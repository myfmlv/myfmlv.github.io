const DATA_INDEX_URL = './data/krx/index.json'
const DATA_BASE_URL = './data/krx'

const themeUp = [
  ['반도체 제품(전력반도체)', 10.4, [21, 24, 23, 29, 31, 38, 44]],
  ['온디바이스 AI', 8.49, [18, 20, 22, 21, 27, 32, 36]],
  ['반도체 제품(비메모리)', 8.04, [16, 18, 17, 21, 28, 31, 35]],
  ['반도체 제품(시스템반도체)', 7.87, [19, 20, 22, 24, 29, 30, 34]],
  ['HD현대그룹', 7.84, [12, 15, 17, 20, 21, 26, 31]],
  ['피팅/밸브', 7.59, [11, 13, 12, 18, 23, 25, 29]],
  ['화장품', 7.35, [14, 15, 19, 18, 22, 27, 31]],
  ['백화점', 7.0, [10, 11, 14, 15, 19, 22, 26]],
  ['ARM', 6.87, [13, 13, 16, 19, 21, 24, 28]],
  ['반도체 후공정', 6.86, [15, 16, 18, 19, 22, 23, 27]],
]

const themeDown = [
  ['양자컴퓨터', -2.87, [28, 26, 25, 24, 21, 20, 18]],
  ['블록체인', -2.36, [25, 25, 22, 21, 20, 18, 17]],
  ['6G', -2.25, [24, 23, 22, 20, 19, 18, 16]],
  ['생체인식', -1.75, [22, 21, 21, 19, 18, 17, 16]],
  ['자동차', -1.67, [30, 28, 27, 26, 25, 23, 22]],
  ['인도투자', -1.31, [20, 19, 19, 18, 17, 17, 16]],
  ['현대자동차그룹', -1.27, [23, 22, 21, 20, 20, 18, 17]],
  ['양자암호통신', -1.17, [18, 19, 17, 17, 16, 15, 14]],
  ['핀테크', -1.17, [17, 17, 16, 15, 15, 14, 13]],
  ['영원그룹', -1.08, [16, 16, 15, 15, 14, 13, 13]],
]

const hotThemes = [
  ['AI 반도체', 96, [20, 23, 28, 35, 43, 48, 55]],
  ['전력 인프라', 91, [22, 24, 26, 30, 39, 45, 49]],
  ['조선 기자재', 88, [18, 22, 24, 28, 34, 38, 44]],
  ['화장품', 86, [16, 17, 19, 25, 28, 34, 39]],
  ['방산', 82, [18, 19, 21, 24, 29, 32, 37]],
  ['원자력 SMR', 79, [14, 16, 18, 23, 25, 28, 33]],
  ['로봇', 75, [12, 15, 18, 17, 21, 25, 30]],
  ['우주항공', 73, [13, 14, 16, 18, 22, 25, 28]],
]

const marketCaps = [
  ['삼성전자', '005930', '468조', [23, 25, 24, 27, 28, 30, 33]],
  ['SK하이닉스', '000660', '245조', [18, 19, 24, 28, 32, 36, 41]],
  ['LG에너지솔루션', '373220', '90조', [26, 25, 24, 22, 21, 22, 23]],
  ['삼성바이오로직스', '207940', '75조', [18, 18, 19, 21, 22, 24, 25]],
  ['현대차', '005380', '56조', [20, 21, 20, 21, 23, 24, 25]],
  ['기아', '000270', '43조', [19, 19, 18, 20, 21, 21, 22]],
  ['셀트리온', '068270', '39조', [16, 18, 17, 20, 23, 22, 24]],
  ['NAVER', '035420', '35조', [20, 19, 18, 18, 17, 18, 19]],
  ['KB금융', '105560', '34조', [17, 18, 19, 20, 21, 23, 24]],
  ['한화에어로스페이스', '012450', '32조', [13, 16, 18, 24, 30, 35, 39]],
]

const fallbackMarketIndex = [
  { name: '원달러', value: '1,477.50', unit: '원', change: '-6.50', tone: 'down' },
  { name: '원엔', value: '926.88', unit: '원/100엔', change: '-2.48', tone: 'down' },
  { name: 'WTI', value: '94.4', unit: '달러', change: '-1.45', tone: 'down' },
  { name: '국제 금', value: '4,740.9', unit: '달러', change: '+16.90', tone: 'up' },
]

const usStocks = [
  { symbol: 'NVDA', name: 'NVIDIA', sector: 'AI 반도체', price: 178.35, changeRate: 2.31, marketCap: '4.35T', amount: '42.1B', popularity: 98, trend: [18, 20, 24, 31, 35, 42, 49] },
  { symbol: 'MSFT', name: 'Microsoft', sector: '클라우드', price: 509.9, changeRate: 0.82, marketCap: '3.79T', amount: '16.8B', popularity: 91, trend: [20, 21, 23, 24, 25, 28, 30] },
  { symbol: 'AAPL', name: 'Apple', sector: '소비자기술', price: 247.4, changeRate: -0.43, marketCap: '3.67T', amount: '13.9B', popularity: 87, trend: [30, 29, 28, 27, 27, 26, 25] },
  { symbol: 'AMZN', name: 'Amazon', sector: '커머스·클라우드', price: 229.2, changeRate: 1.12, marketCap: '2.44T', amount: '12.6B', popularity: 84, trend: [17, 18, 19, 22, 23, 25, 27] },
  { symbol: 'GOOGL', name: 'Alphabet', sector: '검색·AI', price: 186.7, changeRate: -0.21, marketCap: '2.27T', amount: '9.8B', popularity: 82, trend: [24, 24, 23, 22, 22, 21, 21] },
  { symbol: 'META', name: 'Meta Platforms', sector: '소셜·AI', price: 641.3, changeRate: 1.76, marketCap: '1.62T', amount: '11.4B', popularity: 80, trend: [16, 18, 20, 23, 26, 30, 34] },
  { symbol: 'TSLA', name: 'Tesla', sector: '전기차', price: 336.2, changeRate: 3.58, marketCap: '1.08T', amount: '24.2B', popularity: 96, trend: [14, 12, 18, 24, 30, 33, 41] },
  { symbol: 'AVGO', name: 'Broadcom', sector: '반도체', price: 329.8, changeRate: 1.04, marketCap: '1.55T', amount: '7.2B', popularity: 74, trend: [19, 20, 23, 25, 28, 29, 31] },
]

