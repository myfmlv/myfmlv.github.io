import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..')
const dataDir = path.resolve(projectRoot, 'data')
const NAVER_BASE_URL = 'https://stock.naver.com/api'
const NAVER_CHART_BASE_URL = 'https://api.stock.naver.com/chart/domestic/item'
const WISEREPORT_ETF_BASE_URL = 'https://navercomp.wisereport.co.kr/v2/ETF/index.aspx'
const PAGE_SIZE = 100
const CHART_CONCURRENCY = 8
const HOLDINGS_CONCURRENCY = 6
const HISTORY_LENGTH = 61

const issuerMap = [
  ['KODEX', '삼성자산운용'],
  ['TIGER', '미래에셋자산운용'],
  ['ACE', '한국투자신탁운용'],
  ['SOL', '신한자산운용'],
  ['PLUS', '한화자산운용'],
  ['RISE', 'KB자산운용'],
  ['HANARO', 'NH아문디자산운용'],
  ['KOSEF', '키움투자자산운용'],
  ['TIMEFOLIO', '타임폴리오자산운용'],
  ['KoAct', '삼성액티브자산운용'],
  ['WOORI', '우리자산운용'],
  ['마이다스', '마이다스에셋자산운용'],
]

const holdingTemplates = [
  {
    match: /S&P\s?500|미국S&P|미국 S&P/i,
    holdings: [
      ['NVIDIA', 'NVDA', 7.6],
      ['Apple', 'AAPL', 6.7],
      ['Microsoft', 'MSFT', 4.9],
      ['Amazon', 'AMZN', 3.1],
      ['Meta Platforms', 'META', 2.6],
    ],
  },
  {
    match: /나스닥|NASDAQ/i,
    holdings: [
      ['NVIDIA', 'NVDA', 8.7],
      ['Apple', 'AAPL', 7.6],
      ['Microsoft', 'MSFT', 5.6],
      ['Amazon', 'AMZN', 4.1],
      ['Broadcom', 'AVGO', 3.9],
    ],
  },
  {
    match: /필라델피아|반도체.*미국|SOX/i,
    holdings: [
      ['NVIDIA', 'NVDA', 10.8],
      ['Broadcom', 'AVGO', 8.5],
      ['AMD', 'AMD', 6.7],
      ['Applied Materials', 'AMAT', 5.8],
      ['Micron', 'MU', 4.9],
    ],
  },
  {
    match: /AI전력|전력|전력기기|전력설비|ESS|태양광/i,
    holdings: [
      ['HD현대일렉트릭', '267260', 18.6],
      ['LS ELECTRIC', '010120', 15.2],
      ['효성중공업', '298040', 12.8],
      ['일진전기', '103590', 8.4],
      ['LS', '006260', 7.9],
    ],
  },
  {
    match: /조선/i,
    holdings: [
      ['HD현대중공업', '329180', 24.2],
      ['한화오션', '042660', 21.4],
      ['삼성중공업', '010140', 18.7],
      ['HD한국조선해양', '009540', 12.8],
      ['HD현대미포', '010620', 7.6],
    ],
  },
  {
    match: /뷰티|화장품/i,
    holdings: [
      ['아모레퍼시픽', '090430', 19.4],
      ['LG생활건강', '051900', 15.1],
      ['한국콜마', '161890', 9.8],
      ['코스맥스', '192820', 8.9],
      ['실리콘투', '257720', 7.4],
    ],
  },
  {
    match: /2차전지|배터리|전고체/i,
    holdings: [
      ['LG에너지솔루션', '373220', 18.1],
      ['삼성SDI', '006400', 13.6],
      ['POSCO홀딩스', '005490', 9.2],
      ['에코프로비엠', '247540', 8.5],
      ['포스코퓨처엠', '003670', 7.3],
    ],
  },
  {
    match: /200$|KODEX 200|TIGER 200|코스피200|KOSPI200/i,
    holdings: [
      ['삼성전자', '005930', 25.6],
      ['SK하이닉스', '000660', 10.9],
      ['현대차', '005380', 2.7],
      ['기아', '000270', 2.1],
      ['KB금융', '105560', 1.9],
    ],
  },
  {
    match: /코스닥150|KOSDAQ150/i,
    holdings: [
      ['에코프로비엠', '247540', 8.8],
      ['알테오젠', '196170', 7.4],
      ['HLB', '028300', 5.3],
      ['리노공업', '058470', 4.1],
      ['JYP Ent.', '035900', 3.6],
    ],
  },
]

