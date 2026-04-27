import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()

const requiredJsonFiles = [
  'data/krx/index.json',
  'data/naver-market.json',
  'data/market-index.json',
]

function fail(message) {
  console.error(`[fail] ${message}`)
  process.exitCode = 1
}

function ok(message) {
  console.log(`[ok] ${message}`)
}

function warn(message) {
  console.warn(`[warn] ${message}`)
}

function filePath(filePath) {
  return path.join(root, filePath)
}

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key)
}

function isPlainRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function readJson(relativePath, options = {}) {
  const fullPath = filePath(relativePath)

  if (!fs.existsSync(fullPath)) {
    if (options.optional) {
      warn(`${relativePath} does not exist`)
      return null
    }

    fail(`${relativePath} does not exist`)
    return null
  }

  const stat = fs.statSync(fullPath)
  if (stat.size === 0) {
    if (options.optionalEmpty) {
      warn(`${relativePath} is empty`)
      return null
    }

    fail(`${relativePath} is empty`)
    return null
  }

  const raw = fs.readFileSync(fullPath, 'utf8').trim()
  if (!raw) {
    if (options.optionalEmpty) {
      warn(`${relativePath} is blank`)
      return null
    }

    fail(`${relativePath} is blank`)
    return null
  }

  try {
    return JSON.parse(raw)
  } catch (error) {
    fail(`${relativePath} is not valid JSON: ${error.message}`)
    return null
  }
}

function validateCommonFields(relativePath, data) {
  if (data === null || data === undefined) return
  if (!Array.isArray(data) && typeof data !== 'object') {
    fail(`${relativePath} must be a JSON object or array`)
    return
  }

  if (!isPlainRecord(data)) return

  if (hasOwn(data, 'generatedAt') && typeof data.generatedAt !== 'string') {
    fail(`${relativePath}.generatedAt must be a string`)
  }

  if (hasOwn(data, 'generatedAt') && Number.isNaN(Date.parse(data.generatedAt))) {
    fail(`${relativePath}.generatedAt must be an ISO-compatible date string`)
  }

  if (hasOwn(data, 'latest') && typeof data.latest !== 'string') {
    fail(`${relativePath}.latest must be a string`)
  }

  if (hasOwn(data, 'files') && !Array.isArray(data.files)) {
    fail(`${relativePath}.files must be an array`)
  }

  if (hasOwn(data, 'source')) {
    const sourceType = Array.isArray(data.source) ? 'array' : typeof data.source
    if (!['string', 'object', 'array'].includes(sourceType) || data.source === null) {
      fail(`${relativePath}.source must be a string, array, or object`)
    }
  }
}

function countCsvDataRows(relativePath) {
  try {
    const text = fs.readFileSync(filePath(relativePath), 'utf8')
    return Math.max(0, text.split(/\r?\n/).filter((line) => line.trim()).length - 1)
  } catch {
    return null
  }
}

function validateKrxIndex() {
  const relativePath = 'data/krx/index.json'
  const index = readJson(relativePath)
  if (!index) return

  validateCommonFields(relativePath, index)

  if (!isPlainRecord(index)) {
    fail(`${relativePath} must be an object`)
    return
  }

  if (!index.latest || typeof index.latest !== 'string') {
    fail(`${relativePath} must have string field "latest"`)
  }

  if (!Array.isArray(index.files) || index.files.length === 0) {
    fail(`${relativePath} must have non-empty "files" array`)
    return
  }

  const seenDates = new Set()
  for (const item of index.files) {
    if (!isPlainRecord(item)) {
      fail('Every KRX index file entry must be an object')
      continue
    }

    if (!item.date || typeof item.date !== 'string') {
      fail('Every KRX index file entry must have string field "date"')
    }

    if (!item.file || typeof item.file !== 'string') {
      fail('Every KRX index file entry must have string field "file"')
      continue
    }

    if (seenDates.has(item.date)) {
      fail(`Duplicate KRX date in index: ${item.date}`)
    }
    seenDates.add(item.date)

    const csvRelativePath = path.posix.join('data/krx', item.file)
    const csvFullPath = filePath(csvRelativePath)
    if (!fs.existsSync(csvFullPath)) {
      fail(`KRX CSV file missing: ${csvRelativePath}`)
      continue
    }

    const csvStat = fs.statSync(csvFullPath)
    if (csvStat.size === 0) {
      fail(`KRX CSV file is empty: ${csvRelativePath}`)
    }

    if (typeof item.rows !== 'number' || !Number.isFinite(item.rows) || item.rows <= 0) {
      fail(`KRX CSV row count must be a positive number: ${item.file}`)
      continue
    }

    const actualRows = countCsvDataRows(csvRelativePath)
    if (actualRows !== null && actualRows !== item.rows) {
      warn(`KRX CSV row count differs for ${item.file}: index=${item.rows}, actual=${actualRows}`)
    }
  }

  const latestEntry = index.files.find((item) => item.date === index.latest)
  if (!latestEntry) {
    fail(`KRX latest date ${index.latest} is not included in files array`)
  } else {
    const latestCsvPath = path.posix.join('data/krx', latestEntry.file)
    if (!fs.existsSync(filePath(latestCsvPath))) {
      fail(`Latest KRX CSV file missing: ${latestCsvPath}`)
    }
  }

  ok('KRX index validated')
}

