import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

// Load user ID mapping
let userIdMap = {}
try {
  const mapping = fs.readFileSync('mongodb-exports/user-id-mapping.json', 'utf8')
  userIdMap = JSON.parse(mapping)
  console.log(`Loaded ${Object.keys(userIdMap).length} user ID mappings`)
} catch (error) {
  console.error('Could not load user-id-mapping.json:', error.message)
  console.error('Make sure you ran import-mongodb-users.mjs first!')
  process.exit(1)
}

// Load tastings data
const tastingsData = JSON.parse(fs.readFileSync('scripts/tastings.json', 'utf8'))
console.log(`Loaded ${tastingsData.length} tastings from JSON file`)

// Helper function to calculate numeric similarity (0-100)
function calculateNumericSimilarity(userValue, actualValue) {
  const normalizeNumber = (str) => {
    if (typeof str === 'number') return str
    const cleaned = String(str).replace(/[^\d.,]/g, '').replace('prosent', '')
    return parseFloat(cleaned.replace(',', '.'))
  }
  
  const userNum = normalizeNumber(userValue)
  const actualNum = normalizeNumber(actualValue)
  
  if (isNaN(userNum) || isNaN(actualNum)) return 0
  
  const difference = Math.abs(userNum - actualNum)
  const average = (userNum + actualNum) / 2
  const percentDifference = (difference / average) * 100
  
  return Math.max(0, Math.round(100 - percentDifference))
}

// Simplified semantic similarity (just keyword matching for the script)
function simpleSemanticSimilarity(text1, text2) {
  if (!text1 || !text2) return 0
  
  const words1 = text1.toLowerCase().split(/[\s,]+/).filter(w => w.length > 3)
  const words2 = text2.toLowerCase().split(/[\s,]+/).filter(w => w.length > 3)
  
  if (words1.length === 0 || words2.length === 0) return 0
  
  const matches = words1.filter(w1 => words2.some(w2 => w1.includes(w2) || w2.includes(w1)))
  const similarity = (matches.length / Math.max(words1.length, words2.length)) * 100
  
  return Math.round(similarity)
}

async function calculateScores(tasting, wine) {
  if (!wine) return null
  
  const scores = {}
  
  // Color score
  scores.color_score = tasting.farge && wine.color 
    ? simpleSemanticSimilarity(tasting.farge, wine.color)
    : 0
  
  // Smell score
  const smellText = tasting.smell + ' ' + (tasting.lukt || '')
  scores.smell_score = wine.smell 
    ? simpleSemanticSimilarity(smellText, wine.smell)
    : 0
  
  // Taste score
  const tasteText = tasting.taste + ' ' + (tasting.smak || '')
  scores.taste_score = wine.taste
    ? simpleSemanticSimilarity(tasteText, wine.taste)
    : 0
  
  // Alcohol percentage score
  const wineAlcohol = wine.content?.traits?.[0]?.readableValue || '0'
  scores.percentage_score = tasting.alkohol
    ? calculateNumericSimilarity(tasting.alkohol, wineAlcohol)
    : 0
  
  // Price score
  scores.price_score = tasting.pris && wine.price?.value
    ? calculateNumericSimilarity(tasting.pris, wine.price.value)
    : 0
  
  // Characteristics scores
  const characteristics = wine.content?.characteristics || []
  const vmpFylde = characteristics.find(x => x.name?.toLowerCase() === 'fylde')?.value
  const vmpFriskhet = characteristics.find(x => x.name?.toLowerCase() === 'friskhet')?.value
  const vmpSnaerp = characteristics.find(x => x.name?.toLowerCase() === 'garvestoffer')?.value
  const vmpSodme = characteristics.find(x => x.name?.toLowerCase() === 'sødme')?.value
  
  scores.fylde_score = tasting.fylde && vmpFylde
    ? calculateNumericSimilarity(tasting.fylde, vmpFylde)
    : 0
  
  scores.friskhet_score = tasting.friskhet && vmpFriskhet
    ? calculateNumericSimilarity(tasting.friskhet, vmpFriskhet)
    : 0
  
  scores.snaerp_score = wine.main_category?.code === 'rødvin' && tasting.snaerp && vmpSnaerp
    ? calculateNumericSimilarity(tasting.snaerp, vmpSnaerp)
    : 0
  
  scores.sodme_score = wine.main_category?.code !== 'rødvin' && tasting.sodme && vmpSodme
    ? calculateNumericSimilarity(tasting.sodme, vmpSodme)
    : 0
  
  // Calculate overall score (weighted average)
  const halfWeightProps = ['price_score', 'percentage_score']
  let total = 0
  let weightSum = 0
  
  for (const [key, value] of Object.entries(scores)) {
    const weight = halfWeightProps.includes(key) ? 0.2 : 1
    total += value * weight
    weightSum += weight
  }
  
  scores.overall_score = Math.round(total / weightSum)
  
  return scores
}