function numberValue(value) {
  return Number(String(value ?? '').replace(/,/g, '')) || 0
}

function normalizeHoldingName(name) {
  return String(name ?? '').trim().replace(/\s+/g, ' ').toUpperCase()
}

function compactHoldingName(name) {
  return normalizeHoldingName(name)
    .replace(/[.,']/g, '')
    .replace(/\b(COMMON STOCK|ORDINARY SHARES|CLASS [A-Z]|CORPORATION|CORP|INCORPORATED|INC|LIMITED|LTD|COMPANY|CO|PLC)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function addNameTicker(map, name, ticker) {
  if (!name || !ticker) return
  const normalized = normalizeHoldingName(name)
  const compact = compactHoldingName(name)
  if (normalized && !map.has(normalized)) map.set(normalized, String(ticker))
  if (compact && !map.has(compact)) map.set(compact, String(ticker))
}

function lookupHoldingTicker(map, name) {
  return map.get(normalizeHoldingName(name)) ?? map.get(compactHoldingName(name)) ?? ''
}

async function loadStockNameMap() {
  const map = new Map()
  try {
    const payload = JSON.parse(await readFile(path.join(dataDir, 'stock-meta.json'), 'utf8'))
    Object.entries(payload).forEach(([ticker, meta]) => {
      addNameTicker(map, meta?.name, String(ticker).padStart(6, '0'))
    })
  } catch {
    // stock-meta.json is optional for ETF sync; unresolved holdings still keep their names.
  }

  holdingTemplates.flatMap(({ holdings }) => holdings).forEach(([name, ticker]) => {
    addNameTicker(map, name, ticker)
  })

  try {
    const payload = JSON.parse(await readFile(path.join(dataDir, 'us-stocks.json'), 'utf8'))
    ;(payload.stocks ?? []).forEach((item) => {
      addNameTicker(map, item.name, item.symbol)
    })
  } catch {
    // US stock search data is optional for ETF sync.
  }

  try {
    const payload = JSON.parse(await readFile(path.join(dataDir, 'us-symbols.json'), 'utf8'))
    ;(payload.symbols ?? []).forEach((item) => {
      addNameTicker(map, item.name, item.symbol)
    })
  } catch {
    // US symbol data is optional for ETF sync.
  }

  return map
}

function issuerFromName(name) {
  const matched = issuerMap.find(([prefix]) => name.startsWith(prefix))
  return matched?.[1] ?? '운용사 미확인'
}

function inferThemes(item, usListed) {
  const themes = new Set()
  const text = `${item.itemName} ${item.etfType ?? ''}`
  if (usListed) {
    themes.add('국내상장 미국ETF')
    themes.add('미국')
  }
  String(item.etfType ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
    .forEach((value) => themes.add(value))

  const rules = [
    [/S&P\s?500|미국S&P|미국 S&P/i, '미국 대표지수'],
    [/나스닥|NASDAQ/i, '미국 대표지수'],
    [/필라델피아|반도체/i, 'AI 반도체'],
    [/AI전력|전력|전력기기|전력설비|ESS|태양광/i, 'AI 전력'],
    [/조선/i, '조선'],
    [/뷰티|화장품/i, '화장품'],
    [/코스닥/i, '코스닥'],
    [/배당/i, '배당'],
    [/채권|국고채|회사채/i, '채권'],
    [/금\b|금현물|금선물/i, '금'],
    [/원유|WTI|유가/i, '원유'],
    [/인도/i, '인도'],
    [/일본/i, '일본'],
    [/중국|차이나/i, '중국'],
    [/2차전지|배터리|전고체/i, '2차전지'],
    [/로봇/i, '로봇'],
    [/바이오|헬스케어/i, '헬스케어'],
    [/방산|우주|항공/i, '우주항공'],
  ]
  rules.forEach(([pattern, label]) => {
    if (pattern.test(text)) themes.add(label)
  })
  return [...themes]
}

function inferHoldings(item) {
  const matched = holdingTemplates.find(({ match }) => match.test(item.itemName))
  return matched?.holdings ?? []
}

function roundedNumber(value) {
  const number = Number(value)
  if (!Number.isFinite(number)) return 0
  return Math.round(number * 100) / 100
}

function normalizeChart(payload) {
  const priceInfos = Array.isArray(payload?.priceInfos) ? payload.priceInfos : []
  const candles = priceInfos
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
  return {
    history: candles.map((item) => [item.date, item.close]),
    amountHistory: candles.map((item) => [item.date, item.amount]).filter(([, amount]) => amount > 0),
    dayTrend: latest ? [latest.open, latest.close].filter((value) => value > 0) : [],
    latestCandle: latest,
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

async function fetchEtfChart(code) {
  try {
    const payload = await fetchJson(`${NAVER_CHART_BASE_URL}/${code}?periodType=dayCandle`)
    const chart = normalizeChart(payload)
    if (chart.history.length === 0) return null

    try {
      const tradeDate = chart.latestCandle?.date
      if (tradeDate) {
        const minutePayload = await fetchJson(`${NAVER_CHART_BASE_URL}/${code}/minute10?startDateTime=${tradeDate}0900&endDateTime=${tradeDate}1600`)
        const minute10Trend = normalizeMinute10(minutePayload)
        if (minute10Trend.length >= 2) {
          chart.dayTrend = minute10Trend
          chart.source = 'Naver chart domestic dayCandle + minute10'
        }
      }
    } catch (error) {
      console.warn(`ETF minute10 skipped ${code}: ${error.message}`)
    }

    return chart
  } catch (error) {
    console.warn(`ETF chart skipped ${code}: ${error.message}`)
    return null
  }
}

function parseWiseReportHoldings(html, nameToTicker) {
  const match = html.match(/var\s+CU_data\s*=\s*(\{"grid_data":.*?\});/s)
  if (!match) return []

  try {
    const payload = JSON.parse(match[1])
    const rows = Array.isArray(payload.grid_data) ? payload.grid_data : []
    return rows
      .map((row) => {
        const name = String(row.STK_NM_KOR ?? '').trim()
        const ratio = roundedNumber(row.ETF_WEIGHT)
        const quantity = roundedNumber(row.AGMT_STK_CNT)
        if (!name || /설정현금액|원화현금|현금|예수금|CASH/i.test(name)) return null
        if (!ratio && !quantity) return null
        return [name, lookupHoldingTicker(nameToTicker, name), ratio || 0, quantity || 0]
      })
      .filter(Boolean)
      .sort((a, b) => (b[2] || 0) - (a[2] || 0) || Math.abs(b[3] || 0) - Math.abs(a[3] || 0))
  } catch {
    return []
  }
}

async function fetchEtfHoldings(code, nameToTicker) {
  try {
    const query = new URLSearchParams({ cmp_cd: code })
    const html = await fetchText(`${WISEREPORT_ETF_BASE_URL}?${query}`)
    return parseWiseReportHoldings(html, nameToTicker)
  } catch (error) {
    console.warn(`ETF holdings skipped ${code}: ${error.message}`)
    return []
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

function normalizeEtf(item, usListedCodes, chart, holdings) {
  const usListed = usListedCodes.has(item.itemCode)
  const marketCap = numberValue(item.totalNetAssets)
  const chartPrice = chart?.history?.at(-1)?.[1]
  return {
    code: item.itemCode,
    name: item.itemName,
    issuer: issuerFromName(item.itemName),
    category: usListed ? '국내상장 미국ETF' : item.etfType || '국내 ETF',
    themes: inferThemes(item, usListed),
    price: chartPrice || numberValue(item.currentPrice),
    changeRate: Number(item.changeRate) || 0,
    // Naver's ETF endpoint already returns tradingValue in KRW. Multiplying it
    // by 1,000,000 inflated the displayed trading value by one million times.
    amount: numberValue(item.tradingValue),
    marketCap,
    etfType: item.etfType ?? '',
    returnRate1m: Number(item.returnRate1m) || null,
    returnRate3m: Number(item.returnRate3m) || null,
    returnRate6m: Number(item.returnRate6m) || null,
    iNav: Number(item.iNav) || null,
    dayTrend: chart?.dayTrend ?? [],
    priceHistory: chart?.history ?? [],
    amountHistory: chart?.amountHistory ?? [],
    latestCandle: chart?.latestCandle ?? null,
    holdings,
    source: holdings.length > 0 && chart
      ? `Naver stock ETF API + ${chart.source ?? 'Naver chart dayCandle'} + WiseReport ETF holdings`
      : holdings.length > 0
        ? 'Naver stock ETF API + WiseReport ETF holdings'
        : chart
          ? `Naver stock ETF API + ${chart.source ?? 'Naver chart dayCandle'}`
          : 'Naver stock ETF API',
  }
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'Mozilla/5.0',
    },
  })
  if (!response.ok) throw new Error(`${url} failed: ${response.status}`)
  return response.json()
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      Accept: 'text/html',
      'User-Agent': 'Mozilla/5.0',
    },
  })
  if (!response.ok) throw new Error(`${url} failed: ${response.status}`)
  return response.text()
}

async function fetchDomesticEtfs(params = {}) {
  const items = []
  let index = 0
  let hasNext = true

  while (hasNext) {
    const query = new URLSearchParams({
      listingType: 'tradingValueDesc',
      size: String(PAGE_SIZE),
      index: String(index),
      ...params,
    })
    const payload = await fetchJson(`${NAVER_BASE_URL}/stockSecurity/etfs/v1/domestic?${query}`)
    items.push(...(payload.items ?? []))
    hasNext = Boolean(payload.hasNext)
    index += 1
  }

  return items
}

const [allItems, usListedItems, themes, leverageTypes] = await Promise.all([
  fetchDomesticEtfs(),
  fetchDomesticEtfs({ largeCategoryCode: '0201', middleCategoryCode: '0201002' }),
  fetchJson(`${NAVER_BASE_URL}/stockSecurity/etfs/v1/domestic/themes`),
  fetchJson(`${NAVER_BASE_URL}/stockSecurity/etfs/v1/domestic/leverage-types`),
])

const usListedCodes = new Set(usListedItems.map((item) => item.itemCode))
const deduped = new Map()
allItems.forEach((item) => deduped.set(item.itemCode, item))
usListedItems.forEach((item) => deduped.set(item.itemCode, { ...deduped.get(item.itemCode), ...item }))

const rawEtfs = [...deduped.values()]
const stockNameMap = await loadStockNameMap()
const chartEntries = await mapWithConcurrency(rawEtfs, CHART_CONCURRENCY, async (item, index) => {
  const chart = await fetchEtfChart(item.itemCode)
  if ((index + 1) % 100 === 0) console.log(`Fetched ETF charts ${index + 1}/${rawEtfs.length}`)
  return [item.itemCode, chart]
})
const chartByCode = new Map(chartEntries)
const holdingEntries = await mapWithConcurrency(rawEtfs, HOLDINGS_CONCURRENCY, async (item, index) => {
  const holdings = await fetchEtfHoldings(item.itemCode, stockNameMap)
  if ((index + 1) % 100 === 0) console.log(`Fetched ETF holdings ${index + 1}/${rawEtfs.length}`)
  return [item.itemCode, holdings]
})
const holdingsByCode = new Map(holdingEntries)

const etfs = rawEtfs
  .map((item) => normalizeEtf(
    item,
    usListedCodes,
    chartByCode.get(item.itemCode),
    holdingsByCode.get(item.itemCode) ?? [],
  ))
  .sort((a, b) => b.amount - a.amount)

await mkdir(dataDir, { recursive: true })
await writeFile(path.join(dataDir, 'etf-universe.json'), `${JSON.stringify({
  generatedAt: new Date().toISOString(),
  source: [
    'https://stock.naver.com/api/stockSecurity/etfs/v1/domestic',
    'https://api.stock.naver.com/chart/domestic/item/{code}?periodType=dayCandle',
    'https://navercomp.wisereport.co.kr/v2/ETF/index.aspx?cmp_cd={code}',
  ],
  totalCount: etfs.length,
  usListedCount: usListedCodes.size,
  chartCount: etfs.filter((item) => item.priceHistory.length > 0).length,
  holdingCount: etfs.filter((item) => item.holdings.length > 0).length,
  themes,
  leverageTypes,
  etfs,
}, null, 2)}\n`)

console.log(`Synced ${etfs.length} ETF(s), domestic-listed US ETF ${usListedCodes.size}, charts ${etfs.filter((item) => item.priceHistory.length > 0).length}, holdings ${etfs.filter((item) => item.holdings.length > 0).length}`)
