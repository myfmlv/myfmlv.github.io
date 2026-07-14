const ETF_DATA_URL = './data/etf-universe.json'
const FAVORITES_KEY = 'myfmlv.etf.favorites.v1'
const PORTFOLIO_KEY = 'myfmlv.etf.portfolio.v1'
const RECENT_KEY = 'myfmlv.etf.recent.v1'
const THEME_KEY = 'myfmlv.etf.theme.v1'
const BACKUP_FORMAT = 'myfmlv-etf-backup'
const BACKUP_VERSION = 1
const PAGE_SIZE = 24

const SEARCH_ALIASES = new Map([
  ['엔비디아', ['nvidia', 'nvda']],
  ['테슬라', ['tesla', 'tsla']],
  ['애플', ['apple', 'aapl']],
  ['마이크로소프트', ['microsoft', 'msft']],
  ['아마존', ['amazon', 'amzn']],
  ['구글', ['alphabet', 'google', 'googl', 'goog']],
  ['알파벳', ['alphabet', 'googl', 'goog']],
  ['메타', ['meta platforms', 'meta']],
  ['브로드컴', ['broadcom', 'avgo']],
  ['버크셔', ['berkshire', 'brk']],
  ['코스트코', ['costco', 'cost']],
  ['팔란티어', ['palantir', 'pltr']],
  ['넷플릭스', ['netflix', 'nflx']],
  ['마이크론', ['micron', 'mu']],
])

const ALLOCATION_COLORS = ['#50e3b4', '#63a6ff', '#ff6680', '#ffca64', '#a98bff', '#43cad1', '#ff8e5b', '#8ad35e']

let etfs = []
let generatedAt = null

const state = {
  route: 'home',
  loading: true,
  loadError: null,
  finderQuery: '',
  searchMode: 'all',
  category: 'all',
  issuer: 'all',
  structure: 'all',
  sort: 'relevance',
  visibleCount: PAGE_SIZE,
  favorites: new Set(),
  portfolio: [],
  recent: [],
  compare: [],
  portfolioSelection: null,
  portfolioRange: '3m',
  detailCode: null,
  detailHoldingQuery: '',
  detailHoldingVisible: 50,
}

function readJsonStorage(key, fallback) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) ?? 'null')
    return parsed ?? fallback
  } catch {
    return fallback
  }
}

function writeJsonStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // 읽기 전용 브라우저에서는 현재 세션 동안만 상태를 유지합니다.
  }
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function finiteNumber(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function normalizeText(value) {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFKC')
    .replace(/[^0-9a-z가-힣]/g, '')
}

function queryVariants(query) {
  const normalized = normalizeText(query)
  if (!normalized) return []
  const variants = new Set([normalized])
  SEARCH_ALIASES.forEach((aliases, korean) => {
    const normalizedKorean = normalizeText(korean)
    if (normalized.includes(normalizedKorean) || normalizedKorean.includes(normalized)) {
      aliases.forEach((alias) => variants.add(normalizeText(alias)))
    }
  })
  return [...variants]
}

function formatPrice(value) {
  const number = finiteNumber(value)
  if (number === null) return '—'
  const decimals = Math.abs(number % 1) > 0.001 ? 2 : 0
  return `${number.toLocaleString('ko-KR', { maximumFractionDigits: decimals })}원`
}

function formatNumber(value, maximumFractionDigits = 0) {
  const number = finiteNumber(value)
  return number === null ? '—' : number.toLocaleString('ko-KR', { maximumFractionDigits })
}

function formatPercent(value, { signed = true } = {}) {
  const number = finiteNumber(value)
  if (number === null) return '—'
  const prefix = signed && number > 0 ? '+' : ''
  return `${prefix}${number.toFixed(2)}%`
}

function formatCompactWon(value) {
  const number = finiteNumber(value)
  if (number === null || number === 0) return '—'
  const absolute = Math.abs(number)
  const sign = number < 0 ? '-' : ''
  if (absolute >= 1_000_000_000_000) return `${sign}${(absolute / 1_000_000_000_000).toLocaleString('ko-KR', { maximumFractionDigits: 1 })}조`
  if (absolute >= 100_000_000) return `${sign}${(absolute / 100_000_000).toLocaleString('ko-KR', { maximumFractionDigits: absolute >= 10_000_000_000 ? 0 : 1 })}억`
  if (absolute >= 10_000) return `${sign}${(absolute / 10_000).toLocaleString('ko-KR', { maximumFractionDigits: 1 })}만`
  return `${sign}${absolute.toLocaleString('ko-KR', { maximumFractionDigits: 0 })}`
}

function formatDateTime(value) {
  if (!value) return '갱신시각 미확인'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return new Intl.DateTimeFormat('ko-KR', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Seoul',
  }).format(date)
}

function toneClass(value) {
  const number = finiteNumber(value)
  if (number === null || Math.abs(number) < 0.0001) return 'neutral'
  return number > 0 ? 'up' : 'down'
}

function normalizeEtf(item) {
  const priceHistory = Array.isArray(item.priceHistory)
    ? item.priceHistory
      .map((entry) => Array.isArray(entry) ? [String(entry[0] ?? ''), Number(entry[1])] : ['', Number(entry)])
      .filter((entry) => Number.isFinite(entry[1]) && entry[1] > 0)
    : []
  const dayTrend = Array.isArray(item.dayTrend)
    ? item.dayTrend.map(Number).filter((value) => Number.isFinite(value) && value > 0)
    : []

  return {
    code: String(item.code ?? ''),
    name: String(item.name ?? ''),
    issuer: String(item.issuer ?? '운용사 미확인'),
    category: String(item.category ?? item.etfType ?? '기타 ETF'),
    etfType: String(item.etfType ?? item.category ?? ''),
    themes: Array.isArray(item.themes) ? item.themes.map(String).filter(Boolean) : [],
    price: Number(item.price) || priceHistory.at(-1)?.[1] || 0,
    changeRate: finiteNumber(item.changeRate) ?? 0,
    amount: Number(item.amount) || 0,
    marketCap: Number(item.marketCap) || 0,
    iNav: finiteNumber(item.iNav),
    returnRate1m: finiteNumber(item.returnRate1m),
    returnRate3m: finiteNumber(item.returnRate3m),
    returnRate6m: finiteNumber(item.returnRate6m),
    priceHistory,
    dayTrend,
    holdings: Array.isArray(item.holdings)
      ? item.holdings.map((holding) => {
        const [name, ticker, weight, quantity] = Array.isArray(holding) ? holding : []
        return [String(name ?? ''), String(ticker ?? ''), Number(weight) || 0, Number(quantity) || 0]
      }).filter(([name]) => name)
      : [],
  }
}

function premiumRate(item) {
  if (!item || !Number.isFinite(item.price) || !Number.isFinite(item.iNav) || item.iNav <= 0) return null
  return ((item.price - item.iNav) / item.iNav) * 100
}

function categoryGroup(item) {
  const text = normalizeText(`${item.category} ${item.etfType} ${item.name} ${(item.themes ?? []).join(' ')}`)
  if (text.includes('국내상장미국') || text.includes('미국') || text.includes('나스닥') || text.includes('sp500')) return '미국주식'
  if (text.includes('해외주식') || text.includes('글로벌주식')) return '해외주식'
  if (text.includes('채권') || text.includes('국고채') || text.includes('회사채') || text.includes('금리')) return '채권'
  if (text.includes('원자재') || text.includes('금선물') || text.includes('은선물') || text.includes('원유')) return '원자재'
  if (text.includes('국내주식') || text.includes('코스피') || text.includes('코스닥')) return '국내주식'
  return '기타'
}

function structureGroup(item) {
  const text = normalizeText(`${item.name} ${item.etfType} ${item.category}`)
  if (text.includes('인버스')) return 'inverse'
  if (text.includes('레버리지') || /2x/i.test(item.name)) return 'leverage'
  if (text.includes('커버드콜')) return 'covered'
  if (text.includes('액티브')) return 'active'
  return 'general'
}

function itemText(item, mode = 'all') {
  const etfText = `${item.name} ${item.code} ${item.issuer} ${item.category} ${item.etfType} ${item.themes.join(' ')}`
  const holdingText = item.holdings.map(([name, ticker]) => `${name} ${ticker}`).join(' ')
  if (mode === 'etf') return normalizeText(etfText)
  if (mode === 'holding') return normalizeText(holdingText)
  return normalizeText(`${etfText} ${holdingText}`)
}

function matchesVariants(text, variants) {
  return variants.length === 0 || variants.some((variant) => text.includes(variant))
}