const etfThemes = [
  ['AI 전력', 'PLUS 태양광&ESS', 8.49, [13, 15, 17, 21, 27, 31, 35]],
  ['조선', 'SOL 조선기자재', 7.67, [12, 14, 16, 20, 24, 28, 31]],
  ['화장품', 'HANARO K-뷰티', 5.41, [16, 17, 19, 21, 24, 27, 29]],
  ['외인수급', 'WON K-글로벌수급상위', 4.74, [14, 15, 16, 20, 21, 23, 25]],
  ['코스닥', 'TIME 코스닥액티브', 4.09, [11, 13, 14, 15, 17, 19, 21]],
]

const etfUniverse = [
  {
    code: '379800',
    name: 'KODEX 미국S&P500TR',
    issuer: '삼성자산운용',
    category: '국내상장 미국ETF',
    themes: ['미국 대표지수', '국내상장 미국ETF'],
    price: 19845,
    changeRate: 0.84,
    amount: 38200000000,
    marketCap: 2840000000000,
    trend: [20, 21, 23, 24, 26, 29, 31],
    holdings: [
      ['Microsoft', 'MSFT', 7.1],
      ['NVIDIA', 'NVDA', 6.8],
      ['Apple', 'AAPL', 6.2],
      ['Amazon', 'AMZN', 3.9],
      ['Meta Platforms', 'META', 2.8],
    ],
  },
  {
    code: '133690',
    name: 'TIGER 미국나스닥100',
    issuer: '미래에셋자산운용',
    category: '국내상장 미국ETF',
    themes: ['미국 대표지수', '국내상장 미국ETF', 'AI 반도체'],
    price: 148230,
    changeRate: 1.16,
    amount: 64100000000,
    marketCap: 3980000000000,
    trend: [19, 22, 24, 27, 31, 35, 38],
    holdings: [
      ['NVIDIA', 'NVDA', 8.9],
      ['Microsoft', 'MSFT', 8.1],
      ['Apple', 'AAPL', 7.4],
      ['Amazon', 'AMZN', 5.2],
      ['Broadcom', 'AVGO', 4.7],
    ],
  },
  {
    code: '381180',
    name: 'TIGER 미국필라델피아반도체나스닥',
    issuer: '미래에셋자산운용',
    category: '국내상장 미국ETF',
    themes: ['AI 반도체', '국내상장 미국ETF'],
    price: 24210,
    changeRate: 2.42,
    amount: 51800000000,
    marketCap: 2160000000000,
    trend: [14, 16, 21, 23, 28, 33, 39],
    holdings: [
      ['NVIDIA', 'NVDA', 10.8],
      ['Broadcom', 'AVGO', 8.5],
      ['AMD', 'AMD', 6.7],
      ['Applied Materials', 'AMAT', 5.8],
      ['Micron', 'MU', 4.9],
    ],
  },
  {
    code: '069500',
    name: 'KODEX 200',
    issuer: '삼성자산운용',
    category: '국내 대표지수',
    themes: ['코스닥', '국내 대표지수'],
    price: 42780,
    changeRate: -0.18,
    amount: 92800000000,
    marketCap: 5640000000000,
    trend: [22, 22, 23, 22, 21, 22, 21],
    holdings: [
      ['삼성전자', '005930', 25.6],
      ['SK하이닉스', '000660', 10.9],
      ['현대차', '005380', 2.7],
      ['기아', '000270', 2.1],
      ['KB금융', '105560', 1.9],
    ],
  },
  {
    code: '466920',
    name: 'SOL 조선TOP3플러스',
    issuer: '신한자산운용',
    category: '국내 테마',
    themes: ['조선', '조선 기자재'],
    price: 18460,
    changeRate: 3.24,
    amount: 28400000000,
    marketCap: 428000000000,
    trend: [12, 13, 17, 21, 25, 31, 36],
    holdings: [
      ['HD현대중공업', '329180', 24.2],
      ['한화오션', '042660', 21.4],
      ['삼성중공업', '010140', 18.7],
      ['HD한국조선해양', '009540', 12.8],
      ['HD현대마린엔진', '071970', 7.6],
    ],
  },
  {
    code: '475300',
    name: 'SOL 반도체후공정',
    issuer: '신한자산운용',
    category: '국내 테마',
    themes: ['반도체 후공정', 'AI 반도체'],
    price: 15620,
    changeRate: 4.07,
    amount: 19400000000,
    marketCap: 286000000000,
    trend: [13, 13, 16, 20, 26, 32, 37],
    holdings: [
      ['한미반도체', '042700', 19.8],
      ['리노공업', '058470', 12.1],
      ['ISC', '095340', 9.4],
      ['티씨케이', '064760', 8.2],
      ['하나마이크론', '067310', 6.8],
    ],
  },
  {
    code: '491010',
    name: 'PLUS 태양광&ESS',
    issuer: '한화자산운용',
    category: '국내 테마',
    themes: ['AI 전력', '전력 인프라'],
    price: 13240,
    changeRate: 8.49,
    amount: 33700000000,
    marketCap: 312000000000,
    trend: [13, 15, 17, 21, 27, 31, 35],
    holdings: [
      ['HD현대일렉트릭', '267260', 18.6],
      ['LS ELECTRIC', '010120', 15.2],
      ['효성중공업', '298040', 12.8],
      ['일진전기', '103590', 8.4],
      ['LS', '006260', 7.9],
    ],
  },
  {
    code: '469070',
    name: 'KODEX AI전력핵심설비',
    issuer: '삼성자산운용',
    category: '국내 테마',
    themes: ['AI 전력', '전력 인프라'],
    price: 17680,
    changeRate: 6.11,
    amount: 21900000000,
    marketCap: 374000000000,
    trend: [12, 14, 16, 19, 25, 29, 33],
    holdings: [
      ['LS ELECTRIC', '010120', 16.9],
      ['HD현대일렉트릭', '267260', 16.1],
      ['효성중공업', '298040', 14.4],
      ['대한전선', '001440', 8.2],
      ['가온전선', '000500', 6.7],
    ],
  },
  {
    code: '463250',
    name: 'HANARO K-뷰티',
    issuer: 'NH아문디자산운용',
    category: '국내 테마',
    themes: ['화장품'],
    price: 11930,
    changeRate: 5.41,
    amount: 16800000000,
    marketCap: 241000000000,
    trend: [16, 17, 19, 21, 24, 27, 29],
    holdings: [
      ['아모레퍼시픽', '090430', 19.4],
      ['LG생활건강', '051900', 15.1],
      ['한국콜마', '161890', 9.8],
      ['코스맥스', '192820', 8.9],
      ['실리콘투', '257720', 7.4],
    ],
  },
]

