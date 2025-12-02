import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

// Helper function to get value from either camelCase or PascalCase
function getField(obj, fieldName) {
  if (!obj) return undefined
  // Try camelCase first (e.g., 'code')
  if (obj[fieldName] !== undefined) {
    return obj[fieldName]
  }
  // Try PascalCase (e.g., 'Code')
  const pascalCase = fieldName.charAt(0).toUpperCase() + fieldName.slice(1)
  return obj[pascalCase]
}

function normalizeToCamelCase(obj) {
  if (!obj || typeof obj !== 'object') return obj
  if (Array.isArray(obj)) {
    return obj.map(normalizeToCamelCase)
  }
  
  const normalized = {}
  for (const key of Object.keys(obj)) {
    // Convert first character to lowercase for camelCase
    const camelKey = key.charAt(0).toLowerCase() + key.slice(1)
    const value = obj[key]
    
    // Recursively normalize nested objects
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      normalized[camelKey] = normalizeToCamelCase(value)
    } else if (Array.isArray(value)) {
      normalized[camelKey] = value.map(item => 
        typeof item === 'object' ? normalizeToCamelCase(item) : item
      )
    } else {
      normalized[camelKey] = value
    }
  }
  return normalized
}

// Read JSON file
function readJsonFile(filename) {
  const filePath = path.join(__dirname, filename)
  const data = fs.readFileSync(filePath, 'utf8')
  return JSON.parse(data)
}

// Transform MongoDB wine document to match new schema
function transformWine(wine) {
  const code = getField(wine, 'code')
  if (!code) {
    return null
  }
  
  return {
    product_id: code,
    name: getField(wine, 'name'),
    description: getField(wine, 'description') || null,
    summary: getField(wine, 'summary') || null,
    url: getField(wine, 'url') || null,
    year: getField(wine, 'year') || null,
    
    price: normalizeToCamelCase(getField(wine, 'price')),
    volume: normalizeToCamelCase(getField(wine, 'volume')),
    litre_price: normalizeToCamelCase(getField(wine, 'litrePrice')),
    
    // Tasting notes
    color: getField(wine, 'color') || null,
    smell: getField(wine, 'smell') || null,
    taste: getField(wine, 'taste') || null,
    
    // Product attributes
    age_limit: getField(wine, 'ageLimit') || null,
    allergens: getField(wine, 'allergens') || null,
    bio_dynamic: getField(wine, 'bioDynamic') || false,
    buyable: (() => {
      const buyable = getField(wine, 'buyable')
      return buyable !== undefined ? buyable : true
    })(),
    cork: getField(wine, 'cork') || null,
    eco: getField(wine, 'eco') || false,
    environmental_packaging: getField(wine, 'environmentalPackaging') || false,
    expired: getField(wine, 'expired') || false,
    package_type: getField(wine, 'packageType') || null,
    release_mode: getField(wine, 'releaseMode') || false,
    similar_products: getField(wine, 'similarProducts') || false,
    status: getField(wine, 'status') || null,
    status_notification: getField(wine, 'statusNotification') || false,
    sustainable: getField(wine, 'sustainable') || false,
    
    // Distributor info
    distributor: getField(wine, 'distributor') || null,
    distributor_id: getField(wine, 'distributorId') || null,
    whole_saler: getField(wine, 'wholeSaler') || null,
    
    district: normalizeToCamelCase(getField(wine, 'district')),
    main_country: normalizeToCamelCase(getField(wine, 'mainCountry')),
    main_producer: normalizeToCamelCase(getField(wine, 'mainProducer')),
    sub_district: normalizeToCamelCase(getField(wine, 'sub_District') || getField(wine, 'subDistrict')),
    
    // Category - normalize to camelCase
    main_category: normalizeToCamelCase(getField(wine, 'mainCategory')),
    
    // Complex content object - normalize to camelCase
    content: normalizeToCamelCase(getField(wine, 'content'))
  }
}

async function importWines() {
  console.log('Reading wines from JSON file...')
  const wines = readJsonFile('wines.json')
  
  console.log(`Found ${wines.length} wines to import`)
  
  console.log('Checking for existing wines in database...')
  const { data: existingWines, error: checkError } = await supabase
    .from('wines')
    .select('product_id, year')
  
  if (checkError) {
    console.error('Error checking existing wines:', checkError.message)
    process.exit(1)
  }
  
  const existingKeys = new Set(existingWines.map(w => `${w.product_id}_${w.year}`))
  console.log(`Found ${existingKeys.size} unique product_id + year combinations in database`)
  
  let imported = 0
  let skipped = 0
  let alreadyExists = 0
  let errors = 0
  
  const batchSize = 100
  
  for (let i = 0; i < wines.length; i += batchSize) {
    const batch = wines.slice(i, i + batchSize)
    
    const seenKeysInBatch = new Set()
    
    const transformedBatch = batch
      .map(transformWine)
      .filter(wine => wine !== null)
      .filter(wine => {
        const key = `${wine.product_id}_${wine.year}`
        
        if (existingKeys.has(key)) {
          alreadyExists++
          return false
        }
        
        if (seenKeysInBatch.has(key)) {
          skipped++
          return false
        }
        
        seenKeysInBatch.add(key)
        
        return true
      })
    
    if (transformedBatch.length === 0) {
      console.log(`Batch ${i / batchSize + 1}: All wines already exist or are duplicates, skipping...`)
      continue
    }
    
    const { data, error } = await supabase
      .from('wines')
      .insert(transformedBatch)
    
    if (error) {
      console.error(`Error importing batch ${i / batchSize + 1}:`, error.message)
      errors += transformedBatch.length
    } else {
      imported += transformedBatch.length
      transformedBatch.forEach(wine => {
        const key = `${wine.product_id}_${wine.year}`
        existingKeys.add(key)
      })
      console.log(`Imported batch ${i / batchSize + 1}: ${imported} new wines (${alreadyExists} already existed, ${skipped} duplicates in file)`)
    }
  }
  
  console.log('\n✅ Wine import complete!')
  console.log(`Imported: ${imported}`)
  console.log(`Already existed: ${alreadyExists}`)
  console.log(`Skipped: ${skipped} (duplicates in JSON file)`)
  console.log(`Errors: ${errors}`)
}

importWines().catch(console.error)
