import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..')
const outputPath = path.join(projectRoot, 'data/naver-market.json')
const NAVER_BASE_URL = 'https://stock.naver.com/api'
const NAVER_CHART_FOREIGN_URL = 'https://api.stock.naver.com/chart/foreign/item'
const HEADERS = {
  Accept: 'application/json',
  'User-Agent': 'Mozilla/5.0',
}

function numberValue(value) {
  return Number(String(value ?? '').replace(/,/g, '')) || 0
}

function roundedNumber(value) {
  const number = Number(value)
  if (!Number.isFinite(number)) return 0
  return Math.round(number * 100) / 100
}

async function fetchJson(url) {
  const response = await fetch(url, { headers: HEADERS })
  if (!response.ok) throw new Error(`${url} failed: ${response.status}`)
  return response.json()
}

function normalizeDomesticStock(item, rank) {
  const ticker = String(item.itemcode ?? item.itemCode ?? item.reutersCode ?? '').padStart(6, '0')
  return {
    rank,
    ticker,
    name: String(item.itemname ?? item.itemName ?? ''),
    market: item.sosok === '1' ? 'KOSDAQ' : item.sosok === '2' ? 'KONEX' : 'KOSPI',
    price: numberValue(item.nowPrice ?? item.currentPrice),
    changeRate: Number(item.prevChangeRate ?? item.changeRate) || 0,
    changeAmount: numberValue(item.prevChangePrice),
    volume: numberValue(item.tradeVolume ?? item.totalTradeVolume),
    amount: numberValue(item.tradeAmount ?? item.totalTradeAmount),
    marketCap: numberValue(item.marketSum ?? item.totalMarketSum),
    source: 'Naver stock domestic market API',
  }
}

function normalizeForeignStock(item, rank, chart = null) {
  const naverCode = String(item.naverCode ?? item.reutersCode ?? item.itemCode ?? '')
  const symbol = String(item.symbol ?? item.symbolCode ?? naverCode.split('.')[0] ?? '')
  const price = numberValue(item.price ?? item.currentPrice ?? item.closePrice)
  return {
    rank,
    symbol,
    naverCode,
    name: String(item.name ?? item.koreanCodeName ?? item.stockName ?? item.englishCodeName ?? symbol),
    sector: String(item.sector ?? item.reutersIndustryName ?? item.industryCodeType?.industryGroupKor ?? ''),
    price: chart?.latestCandle?.close || price,
    changeRate: Number(item.fluctuationsRatio ?? item.prevChangeRate) || chart?.changeRate || 0,
    amount: numberValue(item.amount ?? item.accumulatedTradingValue),
    volume: numberValue(item.volume ?? item.accumulatedTradingVolume),
    marketCap: numberValue(item.marketCap ?? item.marketValue),
    priceHistory: chart?.priceHistory ?? [],
    dayTrend: chart?.dayTrend ?? [],
    latestCandle: chart?.latestCandle ?? null,
    source: chart ? 'Naver foreign market API + Naver chart dayCandle' : 'Naver foreign market API',
  }
}

function normalizeTheme(item, rank, stocks = []) {
  const amount = numberValue(item.totalAccAmount ?? item.totalTradeAmount)
  return {
    rank,
    no: String(item.no ?? item.upjongThemeCode ?? ''),
    name: String(item.name ?? item.upjongThemeName ?? ''),
    changeRate: Number(item.changeRate ?? item.prevChangeRate) || 0,
    recent3daysChangeRate: Number(item.recent3daysChangeRate) || null,
    totalCount: numberValue(item.totalCnt),
    riseCount: numberValue(item.riseCnt),
    fallCount: numberValue(item.fallCnt),
    steadyCount: numberValue(item.steadyCnt),
    volume: numberValue(item.totalAccQuant ?? item.totalTradeVolume),
    amount,
    marketCap: numberValue(item.totalMarketSum),
    leaderName: String(item.leadingItemName ?? ''),
    leaderTicker: String(item.leadingItemCode ?? ''),
    stocks,
    source: 'Naver stock theme API',
  }
}