const state = {
  rows: [],
  filteredRows: [],
  rowsByDate: new Map(),
  dates: [],
  stockMeta: new Map(),
  marketIndex: fallbackMarketIndex,
  stockCountry: 'kr',
  krStockSection: 'market',
  sortKey: 'netBuy',
  query: '',
  visibleLimit: 20,
  etfQuery: '',
  etfFilter: 'all',
  etfTheme: null,
  selectedEtfCode: etfUniverse[0].code,
  selectedHolding: null,
  meta: null,
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
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

function toNumber(value) {
  return Number(String(value ?? '').replace(/[^0-9.-]/g, '')) || 0
}

function normalizeInvestorLabel(value) {
  const text = String(value ?? '').trim()
  if (text === '연기금 등' || text === '연기금등') return '연기금'
  return text
}

function marketCapToNumber(value) {
  const text = String(value ?? '').trim()
  const number = Number(text.replace(/[^0-9.]/g, '')) || 0
  if (text.includes('조')) return number * 1_000_000_000_000
  if (text.includes('억')) return number * 100_000_000
  return number
}

function parseKrxCsv(text) {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter(Boolean)
  const headers = splitCsvLine(lines[0] ?? '').map((header) => header.replace(/^\uFEFF/, ''))

  return lines.slice(1).map((line) => {
    const cells = splitCsvLine(line)
    const row = Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? '']))
    const buyAmount = toNumber(row['매수거래대금'])
    const sellAmount = toNumber(row['매도거래대금'])
    const grossAmount = buyAmount + sellAmount

    return {
      date: row['날짜'],
      market: row['시장'],
      investor: normalizeInvestorLabel(row['투자자']),
      ticker: row['티커'],
      name: row['종목명'],
      sellVolume: toNumber(row['매도거래량']),
      buyVolume: toNumber(row['매수거래량']),
      netVolume: toNumber(row['순매수거래량']),
      sellAmount,
      buyAmount,
      netAmount: toNumber(row['순매수거래대금']),
      buyPressure: grossAmount === 0 ? 0 : Math.round((buyAmount / grossAmount) * 1000) / 10,
    }
  }).filter((row) => row.date && row.ticker && row.name)
}

function formatTradeDate(date) {
  if (!/^\d{8}$/.test(date ?? '')) return date || '-'
  return `${date.slice(0, 4)}.${date.slice(4, 6)}.${date.slice(6, 8)}`
}

function formatMoney(value) {
  const absolute = Math.abs(value)
  const sign = value < 0 ? '-' : ''
  if (absolute >= 1_000_000_000_000) return `${sign}${(absolute / 1_000_000_000_000).toLocaleString('ko-KR', { maximumFractionDigits: 1 })}조`
  if (absolute >= 100_000_000) return `${sign}${(absolute / 100_000_000).toLocaleString('ko-KR', { maximumFractionDigits: 1 })}억`
  if (absolute >= 10_000) return `${sign}${Math.round(absolute / 10_000).toLocaleString('ko-KR')}만`
  return `${sign}${absolute.toLocaleString('ko-KR')}`
}

function formatMarketCap(value) {
  if (!value) return '-'
  if (value >= 1_000_000_000_000) return `${Math.round(value / 1_000_000_000_000).toLocaleString('ko-KR')}조`
  if (value >= 100_000_000) return `${Math.round(value / 100_000_000).toLocaleString('ko-KR')}억`
  return formatMoney(value)
}

function formatNumber(value) {
  return value.toLocaleString('ko-KR')
}

function formatPercentRatio(value) {
  if (value === null || value === undefined) return '-'
  return `${(value * 100).toFixed(3)}%`
}

function formatSignedPercent(value) {
  const number = Number(value)
  if (!Number.isFinite(number)) return '-'
  const sign = number > 0 ? '+' : ''
  return `${sign}${number.toFixed(2)}%`
}

function formatPrice(value) {
  if (!value) return '-'
  return `${Number(value).toLocaleString('ko-KR')}원`
}

function formatUsd(value) {
  if (!value) return '-'
  return `$${Number(value).toLocaleString('en-US', { maximumFractionDigits: 2 })}`
}

function sparkline(values, tone = 'neutral') {
  const width = 84
  const height = 30
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const points = values.map((value, index) => {
    const x = (index / Math.max(values.length - 1, 1)) * width
    const y = height - ((value - min) / range) * (height - 5) - 2.5
    return [x, y]
  })
  const line = points.map(([x, y], index) => `${index === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ')
  const area = `${line} L${width} ${height} L0 ${height} Z`
  return `<svg class="spark ${tone}" viewBox="0 0 ${width} ${height}" aria-hidden="true"><path class="area" d="${area}" fill="currentColor"></path><path class="line" d="${line}"></path></svg>`
}

function seedTrend(seed, tone = 'up') {
  const base = [...String(seed)].reduce((sum, char) => sum + char.charCodeAt(0), 0)
  return Array.from({ length: 7 }, (_, index) => {
    const wave = ((base + index * 13) % 11) - 5
    const slope = tone === 'down' ? -index * 2 : index * 2
    return 30 + slope + wave
  })
}

function builtinStockMeta() {
  return new Map(marketCaps.map(([name, ticker, cap]) => [ticker, {
    ticker,
    name,
    marketCap: marketCapToNumber(cap),
    marketCapLabel: cap,
  }]))
}

function countStreak(ticker, direction) {
  let streak = 0

  for (const date of state.dates) {
    const row = state.rowsByDate.get(date)?.get(ticker)
    if (!row) break
    const matched = direction === 'buy' ? row.netAmount > 0 : row.netAmount < 0
    if (!matched) break
    streak += 1
  }

  return streak
}

function enrichRows(rows) {
  return rows.map((row) => {
    const meta = state.stockMeta.get(row.ticker)
    const marketCap = meta?.marketCap ?? null
    const buyToMarketCap = marketCap && row.buyAmount > 0 ? row.buyAmount / marketCap : null

    return {
      ...row,
      marketCap,
      marketCapLabel: meta?.marketCapLabel ?? formatMarketCap(marketCap),
      buyToMarketCap,
      buyStreak: row.netAmount > 0 ? countStreak(row.ticker, 'buy') : 0,
      sellStreak: row.netAmount < 0 ? countStreak(row.ticker, 'sell') : 0,
    }
  })
}

function staticItems(items, tone = 'up', formatter = (value) => `${value}%`) {
  return items.map(([name, value, trend], index) => ({
    rank: index + 1,
    name,
    sub: '테마',
    value: formatter(value),
    tone: value < 0 ? 'down' : tone,
    trend,
  }))
}

function stockMetaItems() {
  return [...state.stockMeta.entries()].map(([ticker, meta]) => ({ ticker, ...meta }))
}

function marketCapItems() {
  const items = stockMetaItems()
    .filter((item) => item.marketCap && item.name)
    .sort((a, b) => b.marketCap - a.marketCap)
    .slice(0, 10)

  if (items.length > 0) {
    return items.map((item, index) => ({
      rank: index + 1,
      name: item.name,
      sub: `${item.ticker} · ${item.market || 'KRX'}`,
      href: `https://finance.naver.com/item/main.naver?code=${item.ticker}`,
      value: item.marketCapLabel ?? formatMarketCap(item.marketCap),
      tone: item.changeRate > 0 ? 'up' : item.changeRate < 0 ? 'down' : 'neutral',
      trend: seedTrend(item.ticker, item.changeRate < 0 ? 'down' : 'up'),
    }))
  }

  return marketCaps.map(([name, ticker, cap, trend], index) => ({
    rank: index + 1,
    name,
    sub: ticker,
    href: `https://finance.naver.com/item/main.naver?code=${ticker}`,
    value: cap,
    tone: 'neutral',
    trend,
  }))
}

