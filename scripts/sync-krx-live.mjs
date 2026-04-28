import { copyFile, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..')
const krxDir = path.join(projectRoot, 'data/krx')
const cacheRoot = path.join(projectRoot, '.cache/krx-live')
const cacheKrxDir = path.join(cacheRoot, 'krx')
const defaultEnvCandidates = [
  path.join(projectRoot, 'telegram/.env.krx'),
  path.resolve(projectRoot, '../../Telegram/.env.krx'),
]

function getArg(name, fallback = null) {
  const prefix = `--${name}=`
  const value = process.argv.find((arg) => arg.startsWith(prefix))
  return value ? value.slice(prefix.length) : fallback
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`)
}

function readEnv(text) {
  return Object.fromEntries(text.split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#') && line.includes('='))
    .map((line) => {
      const [key, ...rest] = line.split('=')
      return [key.trim(), rest.join('=').trim().replace(/^['"]|['"]$/g, '')]
    }))
}

function ymdToDate(value) {
  return new Date(Date.UTC(
    Number(value.slice(0, 4)),
    Number(value.slice(4, 6)) - 1,
    Number(value.slice(6, 8)),
  ))
}

function formatYmd(date) {
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0'),
  ].join('')
}

function addDays(value, days) {
  const date = ymdToDate(value)
  date.setUTCDate(date.getUTCDate() + days)
  return formatYmd(date)
}

function compareYmd(a, b) {
  return String(a).localeCompare(String(b))
}

function isWeekday(value) {
  const day = ymdToDate(value).getUTCDay()
  return day >= 1 && day <= 5
}

function previousWeekday(value) {
  let current = value
  do {
    current = addDays(current, -1)
  } while (!isWeekday(current))
  return current
}

function nextDate(value) {
  return addDays(value, 1)
}

function kstParts(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now)
  return Object.fromEntries(parts.map((part) => [part.type, part.value]))
}

function latestSettledKrxDate(now = new Date()) {
  const parts = kstParts(now)
  const today = `${parts.year}${parts.month}${parts.day}`
  const hour = Number(parts.hour)
  const minute = Number(parts.minute)
  const afterCloseUpdateWindow = hour > 18 || (hour === 18 && minute >= 30)

  if (!isWeekday(today)) return previousWeekday(nextDate(today))
  return afterCloseUpdateWindow ? today : previousWeekday(today)
}

async function latestIndexedKrxDate() {
  try {
    const index = JSON.parse(await readFile(path.join(krxDir, 'index.json'), 'utf8'))
    return index.latest ?? index.files?.[0]?.date ?? null
  } catch {
    return null
  }
}

async function existingKrxCsvFiles() {
  try {
    return (await readdir(krxDir))
      .filter((fileName) => /^krx_\d{8}\.csv$/.test(fileName))
      .sort()
  } catch {
    return []
  }
}

function resolveEnvPath() {
  const explicit = getArg('env') || process.env.KRX_ENV_FILE
  if (explicit) return path.resolve(explicit)
  return defaultEnvCandidates.find((candidate) => fs.existsSync(candidate)) ?? defaultEnvCandidates[0]
}

async function hasKrxCredentials(envPath) {
  if (process.env.KRX_USERNAME && process.env.KRX_PASSWORD) return true
  try {
    const env = readEnv(await readFile(envPath, 'utf8'))
    return Boolean(env.KRX_USERNAME && env.KRX_PASSWORD)
  } catch {
    return false
  }
}

function run(command, args, options = {}) {
  console.log(`\n> ${command} ${args.join(' ')}`)
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: {
      ...process.env,
      TZ: 'Asia/Seoul',
      ...options.env,
    },
  })
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed with exit code ${result.status}`)
  }
}

function ensurePythonPlaywright(python) {
  const result = spawnSync(python, ['-c', 'import playwright'], {
    cwd: projectRoot,
    stdio: 'pipe',
    shell: process.platform === 'win32',
  })
  if (result.status !== 0) {
    throw new Error(`Python Playwright가 없습니다. ${python} -m pip install playwright 후 다시 실행하세요.`)
  }
}

