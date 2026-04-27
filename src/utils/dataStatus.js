export function createInitialDataStatus() {
  return {
    phase: 'loading',
    sourceLevel: 'unknown',
    usedFallback: false,
    hasFatalError: false,
    hasPartialError: false,
    generatedAt: null,
    krxLatest: null,
    krxGeneratedAt: null,
    naverGeneratedAt: null,
    marketIndexUpdatedAt: null,
    updateWorkflowGeneratedAt: null,
    updatedAt: new Date().toISOString(),
    errors: [],
    warnings: [],
  }
}

export function addDataError(status, source, error) {
  if (!status) return

  status.hasPartialError = true
  status.errors.push({
    source,
    message: error?.message || String(error),
    at: new Date().toISOString(),
  })
}

export function addDataWarning(status, source, warning) {
  if (!status) return

  status.warnings.push({
    source,
    message: warning?.message || String(warning),
    at: new Date().toISOString(),
  })
}

export function markFallback(status, source, reason) {
  if (!status) return

  status.usedFallback = true
  status.warnings.push({
    source,
    message: reason || 'Fallback data used',
    at: new Date().toISOString(),
  })
}

export function mergeLoadedDataStatus(status, payload = {}) {
  if (!status) return status

  const { krxIndex, naverMarket, marketIndex, updateStatus } = payload

  if (krxIndex?.latest) status.krxLatest = krxIndex.latest
  if (krxIndex?.generatedAt) status.krxGeneratedAt = krxIndex.generatedAt
  if (naverMarket?.generatedAt) status.naverGeneratedAt = naverMarket.generatedAt
  if (Array.isArray(marketIndex) && marketIndex[0]?.updatedAt) {
    status.marketIndexUpdatedAt = marketIndex[0].updatedAt
  }
  if (updateStatus?.generatedAt) {
    status.updateWorkflowGeneratedAt = updateStatus.generatedAt
  }

  status.generatedAt =
    status.naverGeneratedAt ||
    status.krxGeneratedAt ||
    status.marketIndexUpdatedAt ||
    status.updateWorkflowGeneratedAt ||
    status.generatedAt ||
    null

  return status
}

export function getFreshness(generatedAt) {
  if (!generatedAt) {
    return {
      level: 'unknown',
      label: '갱신시각 없음',
      ageHours: null,
    }
  }

  const time = new Date(generatedAt).getTime()

  if (Number.isNaN(time)) {
    return {
      level: 'unknown',
      label: '갱신시각 오류',
      ageHours: null,
    }
  }

  const ageHours = (Date.now() - time) / 1000 / 60 / 60

  if (ageHours <= 30) {
    return {
      level: 'fresh',
      label: '최신 데이터',
      ageHours,
    }
  }

  if (ageHours <= 72) {
    return {
      level: 'stale',
      label: '지연 데이터',
      ageHours,
    }
  }

  return {
    level: 'old',
    label: '오래된 데이터',
    ageHours,
  }
}

export function finalizeDataStatus(status, payload = {}) {
  if (!status) return status

  mergeLoadedDataStatus(status, payload)

  const freshness = getFreshness(status.generatedAt)

  if (status.hasFatalError) {
    status.phase = 'error'
    status.sourceLevel = 'error'
    return status
  }

  if (status.usedFallback) {
    status.phase = 'ready'
    status.sourceLevel = 'fallback'
    return status
  }

  if (status.hasPartialError) {
    status.phase = 'ready'
    status.sourceLevel = 'partial'
    return status
  }

  status.phase = 'ready'
  status.sourceLevel = freshness.level

  return status
}

export function formatDateTime(value) {
  if (!value) return '-'

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return String(value)
  }

  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export function buildDataStatusText(status) {
  if (!status) {
    return {
      title: '데이터 상태: 확인 불가',
      detail: '상태 객체가 없습니다.',
      level: 'unknown',
    }
  }

  const freshness = getFreshness(status.generatedAt)

  let title = `데이터 상태: ${freshness.label}`
  let level = freshness.level

  if (status.sourceLevel === 'fallback') {
    title = '데이터 상태: 백업 데이터 표시 중'
    level = 'fallback'
  }

  if (status.sourceLevel === 'partial') {
    title = '데이터 상태: 일부 데이터 로딩 실패'
    level = 'partial'
  }

  if (status.sourceLevel === 'error') {
    title = '데이터 상태: 데이터 로딩 실패'
    level = 'error'
  }

  const parts = [
    `KRX 기준일: ${status.krxLatest || '-'}`,
    `KRX 생성: ${formatDateTime(status.krxGeneratedAt)}`,
    `네이버 마켓 생성: ${formatDateTime(status.naverGeneratedAt)}`,
    `시장지표 갱신: ${formatDateTime(status.marketIndexUpdatedAt)}`,
  ]

  if (status.updateWorkflowGeneratedAt) {
    parts.push(`자동갱신: ${formatDateTime(status.updateWorkflowGeneratedAt)}`)
  }

  if (typeof freshness.ageHours === 'number') {
    parts.push(`경과: 약 ${Math.round(freshness.ageHours)}시간`)
  }

  if (status.errors?.length) {
    parts.push(`오류: ${status.errors.length}건`)
  }

  if (status.warnings?.length) {
    parts.push(`경고: ${status.warnings.length}건`)
  }

  return {
    title,
    detail: parts.join(' · '),
    level,
  }
}