function rowsByPensionMode(mode) {
  if (mode === 'sell') {
    return [...state.rows]
      .filter((row) => row.netAmount < 0)
      .sort((a, b) => a.netAmount - b.netAmount)
  }

  if (mode === 'buyStreak') {
    return [...state.rows]
      .filter((row) => row.netAmount > 0)
      .sort((a, b) => b.buyStreak - a.buyStreak || b.netAmount - a.netAmount)
  }

  if (mode === 'buyToMarketCap') {
    return [...state.rows]
      .filter((row) => row.netAmount > 0 && row.buyToMarketCap !== null)
      .sort((a, b) => b.buyToMarketCap - a.buyToMarketCap || b.netAmount - a.netAmount)
  }

  return [...state.rows]
    .filter((row) => row.netAmount > 0)
    .sort((a, b) => b.netAmount - a.netAmount)
}

function pensionItems(mode) {
  const rows = rowsByPensionMode(mode)
    .slice(0, 10)

  return rows.map((row, index) => ({
    rank: index + 1,
    name: row.name,
    sub: mode === 'buyStreak'
      ? `${row.ticker} · ${row.buyStreak}일`
      : mode === 'buyToMarketCap'
        ? `${row.ticker} · 시총 ${row.marketCapLabel || '-'}`
        : row.ticker,
    href: `https://finance.naver.com/item/main.naver?code=${row.ticker}`,
    value: mode === 'buyToMarketCap' ? formatPercentRatio(row.buyToMarketCap) : `${formatMoney(row.netAmount)}원`,
    tone: mode === 'sell' ? 'down' : 'up',
    trend: seedTrend(row.ticker, mode === 'sell' ? 'down' : 'up'),
  }))
}

function marketSummaryItems() {
  const groups = new Map()

  stockMetaItems().forEach((item) => {
    const market = item.market || '기타'
    if (!['KOSPI', 'KOSDAQ'].includes(market)) return
    if (!groups.has(market)) {
      groups.set(market, { market, count: 0, up: 0, down: 0, marketCap: 0, amount: 0 })
    }
    const group = groups.get(market)
    group.count += 1
    group.marketCap += item.marketCap || 0
    group.amount += item.amount || 0
    if (item.changeRate > 0) group.up += 1
    if (item.changeRate < 0) group.down += 1
  })

  const marketItems = [...groups.values()]
    .sort((a, b) => b.marketCap - a.marketCap)
    .map((group, index) => ({
      rank: index + 1,
      name: group.market,
      sub: `상승 ${group.up} · 하락 ${group.down} · ${group.count}종목`,
      value: formatMarketCap(group.marketCap),
      tone: group.up >= group.down ? 'up' : 'down',
      trend: seedTrend(group.market, group.up >= group.down ? 'up' : 'down'),
    }))

  const indexItems = state.marketIndex.map((item, index) => ({
    rank: marketItems.length + index + 1,
    name: item.name,
    sub: `${item.change} · ${item.unit}`,
    value: item.value,
    tone: item.tone,
    trend: seedTrend(item.name, item.tone === 'down' ? 'down' : 'up'),
  }))

  return [...marketItems, ...indexItems]
}

function marketRankingItems(mode) {
  const items = stockMetaItems()
    .filter((item) => item.name && item.ticker)
    .sort((a, b) => {
      if (mode === 'up') return (b.changeRate ?? -Infinity) - (a.changeRate ?? -Infinity)
      if (mode === 'down') return (a.changeRate ?? Infinity) - (b.changeRate ?? Infinity)
      return (b.amount ?? 0) - (a.amount ?? 0)
    })
    .slice(0, 10)

  return items.map((item, index) => ({
    rank: index + 1,
    name: item.name,
    sub: `${item.ticker} · ${item.market || 'KRX'} · ${formatPrice(item.price)}`,
    href: `https://finance.naver.com/item/main.naver?code=${item.ticker}`,
    value: mode === 'amount' ? formatMoney(item.amount || 0) : formatSignedPercent(item.changeRate),
    tone: mode === 'down' || item.changeRate < 0 ? 'down' : item.changeRate > 0 ? 'up' : 'neutral',
    trend: seedTrend(item.ticker, mode === 'down' || item.changeRate < 0 ? 'down' : 'up'),
  }))
}

function marketSearchItems() {
  return stockMetaItems()
    .filter((item) => item.name && item.ticker)
    .sort((a, b) => (b.amount ?? 0) + (b.marketCap ?? 0) * 0.001 - ((a.amount ?? 0) + (a.marketCap ?? 0) * 0.001))
    .slice(0, 10)
    .map((item, index) => ({
      rank: index + 1,
      name: item.name,
      sub: `${item.ticker} · 검색상위 후보`,
      href: `https://finance.naver.com/item/main.naver?code=${item.ticker}`,
      value: formatSignedPercent(item.changeRate),
      tone: item.changeRate > 0 ? 'up' : item.changeRate < 0 ? 'down' : 'neutral',
      trend: seedTrend(item.ticker, item.changeRate < 0 ? 'down' : 'up'),
    }))
}

function marketPopularItems() {
  return [...state.rows]
    .sort((a, b) => Math.abs(b.netAmount) + b.buyAmount + b.sellAmount - (Math.abs(a.netAmount) + a.buyAmount + a.sellAmount))
    .slice(0, 10)
    .map((row, index) => ({
      rank: index + 1,
      name: row.name,
      sub: `${row.ticker} · 연기금 수급/거래 관심`,
      href: `https://finance.naver.com/item/main.naver?code=${row.ticker}`,
      value: `${formatMoney(row.netAmount)}원`,
      tone: row.netAmount >= 0 ? 'up' : 'down',
      trend: seedTrend(row.ticker, row.netAmount >= 0 ? 'up' : 'down'),
    }))
}