function validateMarketIndex() {
  const relativePath = 'data/market-index.json'
  const marketIndex = readJson(relativePath)
  if (!marketIndex) return

  validateCommonFields(relativePath, marketIndex)

  if (!Array.isArray(marketIndex)) {
    fail(`${relativePath} must be an array`)
    return
  }

  if (marketIndex.length === 0) {
    fail(`${relativePath} must not be empty`)
    return
  }

  marketIndex.forEach((item, index) => {
    if (!isPlainRecord(item)) {
      fail(`${relativePath}[${index}] must be an object`)
      return
    }

    if (!item.name || typeof item.name !== 'string') {
      fail(`${relativePath}[${index}].name must be a non-empty string`)
    }

    if (item.value === undefined || item.value === null || String(item.value).trim() === '') {
      fail(`${relativePath}[${index}].value must not be empty`)
    }

    if (hasOwn(item, 'updatedAt') && Number.isNaN(Date.parse(item.updatedAt))) {
      fail(`${relativePath}[${index}].updatedAt must be an ISO-compatible date string`)
    }
  })

  ok('Market index validated')
}

function validateNaverMarket() {
  const relativePath = 'data/naver-market.json'
  const data = readJson(relativePath)
  if (!data) return

  validateCommonFields(relativePath, data)

  if (!isPlainRecord(data)) {
    fail(`${relativePath} must be an object`)
    return
  }

  if (!data.generatedAt || typeof data.generatedAt !== 'string') {
    fail(`${relativePath} must have string field "generatedAt"`)
  }

  if (!data.domestic && !data.foreign && !data.us) {
    warn(`${relativePath} has no domestic/foreign/us top-level market data field`)
  }

  for (const key of ['domestic', 'themes', 'us']) {
    if (hasOwn(data, key) && !isPlainRecord(data[key])) {
      fail(`${relativePath}.${key} must be an object when present`)
    }
  }

  ok('Naver market data validated')
}

function stockMetaEntries(data) {
  if (Array.isArray(data)) return data
  if (isPlainRecord(data)) {
    return Object.entries(data).map(([ticker, value]) => ({ ticker, ...value }))
  }
  return []
}

function validateStockMeta() {
  const relativePath = 'data/stock-meta.json'
  const data = readJson(relativePath, { optional: true, optionalEmpty: true })
  if (!data) {
    warn(`${relativePath} is empty or missing. Treating as optional metadata.`)
    return
  }

  validateCommonFields(relativePath, data)

  if (!Array.isArray(data) && !isPlainRecord(data)) {
    fail(`${relativePath} must be an object or array`)
    return
  }

  const entries = stockMetaEntries(data)
  if (entries.length === 0) {
    warn(`${relativePath} has no stock metadata entries. Treating as optional metadata.`)
    return
  }

  let validEntries = 0
  entries.slice(0, 50).forEach((item, index) => {
    if (!item || typeof item !== 'object') {
      fail(`${relativePath} entry ${index} must be an object`)
      return
    }

    if (!item.ticker || typeof item.ticker !== 'string') {
      fail(`${relativePath} entry ${index} must have string field "ticker"`)
      return
    }

    if (hasOwn(item, 'marketCap') && (!Number.isFinite(Number(item.marketCap)) || Number(item.marketCap) < 0)) {
      fail(`${relativePath} entry ${item.ticker}.marketCap must be a non-negative number`)
      return
    }

    validEntries += 1
  })

  if (validEntries === 0) {
    fail(`${relativePath} has no valid stock metadata entries in the first 50 entries`)
  }

  ok(`Stock meta validated (${entries.length.toLocaleString('en-US')} entries)`)
}

function validateUpdateStatus() {
  const relativePath = 'data/update-status.json'
  const data = readJson(relativePath, { optional: true })
  if (!data) return

  validateCommonFields(relativePath, data)

  if (!isPlainRecord(data)) {
    fail(`${relativePath} must be an object`)
    return
  }

  if (!data.generatedAt || typeof data.generatedAt !== 'string') {
    fail(`${relativePath} must have string field "generatedAt"`)
  } else if (Number.isNaN(Date.parse(data.generatedAt))) {
    fail(`${relativePath}.generatedAt must be an ISO-compatible date string`)
  }

  if (data.status && !['ok', 'partial', 'error'].includes(data.status)) {
    fail(`${relativePath}.status must be ok, partial, or error`)
  }

  ok('Update status validated')
}

for (const relativePath of requiredJsonFiles) {
  const data = readJson(relativePath, { optionalEmpty: false })
  if (data) validateCommonFields(relativePath, data)
}

validateKrxIndex()
validateMarketIndex()
validateNaverMarket()
validateStockMeta()
validateUpdateStatus()

if (process.exitCode) {
  process.exit(process.exitCode)
}

console.log('[ok] All data validation checks passed')
