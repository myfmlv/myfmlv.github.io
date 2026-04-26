import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..')
const dataPath = path.join(projectRoot, 'data/stock-meta.json')
const NAVER_CHART_BASE_URL = 'https://api.stock.naver.com/chart/domestic/item'
const CHART_CONCURRENCY = 12

function getArg(name, fallback) {
  const prefix = `--${name}=`
  const value = process.argv.find((arg) => arg.startsWith(prefix))
  return value ? value.slice(prefix.length) : fallback
}

function numberValue(value) {
  return Number(String(value ?? '').replace(/,/g, '')) || 0
}

function roundedNumber(value) {
  const number = Number(value)
  if (!Number.isFinite(number)) return 0
  return Math.round(number * 100) / 100
}

function normalizeChart(payload) {
  const candles = (Array.isArray(payload?.priceInfos) ? payload.priceInfos : [])
    .map((item) => ({
      date: String(item.localDate ?? ''),
      open: roundedNumber(item.openPrice),
      high: roundedNumber(item.highPrice),
      low: roundedNumber(item.lowPrice),
      close: roundedNumber(item.closePrice),
      volume: numberValue(item.accumulatedTradingVolume),
    }))
    .filter((item) => /^\d{8}$/.test(item.date) && item.close > 0)
    .slice(-60)

  const latest = candles.at(-1) ?? null
  const previousClose = candles.at(-2)?.close
  const changeRate = latest && previousClose
    ? Math.round(((latest.close - previousClose) / previousClose) * 10000) / 100
    : null

  return {
    priceHistory: candles.map((item) => [item.date, item.close]),
    dayTrend: latest ? [latest.open, latest.close].filter((value) => value > 0) : [],
    latestCandle: latest,
    changeRate,
  }
}

async function fetchChart(ticker) {
  const response = await fetch(`${NAVER_CHART_BASE_URL}/${ticker}?periodType=dayCandle`, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'Mozilla/5.0',
    },
  })
  if (!response.ok) throw new Error(`Naver chart failed ${ticker}: ${response.status}`)
  const chart = normalizeChart(await response.json())
  if (chart.priceHistory.length === 0) throw new Error(`Naver chart empty ${ticker}`)
  return chart
}

async function mapWithConcurrency(items, limit, mapper) {
  const results = Array(items.length)
  let nextIndex = 0

  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex
      nextIndex += 1
      results[index] = await mapper(items[index], index)
    }
  }

  await Promise.all(Array.from({ length: limit }, worker))
  return results
}

const limit = Number(getArg('limit', '0')) || Infinity
const payload = JSON.parse(await readFile(dataPath, 'utf8'))
const entries = Object.entries(payload)
  .map(([ticker, value]) => [String(ticker).padStart(6, '0'), value])
  .filter(([, value]) => value?.name)
  .slice(0, limit)

const result = { ...payload }

await mapWithConcurrency(entries, CHART_CONCURRENCY, async ([ticker, value], index) => {
  try {
    const chart = await fetchChart(ticker)
    const latestPrice = chart.latestCandle?.close || Number(value.price) || null
    result[ticker] = {
      ...value,
      ticker,
      price: latestPrice,
      changeRate: chart.changeRate ?? Number(value.changeRate) ?? 0,
      priceHistory: chart.priceHistory,
      dayTrend: chart.dayTrend,
      latestCandle: chart.latestCandle,
      chartSource: 'Naver chart domestic dayCandle',
      chartUpdatedAt: new Date().toISOString(),
    }
  } catch (error) {
    console.warn(`${ticker}: ${error.message}`)
  }

  if ((index + 1) % 200 === 0) console.log(`Fetched stock charts ${index + 1}/${entries.length}`)
})

await writeFile(dataPath, `${JSON.stringify(result, null, 2)}\n`)
const chartCount = Object.values(result).filter((item) => Array.isArray(item.priceHistory) && item.priceHistory.length > 0).length
console.log(`Synced stock charts: ${chartCount}/${Object.keys(result).length}`)