function usStockItems(mode) {
  return [...usStocks]
    .sort((a, b) => {
      if (mode === 'marketCap') return parseFloat(b.marketCap) - parseFloat(a.marketCap)
      if (mode === 'amount') return parseFloat(b.amount) - parseFloat(a.amount)
      if (mode === 'search') return b.popularity - a.popularity
      if (mode === 'up') return b.changeRate - a.changeRate
      return b.popularity + parseFloat(b.amount) - (a.popularity + parseFloat(a.amount))
    })
    .slice(0, 10)
    .map((item, index) => ({
      rank: index + 1,
      name: item.name,
      sub: `${item.symbol} · ${item.sector}`,
      href: `https://stock.naver.com/worldstock/stock/${item.symbol}.O/total`,
      value: mode === 'marketCap'
        ? `$${item.marketCap}`
        : mode === 'amount'
          ? `$${item.amount}`
          : mode === 'up'
            ? formatSignedPercent(item.changeRate)
            : `${item.popularity}점`,
      tone: item.changeRate > 0 ? 'up' : item.changeRate < 0 ? 'down' : 'neutral',
      trend: item.trend,
    }))
}

function renderListPanel({ title, meta, items }) {
  return `
    <article class="list-panel">
      <div class="panel-head">
        <div><p>${escapeHtml(meta)}</p><h2>${escapeHtml(title)}</h2></div>
        <span class="panel-meta">${items.length}개</span>
      </div>
      <ol class="rank-list">
        ${items.map((item) => `
          <li class="rank-item">
            <span class="rank">${item.rank}</span>
            <div class="item-main">
              ${item.action ? `<button class="inline-action" type="button" data-action="${escapeHtml(item.action)}" data-value="${escapeHtml(item.actionValue)}">${escapeHtml(item.name)}</button>` : item.href ? `<a href="${item.href}" target="_blank" rel="noreferrer">${escapeHtml(item.name)}</a>` : `<strong>${escapeHtml(item.name)}</strong>`}
              <small>${escapeHtml(item.sub)}</small>
            </div>
            <span class="value ${item.tone}">${escapeHtml(item.value)}</span>
            ${sparkline(item.trend, item.tone)}
          </li>
        `).join('')}
      </ol>
    </article>
  `
}

function renderThemeSections() {
  const panels = [
    { title: '상승중인 테마', meta: 'theme up', items: staticItems(themeUp, 'up') },
    { title: '하락중인 테마', meta: 'theme down', items: staticItems(themeDown, 'down') },
    { title: '현재 핫한 테마', meta: 'hot theme', items: staticItems(hotThemes, 'up', (value) => `${value}점`) },
    { title: '시가총액 높은 종목', meta: 'large cap', items: marketCapItems() },
  ]

  document.querySelector('#themeSectionGrid').innerHTML = panels.map(renderListPanel).join('')
}

function renderMarketInsights() {
  const panels = [
    { title: '시장 요약', meta: 'KRX + index', items: marketSummaryItems() },
    { title: '거래대금 상위', meta: 'top amount', items: marketRankingItems('amount') },
  ]

  document.querySelector('#marketInsightGrid').innerHTML = panels.map(renderListPanel).join('')

  const rankingPanels = [
    { title: '시가총액 상위', meta: 'market cap', items: marketCapItems() },
    { title: '검색 상위', meta: 'search', items: marketSearchItems() },
    { title: '인기 종목', meta: 'popular', items: marketPopularItems() },
    { title: '상승률 상위', meta: 'top gainers', items: marketRankingItems('up') },
  ]

  document.querySelector('#marketRankingGrid').innerHTML = rankingPanels.map(renderListPanel).join('')
}

function renderMarketIndexStrip() {
  document.querySelector('#marketIndexStrip').innerHTML = state.marketIndex.slice(0, 4).map((item) => `
    <div>
      <span>${escapeHtml(item.name)}</span>
      <strong>${escapeHtml(item.value)}</strong>
      <small class="metric-sub ${item.tone}">${escapeHtml(item.change)} · ${escapeHtml(item.unit)}</small>
    </div>
  `).join('')
}

function renderUsMarket() {
  const panels = [
    { title: '미국 시가총액', meta: 'market cap', items: usStockItems('marketCap') },
    { title: '거래대금 상위', meta: 'top amount', items: usStockItems('amount') },
    { title: '검색 상위', meta: 'search', items: usStockItems('search') },
    { title: '인기 종목', meta: 'popular', items: usStockItems('popular') },
    { title: '상승률 상위', meta: 'top gainers', items: usStockItems('up') },
  ]

  document.querySelector('#usMarketGrid').innerHTML = panels.map(renderListPanel).join('')
}

function renderPensionSections() {
  const panels = [
    { title: '연기금 순매수 종목', meta: 'pension buy', items: pensionItems('buy') },
    { title: '연기금 순매도 종목', meta: 'pension sell', items: pensionItems('sell') },
    { title: '연속 순매수', meta: 'buy streak', items: pensionItems('buyStreak') },
    { title: '시총대비 매수 집중', meta: 'buy / market cap', items: pensionItems('buyToMarketCap') },
  ]

  document.querySelector('#pensionSectionGrid').innerHTML = panels.map(renderListPanel).join('')
}

function etfPanelItems(mode) {
  if (mode === 'theme') {
    return etfThemes.map(([name, sub, value, trend], index) => ({
      rank: index + 1,
      name,
      sub,
      value: `${value}%`,
      tone: 'up',
      trend,
      action: 'etf-theme',
      actionValue: name,
    }))
  }

  return [...etfUniverse]
    .filter((item) => mode.startsWith('us') ? item.category === '국내상장 미국ETF' : true)
    .sort((a, b) => {
      if (mode.endsWith('Up')) return b.changeRate - a.changeRate
      return b.amount - a.amount
    })
    .slice(0, 10)
    .map((item, index) => ({
      rank: index + 1,
      name: item.name,
      sub: `${item.code} · ${item.issuer}`,
      value: mode.endsWith('Up') ? formatSignedPercent(item.changeRate) : formatMoney(item.amount),
      tone: item.changeRate >= 0 ? 'up' : 'down',
      trend: item.trend,
    }))
}

