import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing required environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

const BATCH_SIZE = 500

function generateSearchText(wine) {
  const parts = [
    wine.name,
    wine.description || '',
    wine.summary || '',
    wine.color || '',
    wine.smell || '',
    wine.taste || '',
    wine.main_category?.name || '',
    wine.main_country?.name || '',
    wine.main_producer?.name || '',
    wine.district?.name || '',
    wine.sub_district?.name || ''
  ]

  // Add ingredients (grape varieties)
  if (wine.content?.ingredients) {
    for (const ingredient of wine.content.ingredients) {
      parts.push(ingredient.readableValue || '')
    }
  }

  // Add food pairings
  if (wine.content?.isGoodFor) {
    for (const goodFor of wine.content.isGoodFor) {
      parts.push(goodFor.name || '')
    }
  }

  // Add traits
  if (wine.content?.traits) {
    for (const trait of wine.content.traits) {
      parts.push(trait.readableValue || '')
    }
  }

  // Add style description
  if (wine.content?.style?.description) {
    parts.push(wine.content.style.description)
  }

  return parts.filter(Boolean).join(' ').trim()
}

async function generateEmbedding(text, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch('http://localhost:3000/api/embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(`Failed to generate embedding: ${response.statusText} - ${errorData.message || ''}`)
      }

      const { embedding } = await response.json()
      return embedding
    } catch (error) {
      console.error(`Attempt ${attempt}/${maxRetries} failed for embedding:`, error.message)
      if (attempt === maxRetries) throw error
      // Exponential backoff: 2s, 4s, 8s
      const waitTime = Math.pow(2, attempt) * 1000
      console.log(`Waiting ${waitTime/1000}s before retry...`)
      await new Promise(resolve => setTimeout(resolve, waitTime))
    }
  }
  throw new Error('Max retries exceeded')
}

async function processWines() {
  console.log('Fetching wines from database...')
  
  const { data: wines, error, count } = await supabase
    .from('wines')
    .select('id, product_id, name, description, summary, color, smell, taste, main_category, main_country, main_producer, district, sub_district, content, search_text', { count: 'exact' })
    .is('embedding', null)
    .limit(BATCH_SIZE)

  if (error) {
    console.error('Error fetching wines:', error)
    return
  }

  if (!wines || wines.length === 0) {
    console.log('No wines to process!')
    return
  }

  console.log(`Processing ${wines.length} wines (${count} total remaining)...`)

  let processed = 0
  let errors = 0

  for (const wine of wines) {
    try {
      let searchText = wine.search_text
      if (!searchText) {
        searchText = generateSearchText(wine)
        if (!searchText || searchText.length < 5) {
          console.log(`Skipping ${wine.name} (no usable data)`)
          continue
        }
      }

      const embedding = await generateEmbedding(searchText)

      const { error: updateError } = await supabase
        .from('wines')
        .update({ 
          search_text: searchText,
          embedding 
        })
        .eq('id', wine.id)

      if (updateError) {
        console.error(`Error updating wine ${wine.name}:`, updateError)
        errors++
      } else {
        processed++
        if (processed % 50 === 0 || processed === wines.length) {
          console.log(`✓ ${processed}/${wines.length} wines processed`)
        }
      }

      await new Promise(resolve => setTimeout(resolve, 100))
    } catch (error) {
      console.error(`Error processing wine ${wine.name}:`, error.message)
      errors++
      await new Promise(resolve => setTimeout(resolve, 2000))
    }
  }

  console.log(`\nComplete! Processed: ${processed}, Errors: ${errors}`)
  
  const { count: remainingCount } = await supabase
    .from('wines')
    .select('id', { count: 'exact', head: true })
    .is('embedding', null)

  if (remainingCount > 0) {
    console.log(`\n${remainingCount} wines remaining. Run this script again to continue.`)
  } else {
    console.log('\nAll wines have embeddings!')
  }
}

processWines()
