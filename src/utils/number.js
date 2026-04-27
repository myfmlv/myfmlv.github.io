export function toNumberStrict(value) {
  if (value === null || value === undefined || value === '') return null

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }

  const normalized = String(value).replace(/,/g, '').trim()

  if (!/^-?\d+(\.\d+)?$/.test(normalized)) {
    return null
  }

  const result = Number(normalized)
  return Number.isFinite(result) ? result : null
}

export function formatNullableNumber(value, formatter = (number) => number.toLocaleString('ko-KR')) {
  if (value === null || value === undefined || Number.isNaN(value)) return '-'
  return formatter(value)
}
