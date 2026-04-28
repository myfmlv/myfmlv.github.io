import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..')
const dataDir = path.resolve(projectRoot, 'data')

const SOURCES = [
  {
    url: 'https://www.nasdaqtrader.com/dynamic/SymDir/nasdaqlisted.txt',
    exchange: 'NASDAQ',
    symbolKey: 'Symbol',
    nameKey: 'Security Name',
    etfKey: 'ETF',
    testKey: 'Test Issue',
  },
  {
    url: 'https://www.nasdaqtrader.com/dynamic/SymDir/otherlisted.txt',
    exchange: null,
    symbolKey: 'ACT Symbol',
    nameKey: 'Security Name',
    exchangeKey: 'Exchange',
    etfKey: 'ETF',
    testKey: 'Test Issue',
  },
]

const exchangeLabels = {
  A: 'NYSE American',
  N: 'NYSE',
  P: 'NYSE Arca',
  V: 'IEX',
  Z: 'Cboe BZX',
}

function parsePipeTable(text) {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter(Boolean)
  const headers = lines[0].split('|')
  return lines.slice(1)
    .filter((line) => !line.startsWith('File Creation Time'))
    .map((line) => {
      const cells = line.split('|')
      return Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? '']))
    })
}

function cleanName(value) {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .replace(/\s+-\s+/g, ' ')
    .trim()
}

function naverCodeFor(symbol, exchange) {
  const normalized = String(symbol ?? '').trim().replace(/\./g, '')
  if (!normalized) return ''
  if (exchange === 'NASDAQ') return `${normalized}.O`
  if (exchange === 'NYSE') return normalized
  if (exchange === 'NYSE American') return `${normalized}.K`
  return normalized
}

const symbols = new Map()

for (const source of SOURCES) {
  const response = await fetch(source.url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
  if (!response.ok) throw new Error(`${source.url} failed: ${response.status}`)
  const rows = parsePipeTable(await response.text())
  rows.forEach((row) => {
    const symbol = String(row[source.symbolKey] ?? '').trim()
    const name = cleanName(row[source.nameKey])
    const isTest = String(row[source.testKey] ?? '').trim().toUpperCase() === 'Y'
    const isEtf = String(row[source.etfKey] ?? '').trim().toUpperCase() === 'Y'
    if (!symbol || !name || isTest || isEtf) return
    const exchange = source.exchange ?? exchangeLabels[String(row[source.exchangeKey] ?? '').trim()] ?? 'US'
    symbols.set(symbol, {
      symbol,
      name,
      exchange,
      naverCode: naverCodeFor(symbol, exchange),
      sector: '미국 개별주',
    })
  })
}

await mkdir(dataDir, { recursive: true })
await writeFile(path.join(dataDir, 'us-symbols.json'), `${JSON.stringify({
  generatedAt: new Date().toISOString(),
  source: SOURCES.map((source) => source.url),
  symbols: [...symbols.values()].sort((a, b) => a.symbol.localeCompare(b.symbol)),
}, null, 2)}\n`)

console.log(`Synced US symbols: ${symbols.size}`)
