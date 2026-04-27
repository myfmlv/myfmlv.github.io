import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..')
const defaultKisEnv = path.resolve(projectRoot, '../../DBbot/kis-api/kis-api.env')
const dataDir = path.resolve(projectRoot, 'data')
const krxDir = path.resolve(dataDir, 'krx')
const cacheDir = path.resolve(projectRoot, '.cache')
const tokenCachePath = path.join(cacheDir, 'kis-token.json')

function getArg(name, fallback) {
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

async function loadEnv(envPath) {
  try {
    return readEnv(await readFile(envPath, 'utf8'))
  } catch (error) {
    if (process.env.KIS_APP_KEY && process.env.KIS_APP_SECRET) {
      return {
        KIS_APP_KEY: process.env.KIS_APP_KEY,
        KIS_APP_SECRET: process.env.KIS_APP_SECRET,
      }
    }

    throw error
  }
}

function splitCsvLine(line) {
  const cells = []
  let cell = ''
  let quoted = false

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]
    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        cell += '"'
        index += 1
      } else {
        quoted = !quoted
      }
      continue
    }
    if (char === ',' && !quoted) {
      cells.push(cell.trim())
      cell = ''
      continue
    }
    cell += char
  }

  cells.push(cell.trim())
  return cells
}

function parseTickers(csvText) {
  const lines = csvText.replace(/^\uFEFF/, '').split(/\r?\n/).filter(Boolean)
  const headers = splitCsvLine(lines[0] ?? '').map((header) => header.replace(/^\uFEFF/, ''))
  const tickerIndex = headers.indexOf('티커')
  if (tickerIndex < 0) throw new Error('KRX CSV에서 티커 컬럼을 찾지 못했습니다.')
  return [...new Set(lines.slice(1).map((line) => splitCsvLine(line)[tickerIndex]).filter(Boolean))]
}

async function readExistingMeta() {
  try {
    return JSON.parse(await readFile(path.join(dataDir, 'stock-meta.json'), 'utf8'))
  } catch {
    return {}
  }
}

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

async function getToken(env) {
  try {
    const cached = JSON.parse(await readFile(tokenCachePath, 'utf8'))
    if (cached.access_token && cached.expiresAt && Date.parse(cached.expiresAt) > Date.now() + 60_000) {
      return cached.access_token
    }
  } catch {
    // Token cache is optional and intentionally not committed.
  }

  const response = await fetch('https://openapi.koreainvestment.com:9443/oauth2/tokenP', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'client_credentials',
      appkey: env.KIS_APP_KEY,
      appsecret: env.KIS_APP_SECRET,
    }),
  })
  if (!response.ok) throw new Error(`KIS token failed: ${response.status}`)
  const payload = await response.json()
  const expiresIn = Number(payload.expires_in) || 60 * 60 * 24
  await mkdir(cacheDir, { recursive: true })
  await writeFile(tokenCachePath, `${JSON.stringify({
    access_token: payload.access_token,
    expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
  }, null, 2)}\n`, { mode: 0o600 })
  return payload.access_token
}

async function fetchStockMeta(ticker, token, env) {
  const url = new URL('https://openapi.koreainvestment.com:9443/uapi/domestic-stock/v1/quotations/inquire-price')
  url.searchParams.set('FID_COND_MRKT_DIV_CODE', 'J')
  url.searchParams.set('FID_INPUT_ISCD', ticker)

  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      authorization: `Bearer ${token}`,
      appkey: env.KIS_APP_KEY,
      appsecret: env.KIS_APP_SECRET,
      tr_id: 'FHKST01010100',
      custtype: 'P',
    },
  })
  if (!response.ok) throw new Error(`KIS price failed ${ticker}: ${response.status}`)
  const payload = await response.json()
  const output = payload.output ?? {}
  const marketCapEok = Number(String(output.hts_avls ?? '').replace(/,/g, '')) || 0
  const marketCap = marketCapEok * 100_000_000
  return {
    ticker,
    name: output.hts_kor_isnm,
    marketCap,
    marketCapLabel: marketCapEok >= 10_000 ? `${Math.round(marketCapEok / 10_000).toLocaleString('ko-KR')}조` : `${marketCapEok.toLocaleString('ko-KR')}억`,
    price: Number(String(output.stck_prpr ?? '').replace(/,/g, '')) || null,
    changeRate: Number(output.prdy_ctrt) || null,
    updatedAt: new Date().toISOString(),
  }
}

const envPath = path.resolve(getArg('env', defaultKisEnv))
const limit = Number(getArg('limit', '0')) || Infinity
const delayMs = Number(getArg('delay-ms', '120'))
const refresh = hasFlag('refresh')
const env = await loadEnv(envPath)

if (!env.KIS_APP_KEY || !env.KIS_APP_SECRET) {
  throw new Error(`KIS_APP_KEY/KIS_APP_SECRET 값이 없습니다: ${envPath}`)
}

const index = JSON.parse(await readFile(path.join(krxDir, 'index.json'), 'utf8'))
const latest = index.latest || index.files?.[0]?.date
const file = index.files?.find((item) => item.date === latest)?.file
if (!file) throw new Error('KRX index.json에서 최신 CSV 파일을 찾지 못했습니다.')

const existing = await readExistingMeta()
const allTickers = parseTickers(await readFile(path.join(krxDir, file), 'utf8'))
const tickers = allTickers
  .filter((ticker) => refresh || !existing[ticker]?.marketCap)
  .slice(0, limit)

if (tickers.length === 0) {
  console.log(`KIS stock meta skipped: missing tickers 0/${allTickers.length}`)
  process.exit(0)
}

const token = await getToken(env)
const result = { ...existing }

for (const [index, ticker] of tickers.entries()) {
  try {
    const item = await fetchStockMeta(ticker, token, env)
    if (item.marketCap) result[ticker] = item
  } catch (error) {
    console.error(`${ticker}: ${error.message}`)
  }
  if (index < tickers.length - 1) await sleep(delayMs)
}

await mkdir(dataDir, { recursive: true })
await writeFile(path.join(dataDir, 'stock-meta.json'), `${JSON.stringify(result, null, 2)}\n`)
console.log(`Synced KIS stock meta: fetched ${tickers.length}, total ${Object.keys(result).length}`)
