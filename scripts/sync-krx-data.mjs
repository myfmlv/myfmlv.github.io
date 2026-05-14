import { copyFile, mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises'
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

async function isSameFile(left, right) {
  try {
    const [leftStat, rightStat] = await Promise.all([stat(left), stat(right)])
    return leftStat.dev === rightStat.dev && leftStat.ino === rightStat.ino
  } catch {
    return path.resolve(left) === path.resolve(right)
  }
}

async function krxCsvFileNames(directory) {
  return (await readdir(directory))
    .filter((fileName) => /^krx_\d{8}\.csv$/.test(fileName))
    .sort()
}

const sourceDir = getArg('source') ?? (process.env.KRX_SOURCE_DIR ? path.resolve(process.env.KRX_SOURCE_DIR) : defaultSourceDir)
const outputDir = getArg('out') ?? defaultOutputDir

await mkdir(outputDir, { recursive: true })

const sourceFileNames = await readdir(sourceDir)
const fileNames = sourceFileNames
  .filter((fileName) => /^krx_\d{8}\.csv$/.test(fileName))
  .sort()

if (fileNames.length === 0) {
  throw new Error(`KRX CSV 파일이 없습니다: ${sourceDir}`)
}

for (const fileName of fileNames) {
  const sourcePath = path.join(sourceDir, fileName)
  const outputPath = path.join(outputDir, fileName)
  if (!(await isSameFile(sourcePath, outputPath))) {
    await copyFile(sourcePath, outputPath)
  }
}

const files = await Promise.all((await krxCsvFileNames(outputDir)).map(async (fileName) => {
  const text = await readFile(path.join(outputDir, fileName), 'utf8')
  return {
    date: fileName.match(/\d{8}/)?.[0] ?? '',
    file: fileName,
    rows: countDataRows(text),
  }
}))

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
  const latestCsvDate = files[0]?.date ?? ''
  const stockMetaDate = stockMetaFileName.match(/\d{8}/)?.[0] ?? ''
  if (stockMetaDate >= latestCsvDate) {
    await copyFile(path.join(sourceDir, stockMetaFileName), path.join(projectRoot, 'data/stock-meta.json'))
  }
}

console.log(`Synced ${files.length} KRX CSV file(s) to ${outputDir}`)
if (stockMetaFileName) console.log(`Checked stock meta: ${stockMetaFileName}`)
