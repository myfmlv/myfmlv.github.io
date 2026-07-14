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

const html = read('index.html')
const app = read('src/etf-app.js')
const css = read('etf-app.css')
const serviceWorker = read('sw.js')
const manifest = JSON.parse(read('manifest.webmanifest'))
const readme = read('README.md')
const robots = read('robots.txt')
const sitemap = read('sitemap.xml')
const packageJson = JSON.parse(read('package.json'))

expectIncludes(html, 'Content-Security-Policy', 'index.html must include a CSP meta tag')
expectIncludes(html, 'rel="canonical"', 'index.html must include a canonical link')
expectIncludes(html, 'property="og:image"', 'index.html must include Open Graph image metadata')
expectIncludes(html, 'name="twitter:image"', 'index.html must include Twitter image metadata')
expectIncludes(html, 'rel="manifest"', 'index.html must link the installable app manifest')
expectIncludes(html, 'rel="apple-touch-icon"', 'index.html must expose an Apple touch icon')
expectIncludes(html, 'data-route="finder"', 'index.html must expose ETF finder navigation')
expectIncludes(html, 'data-route="portfolio"', 'index.html must expose portfolio navigation')
expectIncludes(html, 'data-search-mode="holding"', 'index.html must expose constituent reverse search')
expectIncludes(html, 'id="etfDetailDialog"', 'index.html must include the ETF detail surface')
expectIncludes(html, 'id="portfolioDialog"', 'index.html must include the portfolio editor')
expectIncludes(html, 'id="exportPortfolioData"', 'index.html must include portfolio backup')
expectIncludes(html, 'id="importPortfolioFile"', 'index.html must include portfolio restore')
expectIncludes(html, 'id="compareDialog"', 'index.html must include ETF comparison')
expectIncludes(html, '<noscript>', 'index.html must include a no-JavaScript fallback')
expectIncludes(html, 'aria-live="polite"', 'dynamic results must expose a polite live region')

expectIncludes(app, 'function matchedHolding(', 'ETF app must support constituent reverse search')
expectIncludes(app, 'function renderDetail(', 'ETF app must render ETF details')
expectIncludes(app, 'function renderDetailHoldings(', 'ETF app must search and progressively reveal all ETF holdings')
expectIncludes(app, 'function renderPortfolio(', 'ETF app must render a portfolio dashboard')
expectIncludes(app, 'function portfolioExposure(', 'ETF app must calculate portfolio constituent exposure')
expectIncludes(app, 'function portfolioHistory(', 'ETF app must calculate portfolio price history')
expectIncludes(app, 'function riskMetricsFromPrices(', 'ETF app must calculate reusable risk metrics')
expectIncludes(app, 'function renderCompare(', 'ETF app must support ETF comparison')
expectIncludes(app, 'localStorage', 'ETF app must keep personal data on device')
expectIncludes(app, 'FAVORITES_KEY', 'ETF app must persist watchlist items')
expectIncludes(app, 'PORTFOLIO_KEY', 'ETF app must persist portfolio positions')
expectIncludes(app, 'function validatedBackup(', 'ETF app must validate portfolio backup files')
expectIncludes(app, 'function exportPortfolioData(', 'ETF app must export portfolio backups')
expectIncludes(app, 'async function importPortfolioData(', 'ETF app must restore portfolio backups')
expectIncludes(app, 'function registerServiceWorker(', 'ETF app must register its offline service worker')

expect(manifest.display === 'standalone', 'web app manifest must launch in standalone mode')
expect(manifest.start_url === './#home', 'web app manifest must start on the ETF home route')
expect(manifest.icons.some((icon) => icon.sizes === '192x192'), 'web app manifest must include a 192px icon')
expect(manifest.icons.some((icon) => icon.sizes === '512x512'), 'web app manifest must include a 512px icon')
expect(manifest.icons.some((icon) => icon.purpose === 'maskable'), 'web app manifest must include a maskable icon')
expectIncludes(serviceWorker, "'./data/etf-universe.json'", 'service worker must cache the ETF dataset for offline use')
expectIncludes(serviceWorker, "request.mode === 'navigate'", 'service worker must provide an offline navigation fallback')

expectIncludes(css, '.mobile-nav', 'ETF stylesheet must include mobile navigation')
expectIncludes(css, '.portfolio-summary-grid', 'ETF stylesheet must style portfolio summaries')
expectIncludes(css, '.portfolio-performance-panel', 'ETF stylesheet must style portfolio performance history')
expectIncludes(css, '.holding-table', 'ETF stylesheet must style constituent holdings')
expectIncludes(css, '.holding-search', 'ETF stylesheet must style constituent search')
expectIncludes(css, '.compare-tray', 'ETF stylesheet must style the comparison tray')
expectIncludes(css, "html[data-theme='light']", 'ETF stylesheet must provide a light theme')
expectIncludes(css, '@media (max-width: 600px)', 'ETF stylesheet must include a mobile breakpoint')

expectIncludes(packageJson.scripts.check, 'src/etf-app.js', 'npm run check must syntax-check the active ETF app')
expectIncludes(packageJson.scripts['validate:data'], 'scripts/validate-data.mjs', 'validate:data must run the data validation script')
expectIncludes(packageJson.scripts['update:data'], 'scripts/update-all-data.mjs', 'update:data must run the data update script')
expectIncludes(packageJson.scripts.test, 'npm run test:e2e', 'npm test must include browser tests')
expectIncludes(robots, 'Sitemap: https://myfmlv.github.io/sitemap.xml', 'robots.txt must reference sitemap.xml')
expectIncludes(sitemap, '<loc>https://myfmlv.github.io/</loc>', 'sitemap.xml must include the site root URL')
expect(fs.existsSync(path.join(root, 'og-image-etf.png')), 'ETF social preview image must exist')
expect(fs.existsSync(path.join(root, 'icons/app-icon-192.png')), '192px app icon must exist')
expect(fs.existsSync(path.join(root, 'icons/app-icon-512.png')), '512px app icon must exist')
expect(fs.existsSync(path.join(root, 'icons/apple-touch-icon.png')), 'Apple touch icon must exist')
expect(fs.existsSync(path.join(root, 'data/etf-universe.json')), 'ETF universe data must exist')
expect(fs.existsSync(path.join(root, '.github/workflows/update-market-data.yml')), 'market data update workflow must exist')
expect(!/\/Users\/|Documents\/01_Projects\/|\/Park\//.test(readme), 'README.md must not expose local absolute paths')

if (failures.length > 0) {
  console.error('[fail] Smoke test failed')
  failures.forEach((failure) => console.error(`- ${failure}`))
  process.exit(1)
}

console.log('[ok] ETF app smoke test passed')
