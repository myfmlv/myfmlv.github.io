import { expect, test } from '@playwright/test'

test('홈페이지가 로드되고 핵심 제목이 보인다', async ({ page }) => {
  await page.goto('/')

  await expect(page).toHaveTitle(/MYFMLV|Market|투자|수급/i)
  await expect(page.locator('body')).toContainText(/연기금|ETF|테마|시장/)
})

test('일반 접속에서는 관리자 데이터 상태 UI가 숨겨진다', async ({ page }) => {
  await page.goto('/')

  await expect(page.locator('#adminDataStatusToggle')).toBeHidden()
  await expect(page.locator('#adminDataStatusPanel')).toBeHidden()
  await expect(page.locator('body')).not.toContainText('데이터 상태를 확인하는 중입니다')
  await expect(page.locator('body')).not.toContainText('기준일과 갱신시각을 불러오는 중입니다')
})

test('관리자 모드에서 데이터 상태 패널을 열 수 있다', async ({ page }) => {
  await page.goto('/?admin=1')

  const toggle = page.locator('#adminDataStatusToggle')
  const statusPanel = page.locator('#adminDataStatusPanel')
  await expect(toggle).toBeVisible()
  await expect(statusPanel).toBeHidden()

  await toggle.click()
  await expect(statusPanel).toBeVisible()
  await expect(statusPanel).not.toContainText('초기화 중', { timeout: 10000 })
  await expect(statusPanel).toContainText(/KRX 기준일|네이버 마켓 생성|시장지표 갱신/)
})

test('관리자 모드를 해제하면 DATA 버튼이 사라진다', async ({ page }) => {
  await page.goto('/?admin=1')
  await expect(page.locator('#adminDataStatusToggle')).toBeVisible()

  await page.goto('/?admin=0')
  await expect(page.locator('#adminDataStatusToggle')).toBeHidden()
  await expect(page.locator('#adminDataStatusPanel')).toBeHidden()
})

test('연기금 수급 테이블이 로딩 상태에 멈추지 않는다', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('tab', { name: '연기금 수급' }).click()
  await page.getByRole('tab', { name: '검색' }).click()

  await expect(page.locator('body')).not.toContainText('데이터를 불러오는 중입니다', {
    timeout: 10000,
  })
})

test('국내 테마 60일 화면은 상승/하락 랭킹과 구성종목 수익률을 계산한다', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('tab', { name: '테마' }).click()
  await page.getByRole('button', { name: '60일' }).click()

  const risingPanel = page.locator('#themeSectionGrid article').filter({ hasText: '상승중인 테마' })
  const fallingPanel = page.locator('#themeSectionGrid article').filter({ hasText: '하락중인 테마' })
  const hotPanel = page.locator('#themeSectionGrid article').filter({ hasText: '현재 핫한 테마' })

  await expect(risingPanel).not.toContainText('표시할 데이터가 없습니다.')
  await expect(fallingPanel).not.toContainText('표시할 데이터가 없습니다.')
  await expect(hotPanel.locator('li').first()).toContainText(/상승 [1-9]/)
  await expect(page.locator('#themeDetail .value').first()).toContainText(/[-+]?\d+(\.\d+)?%/)
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