function filteredEtfs() {
  const query = state.etfQuery.trim().toLowerCase()

  return etfUniverse.filter((item) => {
    const inFilter = state.etfFilter === 'all' || item.category === '국내상장 미국ETF'
    if (!inFilter) return false
    if (state.etfTheme && !item.themes?.includes(state.etfTheme)) return false
    if (!query) return true
    const holdingText = item.holdings.map(([name, ticker]) => `${name} ${ticker}`).join(' ').toLowerCase()
    return item.name.toLowerCase().includes(query)
      || item.code.includes(query)
      || item.issuer.toLowerCase().includes(query)
      || holdingText.includes(query)
  })
}

function etfsByHolding(holdingTicker) {
  return etfUniverse
    .map((etf) => {
      const holding = etf.holdings.find(([, ticker]) => ticker === holdingTicker)
      return holding ? { etf, ratio: holding[2] } : null
    })
    .filter(Boolean)
    .sort((a, b) => b.ratio - a.ratio)
}

function renderEtfSections() {
  const panels = [
    { title: 'ETF 상승 테마', meta: 'theme', items: etfPanelItems('theme') },
    { title: '거래대금 많은 ETF', meta: 'top amount', items: etfPanelItems('amount') },
    { title: '가장 많이 오른 ETF', meta: 'top gainers', items: etfPanelItems('allUp') },
    { title: '미국ETF 거래대금', meta: 'US listed', items: etfPanelItems('usAmount') },
    { title: '미국ETF 상승', meta: 'US listed', items: etfPanelItems('usUp') },
  ]

  document.querySelector('#etfSectionGrid').innerHTML = panels.map(renderListPanel).join('')
  renderEtfList()
  renderEtfDetail()
}

function renderEtfList() {
  const items = filteredEtfs()
  const selectedExists = items.some((item) => item.code === state.selectedEtfCode)
  if (!selectedExists && items[0]) state.selectedEtfCode = items[0].code

  document.querySelector('#etfListMeta').textContent = state.etfTheme
    ? `${state.etfTheme} · ${items.length.toLocaleString('ko-KR')}개`
    : `${items.length.toLocaleString('ko-KR')}개`
  document.querySelector('#etfList').innerHTML = items.map((item) => `
    <li>
      <button class="${item.code === state.selectedEtfCode ? 'active' : ''}" type="button" data-etf-code="${item.code}">
        <span>
          <strong>${escapeHtml(item.name)}</strong>
          <small>${escapeHtml(item.code)} · ${escapeHtml(item.issuer)} · ${escapeHtml(item.category)}</small>
        </span>
        <b class="${item.changeRate >= 0 ? 'up' : 'down'}">${formatSignedPercent(item.changeRate)}</b>
      </button>
    </li>
  `).join('')
}

function renderEtfDetail() {
  const item = etfUniverse.find((etf) => etf.code === state.selectedEtfCode) ?? etfUniverse[0]
  if (!item) return
  const selectedHolding = state.selectedHolding ?? item.holdings[0]?.[1]
  const related = selectedHolding ? etfsByHolding(selectedHolding) : []
  const holdingName = item.holdings.find(([, ticker]) => ticker === selectedHolding)?.[0] ?? selectedHolding

  document.querySelector('#etfDetail').innerHTML = `
    <div class="panel-head">
      <div>
        <p>${escapeHtml(item.code)} · ${escapeHtml(item.issuer)}</p>
        <h2>${escapeHtml(item.name)}</h2>
      </div>
      <span class="panel-meta">${escapeHtml(item.category)}</span>
    </div>
    <div class="etf-metrics">
      <div><span>가격</span><strong>${formatPrice(item.price)}</strong></div>
      <div><span>등락률</span><strong class="${item.changeRate >= 0 ? 'up' : 'down'}">${formatSignedPercent(item.changeRate)}</strong></div>
      <div><span>시가총액</span><strong>${formatMarketCap(item.marketCap)}</strong></div>
      <div><span>거래대금</span><strong>${formatMoney(item.amount)}</strong></div>
    </div>
    <div class="chart-card">${sparkline(item.trend, item.changeRate >= 0 ? 'up' : 'down')}</div>
    <div class="holding-grid">
      <section>
        <h3>구성종목</h3>
        <ol class="holding-list">
          ${item.holdings.map(([name, ticker, ratio]) => `
            <li>
              <button class="${ticker === selectedHolding ? 'active' : ''}" type="button" data-holding-ticker="${ticker}">
                <span>${escapeHtml(name)}<small>${escapeHtml(ticker)}</small></span>
                <b>${ratio.toFixed(1)}%</b>
              </button>
            </li>
          `).join('')}
        </ol>
      </section>
      <section>
        <h3>${escapeHtml(holdingName)} 포함 ETF</h3>
        <ol class="holding-list related">
          ${related.map(({ etf, ratio }) => `
            <li>
              <button type="button" data-etf-code="${etf.code}">
                <span>${escapeHtml(etf.name)}<small>${escapeHtml(etf.issuer)}</small></span>
                <b>${ratio.toFixed(1)}%</b>
              </button>
            </li>
          `).join('')}
        </ol>
      </section>
    </div>
  `
}

function renderSummary() {
  const buyRows = state.rows.filter((row) => row.netAmount > 0)
  const sellRows = state.rows.filter((row) => row.netAmount < 0)

  document.querySelector('#tradeDate').textContent = formatTradeDate(state.meta?.latest)
  document.querySelector('#buyStockCount').textContent = `${buyRows.length.toLocaleString('ko-KR')}개`
  document.querySelector('#sellStockCount').textContent = `${sellRows.length.toLocaleString('ko-KR')}개`
  document.querySelector('#dataRows').textContent = `${state.rows.length.toLocaleString('ko-KR')}행`
  document.querySelector('#marketStatus').textContent = `${formatTradeDate(state.meta?.latest)} · 연기금 · ${state.rows.length.toLocaleString('ko-KR')}종목`
}

function sortedRows(rows) {
  return [...rows].sort((a, b) => {
    if (state.sortKey === 'netSell') return a.netAmount - b.netAmount
    if (state.sortKey === 'buyStreak') return b.buyStreak - a.buyStreak || b.netAmount - a.netAmount
    if (state.sortKey === 'sellStreak') return b.sellStreak - a.sellStreak || a.netAmount - b.netAmount
    if (state.sortKey === 'buyToMarketCap') return (b.buyToMarketCap ?? -1) - (a.buyToMarketCap ?? -1) || b.netAmount - a.netAmount
    if (state.sortKey === 'marketCapAsc') return (a.marketCap ?? Number.MAX_SAFE_INTEGER) - (b.marketCap ?? Number.MAX_SAFE_INTEGER)
    return b.netAmount - a.netAmount
  })
}

