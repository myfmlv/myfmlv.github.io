import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('myfmlv-test-cleaned') === '1') return
    localStorage.clear()
    sessionStorage.setItem('myfmlv-test-cleaned', '1')
  })
})

async function waitForEtfData(page) {
  await expect(page.locator('#heroUpdatedAt')).not.toContainText('확인 중', { timeout: 20_000 })
}

test('ETF 중심 홈이 실제 데이터로 로드된다', async ({ page }) => {
  await page.goto('/')
  await waitForEtfData(page)

  await expect(page).toHaveTitle(/MYFMLV ETF/)
  await expect(page.getByRole('heading', { name: /무엇을 담았는지/ })).toBeVisible()
  await expect(page.locator('#heroEtfCount')).toContainText(/1,\d{3}/)
  await expect(page.locator('#homeRankingGrid')).toContainText('거래대금 상위')
  await expect(page.locator('#homeRankingGrid')).toContainText('괴리율 주목')
})

test('홈 화면 설치와 오프라인 재접속을 지원한다', async ({ page, context }) => {
  await page.goto('/')
  await waitForEtfData(page)

  const manifest = await page.evaluate(async () => {
    const link = document.querySelector('link[rel="manifest"]')
    return fetch(link.href).then((response) => response.json())
  })
  expect(manifest.name).toBe('MYFMLV ETF')
  expect(manifest.display).toBe('standalone')
  expect(manifest.shortcuts.map((shortcut) => shortcut.url)).toEqual(expect.arrayContaining(['./#finder', './#portfolio']))

  const serviceWorkerState = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready
    return registration.active?.state
  })
  expect(serviceWorkerState).toBe('activated')

  await context.setOffline(true)
  try {
    await page.reload({ waitUntil: 'domcontentloaded' })
    await waitForEtfData(page)
    await expect(page).toHaveTitle(/MYFMLV ETF/)
    await expect(page.locator('#heroEtfCount')).toContainText(/1,\d{3}/)
    await page.locator('.desktop-nav').getByRole('button', { name: '포트폴리오' }).click()
    await expect(page.getByRole('heading', { name: '포트폴리오', exact: true })).toBeVisible()
  } finally {
    await context.setOffline(false)
  }
})

test('ETF를 검색해 iNAV·위험지표·구성종목 상세를 연다', async ({ page }) => {
  await page.goto('/')
  await waitForEtfData(page)
  await page.locator('.desktop-nav').getByRole('button', { name: 'ETF 찾기' }).click()

  await page.locator('#finderSearch').fill('379800')
  const result = page.getByRole('button', { name: /379800 KODEX 미국S&P500 삼성자산운용/ })
  await expect(result).toBeVisible()
  await result.click()

  const dialog = page.locator('#etfDetailDialog')
  await expect(dialog).toBeVisible()
  await expect(dialog).toContainText('공식 iNAV')
  await expect(dialog).toContainText('위험지표')
  await expect(dialog).toContainText('구성종목')
  await expect(dialog).toContainText(/NVIDIA/i)
})

test('구성종목이 많은 ETF도 전체 목록에서 종목명으로 찾는다', async ({ page }) => {
  await page.goto('/#finder')
  await waitForEtfData(page)
  await page.locator('#finderSearch').fill('0060H0')
  await page.locator('#finderResults [data-open-etf="0060H0"]').click()

  const dialog = page.locator('#etfDetailDialog')
  await expect(dialog).toContainText('TIGER 토탈월드스탁액티브')
  await expect(page.locator('#detailHoldingSummary')).toContainText('1,561개')
  await expect(page.locator('#detailHoldingsContent tbody tr')).toHaveCount(50)

  await page.locator('#detailHoldingSearch').fill('NVR INC')
  await expect(page.locator('#detailHoldingSummary')).toContainText('1개 검색')
  await expect(page.locator('#detailHoldingsContent')).toContainText('NVR INC')
  await expect(page.locator('#detailHoldingsContent')).toContainText('NVR')
})

test('개별 종목으로 해당 종목을 담은 ETF를 역검색한다', async ({ page }) => {
  await page.goto('/#finder')
  await waitForEtfData(page)

  await page.getByRole('tab', { name: '구성종목 역검색' }).click()
  await page.locator('#finderSearch').fill('삼성전자')

  await expect(page.locator('#finderResultTitle')).toContainText('삼성전자')
  await expect(page.locator('#finderResultCount')).not.toHaveText('0개')
  await expect(page.locator('#finderResults .matched-holding').first()).toContainText(/삼성전자/)
})