function matchedHolding(item, query = state.finderQuery) {
  if (!query.trim()) return null
  const variants = queryVariants(query)
  return item.holdings
    .filter(([name, ticker]) => matchesVariants(normalizeText(`${name} ${ticker}`), variants))
    .sort((a, b) => b[2] - a[2] || Math.abs(b[3]) - Math.abs(a[3]))[0] ?? null
}

function relevanceScore(item, query = state.finderQuery) {
  const normalizedQuery = normalizeText(query)
  if (!normalizedQuery) return 0
  const name = normalizeText(item.name)
  const code = normalizeText(item.code)
  const holding = matchedHolding(item, query)
  if (code === normalizedQuery) return 10000
  if (name === normalizedQuery) return 9000
  if (name.startsWith(normalizedQuery)) return 8000
  if (name.includes(normalizedQuery)) return 7000
  if (holding) return 6000 + (holding[2] || 0) * 10
  if (normalizeText(item.issuer).includes(normalizedQuery)) return 4000
  return 1000
}

function filteredEtfs() {
  const variants = queryVariants(state.finderQuery)
  const hasQuery = variants.length > 0
  const items = etfs.filter((item) => {
    if (hasQuery && !matchesVariants(itemText(item, state.searchMode), variants)) return false
    if (state.category !== 'all' && categoryGroup(item) !== state.category) return false
    if (state.issuer !== 'all' && item.issuer !== state.issuer) return false
    if (state.structure !== 'all' && structureGroup(item) !== state.structure) return false
    return true
  })

  return items.sort((a, b) => {
    if (state.sort === 'amount') return b.amount - a.amount || b.marketCap - a.marketCap
    if (state.sort === 'marketCap') return b.marketCap - a.marketCap || b.amount - a.amount
    if (state.sort === 'return1m') return (b.returnRate1m ?? -Infinity) - (a.returnRate1m ?? -Infinity)
    if (state.sort === 'premium') return Math.abs(premiumRate(b) ?? -Infinity) - Math.abs(premiumRate(a) ?? -Infinity)
    return relevanceScore(b) - relevanceScore(a) || b.amount - a.amount
  })
}

function historyValues(item, preferDay = false) {
  if (preferDay && item.dayTrend.length >= 2) return item.dayTrend
  return item.priceHistory.map((entry) => entry[1]).filter(Number.isFinite)
}

function sparkline(values, tone = 'neutral', width = 180, height = 56) {
  const source = (Array.isArray(values) ? values : []).map(Number).filter(Number.isFinite)
  if (source.length < 2) return '<span>—</span>'
  const visible = source.slice(-60)
  const min = Math.min(...visible)
  const max = Math.max(...visible)
  const range = max - min || 1
  const points = visible.map((value, index) => {
    const x = (index / Math.max(visible.length - 1, 1)) * width
    const y = height - ((value - min) / range) * (height - 6) - 3
    return [x, y]
  })
  const line = points.map(([x, y], index) => `${index === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ')
  const area = `${line} L${width} ${height} L0 ${height} Z`
  return `<svg class="sparkline ${tone}" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-hidden="true"><path class="area" d="${area}" fill="currentColor"></path><path class="line" d="${line}"></path></svg>`
}

function riskMetricsFromPrices(values) {
  const prices = values.map(Number).filter((value) => Number.isFinite(value) && value > 0)
  if (prices.length < 3) return { volatility: null, maxDrawdown: null, sharpe: null, sortino: null, calmar: null }
  const returns = prices.slice(1).map((price, index) => (price / prices[index]) - 1)
  const average = returns.reduce((sum, value) => sum + value, 0) / returns.length
  const variance = returns.reduce((sum, value) => sum + ((value - average) ** 2), 0) / Math.max(returns.length - 1, 1)
  const volatilityDecimal = Math.sqrt(variance) * Math.sqrt(252)
  const downsideVariance = returns.reduce((sum, value) => sum + (Math.min(value, 0) ** 2), 0) / returns.length
  const downsideVolatility = Math.sqrt(downsideVariance) * Math.sqrt(252)
  let peak = prices[0]
  let maxDrawdown = 0
  prices.forEach((price) => {
    peak = Math.max(peak, price)
    maxDrawdown = Math.min(maxDrawdown, ((price - peak) / peak) * 100)
  })
  const annualReturn = average * 252
  return {
    volatility: volatilityDecimal * 100,
    maxDrawdown,
    sharpe: volatilityDecimal > 0 ? (annualReturn - 0.035) / volatilityDecimal : null,
    sortino: downsideVolatility > 0 ? (annualReturn - 0.035) / downsideVolatility : null,
    calmar: maxDrawdown < 0 ? annualReturn / Math.abs(maxDrawdown / 100) : null,
  }
}

function riskMetrics(item) {
  return riskMetricsFromPrices(historyValues(item))
}

function sessionLabel() {
  const now = new Date()
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    weekday: 'short',
  }).formatToParts(now)
  const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? 0)
  const minute = Number(parts.find((part) => part.type === 'minute')?.value ?? 0)
  const weekday = parts.find((part) => part.type === 'weekday')?.value ?? ''
  const minutes = hour * 60 + minute
  if (['Sat', 'Sun'].includes(weekday)) return 'KRX 휴장'
  if (minutes >= 540 && minutes <= 930) return 'KRX 정규장'
  if (minutes >= 480 && minutes < 540) return '개장 준비'
  return 'KRX 마감'
}

function findEtf(code) {
  return etfs.find((item) => item.code === String(code)) ?? null
}

function routeFromHash() {
  const route = window.location.hash.replace('#', '').split('?')[0]
  return ['home', 'finder', 'portfolio', 'favorites'].includes(route) ? route : 'home'
}

function setRoute(route, { focusSearch = false, scroll = true } = {}) {
  if (!['home', 'finder', 'portfolio', 'favorites'].includes(route)) return
  state.route = route
  document.querySelectorAll('[data-view]').forEach((view) => {
    const active = view.dataset.view === route
    view.classList.toggle('active', active)
    view.hidden = !active
  })
  document.querySelectorAll('[data-route]').forEach((button) => {
    const active = button.dataset.route === route
    button.classList.toggle('active', active)
    if (button.getAttribute('role') === 'tab') button.setAttribute('aria-selected', String(active))
  })
  history.replaceState(null, '', `#${route}`)
  if (route === 'finder') renderFinder()
  if (route === 'portfolio') renderPortfolio()
  if (route === 'favorites') renderFavorites()
  if (route === 'home') renderHomePortfolioSummary()
  if (scroll) window.scrollTo({ top: 0, behavior: 'smooth' })
  if (focusSearch && route === 'finder') requestAnimationFrame(() => document.querySelector('#finderSearch')?.focus())
}

function openFinder(query = '', mode = 'all') {
  state.finderQuery = query
  state.searchMode = mode
  state.visibleCount = PAGE_SIZE
  if (query.trim() && state.sort === 'amount') state.sort = 'relevance'
  document.querySelector('#finderSearch').value = query
  document.querySelector('#sortFilter').value = state.sort
  updateSearchModeTabs()
  setRoute('finder', { focusSearch: !query })
}

function updateSearchModeTabs() {
  document.querySelectorAll('[data-search-mode]').forEach((button) => {
    if (!button.closest('.search-mode-tabs')) return
    const active = button.dataset.searchMode === state.searchMode
    button.classList.toggle('active', active)
    button.setAttribute('aria-selected', String(active))
  })
  const helper = document.querySelector('#searchHelper')
  if (state.searchMode === 'holding') helper.textContent = '종목명 또는 티커를 입력하세요. 예: 삼성전자, SK하이닉스, NVIDIA, TSLA'
  else if (state.searchMode === 'etf') helper.textContent = 'ETF명, 종목코드, 운용사, 테마를 검색합니다. 예: KODEX 200, 069500, 월배당'
  else helper.textContent = '예: KODEX 200, 069500, 반도체, 삼성전자, NVIDIA'
}

function showToast(message) {
  const region = document.querySelector('#toastRegion')
  const toast = document.createElement('div')
  toast.className = 'toast'
  toast.textContent = message
  region.append(toast)
  window.setTimeout(() => toast.remove(), 2800)
}

function renderHome() {
  if (state.loading) return
  if (state.loadError) {
    document.querySelector('#homeRankingGrid').innerHTML = `<div class="empty-state"><div><span>!</span><h2>ETF 데이터를 불러오지 못했습니다</h2><p>${escapeHtml(state.loadError.message)}</p></div></div>`
    return
  }
  document.querySelector('#heroEtfCount').textContent = etfs.length.toLocaleString('ko-KR')
  document.querySelector('#heroUpdatedAt').textContent = formatDateTime(generatedAt)

  const valid = etfs.filter((item) => item.price > 0)
  const top = [...valid].sort((a, b) => b.amount - a.amount)[0]
  const upCount = valid.filter((item) => item.changeRate > 0).length
  const downCount = valid.filter((item) => item.changeRate < 0).length
  const flatCount = valid.length - upCount - downCount

  if (top) {
    document.querySelector('#heroSnapshotMain').innerHTML = `
      <div class="snapshot-main-head"><small>${escapeHtml(top.code)} · 거래대금 1위</small><small>${escapeHtml(sessionLabel())}</small></div>
      <h2>${escapeHtml(top.name)}</h2>
      <div class="snapshot-price"><strong>${formatPrice(top.price)}</strong><span class="${toneClass(top.changeRate)}">${formatPercent(top.changeRate)}</span></div>
      <div class="snapshot-chart">${sparkline(historyValues(top, true), toneClass(top.changeRate), 310, 58)}</div>
    `
  }
  document.querySelector('#heroSnapshotStats').innerHTML = `
    <div><span>상승</span><strong class="up">${upCount.toLocaleString('ko-KR')}</strong></div>
    <div><span>하락</span><strong class="down">${downCount.toLocaleString('ko-KR')}</strong></div>
    <div><span>보합</span><strong>${flatCount.toLocaleString('ko-KR')}</strong></div>
  `

  const amountItems = [...valid].sort((a, b) => b.amount - a.amount).slice(0, 5)
  const premiumItems = valid
    .map((item) => ({ item, value: premiumRate(item) }))
    .filter(({ value }) => value !== null && Math.abs(value) <= 10)
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
    .slice(0, 5)
    .map(({ item }) => item)
  const returnItems = [...valid].sort((a, b) => b.changeRate - a.changeRate).slice(0, 5)

  document.querySelector('#homeRankingGrid').innerHTML = [
    rankingCard('MOST TRADED', '거래대금 상위', amountItems, (item) => `${formatCompactWon(item.amount)}원`),
    rankingCard('PREMIUM / DISCOUNT', '괴리율 주목', premiumItems, (item) => formatPercent(premiumRate(item))),
    rankingCard('TOP MOVERS', '오늘 상승률', returnItems, (item) => formatPercent(item.changeRate)),
  ].join('')

  renderRecent()
  renderHomePortfolioSummary()
}

function rankingCard(kicker, title, items, valueFormatter) {
  return `
    <article class="ranking-card">
      <div class="rank-card-head"><div><small>${escapeHtml(kicker)}</small><strong>${escapeHtml(title)}</strong></div><span aria-hidden="true">↗</span></div>
      <ol class="ranking-list">
        ${items.map((item, index) => `
          <li><button class="ranking-item" type="button" data-open-etf="${escapeHtml(item.code)}"><span>${index + 1}</span><span><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.code)} · ${escapeHtml(item.issuer)}</small></span><b class="${title.includes('거래') ? 'neutral' : toneClass(title.includes('괴리') ? premiumRate(item) : item.changeRate)}">${escapeHtml(valueFormatter(item))}</b></button></li>
        `).join('')}
      </ol>
    </article>
  `
}

