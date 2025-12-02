import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Read wines.json
const winesPath = path.join(__dirname, 'wines.json')
const wines = JSON.parse(fs.readFileSync(winesPath, 'utf8'))

console.log(`Total wines: ${wines.length}`)

// Separate wines with and without code
const winesWithCode = wines.filter(w => w.code)
const winesWithoutCode = wines.filter(w => !w.code)

console.log(`Wines with code: ${winesWithCode.length}`)
console.log(`Wines without code: ${winesWithoutCode.length}`)

// Analyze wines without code - find alternative identifiers
console.log('\n--- Sample wines WITHOUT code ---')
const samples = winesWithoutCode.slice(0, 5)
samples.forEach((wine, idx) => {
  console.log(`\nSample ${idx + 1}:`)
  console.log('  Fields available:', Object.keys(wine).filter(k => wine[k] !== null && wine[k] !== undefined && wine[k] !== ''))
  console.log('  Name:', wine.name || 'N/A')
  console.log('  URL:', wine.url || 'N/A')
  console.log('  _id:', wine._id || 'N/A')
  console.log('  code:', wine.code || 'MISSING')
  console.log('  Has price:', !!wine.price)
  console.log('  Has volume:', !!wine.volume)
  console.log('  Status:', wine.status || 'N/A')
  console.log('  Buyable:', wine.buyable)
})

// Check if there are any alternative unique identifiers
console.log('\n--- Checking alternative identifiers ---')
const hasMongoId = winesWithoutCode.filter(w => w._id).length
const hasUrl = winesWithoutCode.filter(w => w.url).length
const hasName = winesWithoutCode.filter(w => w.name).length

console.log(`Wines with _id: ${hasMongoId}`)
console.log(`Wines with url: ${hasUrl}`)
console.log(`Wines with name: ${hasName}`)

// Check if we can extract product ID from URL
const urlsWithProductId = winesWithoutCode.filter(w => {
  if (!w.url) return false
  const match = w.url.match(/\/(\d+)$/)
  return match !== null
})

console.log(`\nWines where product ID can be extracted from URL: ${urlsWithProductId.length}`)

if (urlsWithProductId.length > 0) {
  console.log('\nSample URLs with extractable product IDs:')
  urlsWithProductId.slice(0, 5).forEach(w => {
    const match = w.url.match(/\/(\d+)$/)
    console.log(`  URL: ${w.url} -> Product ID: ${match[1]}`)
  })
}
