import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..')
const dataPath = path.join(projectRoot, 'data/stock-meta.json')
const NAVER_CHART_BASE_URL = 'https://api.stock.naver.com/chart/domestic/item'
const CHART_CONCURRENCY = 12
const HISTORY_LENGTH = 61

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
    .map((item) => {
      const close = roundedNumber(item.closePrice)
      const volume = numberValue(item.accumulatedTradingVolume)
      const amount = numberValue(item.accumulatedTradingValue ?? item.accumulatedTradingAmount)
        || Math.round(close * volume)
      return {
        date: String(item.localDate ?? ''),
        open: roundedNumber(item.openPrice),
        high: roundedNumber(item.highPrice),
        low: roundedNumber(item.lowPrice),
        close,
        volume,
        amount,
      }
    })
    .filter((item) => /^\d{8}$/.test(item.date) && item.close > 0)
    .slice(-HISTORY_LENGTH)

  const latest = candles.at(-1) ?? null
  const previousClose = candles.at(-2)?.close
  const changeRate = latest && previousClose
    ? Math.round(((latest.close - previousClose) / previousClose) * 10000) / 100
    : null

  return {
    priceHistory: candles.map((item) => [item.date, item.close]),
    amountHistory: candles.map((item) => [item.date, item.amount]).filter(([, amount]) => amount > 0),
    dayTrend: latest ? [latest.open, latest.close].filter((value) => value > 0) : [],
    latestCandle: latest,
    changeRate,
  }
}

function normalizeMinute10(payload) {
  const items = Array.isArray(payload) ? payload : []
  return items
    .map((item) => ({
      dateTime: String(item.localDateTime ?? ''),
      close: roundedNumber(item.currentPrice ?? item.closePrice),
    }))
    .filter((item) => /^\d{14}$/.test(item.dateTime) && item.close > 0)
    .sort((a, b) => a.dateTime.localeCompare(b.dateTime))
    .map((item) => item.close)
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

async function fetchMinute10Trend(ticker, tradeDate) {
  if (!/^\d{8}$/.test(String(tradeDate ?? ''))) return []
  const response = await fetch(`${NAVER_CHART_BASE_URL}/${ticker}/minute10?startDateTime=${tradeDate}0900&endDateTime=${tradeDate}1600`, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'Mozilla/5.0',
    },
  })
  if (!response.ok) throw new Error(`Naver minute10 failed ${ticker}: ${response.status}`)
  return normalizeMinute10(await response.json())
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
    let minute10Trend = []
    try {
      minute10Trend = await fetchMinute10Trend(ticker, chart.latestCandle?.date)
    } catch (error) {
      console.warn(`${ticker}: minute10 skipped: ${error.message}`)
    }
    const latestPrice = chart.latestCandle?.close || Number(value.price) || null
    result[ticker] = {
      ...value,
      ticker,
      price: latestPrice,
      changeRate: chart.changeRate ?? Number(value.changeRate) ?? 0,
      priceHistory: chart.priceHistory,
      amountHistory: chart.amountHistory,
      dayTrend: minute10Trend.length >= 2 ? minute10Trend : chart.dayTrend,
      latestCandle: chart.latestCandle,
      chartSource: minute10Trend.length >= 2
        ? 'Naver chart domestic dayCandle + minute10'
        : 'Naver chart domestic dayCandle',
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