function rowsForSort() {
  if (state.sortKey === 'netSell' || state.sortKey === 'sellStreak') return state.rows.filter((row) => row.netAmount < 0)
  if (state.sortKey === 'marketCapAsc') return state.rows.filter((row) => row.marketCap)
  return state.rows.filter((row) => row.netAmount > 0)
}

function sortLabel() {
  const labels = {
    netBuy: '순매수금액',
    netSell: '순매도금액',
    buyStreak: '연속 순매수',
    sellStreak: '연속 순매도',
    buyToMarketCap: '시총대비 매수금액',
    marketCapAsc: '시가총액 작은순',
  }
  return labels[state.sortKey] ?? '순매수금액'
}

function streakLabel(row) {
  if (state.sortKey === 'sellStreak' || row.netAmount < 0) return `${row.sellStreak || 0}일`
  return `${row.buyStreak || 0}일`
}

function rankingMetaText(visibleCount, totalCount) {
  const tradeDays = state.meta?.files?.length ?? state.dates.length
  const marketCapCount = state.stockMeta.size
  return [
    `${sortLabel()} · ${visibleCount.toLocaleString('ko-KR')} / ${totalCount.toLocaleString('ko-KR')}개`,
    `누적 ${tradeDays.toLocaleString('ko-KR')}거래일`,
    `시총 ${marketCapCount.toLocaleString('ko-KR')}개`,
  ].join(' · ')
}

function updateStockTable() {
  const query = state.query.trim().toLowerCase()
  const baseRows = rowsForSort()
  state.filteredRows = sortedRows(query
    ? baseRows.filter((row) => row.name.toLowerCase().includes(query) || row.ticker.includes(query))
    : baseRows)

  const tbody = document.querySelector('#stockTableBody')
  if (state.filteredRows.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9">검색 결과가 없습니다.</td></tr>'
    document.querySelector('#rankingMeta').textContent = rankingMetaText(0, 0)
    document.querySelector('#loadMoreButton').hidden = true
    return
  }

  const visibleRows = state.filteredRows.slice(0, state.visibleLimit)
  tbody.innerHTML = visibleRows.map((row, index) => `
    <tr>
      <td><span class="rank-pill">${index + 1}</span></td>
      <td>
        <div class="stock-name">
          <a href="https://finance.naver.com/item/main.naver?code=${row.ticker}" target="_blank" rel="noreferrer">${escapeHtml(row.name)}</a>
          <small>${escapeHtml(row.ticker)} · ${escapeHtml(row.investor)}</small>
        </div>
      </td>
      <td class="value ${row.netAmount >= 0 ? 'up' : 'down'}">${formatMoney(row.netAmount)}원<small>${sortLabel()}</small></td>
      <td>${formatNumber(row.netVolume)}주</td>
      <td>${formatMoney(row.buyAmount)}원</td>
      <td>${escapeHtml(row.marketCapLabel || '-')}</td>
      <td>${formatPercentRatio(row.buyToMarketCap)}</td>
      <td>${streakLabel(row)}</td>
      <td>${sparkline(seedTrend(row.ticker, row.netAmount >= 0 ? 'up' : 'down'), row.netAmount >= 0 ? 'up' : 'down')}</td>
    </tr>
  `).join('')

  const remaining = Math.max(state.filteredRows.length - visibleRows.length, 0)
  const loadMoreButton = document.querySelector('#loadMoreButton')
  document.querySelector('#rankingMeta').textContent = rankingMetaText(visibleRows.length, state.filteredRows.length)
  loadMoreButton.hidden = remaining === 0
  loadMoreButton.textContent = `아래로 20개 더 보기 ↓ (${remaining.toLocaleString('ko-KR')}개 남음)`
}

function updateSearchResults() {
  const container = document.querySelector('#searchResults')
  const query = state.query.trim().toLowerCase()

  if (!query) {
    container.hidden = true
    container.innerHTML = ''
    return
  }

  const matches = state.rows
    .filter((row) => row.name.toLowerCase().includes(query) || row.ticker.includes(query))
    .sort((a, b) => Math.abs(b.netAmount) - Math.abs(a.netAmount))
    .slice(0, 8)

  container.hidden = false
  if (matches.length === 0) {
    container.innerHTML = '<div class="search-result-head"><span>검색 결과 없음</span></div>'
    return
  }

  container.innerHTML = `
    <div class="search-result-head">
      <span>검색 결과</span>
      <b>${matches.length}개 표시</b>
    </div>
    <ol class="search-result-list">
      ${matches.map((row) => `
        <li>
          <div>
            <a href="https://finance.naver.com/item/main.naver?code=${row.ticker}" target="_blank" rel="noreferrer">${escapeHtml(row.name)}</a>
            <small>${escapeHtml(row.ticker)} · ${row.netAmount >= 0 ? '순매수' : '순매도'} · ${row.netAmount >= 0 ? row.buyStreak : row.sellStreak}일</small>
          </div>
          <b class="${row.netAmount >= 0 ? 'value up' : 'value down'}">${formatMoney(row.netAmount)}원</b>
          ${sparkline(seedTrend(row.ticker, row.netAmount >= 0 ? 'up' : 'down'), row.netAmount >= 0 ? 'up' : 'down')}
        </li>
      `).join('')}
    </ol>
  `
}

