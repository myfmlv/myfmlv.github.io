import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..')
const dataDir = path.resolve(projectRoot, 'data')
const NAVER_CHART_BASE_URL = 'https://api.stock.naver.com/chart/foreign/item'
const YAHOO_CHART_BASE_URL = 'https://query1.finance.yahoo.com/v8/finance/chart'
const HISTORY_LENGTH = 61

const baseStocks = [
  { symbol: 'NVDA', naverCode: 'NVDA.O', name: 'NVIDIA', sector: 'AI 반도체', marketCap: '4.35T', popularity: 98 },
  { symbol: 'MSFT', naverCode: 'MSFT.O', name: 'Microsoft', sector: '클라우드', marketCap: '3.79T', popularity: 91 },
  { symbol: 'AAPL', naverCode: 'AAPL.O', name: 'Apple', sector: '소비자기술', marketCap: '3.67T', popularity: 87 },
  { symbol: 'AMZN', naverCode: 'AMZN.O', name: 'Amazon', sector: '커머스·클라우드', marketCap: '2.44T', popularity: 84 },
  { symbol: 'GOOGL', naverCode: 'GOOGL.O', name: 'Alphabet', sector: '검색·AI', marketCap: '2.27T', popularity: 82 },
  { symbol: 'META', naverCode: 'META.O', name: 'Meta Platforms', sector: '소셜·AI', marketCap: '1.62T', popularity: 80 },
  { symbol: 'TSLA', naverCode: 'TSLA.O', name: 'Tesla', sector: '전기차', marketCap: '1.08T', popularity: 96 },
  { symbol: 'AVGO', naverCode: 'AVGO.O', name: 'Broadcom', sector: '반도체', marketCap: '1.55T', popularity: 74 },
  { symbol: 'BRK.B', naverCode: 'BRKb', name: 'Berkshire Hathaway', sector: '복합지주', marketCap: '1.15T', popularity: 62 },
  { symbol: 'LLY', naverCode: 'LLY', name: 'Eli Lilly', sector: '비만치료제', marketCap: '1.07T', popularity: 78 },
  { symbol: 'JPM', naverCode: 'JPM', name: 'JPMorgan Chase', sector: '은행', marketCap: '846B', popularity: 68 },
  { symbol: 'V', naverCode: 'V', name: 'Visa', sector: '결제', marketCap: '681B', popularity: 66 },
  { symbol: 'MA', naverCode: 'MA', name: 'Mastercard', sector: '결제', marketCap: '529B', popularity: 61 },
  { symbol: 'NFLX', naverCode: 'NFLX.O', name: 'Netflix', sector: '스트리밍', marketCap: '492B', popularity: 73 },
  { symbol: 'COST', naverCode: 'COST.O', name: 'Costco', sector: '소매', marketCap: '449B', popularity: 58 },
  { symbol: 'ORCL', naverCode: 'ORCL.K', name: 'Oracle', sector: '클라우드', marketCap: '805B', popularity: 79 },
  { symbol: 'AMD', naverCode: 'AMD.O', name: 'AMD', sector: 'AI 반도체', marketCap: '366B', popularity: 89 },
  { symbol: 'PLTR', naverCode: 'PLTR.O', name: 'Palantir', sector: 'AI 소프트웨어', marketCap: '482B', popularity: 95 },
  { symbol: 'CRM', naverCode: 'CRM', name: 'Salesforce', sector: 'SaaS', marketCap: '274B', popularity: 55 },
  { symbol: 'COIN', naverCode: 'COIN.O', name: 'Coinbase', sector: '가상자산', marketCap: '99B', popularity: 88 },
  { symbol: 'SMCI', naverCode: 'SMCI.O', name: 'Super Micro Computer', sector: 'AI 서버', marketCap: '43B', popularity: 86 },
  { symbol: 'MU', naverCode: 'MU.O', name: 'Micron', sector: '메모리', marketCap: '193B', popularity: 76 },
  { symbol: 'HOOD', naverCode: 'HOOD.O', name: 'Robinhood', sector: '증권 플랫폼', marketCap: '122B', popularity: 84 },
  { symbol: 'SHOP', naverCode: 'SHOP.O', name: 'Shopify', sector: '커머스 SaaS', marketCap: '210B', popularity: 72 },
  { symbol: 'ABCL', naverCode: 'ABCL.O', name: 'AbCellera Biologics', sector: '바이오테크', marketCap: '1.2B', popularity: 42 },
]