async function prepareCacheDir() {
  await rm(cacheKrxDir, { recursive: true, force: true })
  await mkdir(cacheKrxDir, { recursive: true })

  for (const fileName of await existingKrxCsvFiles()) {
    await copyFile(path.join(krxDir, fileName), path.join(cacheKrxDir, fileName))
  }
}

async function krxCsvDates(directory) {
  return (await readdir(directory))
    .map((fileName) => fileName.match(/^krx_(\d{8})\.csv$/)?.[1])
    .filter(Boolean)
    .sort()
}

const envPath = resolveEnvPath()
const python = getArg('python', process.env.PYTHON || 'python3')
const latest = await latestIndexedKrxDate()
const defaultStart = latest ? nextDate(latest) : latestSettledKrxDate()
const start = getArg('start', defaultStart)
const end = getArg('end', latestSettledKrxDate())
const force = hasFlag('force')

if (!/^\d{8}$/.test(start) || !/^\d{8}$/.test(end)) {
  throw new Error(`start/end must be YYYYMMDD. start=${start}, end=${end}`)
}

await mkdir(cacheRoot, { recursive: true })

if (!(await hasKrxCredentials(envPath))) {
  throw new Error(`KRX_USERNAME/KRX_PASSWORD가 없습니다. GitHub Secrets 또는 ${envPath}에 설정하세요.`)
}

ensurePythonPlaywright(python)
await prepareCacheDir()

if (!force && compareYmd(start, end) > 0) {
  await writeFile(path.join(cacheRoot, 'manifest.json'), `${JSON.stringify({
    generatedAt: new Date().toISOString(),
    status: 'skipped',
    reason: 'KRX CSV already covers the latest settled trading date',
    latest,
    expectedLatestTradeDate: end,
  }, null, 2)}\n`)
  console.log(`KRX live sync skipped: latest=${latest}, expected=${end}`)
  process.exit(0)
}

const commonPythonArgs = [
  `--env-file=${envPath}`,
]

const useHeadless = process.env.KRX_HEADLESS === '0'
  ? false
  : Boolean(process.env.GITHUB_ACTIONS || process.env.KRX_HEADLESS === '1' || hasFlag('headless'))

if (useHeadless) {
  commonPythonArgs.push('--headless')
}

if (process.env.KRX_BROWSER_CHANNEL !== undefined) {
  commonPythonArgs.push(`--browser-channel=${process.env.KRX_BROWSER_CHANNEL}`)
}

run(python, [
  'telegram/scripts/download_krx_pension_netbuys.py',
  `--start=${start}`,
  `--end=${end}`,
  `--output-dir=${cacheKrxDir}`,
  ...commonPythonArgs,
])

const datesAfterDownload = await krxCsvDates(cacheKrxDir)
const latestAfterDownload = datesAfterDownload.at(-1)

if (!latestAfterDownload) {
  throw new Error('KRX live sync produced no CSV files.')
}

if (compareYmd(latestAfterDownload, latest ?? '') <= 0 && compareYmd(start, end) <= 0) {
  await writeFile(path.join(cacheRoot, 'manifest.json'), `${JSON.stringify({
    generatedAt: new Date().toISOString(),
    status: 'no-new-trading-day',
    start,
    end,
    latest: latestAfterDownload,
    expectedLatestTradeDate: latestAfterDownload,
    reason: 'KRX returned no rows for the attempted dates. Treating them as non-trading or not-yet-published days.',
  }, null, 2)}\n`)
  console.warn(`KRX live sync found no newer trading day: latest=${latestAfterDownload}, attempted=${start}-${end}`)
  process.exit(0)
}

run(python, [
  'telegram/scripts/download_krx_stock_meta.py',
  `--date=${latestAfterDownload}`,
  `--output-dir=${cacheKrxDir}`,
  ...commonPythonArgs,
])

run('node', ['scripts/sync-krx-data.mjs', `--source=${cacheKrxDir}`])

await writeFile(path.join(cacheRoot, 'manifest.json'), `${JSON.stringify({
  generatedAt: new Date().toISOString(),
  status: 'ok',
  start,
  end,
  previousLatest: latest,
  latest: latestAfterDownload,
  expectedLatestTradeDate: end,
}, null, 2)}\n`)

console.log(`KRX live sync completed: ${latest ?? '-'} -> ${latestAfterDownload}`)