function bindControls() {
  document.querySelector('#viewTabs').addEventListener('click', (event) => {
    const button = event.target.closest('button[data-view]')
    if (!button) return
    document.querySelectorAll('#viewTabs button').forEach((item) => item.classList.toggle('active', item === button))
    document.querySelectorAll('.view').forEach((view) => view.classList.toggle('active', view.id === `${button.dataset.view}View`))
  })

  document.querySelector('#stockCountryTabs').addEventListener('click', (event) => {
    const button = event.target.closest('button[data-stock-country]')
    if (!button) return
    state.stockCountry = button.dataset.stockCountry
    document.querySelectorAll('#stockCountryTabs button').forEach((item) => item.classList.toggle('active', item === button))
    document.querySelectorAll('[data-stock-country-pane]').forEach((pane) => {
      pane.classList.toggle('active', pane.dataset.stockCountryPane === state.stockCountry)
    })
  })

  document.querySelector('#krStockSubTabs').addEventListener('click', (event) => {
    const button = event.target.closest('button[data-kr-stock-section]')
    if (!button) return
    state.krStockSection = button.dataset.krStockSection
    document.querySelectorAll('#krStockSubTabs button').forEach((item) => item.classList.toggle('active', item === button))
    document.querySelectorAll('[data-kr-stock-pane]').forEach((pane) => {
      pane.classList.toggle('active', pane.dataset.krStockPane === state.krStockSection)
    })
  })

  document.querySelector('#stockSearch').addEventListener('input', (event) => {
    state.query = event.target.value
    state.visibleLimit = 20
    updateSearchResults()
    updateStockTable()
  })

  document.querySelector('#sortRow').addEventListener('click', (event) => {
    const button = event.target.closest('button[data-sort]')
    if (!button) return
    state.sortKey = button.dataset.sort
    state.visibleLimit = 20
    document.querySelectorAll('#sortRow button').forEach((item) => item.classList.toggle('active', item === button))
    updateStockTable()
  })

  document.querySelector('#loadMoreButton').addEventListener('click', () => {
    state.visibleLimit += 20
    updateStockTable()
  })

  document.querySelector('#etfSearch').addEventListener('input', (event) => {
    state.etfQuery = event.target.value
    state.etfTheme = null
    state.selectedHolding = null
    renderEtfList()
    renderEtfDetail()
  })

  document.querySelector('#etfFilterRow').addEventListener('click', (event) => {
    const button = event.target.closest('button[data-etf-filter]')
    if (!button) return
    state.etfFilter = button.dataset.etfFilter
    state.selectedHolding = null
    document.querySelectorAll('#etfFilterRow button').forEach((item) => item.classList.toggle('active', item === button))
    renderEtfList()
    renderEtfDetail()
  })

  document.querySelector('#etfSectionGrid').addEventListener('click', (event) => {
    const button = event.target.closest('button[data-action="etf-theme"]')
    if (!button) return
    state.etfTheme = button.dataset.value
    state.etfQuery = ''
    state.etfFilter = 'all'
    state.selectedHolding = null
    document.querySelector('#etfSearch').value = ''
    document.querySelectorAll('#etfFilterRow button').forEach((item) => item.classList.toggle('active', item.dataset.etfFilter === 'all'))
    renderEtfList()
    renderEtfDetail()
  })

  document.querySelector('#etfList').addEventListener('click', (event) => {
    const button = event.target.closest('button[data-etf-code]')
    if (!button) return
    state.selectedEtfCode = button.dataset.etfCode
    state.selectedHolding = null
    renderEtfList()
    renderEtfDetail()
  })

  document.querySelector('#etfDetail').addEventListener('click', (event) => {
    const holdingButton = event.target.closest('button[data-holding-ticker]')
    if (holdingButton) {
      state.selectedHolding = holdingButton.dataset.holdingTicker
      renderEtfDetail()
      return
    }

    const etfButton = event.target.closest('button[data-etf-code]')
    if (etfButton) {
      state.selectedEtfCode = etfButton.dataset.etfCode
      state.selectedHolding = null
      renderEtfList()
      renderEtfDetail()
    }
  })
}

async function loadKrxData() {
  const indexResponse = await fetch(DATA_INDEX_URL, { cache: 'no-store' })
  if (!indexResponse.ok) throw new Error(`KRX index load failed: ${indexResponse.status}`)
  const index = await indexResponse.json()
  const files = [...(index.files ?? [])].sort((a, b) => b.date.localeCompare(a.date))
  const latest = index.latest || files[0]?.date
  if (!latest || files.length === 0) throw new Error('KRX CSV file is missing from index.json')

  state.stockMeta = await loadStockMeta()

  const parsedEntries = await Promise.all(files.map(async (fileMeta) => {
    const csvResponse = await fetch(`${DATA_BASE_URL}/${fileMeta.file}`, { cache: 'no-store' })
    if (!csvResponse.ok) throw new Error(`KRX CSV load failed: ${csvResponse.status}`)
    return [fileMeta.date, parseKrxCsv(await csvResponse.text())]
  }))

  state.meta = { ...index, latest }
  state.dates = parsedEntries.map(([date]) => date)
  state.rowsByDate = new Map(parsedEntries.map(([date, rows]) => [date, new Map(rows.map((row) => [row.ticker, row]))]))
  state.rows = enrichRows(parsedEntries.find(([date]) => date === latest)?.[1] ?? parsedEntries[0][1])
}

async function loadMarketIndex() {
  try {
    const response = await fetch('./data/market-index.json', { cache: 'no-store' })
    if (!response.ok) return fallbackMarketIndex
    return await response.json()
  } catch {
    return fallbackMarketIndex
  }
}

async function loadStockMeta() {
  const meta = builtinStockMeta()

  try {
    const response = await fetch('./data/stock-meta.json', { cache: 'no-store' })
    if (!response.ok) return meta
    const payload = await response.json()
    const entries = Array.isArray(payload) ? payload : Object.entries(payload).map(([ticker, value]) => ({ ticker, ...value }))

    entries.forEach((item) => {
      if (!item.ticker || !item.marketCap) return
      const marketCap = Number(item.marketCap)
      if (!marketCap) return
      const ticker = String(item.ticker).padStart(6, '0')
      meta.set(ticker, {
        ...item,
        ticker,
        name: item.name ?? meta.get(ticker)?.name,
        market: item.market ?? meta.get(ticker)?.market,
        sector: item.sector ?? meta.get(ticker)?.sector,
        marketCap,
        marketCapLabel: item.marketCapLabel ?? formatMarketCap(marketCap),
        price: Number(item.price) || null,
        changeRate: Number(item.changeRate) || 0,
        volume: Number(item.volume) || 0,
        amount: Number(item.amount) || 0,
        listedShares: Number(item.listedShares) || 0,
      })
    })
  } catch {
    return meta
  }

  return meta
}

async function main() {
  bindControls()
  renderEtfSections()

  try {
    state.marketIndex = await loadMarketIndex()
    await loadKrxData()
    renderSummary()
    renderMarketIndexStrip()
    renderThemeSections()
    renderMarketInsights()
    renderPensionSections()
    renderUsMarket()
    updateStockTable()
  } catch (error) {
    document.querySelector('#marketStatus').textContent = 'KRX 데이터 로딩 실패'
    document.querySelector('#themeSectionGrid').innerHTML = renderListPanel({ title: '데이터 오류', meta: 'error', items: [] })
    document.querySelector('#marketInsightGrid').innerHTML = ''
    document.querySelector('#marketRankingGrid').innerHTML = ''
    document.querySelector('#pensionSectionGrid').innerHTML = ''
    document.querySelector('#usMarketGrid').innerHTML = ''
    document.querySelector('#stockTableBody').innerHTML = `<tr><td colspan="9">${escapeHtml(error.message)}</td></tr>`
  }
}

main()