function renderHomePortfolioSummary() {
  const title = document.querySelector('#homePortfolioTitle')
  const meta = document.querySelector('#homePortfolioMeta')
  if (!title || !meta || state.loading) return
  const positions = portfolioPositions()
  if (positions.length === 0) {
    title.textContent = '내 ETF 한눈에 보기'
    meta.textContent = '보유 ETF를 등록해 평가금액과 노출을 확인하세요'
    return
  }
  const total = positions.reduce((sum, position) => sum + position.value, 0)
  const cost = positions.reduce((sum, position) => sum + position.cost, 0)
  title.textContent = `${formatCompactWon(total)}원 · ${positions.length}개 ETF`
  meta.textContent = `평가손익 ${formatCompactWon(total - cost)}원 (${cost > 0 ? formatPercent(((total - cost) / cost) * 100) : '—'})`
}

function renderRecent() {
  const recentItems = state.recent.map(findEtf).filter(Boolean).slice(0, 4)
  const section = document.querySelector('#recentSection')
  if (recentItems.length === 0) {
    section.hidden = true
    return
  }
  section.hidden = false
  document.querySelector('#recentGrid').innerHTML = recentItems.map((item) => etfCard(item, { compact: true })).join('')
}

function populateFilters() {
  const categorySelect = document.querySelector('#categoryFilter')
  const issuerSelect = document.querySelector('#issuerFilter')
  const categories = [
    ['국내주식', '국내주식'],
    ['미국주식', '미국주식'],
    ['해외주식', '해외주식'],
    ['채권', '채권'],
    ['원자재', '원자재'],
    ['기타', '기타'],
  ]
  categorySelect.innerHTML = '<option value="all">전체</option>' + categories.map(([value, label]) => `<option value="${value}">${label}</option>`).join('')
  const issuers = [...new Set(etfs.map((item) => item.issuer).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ko'))
  issuerSelect.innerHTML = '<option value="all">전체</option>' + issuers.map((issuer) => `<option value="${escapeHtml(issuer)}">${escapeHtml(issuer)}</option>`).join('')
}

function renderFinder() {
  const results = document.querySelector('#finderResults')
  if (state.loading) {
    results.innerHTML = Array.from({ length: 6 }, () => '<article class="etf-card"><div class="skeleton skeleton-title"></div><div class="skeleton skeleton-value"></div><div class="skeleton skeleton-line"></div></article>').join('')
    return
  }
  if (state.loadError) {
    results.innerHTML = `<div class="empty-state"><div><span>!</span><h2>데이터를 불러오지 못했습니다</h2><p>${escapeHtml(state.loadError.message)}</p></div></div>`
    return
  }

  document.querySelector('#finderSearch').value = state.finderQuery
  document.querySelector('#categoryFilter').value = state.category
  document.querySelector('#issuerFilter').value = state.issuer
  document.querySelector('#structureFilter').value = state.structure
  document.querySelector('#sortFilter').value = state.sort
  document.querySelector('#clearFinderSearch').hidden = !state.finderQuery
  document.querySelector('#finderDataStamp').textContent = `${etfs.length.toLocaleString('ko-KR')}개 · ${formatDateTime(generatedAt)} 기준`
  updateSearchModeTabs()

  const filtered = filteredEtfs()
  const visible = filtered.slice(0, state.visibleCount)
  const query = state.finderQuery.trim()
  const resultTitle = query
    ? (state.searchMode === 'holding' ? `'${query}' 포함 ETF` : `'${query}' 검색 결과`)
    : '전체 ETF'
  document.querySelector('#finderResultTitle').textContent = resultTitle
  document.querySelector('#finderResultCount').textContent = `${filtered.length.toLocaleString('ko-KR')}개`
  document.querySelector('#finderResultHint').textContent = state.searchMode === 'holding'
    ? '구성종목 비중이 큰 ETF부터 검색 연관도에 반영합니다.'
    : 'ETF를 선택하면 구성종목과 위험지표를 볼 수 있습니다.'
  document.querySelector('#resultStatus').textContent = `${filtered.length.toLocaleString('ko-KR')}개의 ETF 검색 결과`

  if (filtered.length === 0) {
    results.innerHTML = `<div class="empty-state"><div><span>⌕</span><h2>조건에 맞는 ETF가 없습니다</h2><p>검색어를 줄이거나 자산·운용사·구조 필터를 초기화해 보세요.</p><button class="primary-button" type="button" data-reset-finder>필터 초기화</button></div></div>`
  } else {
    results.innerHTML = visible.map((item) => etfCard(item)).join('')
  }
  const loadMore = document.querySelector('#finderLoadMore')
  loadMore.hidden = visible.length >= filtered.length
  loadMore.textContent = `ETF 더 보기 (${(filtered.length - visible.length).toLocaleString('ko-KR')}개 남음)`
}

function etfCard(item, { compact = false } = {}) {
  const premium = premiumRate(item)
  const holding = matchedHolding(item)
  const isFavorite = state.favorites.has(item.code)
  const isCompared = state.compare.includes(item.code)
  const tags = [categoryGroup(item), structureGroup(item) !== 'general' ? structureLabel(structureGroup(item)) : item.themes[0]].filter(Boolean)
  return `
    <article class="etf-card${compact ? ' compact-card' : ''}">
      <div class="etf-card-top">
        <button class="etf-card-button" type="button" data-open-etf="${escapeHtml(item.code)}">
          <span class="etf-card-code">${escapeHtml(item.code)}</span>
          <h3>${escapeHtml(item.name)}</h3>
          <span class="etf-card-issuer">${escapeHtml(item.issuer)}</span>
        </button>
        <div class="card-action-group">
          <button class="card-icon-button${isCompared ? ' active' : ''}" type="button" data-compare-etf="${escapeHtml(item.code)}" aria-label="${escapeHtml(item.name)} 비교함 ${isCompared ? '제거' : '추가'}" aria-pressed="${isCompared}">≋</button>
          <button class="card-icon-button${isFavorite ? ' active' : ''}" type="button" data-favorite-etf="${escapeHtml(item.code)}" aria-label="${escapeHtml(item.name)} 관심 ${isFavorite ? '해제' : '등록'}" aria-pressed="${isFavorite}">${isFavorite ? '★' : '☆'}</button>
        </div>
      </div>
      ${holding ? `<div class="matched-holding"><span>${escapeHtml(holding[0])}${holding[1] ? ` · ${escapeHtml(holding[1])}` : ''}</span><strong>${holding[2] > 0 ? `${holding[2].toFixed(1)}%` : `CU ${formatNumber(holding[3], 2)}`}</strong></div>` : ''}
      <div class="etf-card-metrics">
        <div><span>현재가</span><strong>${formatPrice(item.price)}</strong></div>
        <div><span>오늘</span><strong class="${toneClass(item.changeRate)}">${formatPercent(item.changeRate)}</strong></div>
        <div><span>공식 iNAV</span><strong>${formatPrice(item.iNav)}</strong></div>
        <div><span>괴리율</span><strong class="${toneClass(premium)}">${formatPercent(premium)}</strong></div>
      </div>
      <div class="card-bottom"><div class="card-tags">${tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}</div><b>${formatCompactWon(item.amount)}원</b></div>
    </article>
  `
}

function structureLabel(value) {
  return {
    active: '액티브',
    covered: '커버드콜',
    leverage: '레버리지',
    inverse: '인버스',
  }[value] ?? '일반형'
}

function addRecent(code) {
  state.recent = [code, ...state.recent.filter((item) => item !== code)].slice(0, 8)
  writeJsonStorage(RECENT_KEY, state.recent)
}

function openEtfDetail(code) {
  const item = findEtf(code)
  if (!item) return
  addRecent(item.code)
  state.detailCode = item.code
  state.detailHoldingQuery = ''
  state.detailHoldingVisible = 50
  renderDetail(item)
  const dialog = document.querySelector('#etfDetailDialog')
  if (!dialog.open) dialog.showModal()
}

function renderDetail(item) {
  const premium = premiumRate(item)
  const risk = riskMetrics(item)
  const favorite = state.favorites.has(item.code)
  const compared = state.compare.includes(item.code)
  const values = historyValues(item)

  document.querySelector('#etfDetailContent').innerHTML = `
    <header class="detail-header">
      <div class="detail-kicker">${escapeHtml(item.code)} · ${escapeHtml(item.issuer)} · ${escapeHtml(item.category)}</div>
      <div class="detail-title-row">
        <h2 id="detailDialogTitle">${escapeHtml(item.name)}</h2>
        <div class="detail-actions">
          <button class="${favorite ? 'active' : ''}" type="button" data-favorite-etf="${escapeHtml(item.code)}">${favorite ? '★ 관심' : '☆ 관심'}</button>
          <button class="${compared ? 'active' : ''}" type="button" data-compare-etf="${escapeHtml(item.code)}">≋ 비교 ${compared ? '빼기' : '담기'}</button>
          <button type="button" data-add-portfolio="${escapeHtml(item.code)}">＋ 포트폴리오</button>
        </div>
      </div>
    </header>
    <div class="detail-hero-grid">
      <section class="detail-price-card">
        <div class="price-block"><span>현재가</span><strong>${formatPrice(item.price)}</strong><div class="price-change ${toneClass(item.changeRate)}"><span>${formatPercent(item.changeRate)}</span></div></div>
        <div class="detail-chart">${sparkline(values, toneClass(item.changeRate), 560, 160)}</div>
      </section>
      <section class="detail-metric-card">
        <div><span>공식 iNAV</span><strong>${formatPrice(item.iNav)}</strong></div>
        <div><span>괴리율</span><strong class="${toneClass(premium)}">${formatPercent(premium)}</strong></div>
        <div><span>시가총액</span><strong>${formatCompactWon(item.marketCap)}원</strong></div>
        <div><span>거래대금</span><strong>${formatCompactWon(item.amount)}원</strong></div>
      </section>
    </div>
    <div class="detail-info-grid">
      <section class="detail-section">
        <div class="detail-section-head"><h3>기간 수익률</h3><span>가격 데이터 기준</span></div>
        <dl class="metric-list"><div><dt>1개월</dt><dd class="${toneClass(item.returnRate1m)}">${formatPercent(item.returnRate1m)}</dd></div><div><dt>3개월</dt><dd class="${toneClass(item.returnRate3m)}">${formatPercent(item.returnRate3m)}</dd></div><div><dt>6개월</dt><dd class="${toneClass(item.returnRate6m)}">${formatPercent(item.returnRate6m)}</dd></div></dl>
      </section>
      <section class="detail-section">
        <div class="detail-section-head"><h3>위험지표</h3><span>보유 가격이력 기준</span></div>
        <dl class="metric-list risk-list"><div><dt>연환산 변동성</dt><dd>${formatPercent(risk.volatility, { signed: false })}</dd></div><div><dt>최대낙폭</dt><dd class="down">${formatPercent(risk.maxDrawdown)}</dd></div><div><dt>Sharpe</dt><dd>${risk.sharpe === null ? '—' : risk.sharpe.toFixed(2)}</dd></div><div><dt>Sortino</dt><dd>${risk.sortino === null ? '—' : risk.sortino.toFixed(2)}</dd></div><div><dt>Calmar</dt><dd>${risk.calmar === null ? '—' : risk.calmar.toFixed(2)}</dd></div></dl>
      </section>
      <section class="detail-section full">
        <div class="detail-section-head holding-section-head">
          <div><h3>구성종목</h3><span id="detailHoldingSummary">${item.holdings.length.toLocaleString('ko-KR')}개 · 종목을 누르면 역검색</span></div>
          ${item.holdings.length > 0 ? `<label class="holding-search"><span aria-hidden="true">⌕</span><input id="detailHoldingSearch" type="search" value="${escapeHtml(state.detailHoldingQuery)}" placeholder="구성종목명·코드 검색" autocomplete="off" aria-label="구성종목 검색" /></label>` : ''}
        </div>
        <div id="detailHoldingsContent"></div>
      </section>
    </div>
    <p class="detail-note">공식 iNAV는 KRX 정규장 기준 참고값입니다. 이 화면은 장 마감 후 추정 iNAV를 제공하지 않으며 실제 체결가와 다를 수 있습니다.</p>
  `
  renderDetailHoldings(item)
}

function renderDetailHoldings(item) {
  const container = document.querySelector('#detailHoldingsContent')
  if (!container) return
  const variants = queryVariants(state.detailHoldingQuery)
  const filtered = item.holdings.filter(([name, ticker]) => matchesVariants(normalizeText(`${name} ${ticker}`), variants))
  const visible = filtered.slice(0, state.detailHoldingVisible)
  const remaining = Math.max(filtered.length - visible.length, 0)
  const maxWeight = Math.max(...filtered.map((holding) => holding[2]), 1)
  const summary = document.querySelector('#detailHoldingSummary')
  if (summary) {
    summary.textContent = state.detailHoldingQuery
      ? `전체 ${item.holdings.length.toLocaleString('ko-KR')}개 중 ${filtered.length.toLocaleString('ko-KR')}개 검색`
      : `${item.holdings.length.toLocaleString('ko-KR')}개 · 현재 ${visible.length.toLocaleString('ko-KR')}개 표시`
  }

  if (item.holdings.length === 0) {
    container.innerHTML = '<div class="empty-state compact"><p>공개된 구성종목 데이터가 없습니다.</p></div>'
    return
  }
  if (visible.length === 0) {
    container.innerHTML = `<div class="empty-state compact"><p>‘${escapeHtml(state.detailHoldingQuery)}’와 일치하는 구성종목이 없습니다.</p></div>`
    return
  }

  container.innerHTML = `
    <div class="holding-table-wrap">
      <table class="holding-table">
        <thead><tr><th scope="col">종목</th><th scope="col">구분</th><th scope="col">비중 / CU 수량</th></tr></thead>
        <tbody>${visible.map(([name, ticker, weight, quantity]) => `
          <tr><td><button class="holding-name-button" type="button" data-reverse-holding="${escapeHtml(name)}"><strong>${escapeHtml(name)}</strong><small>${escapeHtml(ticker || '코드 미확인')}</small></button></td><td>${ticker ? '구성자산' : '기타자산'}</td><td>${weight > 0 ? `<span class="holding-weight"><i style="--weight:${Math.max(2, (weight / maxWeight) * 100).toFixed(1)}%"></i><b>${weight.toFixed(2)}%</b></span>` : `<b>CU ${formatNumber(quantity, 2)}</b>`}</td></tr>
        `).join('')}</tbody>
      </table>
    </div>
    ${remaining > 0 ? `<button class="load-more-button holding-load-more" type="button" data-load-more-holdings>구성종목 더 보기 <span>${remaining.toLocaleString('ko-KR')}개 남음</span></button>` : ''}
  `
}

function toggleFavorite(code) {
  const item = findEtf(code)
  if (!item) return
  if (state.favorites.has(code)) {
    state.favorites.delete(code)
    showToast(`${item.name} 관심 ETF를 해제했습니다.`)
  } else {
    state.favorites.add(code)
    showToast(`${item.name} 관심 ETF에 추가했습니다.`)
  }
  writeJsonStorage(FAVORITES_KEY, [...state.favorites])
  if (state.route === 'finder') renderFinder()
  if (state.route === 'favorites') renderFavorites()
  if (document.querySelector('#etfDetailDialog').open) renderDetail(item)
}

function renderFavorites() {
  if (state.loading) return
  const items = [...state.favorites].map(findEtf).filter(Boolean)
  document.querySelector('#favoriteCount').textContent = `${items.length.toLocaleString('ko-KR')}개`
  document.querySelector('#favoritesGrid').innerHTML = items.length > 0
    ? items.map((item) => etfCard(item)).join('')
    : `<div class="empty-state"><div><span>☆</span><h2>아직 관심 ETF가 없습니다</h2><p>ETF 카드나 상세 화면에서 별표를 누르면 이곳에서 빠르게 확인할 수 있습니다.</p><button class="primary-button" type="button" data-route="finder">ETF 찾아보기</button></div></div>`
}

function toggleCompare(code) {
  const item = findEtf(code)
  if (!item) return
  if (state.compare.includes(code)) {
    state.compare = state.compare.filter((value) => value !== code)
  } else if (state.compare.length >= 4) {
    showToast('ETF는 최대 4개까지 비교할 수 있습니다.')
    return
  } else {
    state.compare.push(code)
  }
  renderCompareTray()
  if (state.route === 'finder') renderFinder()
  if (state.route === 'favorites') renderFavorites()
  if (document.querySelector('#etfDetailDialog').open) renderDetail(item)
}

function renderCompareTray() {
  const tray = document.querySelector('#compareTray')
  tray.hidden = state.compare.length === 0
  document.querySelector('#compareCount').textContent = state.compare.length
  document.querySelector('#compareTrayItems').innerHTML = state.compare
    .map(findEtf)
    .filter(Boolean)
    .map((item) => `<span class="compare-chip">${escapeHtml(item.name)}</span>`)
    .join('')
}

function openCompareDialog() {
  const items = state.compare.map(findEtf).filter(Boolean)
  if (items.length < 2) {
    showToast('비교할 ETF를 2개 이상 담아주세요.')
    return
  }
  renderCompare(items)
  const dialog = document.querySelector('#compareDialog')
  if (!dialog.open) dialog.showModal()
}

function renderCompare(items) {
  const metrics = [
    ['현재가', (item) => formatPrice(item.price)],
    ['오늘 등락률', (item) => formatPercent(item.changeRate)],
    ['공식 iNAV', (item) => formatPrice(item.iNav)],
    ['괴리율', (item) => formatPercent(premiumRate(item))],
    ['시가총액', (item) => `${formatCompactWon(item.marketCap)}원`],
    ['거래대금', (item) => `${formatCompactWon(item.amount)}원`],
    ['1개월 수익률', (item) => formatPercent(item.returnRate1m)],
    ['3개월 수익률', (item) => formatPercent(item.returnRate3m)],
    ['6개월 수익률', (item) => formatPercent(item.returnRate6m)],
    ['변동성', (item) => formatPercent(riskMetrics(item).volatility, { signed: false })],
    ['최대낙폭', (item) => formatPercent(riskMetrics(item).maxDrawdown)],
    ['Sharpe', (item) => riskMetrics(item).sharpe?.toFixed(2) ?? '—'],
    ['Sortino', (item) => riskMetrics(item).sortino?.toFixed(2) ?? '—'],
    ['Calmar', (item) => riskMetrics(item).calmar?.toFixed(2) ?? '—'],
  ]

  const holdingMap = new Map()
  items.forEach((item) => item.holdings.forEach(([name, ticker, weight]) => {
    const key = ticker || normalizeText(name)
    const existing = holdingMap.get(key) ?? { name, ticker, count: 0, totalWeight: 0 }
    existing.count += 1
    existing.totalWeight += weight || 0
    holdingMap.set(key, existing)
  }))
  const overlaps = [...holdingMap.values()]
    .filter((holding) => holding.count >= 2)
    .sort((a, b) => b.count - a.count || b.totalWeight - a.totalWeight)
    .slice(0, 20)

  document.querySelector('#compareContent').innerHTML = `
    <div class="compare-selected-grid" style="--compare-count:${items.length}">${items.map((item) => `<article class="compare-selected-card"><small>${escapeHtml(item.code)} · ${escapeHtml(item.issuer)}</small><h3>${escapeHtml(item.name)}</h3><strong class="${toneClass(item.changeRate)}">${formatPercent(item.changeRate)}</strong></article>`).join('')}</div>
    <div class="compare-table-wrap"><table class="compare-table"><thead><tr><th scope="col">비교 항목</th>${items.map((item) => `<th scope="col">${escapeHtml(item.name)}</th>`).join('')}</tr></thead><tbody>${metrics.map(([label, formatter]) => `<tr><td>${label}</td>${items.map((item) => `<td>${escapeHtml(formatter(item))}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
    <section class="compare-overlap"><h3>겹치는 구성종목</h3>${overlaps.length > 0 ? `<div class="overlap-chips">${overlaps.map((holding) => `<span class="overlap-chip">${escapeHtml(holding.name)} · ${holding.count}개 ETF</span>`).join('')}</div>` : '<p>공통으로 확인되는 구성종목이 없습니다.</p>'}</section>
  `
}

function loadPortfolio() {
  const saved = readJsonStorage(PORTFOLIO_KEY, [])
  state.portfolio = Array.isArray(saved)
    ? saved.map((position) => ({
      code: String(position.code ?? ''),
      quantity: Number(position.quantity) || 0,
      averagePrice: Number(position.averagePrice) || 0,
    })).filter((position) => position.code && position.quantity > 0)
    : []
}

function savePortfolio() {
  writeJsonStorage(PORTFOLIO_KEY, state.portfolio)
  renderHomePortfolioSummary()
}

function backupPayload() {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    portfolio: state.portfolio.map(({ code, quantity, averagePrice }) => ({ code, quantity, averagePrice })),
    favorites: [...state.favorites],
  }
}

function exportPortfolioData() {
  const payload = backupPayload()
  const blob = new Blob([`${JSON.stringify(payload, null, 2)}\n`], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date())
  link.href = url
  link.download = `myfmlv-etf-backup-${date}.json`
  document.body.append(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
  showToast(`포트폴리오 ${payload.portfolio.length}개와 관심 ETF ${payload.favorites.length}개를 백업했습니다.`)
}

function validatedBackup(payload) {
  if (!payload || payload.format !== BACKUP_FORMAT || payload.version !== BACKUP_VERSION) {
    throw new Error('MYFMLV ETF 백업 파일 형식이 아닙니다.')
  }
  if (!Array.isArray(payload.portfolio) || !Array.isArray(payload.favorites)) {
    throw new Error('백업 파일의 포트폴리오 또는 관심 ETF 목록이 올바르지 않습니다.')
  }
  if (payload.portfolio.length > 500 || payload.favorites.length > 1500) {
    throw new Error('백업 파일의 항목 수가 허용 범위를 넘었습니다.')
  }

  const portfolio = payload.portfolio.map((position) => {
    const code = String(position?.code ?? '')
    const quantity = Number(position?.quantity)
    const averagePrice = Number(position?.averagePrice)
    if (!findEtf(code) || !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(averagePrice) || averagePrice < 0) return null
    return { code, quantity, averagePrice }
  }).filter(Boolean)
  const favorites = [...new Set(payload.favorites.map(String))].filter((code) => findEtf(code))
  if (portfolio.length !== payload.portfolio.length) {
    throw new Error('알 수 없는 ETF 또는 올바르지 않은 수량·평균단가가 포함되어 있습니다.')
  }
  return { portfolio, favorites }
}

async function importPortfolioData(file) {
  if (!file) return
  if (file.size > 1_000_000) {
    showToast('백업 파일은 1MB 이하여야 합니다.')
    return
  }

  try {
    const restored = validatedBackup(JSON.parse(await file.text()))
    const confirmed = window.confirm(`현재 포트폴리오와 관심 ETF를 백업 파일의 데이터로 교체할까요?\n\n포트폴리오 ${restored.portfolio.length}개 · 관심 ETF ${restored.favorites.length}개`)
    if (!confirmed) return
    state.portfolio = restored.portfolio
    state.favorites = new Set(restored.favorites)
    savePortfolio()
    writeJsonStorage(FAVORITES_KEY, [...state.favorites])
    renderPortfolio()
    renderFavorites()
    showToast(`포트폴리오 ${restored.portfolio.length}개와 관심 ETF ${restored.favorites.length}개를 복원했습니다.`)
  } catch (error) {
    showToast(`백업 파일을 읽지 못했습니다. ${error.message}`)
  }
}

function portfolioPositions() {
  return state.portfolio.map((position) => {
    const item = findEtf(position.code)
    if (!item) return null
    const value = item.price * position.quantity
    const cost = position.averagePrice * position.quantity
    const previousPrice = item.changeRate === -100 ? item.price : item.price / (1 + item.changeRate / 100)
    const dailyChange = (item.price - previousPrice) * position.quantity
    return { ...position, item, value, cost, gain: value - cost, dailyChange }
  }).filter(Boolean)
}

function portfolioHistory(positions, limit = 66) {
  if (positions.length === 0) return []
  const histories = positions.map((position) => new Map(
    position.item.priceHistory
      .filter(([date, price]) => date && Number.isFinite(price) && price > 0)
      .map(([date, price]) => [date, price]),
  ))
  const commonDates = [...histories[0].keys()]
    .filter((date) => histories.every((history) => history.has(date)))
    .sort()
    .slice(-limit)
  return commonDates.map((date) => [
    date,
    positions.reduce((sum, position, index) => sum + (histories[index].get(date) * position.quantity), 0),
  ])
}

function shortHistoryDate(value) {
  const date = String(value ?? '')
  return date.length === 8 ? `${date.slice(4, 6)}.${date.slice(6, 8)}` : date
}

function portfolioExposure(positions, totalValue) {
  const exposures = new Map()
  let coverage = 0
  positions.forEach((position) => {
    const portfolioWeight = totalValue > 0 ? position.value / totalValue : 0
    if (position.item.holdings.some(([, , weight]) => weight > 0)) coverage += portfolioWeight * 100
    position.item.holdings.forEach(([name, ticker, weight]) => {
      if (weight <= 0) return
      const key = ticker || normalizeText(name)
      const existing = exposures.get(key) ?? { name, ticker, weight: 0 }
      existing.weight += portfolioWeight * (weight / 100) * 100
      exposures.set(key, existing)
    })
  })
  return {
    items: [...exposures.values()].sort((a, b) => b.weight - a.weight).slice(0, 8),
    coverage,
  }
}

function renderPortfolio() {
  const container = document.querySelector('#portfolioDashboard')
  if (state.loading) {
    container.innerHTML = '<div class="empty-state"><p>포트폴리오 데이터를 준비하는 중입니다.</p></div>'
    return
  }
  const positions = portfolioPositions()
  if (positions.length === 0) {
    container.innerHTML = `<div class="empty-state"><div><span>◫</span><h2>내 ETF 포트폴리오를 만들어보세요</h2><p>보유 수량과 평균 매수가를 입력하면 평가손익, 자산 배분, 실제 구성종목 노출을 한눈에 계산합니다. 입력한 정보는 이 브라우저에만 저장됩니다.</p><button class="primary-button" type="button" data-open-portfolio-form>첫 ETF 추가하기</button></div></div>`
    return
  }

  const totalValue = positions.reduce((sum, position) => sum + position.value, 0)
  const totalCost = positions.reduce((sum, position) => sum + position.cost, 0)
  const totalGain = totalValue - totalCost
  const gainRate = totalCost > 0 ? (totalGain / totalCost) * 100 : null
  const dailyChange = positions.reduce((sum, position) => sum + position.dailyChange, 0)
  const allocationMap = new Map()
  positions.forEach((position) => {
    const group = categoryGroup(position.item)
    allocationMap.set(group, (allocationMap.get(group) ?? 0) + position.value)
  })
  const allocations = [...allocationMap.entries()].sort((a, b) => b[1] - a[1])
  let angle = 0
  const donutSegments = allocations.map(([group, value], index) => {
    const start = angle
    angle += totalValue > 0 ? (value / totalValue) * 360 : 0
    return `${ALLOCATION_COLORS[index % ALLOCATION_COLORS.length]} ${start.toFixed(1)}deg ${angle.toFixed(1)}deg`
  }).join(', ')
  const exposure = portfolioExposure(positions, totalValue)
  const historyLimit = state.portfolioRange === '1m' ? 22 : 66
  const history = portfolioHistory(positions, historyLimit)
  const historyValues = history.map(([, value]) => value)
  const historyReturn = historyValues.length >= 2 ? ((historyValues.at(-1) / historyValues[0]) - 1) * 100 : null
  const historyRisk = riskMetricsFromPrices(historyValues)
  const historyPeriod = history.length >= 2 ? `${shortHistoryDate(history[0][0])} – ${shortHistoryDate(history.at(-1)[0])}` : '가격이력 부족'

  container.innerHTML = `
    <div class="portfolio-summary-grid">
      <article class="summary-card primary"><span>총 평가금액</span><strong>${formatCompactWon(totalValue)}원</strong><small>${positions.length}개 ETF · ${formatNumber(positions.reduce((sum, position) => sum + position.quantity, 0), 4)}주</small></article>
      <article class="summary-card"><span>투자원금</span><strong>${formatCompactWon(totalCost)}원</strong><small>평균 매수가 기준</small></article>
      <article class="summary-card"><span>평가손익</span><strong class="${toneClass(totalGain)}">${formatCompactWon(totalGain)}원</strong><small class="${toneClass(gainRate)}">${formatPercent(gainRate)}</small></article>
      <article class="summary-card"><span>오늘 변동</span><strong class="${toneClass(dailyChange)}">${formatCompactWon(dailyChange)}원</strong><small>종가 등락률 기준 추정</small></article>
    </div>
    <section class="portfolio-performance-panel">
      <div class="panel-title performance-title">
        <div><h2>포트폴리오 가격 흐름</h2><span>${historyPeriod} · 현재 보유 수량 기준</span></div>
        <div class="portfolio-range-tabs" role="group" aria-label="포트폴리오 가격 흐름 기간">
          <button class="${state.portfolioRange === '1m' ? 'active' : ''}" type="button" data-portfolio-range="1m" aria-pressed="${state.portfolioRange === '1m'}">1개월</button>
          <button class="${state.portfolioRange === '3m' ? 'active' : ''}" type="button" data-portfolio-range="3m" aria-pressed="${state.portfolioRange === '3m'}">3개월</button>
        </div>
      </div>
      <div class="portfolio-performance-body">
        <figure class="portfolio-history-chart" aria-label="${escapeHtml(historyPeriod)} 포트폴리오 평가금액 흐름">
          ${historyValues.length >= 2 ? sparkline(historyValues, toneClass(historyReturn), 900, 190) : '<div class="empty-state compact"><p>함께 비교할 수 있는 가격이력이 부족합니다.</p></div>'}
          <figcaption><span>${history.length ? `${shortHistoryDate(history[0][0])} · ${formatCompactWon(historyValues[0])}원` : '—'}</span><strong class="${toneClass(historyReturn)}">${formatPercent(historyReturn)}</strong><span>${history.length ? `${shortHistoryDate(history.at(-1)[0])} · ${formatCompactWon(historyValues.at(-1))}원` : '—'}</span></figcaption>
        </figure>
        <dl class="portfolio-risk-grid">
          <div><dt>기간 수익률</dt><dd class="${toneClass(historyReturn)}">${formatPercent(historyReturn)}</dd></div>
          <div><dt>연환산 변동성</dt><dd>${formatPercent(historyRisk.volatility, { signed: false })}</dd></div>
          <div><dt>최대낙폭</dt><dd class="down">${formatPercent(historyRisk.maxDrawdown)}</dd></div>
          <div><dt>Sharpe</dt><dd>${historyRisk.sharpe === null ? '—' : historyRisk.sharpe.toFixed(2)}</dd></div>
        </dl>
      </div>
      <p class="portfolio-performance-note">현재 보유 수량을 조회 기간 내내 동일하게 보유했다고 가정한 단순 가격 시뮬레이션입니다. 실제 입출금·매매 시점·분배금은 반영하지 않습니다.</p>
    </section>
    <div class="portfolio-main-grid">
      <section class="portfolio-panel">
        <div class="panel-title"><h2>보유 ETF</h2><span>현재가 기준</span></div>
        <ol class="position-list">${positions.sort((a, b) => b.value - a.value).map((position) => `
          <li class="position-row">
            <button class="position-name" type="button" data-open-etf="${escapeHtml(position.item.code)}"><strong>${escapeHtml(position.item.name)}</strong><small>${escapeHtml(position.item.code)} · ${formatNumber(position.quantity, 4)}주 · 비중 ${totalValue > 0 ? ((position.value / totalValue) * 100).toFixed(1) : '0.0'}%</small></button>
            <div class="position-metric"><span>평가금액</span><strong>${formatCompactWon(position.value)}원</strong></div>
            <div class="position-metric"><span>평가손익</span><strong class="${toneClass(position.gain)}">${formatCompactWon(position.gain)}원</strong></div>
            <div class="position-metric"><span>수익률</span><strong class="${toneClass(position.gain)}">${position.cost > 0 ? formatPercent((position.gain / position.cost) * 100) : '—'}</strong></div>
            <div class="position-actions"><button type="button" data-edit-position="${escapeHtml(position.item.code)}" aria-label="${escapeHtml(position.item.name)} 수정">✎</button><button type="button" data-remove-position="${escapeHtml(position.item.code)}" aria-label="${escapeHtml(position.item.name)} 삭제">×</button></div>
          </li>
        `).join('')}</ol>
      </section>
      <aside class="portfolio-panel">
        <div class="panel-title"><h3>포트폴리오 분석</h3><span>평가금액 비중</span></div>
        <div class="allocation-wrap">
          <div class="donut-wrap"><div class="donut-chart" style="--donut:conic-gradient(${donutSegments})"></div><div class="donut-label"><strong>${allocations.length}</strong><span>자산군</span></div></div>
          <div class="allocation-legend">${allocations.map(([group, value], index) => `<div class="allocation-item"><i style="background:${ALLOCATION_COLORS[index % ALLOCATION_COLORS.length]}"></i><span>${escapeHtml(group)}</span><b>${totalValue > 0 ? ((value / totalValue) * 100).toFixed(1) : '0.0'}%</b></div>`).join('')}</div>
          <div class="exposure-block"><h3>상위 종목 노출 <span>· 포트폴리오 ${exposure.coverage.toFixed(0)}% 분석</span></h3><div class="exposure-list">${exposure.items.length > 0 ? exposure.items.map((item) => `<div class="exposure-item"><span>${escapeHtml(item.name)}</span><span class="exposure-bar"><i style="width:${Math.min(item.weight * 2.5, 100).toFixed(1)}%"></i></span><b>${item.weight.toFixed(1)}%</b></div>`).join('') : '<p class="detail-note">공개 비중 데이터가 있는 ETF부터 계산합니다.</p>'}</div></div>
        </div>
      </aside>
    </div>
  `
}

function openPortfolioForm(code = null) {
  const dialog = document.querySelector('#portfolioDialog')
  const form = document.querySelector('#portfolioForm')
  form.reset()
  const existing = code ? state.portfolio.find((position) => position.code === code) : null
  const item = code ? findEtf(code) : null
  state.portfolioSelection = item
  document.querySelector('#portfolioDialogTitle').textContent = existing ? '보유 ETF 수정' : 'ETF 추가'
  document.querySelector('#portfolioCode').value = item?.code ?? ''
  document.querySelector('#portfolioSearch').value = item?.name ?? ''
  document.querySelector('#portfolioQuantity').value = existing?.quantity ?? ''
  document.querySelector('#portfolioAveragePrice').value = existing?.averagePrice ?? item?.price ?? ''
  document.querySelector('#portfolioSearchResults').hidden = true
  renderPortfolioSelection()
  if (!dialog.open) {
    dialog.dataset.returnScrollY = String(window.scrollY)
    dialog.showModal()
  }
  requestAnimationFrame(() => (item ? document.querySelector('#portfolioQuantity') : document.querySelector('#portfolioSearch')).focus())
}

function portfolioSearchMatches(query) {
  const variants = queryVariants(query)
  if (variants.length === 0) return []
  return etfs
    .filter((item) => matchesVariants(itemText(item, 'etf'), variants))
    .sort((a, b) => relevanceScore(b, query) - relevanceScore(a, query) || b.amount - a.amount)
    .slice(0, 8)
}

function renderPortfolioSearchResults() {
  const query = document.querySelector('#portfolioSearch').value
  const container = document.querySelector('#portfolioSearchResults')
  const matches = portfolioSearchMatches(query)
  container.hidden = !query.trim()
  container.innerHTML = matches.length > 0
    ? matches.map((item) => `<button type="button" data-select-portfolio-etf="${escapeHtml(item.code)}"><span><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.code)} · ${escapeHtml(item.issuer)}</small></span><b>${formatPrice(item.price)}</b></button>`).join('')
    : '<p class="detail-note">검색 결과가 없습니다.</p>'
}

function selectPortfolioEtf(code) {
  const item = findEtf(code)
  if (!item) return
  state.portfolioSelection = item
  document.querySelector('#portfolioCode').value = item.code
  document.querySelector('#portfolioSearch').value = item.name
  const averageInput = document.querySelector('#portfolioAveragePrice')
  if (!averageInput.value) averageInput.value = item.price || ''
  document.querySelector('#portfolioSearchResults').hidden = true
  renderPortfolioSelection()
  document.querySelector('#portfolioQuantity').focus()
}

function renderPortfolioSelection() {
  const preview = document.querySelector('#portfolioSelectedPreview')
  const item = state.portfolioSelection
  preview.hidden = !item
  preview.innerHTML = item ? `<span><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.code)} · ${escapeHtml(item.issuer)}</small></span><b>${formatPrice(item.price)}</b>` : ''
}

function savePortfolioForm() {
  const code = document.querySelector('#portfolioCode').value
  const quantity = Number(document.querySelector('#portfolioQuantity').value)
  const averagePrice = Number(document.querySelector('#portfolioAveragePrice').value)
  const item = findEtf(code)
  if (!item || !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(averagePrice) || averagePrice < 0) {
    showToast('ETF, 보유 수량, 평균 매수가를 확인해주세요.')
    return false
  }
  const position = { code: item.code, quantity, averagePrice }
  const existingIndex = state.portfolio.findIndex((value) => value.code === item.code)
  if (existingIndex >= 0) state.portfolio[existingIndex] = position
  else state.portfolio.push(position)
  savePortfolio()
  renderPortfolio()
  showToast(`${item.name} 포지션을 저장했습니다.`)
  return true
}

function removePortfolioPosition(code) {
  const item = findEtf(code)
  state.portfolio = state.portfolio.filter((position) => position.code !== code)
  savePortfolio()
  renderPortfolio()
  showToast(`${item?.name ?? code} 포지션을 삭제했습니다.`)
}

function resetFinder() {
  state.finderQuery = ''
  state.category = 'all'
  state.issuer = 'all'
  state.structure = 'all'
  state.sort = 'relevance'
  state.visibleCount = PAGE_SIZE
  renderFinder()
}

function closeDialog(id) {
  const dialog = document.getElementById(id)
  if (dialog?.open) dialog.close()
}

function bindEvents() {
  document.addEventListener('click', (event) => {
    const closeButton = event.target.closest('[data-close-dialog]')
    if (closeButton) {
      closeDialog(closeButton.dataset.closeDialog)
      return
    }

    const routeButton = event.target.closest('[data-route]')
    if (routeButton) {
      if (routeButton.dataset.presetMode) state.searchMode = routeButton.dataset.presetMode
      setRoute(routeButton.dataset.route, { focusSearch: routeButton.dataset.route === 'finder' && routeButton.dataset.presetMode === 'holding' })
      return
    }

    const quickButton = event.target.closest('[data-quick-query]')
    if (quickButton) {
      openFinder(quickButton.dataset.quickQuery, quickButton.dataset.searchMode ?? 'all')
      return
    }

    const openButton = event.target.closest('[data-open-etf]')
    if (openButton) {
      openEtfDetail(openButton.dataset.openEtf)
      return
    }

    const favoriteButton = event.target.closest('[data-favorite-etf]')
    if (favoriteButton) {
      toggleFavorite(favoriteButton.dataset.favoriteEtf)
      return
    }

    const compareButton = event.target.closest('[data-compare-etf]')
    if (compareButton) {
      toggleCompare(compareButton.dataset.compareEtf)
      return
    }

    const portfolioButton = event.target.closest('[data-add-portfolio]')
    if (portfolioButton) {
      closeDialog('etfDetailDialog')
      openPortfolioForm(portfolioButton.dataset.addPortfolio)
      return
    }

    const reverseButton = event.target.closest('[data-reverse-holding]')
    if (reverseButton) {
      closeDialog('etfDetailDialog')
      openFinder(reverseButton.dataset.reverseHolding, 'holding')
      return
    }

    if (event.target.closest('[data-load-more-holdings]')) {
      const item = findEtf(state.detailCode)
      if (item) {
        state.detailHoldingVisible += 100
        renderDetailHoldings(item)
      }
      return
    }

    const portfolioRangeButton = event.target.closest('[data-portfolio-range]')
    if (portfolioRangeButton) {
      state.portfolioRange = portfolioRangeButton.dataset.portfolioRange
      renderPortfolio()
      return
    }

    if (event.target.closest('[data-open-portfolio-form]')) {
      openPortfolioForm()
      return
    }

    const editButton = event.target.closest('[data-edit-position]')
    if (editButton) {
      openPortfolioForm(editButton.dataset.editPosition)
      return
    }

    const removeButton = event.target.closest('[data-remove-position]')
    if (removeButton) {
      removePortfolioPosition(removeButton.dataset.removePosition)
      return
    }

    const selectPortfolioButton = event.target.closest('[data-select-portfolio-etf]')
    if (selectPortfolioButton) {
      selectPortfolioEtf(selectPortfolioButton.dataset.selectPortfolioEtf)
      return
    }

    if (event.target.closest('[data-reset-finder]')) resetFinder()
  })

  document.querySelector('#heroSearchForm').addEventListener('submit', (event) => {
    event.preventDefault()
    openFinder(document.querySelector('#heroSearch').value, 'all')
  })

  document.querySelector('#finderSearchForm').addEventListener('submit', (event) => {
    event.preventDefault()
    state.finderQuery = document.querySelector('#finderSearch').value
    state.visibleCount = PAGE_SIZE
    renderFinder()
  })

  document.querySelector('#finderSearch').addEventListener('input', (event) => {
    state.finderQuery = event.target.value
    state.visibleCount = PAGE_SIZE
    document.querySelector('#clearFinderSearch').hidden = !state.finderQuery
    renderFinder()
  })

  document.querySelector('#clearFinderSearch').addEventListener('click', () => {
    state.finderQuery = ''
    state.visibleCount = PAGE_SIZE
    renderFinder()
    document.querySelector('#finderSearch').focus()
  })

  document.querySelector('.search-mode-tabs').addEventListener('click', (event) => {
    const button = event.target.closest('[data-search-mode]')
    if (!button) return
    state.searchMode = button.dataset.searchMode
    state.visibleCount = PAGE_SIZE
    renderFinder()
  })

  const filterMap = {
    categoryFilter: 'category',
    issuerFilter: 'issuer',
    structureFilter: 'structure',
    sortFilter: 'sort',
  }
  Object.entries(filterMap).forEach(([id, key]) => {
    document.getElementById(id).addEventListener('change', (event) => {
      state[key] = event.target.value
      state.visibleCount = PAGE_SIZE
      renderFinder()
    })
  })
  document.querySelector('#resetFilters').addEventListener('click', resetFinder)
  document.querySelector('#finderLoadMore').addEventListener('click', () => {
    state.visibleCount += PAGE_SIZE
    renderFinder()
  })

  document.querySelector('#addPortfolioButton').addEventListener('click', () => openPortfolioForm())
  document.querySelector('#exportPortfolioData').addEventListener('click', exportPortfolioData)
  document.querySelector('#importPortfolioData').addEventListener('click', () => document.querySelector('#importPortfolioFile').click())
  document.querySelector('#importPortfolioFile').addEventListener('change', async (event) => {
    const [file] = event.target.files ?? []
    await importPortfolioData(file)
    event.target.value = ''
  })
  document.addEventListener('input', (event) => {
    if (!event.target.matches('#detailHoldingSearch')) return
    state.detailHoldingQuery = event.target.value
    state.detailHoldingVisible = 50
    const item = findEtf(state.detailCode)
    if (item) renderDetailHoldings(item)
  })
  document.querySelector('#portfolioSearch').addEventListener('input', () => {
    state.portfolioSelection = null
    document.querySelector('#portfolioCode').value = ''
    renderPortfolioSelection()
    renderPortfolioSearchResults()
  })
  document.querySelector('#portfolioForm').addEventListener('submit', (event) => {
    event.preventDefault()
    if (savePortfolioForm()) closeDialog('portfolioDialog')
  })

  document.querySelector('#clearCompare').addEventListener('click', () => {
    state.compare = []
    renderCompareTray()
    if (state.route === 'finder') renderFinder()
    if (state.route === 'favorites') renderFavorites()
  })
  document.querySelector('#openCompare').addEventListener('click', openCompareDialog)
  document.querySelector('#openCompareShortcut').addEventListener('click', () => {
    if (state.compare.length >= 2) openCompareDialog()
    else {
      setRoute('finder')
      showToast('비교할 ETF 카드에서 ≋ 버튼을 눌러 2개 이상 담아주세요.')
    }
  })

  document.querySelector('#headerSearchButton').addEventListener('click', () => setRoute('finder', { focusSearch: true }))
  document.querySelector('#themeToggle').addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'
    document.documentElement.dataset.theme = next
    document.querySelector('#themeToggle').setAttribute('aria-pressed', String(next === 'dark'))
    writeJsonStorage(THEME_KEY, next)
  })

  document.querySelectorAll('dialog').forEach((dialog) => {
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) dialog.close()
    })
    dialog.addEventListener('close', () => {
      if (dialog.dataset.returnScrollY === undefined) return
      const returnScrollY = Number(dialog.dataset.returnScrollY)
      delete dialog.dataset.returnScrollY
      if (Number.isFinite(returnScrollY)) {
        requestAnimationFrame(() => window.scrollTo({ top: returnScrollY, behavior: 'auto' }))
      }
    })
  })

  window.addEventListener('hashchange', () => setRoute(routeFromHash(), { scroll: false }))
  document.addEventListener('keydown', (event) => {
    const target = event.target
    const isTyping = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement
    if (event.key === '/' && !isTyping) {
      event.preventDefault()
      setRoute('finder', { focusSearch: true })
    }
  })
}

