import { expect, test } from '@playwright/test'

test('홈페이지가 로드되고 핵심 제목이 보인다', async ({ page }) => {
  await page.goto('/')

  await expect(page).toHaveTitle(/MYFMLV|Market|투자|수급/i)
  await expect(page.locator('body')).toContainText(/연기금|ETF|테마|시장/)
})

test('데이터 상태 패널이 표시된다', async ({ page }) => {
  await page.goto('/')

  const statusPanel = page.locator('.data-status-panel')
  await expect(statusPanel).toBeVisible()
  await expect(statusPanel).not.toContainText('확인하는 중입니다', { timeout: 10000 })
  await expect(statusPanel).toContainText(/KRX 기준일|네이버 마켓 생성|시장지표 갱신/)
})

test('연기금 수급 테이블이 로딩 상태에 멈추지 않는다', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('tab', { name: '연기금 수급' }).click()
  await page.getByRole('tab', { name: '검색' }).click()

  await expect(page.locator('body')).not.toContainText('데이터를 불러오는 중입니다', {
    timeout: 10000,
  })
})

test('검색 입력이 가능하다', async ({ page }) => {
  await page.goto('/')

  const search = page.getByLabel('종목명 또는 종목코드 검색').first()
  await expect(search).toBeVisible()

  await search.fill('삼성')
  await expect(search).toHaveValue('삼성')
})

test('모바일 폭에서도 핵심 콘텐츠와 카드형 리스트가 보인다', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await page.getByRole('tab', { name: '연기금 수급' }).click()
  await page.getByRole('tab', { name: '검색' }).click()

  await expect(page.locator('body')).toContainText(/연기금|ETF|테마|시장/)
  await expect(page.locator('.mobile-stock-list')).toBeVisible()
  await expect(page.locator('.mobile-stock-card').first()).toBeVisible()
})
