import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const failures = []

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8')
}

function expect(condition, message) {
  if (!condition) failures.push(message)
}

function expectIncludes(text, needle, message) {
  expect(text.includes(needle), message)
}

function expectMatch(text, pattern, message) {
  expect(pattern.test(text), message)
}

const html = read('index.html')
const app = read('src/app.js')
const css = read('styles.css')
const readme = read('README.md')
const robots = read('robots.txt')
const sitemap = read('sitemap.xml')
const packageJson = JSON.parse(read('package.json'))

expectIncludes(html, 'Content-Security-Policy', 'index.html must include a CSP meta tag')
expectIncludes(html, 'rel="canonical"', 'index.html must include a canonical link')
expectIncludes(html, 'property="og:image"', 'index.html must include Open Graph image metadata')
expectIncludes(html, 'name="twitter:image"', 'index.html must include Twitter image metadata')
expectIncludes(html, 'role="tablist"', 'tab groups must expose tablist role')
expectIncludes(html, 'role="tab"', 'tab buttons must expose tab role')
expectIncludes(html, 'role="tabpanel"', 'tab panels must expose tabpanel role')
expectIncludes(html, 'aria-selected="true"', 'selected tabs must expose aria-selected')
expectIncludes(html, 'id="dataStatus"', 'index.html must include the data status region')
expectIncludes(html, 'class="data-status-panel data-status"', 'index.html must include the data status panel class')
expectIncludes(html, 'id="dataStatusMain"', 'index.html must include the data status main target')
expectIncludes(html, 'id="dataStatusMeta"', 'index.html must include the data status meta target')
expectIncludes(html, 'id="mobileStockList"', 'index.html must include the mobile stock list container')
expectIncludes(html, 'id="resultStatus"', 'index.html must include a screen-reader result status')
expectIncludes(html, 'aria-live="polite"', 'data status and ranking metadata should expose polite live regions')
expectIncludes(html, '<noscript>', 'index.html must include a no-JavaScript fallback')
expectIncludes(html, 'noscript-warning', 'index.html must include the explicit noscript warning')
expectIncludes(html, 'property="og:title"', 'index.html must include Open Graph title metadata')
expectIncludes(html, 'name="twitter:card"', 'index.html must include Twitter card metadata')
expectIncludes(html, '<caption class="visually-hidden">KRX 연기금 수급 종목 랭킹</caption>', 'stock ranking table must include an accessible caption')
expectMatch(html, /<th scope="col">수급금액<\/th>/, 'stock ranking table headers must use column scope')

expectIncludes(app, 'function renderDataStatus()', 'app.js must render data source status')
expectIncludes(app, 'function updateDataStatusPanel(', 'app.js must expose a data status panel update function')
expectIncludes(app, 'function getDataFreshnessStatus(', 'app.js must classify data freshness')
expectIncludes(app, 'function updateResultStatus(', 'app.js must update screen-reader result status')
expectIncludes(app, 'let appDataStatus', 'app.js must track fallback/error status separately')
expectIncludes(app, 'renderTableState(', 'app.js must render explicit table states')
expectIncludes(app, 'function renderMobileStockList(', 'app.js must render the mobile stock list')
expectIncludes(app, '최신 데이터를 불러오지 못해 백업 데이터를 표시 중입니다.', 'fallback warning must be shown in the data status panel')
expectIncludes(app, "setDataSource('stockMeta'", 'stock metadata fallback state must be recorded')
expectIncludes(app, "setDataSource('naverMarket'", 'Naver market fallback state must be recorded')
expectIncludes(app, "setDataSource('marketIndex'", 'market index fallback state must be recorded')
expectIncludes(app, '종목 메타데이터 없음', 'stock metadata missing state must be visible to users')
expectIncludes(app, 'data-label="수급금액"', 'mobile stock ranking rows must include data labels')
expectIncludes(app, 'aria-pressed', 'interactive tab state must update aria-pressed')

expectIncludes(css, '.data-status-panel', 'styles.css must style the data status panel')
expectIncludes(css, ".data-status-panel[data-status='stale']", 'styles.css must style stale data status')
expectIncludes(css, ".data-status-panel[data-status='fallback']", 'styles.css must style fallback data status')
expectIncludes(css, '.table-state--error td', 'styles.css must style table error state')
expectIncludes(css, '.mobile-stock-list', 'styles.css must include mobile stock list styles')
expectIncludes(css, '.mobile-stock-card__metrics', 'styles.css must include mobile stock card metric styles')
expectIncludes(css, 'content: attr(data-label)', 'styles.css must expose table labels on mobile')
expectIncludes(css, '.visually-hidden', 'styles.css must provide a visually-hidden utility')
expectIncludes(css, '.sr-only', 'styles.css must provide an sr-only utility')
expectIncludes(css, '.noscript-warning', 'styles.css must style the explicit noscript warning')

expectIncludes(packageJson.scripts['validate:data'], 'scripts/validate-data.mjs', 'validate:data must run the data validation script')
expectIncludes(packageJson.scripts.check, 'npm run validate:data', 'npm run check must run validate:data')
expectIncludes(packageJson.scripts.check, 'scripts/smoke-test.mjs', 'npm run check must run the smoke test')
expectIncludes(packageJson.scripts['test:e2e'], 'playwright test', 'test:e2e must run Playwright')
expectIncludes(packageJson.scripts.test, 'npm run test:e2e', 'npm test must include e2e tests')
expectIncludes(robots, 'Sitemap: https://myfmlv.github.io/sitemap.xml', 'robots.txt must reference sitemap.xml')
expectIncludes(sitemap, '<loc>https://myfmlv.github.io/</loc>', 'sitemap.xml must include the site root URL')
expect(fs.existsSync(path.join(root, 'og-image.png')), 'og-image.png must exist')
expect(!/\/Users\/|Documents\/01_Projects\/|\/Park\//.test(readme), 'README.md must not expose local absolute paths')

if (failures.length > 0) {
  console.error('[fail] Smoke test failed')
  failures.forEach((failure) => console.error(`- ${failure}`))
  process.exit(1)
}

console.log('[ok] Smoke test passed')
