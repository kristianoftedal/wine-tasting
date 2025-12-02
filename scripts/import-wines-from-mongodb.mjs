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
  // Try camelCase first (e.g., 'code')
  if (obj[fieldName] !== undefined) {
    return obj[fieldName]
  }
  // Try PascalCase (e.g., 'Code')
  const pascalCase = fieldName.charAt(0).toUpperCase() + fieldName.slice(1)
  return obj[pascalCase]
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

    // JSONB fields - store as objects
    price: (() => {
      const price = getField(wine, 'price')
      return price ? {
        value: price.value || price.Value,
        formattedValue: price.formattedValue || price.FormattedValue,
        readableValue: price.readableValue || price.ReadableValue
      } : null
    })(),

    volume: (() => {
      const volume = getField(wine, 'volume')
      return volume ? {
        value: volume.value || volume.Value,
        formattedValue: volume.formattedValue || volume.FormattedValue,
        readableValue: volume.readableValue || volume.ReadableValue
      } : null
    })(),

    litre_price: (() => {
      const litrePrice = getField(wine, 'litrePrice')
      return litrePrice ? {
        value: litrePrice.value || litrePrice.Value,
        formattedValue: litrePrice.formattedValue || litrePrice.FormattedValue,
        readableValue: litrePrice.readableValue || litrePrice.ReadableValue
      } : null
    })(),

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

    // Location JSONB objects
    district: getField(wine, 'district') || null,
    main_country: getField(wine, 'mainCountry') || null,
    main_producer: getField(wine, 'mainProducer') || null,
    sub_district: getField(wine, 'sub_District') || getField(wine, 'subDistrict') || null,

    // Category
    main_category: getField(wine, 'mainCategory') || null,

    // Complex content object
    content: getField(wine, 'content') || null
  }
}

async function importWines() {
  console.log('Reading wines from JSON file...')
  const wines = readJsonFile('wines.json')

  console.log(`Found ${wines.length} wines to import`)

  let imported = 0
  let skipped = 0
  let errors = 0

  const batchSize = 100

  for (let i = 0; i < wines.length; i += batchSize) {
    const batch = wines.slice(i, i + batchSize)
    const transformedBatch = batch
      .map(transformWine)
      .filter(wine => wine !== null)

    const skippedInBatch = batch.length - transformedBatch.length
    skipped += skippedInBatch

    if (skippedInBatch > 0) {
      console.log(`⚠️  Skipped ${skippedInBatch} wines without product_id in batch ${i / batchSize + 1}`)
    }

    if (transformedBatch.length === 0) {
      continue
    }

    const { data, error } = await supabase
      .from('wines')
      .upsert(transformedBatch, {
        onConflict: 'product_id',
        ignoreDuplicates: false
      })

    if (error) {
      console.error(`Error importing batch ${i / batchSize + 1}:`, error.message)
      errors += transformedBatch.length
    } else {
      imported += transformedBatch.length
      console.log(`Imported batch ${i / batchSize + 1}: ${imported}/${wines.length - skipped} wines`)
    }
  }

  console.log('\n✅ Wine import complete!')
  console.log(`Imported: ${imported}`)
  console.log(`Skipped: ${skipped} (missing product_id)`)
  console.log(`Errors: ${errors}`)
}

importWines().catch(console.error)
