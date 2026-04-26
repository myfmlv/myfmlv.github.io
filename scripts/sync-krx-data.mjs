import { copyFile, mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..')
const defaultSourceDir = path.resolve(projectRoot, '../../Telegram/data/krx')
const defaultOutputDir = path.resolve(projectRoot, 'data/krx')

function getArg(name) {
  const prefix = `--${name}=`
  const value = process.argv.find((arg) => arg.startsWith(prefix))
  return value ? path.resolve(value.slice(prefix.length)) : undefined
}

function countDataRows(text) {
  return Math.max(0, text.split(/\r?\n/).filter((line) => line.trim()).length - 1)
}

const sourceDir = getArg('source') ?? defaultSourceDir
const outputDir = getArg('out') ?? defaultOutputDir

await mkdir(outputDir, { recursive: true })

const sourceFileNames = await readdir(sourceDir)
const fileNames = sourceFileNames
  .filter((fileName) => /^krx_\d{8}\.csv$/.test(fileName))
  .sort()

if (fileNames.length === 0) {
  throw new Error(`KRX CSV 파일이 없습니다: ${sourceDir}`)
}

const files = []

for (const fileName of fileNames) {
  const sourcePath = path.join(sourceDir, fileName)
  const outputPath = path.join(outputDir, fileName)
  const text = await readFile(sourcePath, 'utf8')
  await copyFile(sourcePath, outputPath)
  files.push({
    date: fileName.match(/\d{8}/)?.[0] ?? '',
    file: fileName,
    rows: countDataRows(text),
  })
}

files.sort((a, b) => b.date.localeCompare(a.date))

await writeFile(path.join(outputDir, 'index.json'), `${JSON.stringify({
  latest: files[0].date,
  generatedAt: new Date().toISOString(),
  files,
}, null, 2)}\n`)

const stockMetaFileName = sourceFileNames
  .filter((fileName) => /^stock_meta_\d{8}\.json$/.test(fileName))
  .sort()
  .at(-1)

if (stockMetaFileName) {
  await copyFile(path.join(sourceDir, stockMetaFileName), path.join(projectRoot, 'data/stock-meta.json'))
}

console.log(`Synced ${files.length} KRX CSV file(s) to ${outputDir}`)
if (stockMetaFileName) console.log(`Synced stock meta: ${stockMetaFileName}`)