test('관심 ETF를 저장하고 관심 탭에서 다시 본다', async ({ page }) => {
  await page.goto('/#finder')
  await waitForEtfData(page)
  await page.locator('#finderSearch').fill('379800')

  await page.getByRole('button', { name: 'KODEX 미국S&P500 관심 등록' }).click()
  await page.locator('.desktop-nav').getByRole('button', { name: '관심' }).click()

  await expect(page.locator('#favoritesGrid')).toContainText('KODEX 미국S&P500')
  await expect(page.locator('#favoriteCount')).toHaveText('1개')
})

test('포트폴리오 포지션을 저장하고 새로고침 후에도 유지한다', async ({ page }) => {
  await page.goto('/#portfolio')
  await waitForEtfData(page)
  await page.getByRole('button', { name: '첫 ETF 추가하기' }).click()

  await page.locator('#portfolioSearch').fill('379800')
  await page.getByRole('button', { name: /KODEX 미국S&P500 379800/ }).click()
  await page.locator('#portfolioQuantity').fill('10')
  await page.locator('#portfolioAveragePrice').fill('24000')
  await page.getByRole('button', { name: '포트폴리오에 저장' }).click()

  await expect(page.locator('#portfolioDashboard')).toContainText('KODEX 미국S&P500')
  await expect(page.locator('#portfolioDashboard')).toContainText('평가손익')
  await expect(page.locator('#portfolioDashboard')).toContainText('포트폴리오 가격 흐름')
  await expect(page.locator('#portfolioDashboard')).toContainText('최대낙폭')
  await page.getByRole('button', { name: '1개월' }).click()
  await expect(page.getByRole('button', { name: '1개월' })).toHaveAttribute('aria-pressed', 'true')
  await page.reload()
  await waitForEtfData(page)
  await expect(page.locator('#portfolioDashboard')).toContainText('KODEX 미국S&P500')
})

test('포트폴리오를 백업·복원하고 손상된 파일에서는 기존 데이터를 보존한다', async ({ page }) => {
  await page.goto('/#portfolio')
  await waitForEtfData(page)

  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: '백업', exact: true }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toMatch(/^myfmlv-etf-backup-\d{4}-\d{2}-\d{2}\.json$/)

  page.once('dialog', (dialog) => dialog.accept())
  await page.locator('#importPortfolioFile').setInputFiles({
    name: 'valid-backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({
      format: 'myfmlv-etf-backup',
      version: 1,
      portfolio: [{ code: '379800', quantity: 7, averagePrice: 24000 }],
      favorites: ['379800'],
    })),
  })

  await expect(page.locator('#portfolioDashboard')).toContainText('KODEX 미국S&P500')
  await expect(page.locator('#portfolioDashboard')).toContainText('379800 · 7주')
  await expect(page.locator('#toastRegion')).toContainText('복원했습니다')

  await page.locator('#importPortfolioFile').setInputFiles({
    name: 'invalid-backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ format: 'unknown-backup', version: 1 })),
  })

  await expect(page.locator('#toastRegion')).toContainText('백업 파일을 읽지 못했습니다')
  await expect(page.locator('#portfolioDashboard')).toContainText('KODEX 미국S&P500')
  await page.locator('.desktop-nav').getByRole('button', { name: '관심' }).click()
  await expect(page.locator('#favoriteCount')).toHaveText('1개')
  await expect(page.locator('#favoritesGrid')).toContainText('KODEX 미국S&P500')
})

test('최대 4개 비교함에서 2개 ETF를 정밀 비교한다', async ({ page }) => {
  await page.goto('/#finder')
  await waitForEtfData(page)
  await page.locator('#finderSearch').fill('미국S&P500')

  const compareButtons = page.locator('#finderResults [data-compare-etf]')
  expect(await compareButtons.count()).toBeGreaterThan(1)
  await compareButtons.nth(0).click()
  await compareButtons.nth(1).click()
  await page.locator('#openCompare').click()

  const dialog = page.locator('#compareDialog')
  await expect(dialog).toBeVisible()
  await expect(dialog).toContainText('ETF 정밀 비교')
  await expect(dialog).toContainText('1개월 수익률')
  await expect(dialog).toContainText('겹치는 구성종목')
})

test('모바일에서도 하단 탐색과 검색 카드가 사용 가능하다', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await waitForEtfData(page)

  const mobileNav = page.locator('.mobile-nav')
  await expect(mobileNav).toBeVisible()
  await mobileNav.getByRole('button', { name: '찾기' }).click()
  await page.locator('#finderSearch').fill('삼성전자')
  await expect(page.locator('#finderResults .etf-card').first()).toBeVisible()

  const fontSize = await page.locator('#finderSearch').evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize))
  expect(fontSize).toBeGreaterThanOrEqual(16)
})

test('라이트·다크 테마를 기기 설정으로 저장한다', async ({ page }) => {
  await page.goto('/')
  await waitForEtfData(page)
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')

  await page.locator('#themeToggle').click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
})
