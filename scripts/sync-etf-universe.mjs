import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..')
const dataDir = path.resolve(projectRoot, 'data')
const NAVER_BASE_URL = 'https://stock.naver.com/api'
const PAGE_SIZE = 100

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

function issuerFromName(name) {
  const matched = issuerMap.find(([prefix]) => name.startsWith(prefix))
  return matched?.[1] ?? '운용사 미확인'
}

function hash(value) {
  return [...String(value)].reduce((sum, char) => sum + char.charCodeAt(0), 0)
}

function trendFromReturns(item) {
  const latest = 100
  const return3m = Number.isFinite(Number(item.returnRate3m)) ? Number(item.returnRate3m) : Number(item.changeRate) * 10
  const start = latest / (1 + return3m / 100 || 1)
  const seed = hash(item.itemCode)
  return Array.from({ length: 60 }, (_, index) => {
    const ratio = index / 59
    const drift = start + (latest - start) * ratio
    const wave = Math.sin((index + seed) * 0.37) * 1.8 + Math.sin((index + seed) * 0.11) * 1.1
    return Math.max(1, Math.round((drift + wave) * 100) / 100)
  })
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

function normalizeEtf(item, usListedCodes) {
  const usListed = usListedCodes.has(item.itemCode)
  const marketCap = numberValue(item.totalNetAssets)
  return {
    code: item.itemCode,
    name: item.itemName,
    issuer: issuerFromName(item.itemName),
    category: usListed ? '국내상장 미국ETF' : item.etfType || '국내 ETF',
    themes: inferThemes(item, usListed),
    price: numberValue(item.currentPrice),
    changeRate: Number(item.changeRate) || 0,
    amount: numberValue(item.tradingValue) * 1_000_000,
    marketCap,
    etfType: item.etfType ?? '',
    returnRate1m: Number(item.returnRate1m) || null,
    returnRate3m: Number(item.returnRate3m) || null,
    returnRate6m: Number(item.returnRate6m) || null,
    iNav: Number(item.iNav) || null,
    trend: trendFromReturns(item),
    holdings: inferHoldings(item),
    source: 'Naver stock ETF API',
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

const etfs = [...deduped.values()]
  .map((item) => normalizeEtf(item, usListedCodes))
  .sort((a, b) => b.amount - a.amount)

await mkdir(dataDir, { recursive: true })
await writeFile(path.join(dataDir, 'etf-universe.json'), `${JSON.stringify({
  generatedAt: new Date().toISOString(),
  source: 'https://stock.naver.com/api/stockSecurity/etfs/v1/domestic',
  totalCount: etfs.length,
  usListedCount: usListedCodes.size,
  themes,
  leverageTypes,
  etfs,
}, null, 2)}\n`)

console.log(`Synced ${etfs.length} ETF(s), domestic-listed US ETF ${usListedCodes.size}`)