async function importTastings() {
  let imported = 0
  let skipped = 0
  let failed = 0
  
  for (const tasting of tastingsData) {
    try {
      // Map user ID
      const mongoUserId = tasting.userId
      const newUserId = userIdMap[mongoUserId]
      
      if (!newUserId) {
        console.log(`Skipping tasting - missing user reference for ${mongoUserId}`)
        skipped++
        continue
      }
      
      // Transform selectedFlavorsLukt to comma-separated flavor names
      const smell = tasting.selectedFlavorsLukt
        ?.map(item => item.flavor?.name)
        .filter(Boolean)
        .join(', ') || ''
      
      // Transform selectedFlavorsSmak to comma-separated flavor names
      const taste = tasting.selectedFlavorsSmak
        ?.map(item => item.flavor?.name)
        .filter(Boolean)
        .join(', ') || ''
      
      let transformedKarakter = tasting.karakter
      if (transformedKarakter && transformedKarakter <= 6) {
        // Scale from 1-6 to 1-10: ((value - 1) * 9 / 5) + 1
        transformedKarakter = Math.round(((transformedKarakter - 1) * 9 / 5) + 1)
      }
      
      // Fetch wine data for score calculation
      const { data: wine } = await supabase
        .from('wines')
        .select('*')
        .eq('code', tasting.productId)
        .single()
      
      // Calculate scores
      const scores = await calculateScores({
        ...tasting,
        smell,
        taste,
        karakter: transformedKarakter // Use transformed karakter for score calculation
      }, wine)
      
      // Prepare tasting data
      const tastingData = {
        user_id: newUserId,
        product_id: tasting.productId,
        farge: tasting.farge || null,
        smell: smell || null,
        taste: taste || null,
        lukt: tasting.lukt || null,
        smak: tasting.smak || null,
        friskhet: tasting.friskhet || null,
        fylde: tasting.fylde || null,
        sodme: tasting.sødme || tasting.sodme || null,
        snaerp: tasting.snærp || tasting.snaerp || null,
        karakter: transformedKarakter, // Use transformed value
        egenskaper: tasting.egenskaper || null,
        lukt_intensitet: tasting.luktIntensitet || null,
        smaks_intensitet: tasting.smaksIntensitet || null,
        alkohol: tasting.alkohol || null,
        pris: tasting.pris || null,
        tasted_at: tasting.tastedAt ? new Date(tasting.tastedAt) : new Date(),
        ...scores
      }
      
      // Insert with upsert to avoid duplicates
      const { error } = await supabase
        .from('tastings')
        .upsert(tastingData, { onConflict: 'id' })
      
      if (error) {
        console.error(`Failed to import tasting for user ${newUserId}:`, error.message)
        failed++
      } else {
        imported++
        if (imported % 100 === 0) {
          console.log(`Imported ${imported} tastings...`)
        }
      }
      
    } catch (error) {
      console.error(`Error processing tasting:`, error.message)
      failed++
    }
  }
  
  console.log(`\nImport complete!`)
  console.log(`Imported: ${imported}`)
  console.log(`Skipped: ${skipped}`)
  console.log(`Failed: ${failed}`)
}

importTastings()