function roundedNumber(value) {
  const number = Number(value)
  if (!Number.isFinite(number)) return 0
  return Math.round(number * 100) / 100
}

function formatAbbrev(value) {
  if (!value) return '0'
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  return Math.round(value).toLocaleString('en-US')
}

function yahooSymbol(symbol) {
  return String(symbol ?? '').replace(/\./g, '-')
}

function normalizeIntraday(payload) {
  const result = payload?.chart?.result?.[0]
  const timestamps = Array.isArray(result?.timestamp) ? result.timestamp : []
  const closes = result?.indicators?.quote?.[0]?.close ?? []
  const points = timestamps
    .map((timestamp, index) => ({
      timestamp: Number(timestamp),
      close: roundedNumber(closes[index]),
    }))
    .filter((item) => Number.isFinite(item.timestamp) && item.close > 0)
    .sort((a, b) => a.timestamp - b.timestamp)

  const buckets = new Map()
  points.forEach((point) => {
    const bucket = Math.floor(point.timestamp / 1200) * 1200
    buckets.set(bucket, point.close)
  })

  return [...buckets.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, close]) => close)
}

function normalizeChart(payload) {
  const candles = (Array.isArray(payload?.priceInfos) ? payload.priceInfos : [])
    .map((item) => ({
      date: String(item.localDate ?? ''),
      open: roundedNumber(item.openPrice),
      high: roundedNumber(item.highPrice),
      low: roundedNumber(item.lowPrice),
      close: roundedNumber(item.closePrice),
      volume: Number(item.accumulatedTradingVolume) || 0,
    }))
    .filter((item) => /^\d{8}$/.test(item.date) && item.close > 0)
    .slice(-HISTORY_LENGTH)

  const latest = candles.at(-1) ?? null
  const previousClose = candles.at(-2)?.close
  return {
    priceHistory: candles.map((item) => [item.date, item.close]),
    dayTrend: latest ? [latest.open, latest.close].filter((value) => value > 0) : [],
    latestCandle: latest,
    changeRate: latest && previousClose ? Math.round(((latest.close - previousClose) / previousClose) * 10000) / 100 : 0,
  }
}

async function fetchChart(code) {
  const response = await fetch(`${NAVER_CHART_BASE_URL}/${encodeURIComponent(code)}?periodType=dayCandle`, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'Mozilla/5.0',
    },
  })
  if (!response.ok) throw new Error(`${code} failed: ${response.status}`)
  const chart = normalizeChart(await response.json())
  if (chart.priceHistory.length === 0) throw new Error(`${code} empty chart`)
  return chart
}

async function fetchIntradayTrend(symbol) {
  const response = await fetch(`${YAHOO_CHART_BASE_URL}/${encodeURIComponent(yahooSymbol(symbol))}?range=1d&interval=5m&includePrePost=false`, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'Mozilla/5.0',
    },
  })
  if (!response.ok) throw new Error(`${symbol} intraday failed: ${response.status}`)
  return normalizeIntraday(await response.json())
}

const stocks = []

for (const item of baseStocks) {
  const chart = await fetchChart(item.naverCode)
  let intradayTrend = []
  try {
    intradayTrend = await fetchIntradayTrend(item.symbol)
  } catch (error) {
    console.warn(`${item.symbol}: intraday skipped: ${error.message}`)
  }
  const price = chart.latestCandle?.close || 0
  const tradingValue = price * (chart.latestCandle?.volume || 0)
  stocks.push({
    ...item,
    price,
    changeRate: chart.changeRate,
    amount: formatAbbrev(tradingValue),
    priceHistory: chart.priceHistory,
    dayTrend: intradayTrend.length >= 2 ? intradayTrend : chart.dayTrend,
    latestCandle: chart.latestCandle,
    chartSource: intradayTrend.length >= 2
      ? 'Naver chart foreign dayCandle + Yahoo 20m intraday'
      : 'Naver chart foreign dayCandle',
    updatedAt: new Date().toISOString(),
  })
}

await mkdir(dataDir, { recursive: true })
await writeFile(path.join(dataDir, 'us-stocks.json'), `${JSON.stringify({
  generatedAt: new Date().toISOString(),
  source: 'https://api.stock.naver.com/chart/foreign/item/{code}?periodType=dayCandle',
  stocks,
}, null, 2)}\n`)

console.log(`Synced US stock charts: ${stocks.length}`)