function hydrateLocalState() {
  const favorites = readJsonStorage(FAVORITES_KEY, [])
  state.favorites = new Set(Array.isArray(favorites) ? favorites.map(String) : [])
  const recent = readJsonStorage(RECENT_KEY, [])
  state.recent = Array.isArray(recent) ? recent.map(String).slice(0, 8) : []
  loadPortfolio()
  const savedTheme = readJsonStorage(THEME_KEY, 'dark')
  document.documentElement.dataset.theme = savedTheme === 'light' ? 'light' : 'dark'
  document.querySelector('#themeToggle').setAttribute('aria-pressed', String(savedTheme !== 'light'))
}

async function loadEtfs() {
  const response = await fetch(ETF_DATA_URL, { cache: 'no-cache' })
  if (!response.ok) throw new Error(`ETF 데이터 응답 오류 (${response.status})`)
  const payload = await response.json()
  if (!Array.isArray(payload.etfs) || payload.etfs.length === 0) throw new Error('ETF 목록이 비어 있습니다.')
  etfs = payload.etfs.map(normalizeEtf).filter((item) => item.code && item.name)
  generatedAt = payload.generatedAt ?? null
}

async function init() {
  hydrateLocalState()
  bindEvents()
  state.route = routeFromHash()
  setRoute(state.route, { scroll: false })
  renderFinder()
  renderCompareTray()

  try {
    await loadEtfs()
    state.loading = false
    populateFilters()
    document.querySelector('#footerDataNote').textContent = `${formatDateTime(generatedAt)} 기준 · 가격·공식 iNAV·수익률은 참고용이며 실제 체결가와 다를 수 있습니다.`
  } catch (error) {
    state.loading = false
    state.loadError = error
  }

  renderHome()
  renderFinder()
  renderPortfolio()
  renderFavorites()
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || window.location.protocol === 'file:') return
  navigator.serviceWorker.register('./sw.js', { scope: './', updateViaCache: 'none' }).catch(() => {
    // 앱 설치나 오프라인 캐시를 지원하지 못해도 온라인 ETF 기능은 그대로 유지합니다.
  })
}

init()
registerServiceWorker()
