import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const updateStatusPath = path.join(root, 'data/update-status.json')
const defaultKrxSourceDir = path.resolve(root, '../../Telegram/data/krx')
const defaultKisEnvPath = path.resolve(root, '../../DBbot/kis-api/kis-api.env')
const updateStartedAt = Date.now()
const defaultKrxEnvCandidates = [
  path.resolve(root, 'telegram/.env.krx'),
  path.resolve(root, '../../Telegram/.env.krx'),
]

const results = []

function exists(relativePath) {
  return fs.existsSync(path.join(root, relativePath))
}

function isDirectory(targetPath) {
  try {
    return fs.statSync(targetPath).isDirectory()
  } catch {
    return false
  }
}

function hasJsonContent(relativePath) {
  try {
    return fs.readFileSync(path.join(root, relativePath), 'utf8').trim().length > 0
  } catch {
    return false
  }
}

function hasKisCredentials() {
  return Boolean(
    (process.env.KIS_APP_KEY && process.env.KIS_APP_SECRET) ||
    fs.existsSync(defaultKisEnvPath),
  )
}

function hasKrxSourceDir() {
  return isDirectory(process.env.KRX_SOURCE_DIR || defaultKrxSourceDir)
}

function readEnvFile(envPath) {
  try {
    return Object.fromEntries(fs.readFileSync(envPath, 'utf8').split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#') && line.includes('='))
      .map((line) => {
        const [key, ...rest] = line.split('=')
        return [key.trim(), rest.join('=').trim().replace(/^['"]|['"]$/g, '')]
      }))
  } catch {
    return {}
  }
}

function hasKrxLiveCredentials() {
  if (process.env.KRX_USERNAME && process.env.KRX_PASSWORD) return true
  return defaultKrxEnvCandidates.some((envPath) => {
    const env = readEnvFile(envPath)
    return Boolean(env.KRX_USERNAME && env.KRX_PASSWORD)
  })
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

function latestSettledKrxDate(now = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now).map((part) => [part.type, part.value]))
  const today = `${parts.year}${parts.month}${parts.day}`
  const hour = Number(parts.hour)
  const minute = Number(parts.minute)
  const afterCloseUpdateWindow = hour > 18 || (hour === 18 && minute >= 30)

  if (!isWeekday(today)) return previousWeekday(nextDate(today))
  return afterCloseUpdateWindow ? today : previousWeekday(today)
}

function readJson(relativePath) {
  try {
    return JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'))
  } catch {
    return null
  }
}

function krxFreshnessSummary() {
  const index = readJson('data/krx/index.json')
  const liveManifest = readJson('.cache/krx-live/manifest.json')
  const liveManifestTime = Date.parse(liveManifest?.generatedAt)
  const freshLiveManifest = Number.isFinite(liveManifestTime) && liveManifestTime >= updateStartedAt - 60_000
  const expectedKrxLatestTradeDate = freshLiveManifest && liveManifest?.expectedLatestTradeDate
    ? liveManifest.expectedLatestTradeDate
    : latestSettledKrxDate()
  const krxLatest = index?.latest ?? null
  return {
    marketCloseUpdateKst: '18:30',
    expectedKrxLatestTradeDate,
    krxLatest,
    krxIsCurrent: Boolean(krxLatest && krxLatest >= expectedKrxLatestTradeDate),
    krxLiveSyncStatus: freshLiveManifest ? liveManifest.status : null,
  }
}

function run(command, args) {
  console.log(`\n> ${command} ${args.join(' ')}`)

  const result = spawnSync(command, args, {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: {
      ...process.env,
      TZ: 'Asia/Seoul',
    },
  })

  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed with exit code ${result.status}`)
  }
}

function writeUpdateManifest(status, extra = {}) {
  fs.mkdirSync(path.dirname(updateStatusPath), { recursive: true })
  fs.writeFileSync(updateStatusPath, `${JSON.stringify({
    generatedAt: new Date().toISOString(),
    timezone: 'Asia/Seoul',
    source: process.env.GITHUB_ACTIONS ? 'GitHub Actions' : 'Local update:data',
    status,
    ...krxFreshnessSummary(),
    ...extra,
  }, null, 2)}\n`, 'utf8')
}

const tasks = [
  {
    name: 'Sync KRX data from KRX after close',
    file: 'scripts/sync-krx-live.mjs',
    args: ['scripts/sync-krx-live.mjs'],
    required: false,
    shouldRun: hasKrxLiveCredentials,
    skipReason: 'KRX_USERNAME/KRX_PASSWORD not found for direct KRX after-close sync',
  },
  {
    name: 'Sync KRX CSV data from local source',
    file: 'scripts/sync-krx-data.mjs',
    args: ['scripts/sync-krx-data.mjs'],
    required: false,
    shouldRun: () => !hasKrxLiveCredentials() && hasKrxSourceDir(),
    skipStatus: () => hasKrxLiveCredentials() ? 'not-applicable' : 'skipped',
    skipReason: 'KRX_SOURCE_DIR or local Telegram KRX source directory not found',
  },
  {
    name: 'Fetch Naver market data',
    file: 'scripts/sync-naver-market.mjs',
    args: ['scripts/sync-naver-market.mjs'],
    required: true,
  },
  {
    name: 'Update market index',
    file: 'scripts/sync-market-index.mjs',
    args: ['scripts/sync-market-index.mjs'],
    required: true,
  },
  {
    name: 'Update US stock data',
    file: 'scripts/sync-us-stocks.mjs',
    args: ['scripts/sync-us-stocks.mjs'],
    required: true,
  },
  {
    name: 'Update ETF universe',
    file: 'scripts/sync-etf-universe.mjs',
    args: ['scripts/sync-etf-universe.mjs'],
    required: true,
  },
  {
    name: 'Sync KIS stock metadata',
    file: 'scripts/sync-kis-stock-meta.mjs',
    args: ['scripts/sync-kis-stock-meta.mjs'],
    required: false,
    shouldRun: hasKisCredentials,
    skipReason: 'KIS_APP_KEY/KIS_APP_SECRET or local KIS env file not found',
  },
  {
    name: 'Update stock charts',
    file: 'scripts/sync-stock-charts.mjs',
    args: ['scripts/sync-stock-charts.mjs'],
    required: false,
    shouldRun: () => hasJsonContent('data/stock-meta.json'),
    skipReason: 'data/stock-meta.json is empty or missing',
  },
]

try {
  for (const task of tasks) {
    if (!exists(task.file)) {
      const message = `${task.name}: ${task.file} not found`
      if (task.required) throw new Error(message)
      console.warn(`[warn] ${message}, skipped`)
      results.push({ name: task.name, status: 'skipped', reason: message })
      continue
    }

    if (task.shouldRun && !task.shouldRun()) {
      console.warn(`[warn] ${task.name}: ${task.skipReason}, skipped`)
      const skipStatus = typeof task.skipStatus === 'function' ? task.skipStatus() : 'skipped'
      results.push({ name: task.name, status: skipStatus, reason: task.skipReason })
      continue
    }

    run('node', task.args)
    results.push({ name: task.name, status: 'ok' })
  }

  const ran = results.filter((item) => item.status === 'ok')
  if (ran.length === 0) {
    throw new Error('No update scripts ran.')
  }

  const status = results.some((item) => item.status === 'skipped') ? 'partial' : 'ok'
  writeUpdateManifest(status, { tasks: results })

  console.log('\n[ok] Data update completed')
  if (status === 'partial') {
    console.log('[warn] Some optional update tasks were skipped. See data/update-status.json.')
  }
} catch (error) {
  writeUpdateManifest('error', {
    error: error?.message || String(error),
    tasks: results,
  })
  console.error(`\n[fail] Data update failed: ${error?.message || String(error)}`)
  process.exit(1)
}