async function fetchDomesticStockList(orderType, pageSize = 30) {
  const query = new URLSearchParams({
    tradeType: 'KRX',
    marketType: 'ALL',
    orderType,
    startIdx: '0',
    pageSize: String(pageSize),
  })
  const payload = await fetchJson(`${NAVER_BASE_URL}/domestic/market/stock/default?${query}`)
  return payload.map((item, index) => normalizeDomesticStock(item, index + 1))
}

async function fetchSearchTop(nationType, pageSize = 30) {
  const query = new URLSearchParams({
    nationType,
    startIdx: '0',
    pageSize: String(pageSize),
  })
  return fetchJson(`${NAVER_BASE_URL}/domestic/market/searchTop?${query}`)
}

async function fetchDomesticSearchTop(pageSize = 30) {
  const [stocks, ranks] = await Promise.all([
    fetchDomesticStockList('searchTop', pageSize),
    fetchSearchTop('KOR', pageSize),
  ])
  const rankMap = new Map(ranks.map((item) => [String(item.reutersCode).padStart(6, '0'), item]))
  return stocks.map((item, index) => {
    const rank = rankMap.get(item.ticker)
    return {
      ...item,
      rank: numberValue(rank?.ranking) || index + 1,
      viewCount: numberValue(rank?.sumCount),
      rankedAt: rank?.toRankingAt ?? null,
      source: 'Naver stock searchTop API',
    }
  })
}

async function fetchThemeList(sortType, pageSize = 100, maxPages = 3) {
  const items = []
  for (let startIdx = 0; startIdx < maxPages; startIdx += 1) {
    const query = new URLSearchParams({
      startIdx: String(startIdx),
      pageSize: String(pageSize),
      sortType,
    })
    const payload = await fetchJson(`${NAVER_BASE_URL}/domestic/market/theme/list?${query}`)
    if (!Array.isArray(payload) || payload.length === 0) break
    items.push(...payload)
    if (payload.length < pageSize) break
  }
  return items
}

async function fetchThemeStocks(themeNo, pageSize = 20) {
  if (!themeNo) return []
  const query = new URLSearchParams({
    marketType: 'ALL',
    orderType: 'marketSum',
    startIdx: '0',
    pageSize: String(pageSize),
  })
  const payload = await fetchJson(`${NAVER_BASE_URL}/domestic/market/theme/${encodeURIComponent(themeNo)}/stocklist?${query}`)
  return payload.map((item, index) => normalizeDomesticStock(item, index + 1))
}

async function fetchForeignStockList(orderType, pageSize = 30) {
  const query = new URLSearchParams({
    nation: 'usa',
    tradeType: 'ALL',
    orderType,
    startIdx: '0',
    pageSize: String(pageSize),
  })
  const payload = await fetchJson(`${NAVER_BASE_URL}/foreign/market/stock/global?${query}`)
  return payload.map((item, index) => normalizeForeignStock(item, index + 1))
}

async function fetchForeignPrices(codes) {
  if (codes.length === 0) return new Map()
  const query = new URLSearchParams({ foreignCodes: codes.join(',') })
  const payload = await fetchJson(`${NAVER_BASE_URL}/securityService/integration/price?${query}`)
  return new Map(Object.entries(payload.foreign ?? {}))
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
  return {
    priceHistory: candles.map((item) => [item.date, item.close]),
    dayTrend: latest ? [latest.open, latest.close].filter((value) => value > 0) : [],
    latestCandle: latest,
    changeRate: latest && previousClose ? Math.round(((latest.close - previousClose) / previousClose) * 10000) / 100 : 0,
  }
}

