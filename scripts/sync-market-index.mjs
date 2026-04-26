import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..')
const outputPath = path.join(projectRoot, 'data/market-index.json')
const sourceUrl = 'https://finance.naver.com/marketindex/'

const targets = [
  { label: '미국 USD', name: '원달러', unit: '원' },
  { label: '일본 JPY(100엔)', name: '원엔', unit: '원/100엔' },
  { label: 'WTI', name: 'WTI', unit: '달러' },
  { label: '국제 금', name: '국제 금', unit: '달러' },
]

function clean(value) {
  return String(value ?? '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
}

function parseItem(html, target) {
  const blockPattern = new RegExp(`<h3[^>]*>\\s*<span class="blind">${target.label.replace(/[()]/g, '\\$&')}</span>[\\s\\S]*?</a>`)
  const block = html.match(blockPattern)?.[0] ?? ''
  const value = clean(block.match(/<span class="value">([\s\S]*?)<\/span>/)?.[1])
  const change = clean(block.match(/<span class="change">([\s\S]*?)<\/span>/)?.[1])
  const direction = clean(block.match(/<span class="blind">(상승|하락)<\/span>/)?.[1])
  const tone = direction === '상승' ? 'up' : direction === '하락' ? 'down' : 'neutral'
  const sign = tone === 'up' && change ? '+' : tone === 'down' && change ? '-' : ''

  if (!value) throw new Error(`${target.label} 값을 찾지 못했습니다.`)

  return {
    name: target.name,
    value,
    unit: target.unit,
    change: `${sign}${change}`.replace('--', '-'),
    tone,
    source: 'Naver Finance',
    sourceUrl,
    updatedAt: new Date().toISOString(),
  }
}

const response = await fetch(sourceUrl, {
  headers: { 'User-Agent': 'Mozilla/5.0' },
})

if (!response.ok) throw new Error(`Naver marketindex failed: ${response.status}`)

const html = new TextDecoder('euc-kr').decode(await response.arrayBuffer())
const items = targets.map((target) => parseItem(html, target))

await mkdir(path.dirname(outputPath), { recursive: true })
await writeFile(outputPath, `${JSON.stringify(items, null, 2)}\n`)
console.log(`Synced market index: ${items.length} item(s) -> ${outputPath}`)