async function fetchForeignChart(code) {
  try {
    const payload = await fetchJson(`${NAVER_CHART_FOREIGN_URL}/${encodeURIComponent(code)}?periodType=dayCandle`)
    const chart = normalizeChart(payload)
    return chart.priceHistory.length > 0 ? chart : null
  } catch {
    return null
  }
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

async function attachForeignCharts(lists) {
  const codeMap = new Map()
  lists.flat().forEach((item) => {
    if (item.naverCode) codeMap.set(item.naverCode, item)
  })

  const charts = await mapWithConcurrency([...codeMap.keys()], 8, async (code) => [code, await fetchForeignChart(code)])
  const chartMap = new Map(charts)

  return lists.map((list) => list.map((item) => normalizeForeignStock(item, item.rank, chartMap.get(item.naverCode))))
}

const [marketCap, tradingAmount, volume, searchTop, allThemes, hotThemes, usMarketCapRaw, usTradingRaw, usVolumeRaw, usSearchRanks] = await Promise.all([
  fetchDomesticStockList('marketSum'),
  fetchDomesticStockList('priceTop'),
  fetchDomesticStockList('quantTop'),
  fetchDomesticSearchTop(),
  fetchThemeList('changeRate'),
  fetchThemeList('totalAccAmount', 50, 1),
  fetchForeignStockList('marketValue'),
  fetchForeignStockList('priceTop'),
  fetchForeignStockList('quantTop'),
  fetchSearchTop('USA'),
])

const usSearchCodes = usSearchRanks
  .map((item) => String(item.reutersCode ?? ''))
  .filter(Boolean)
const usSearchPrices = await fetchForeignPrices(usSearchCodes)
const usSearchRaw = usSearchCodes
  .map((code, index) => {
    const item = usSearchPrices.get(code)
    return item ? normalizeForeignStock(item, index + 1) : null
  })
  .filter(Boolean)

const [usMarketCap, usTradingAmount, usVolume, usSearchTop] = await attachForeignCharts([
  usMarketCapRaw,
  usTradingRaw,
  usVolumeRaw,
  usSearchRaw,
])

const risingThemesRaw = [...allThemes]
  .sort((a, b) => Number(b.changeRate) - Number(a.changeRate))
  .slice(0, 10)
const fallingThemesRaw = [...allThemes]
  .filter((item) => Number(item.changeRate) < 0)
  .sort((a, b) => Number(a.changeRate) - Number(b.changeRate))
  .slice(0, 10)
const hotThemesRaw = [...hotThemes].slice(0, 10)

const themeNos = [...new Set([...risingThemesRaw, ...fallingThemesRaw, ...hotThemesRaw].map((item) => String(item.no)).filter(Boolean))]
const themeStockEntries = await mapWithConcurrency(themeNos, 6, async (no) => [no, await fetchThemeStocks(no)])
const themeStockMap = new Map(themeStockEntries)

function normalizeThemeList(items) {
  return items.map((item, index) => normalizeTheme(item, index + 1, themeStockMap.get(String(item.no)) ?? []))
}

const payload = {
  generatedAt: new Date().toISOString(),
  source: [
    `${NAVER_BASE_URL}/domestic/market/stock/default`,
    `${NAVER_BASE_URL}/domestic/market/searchTop`,
    `${NAVER_BASE_URL}/domestic/market/theme/list`,
    `${NAVER_BASE_URL}/foreign/market/stock/global`,
    `${NAVER_CHART_FOREIGN_URL}/{code}?periodType=dayCandle`,
  ],
  domestic: {
    marketCap,
    tradingAmount,
    volume,
    searchTop,
  },
  themes: {
    rising: normalizeThemeList(risingThemesRaw),
    falling: normalizeThemeList(fallingThemesRaw),
    hot: normalizeThemeList(hotThemesRaw),
  },
  us: {
    marketCap: usMarketCap,
    tradingAmount: usTradingAmount,
    volume: usVolume,
    searchTop: usSearchTop,
  },
}

await mkdir(path.dirname(outputPath), { recursive: true })
await writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`)

console.log(`Synced Naver market data -> ${outputPath}`)
console.log(`Domestic rankings: ${marketCap.length}/${tradingAmount.length}/${searchTop.length}`)
console.log(`Themes: ${payload.themes.rising.length}/${payload.themes.falling.length}/${payload.themes.hot.length}`)
console.log(`US rankings: ${usMarketCap.length}/${usTradingAmount.length}/${usSearchTop.length}`)
