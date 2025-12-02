import { createClient } from '@supabase/supabase-js'

// Check for required environment variables
const requiredEnvVars = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']
const missingEnvVars = requiredEnvVars.filter((varName) => !process.env[varName])

if (missingEnvVars.length > 0) {
  console.error('Missing required environment variables:')
  missingEnvVars.forEach((varName) => console.error(`- ${varName}`))
  process.exit(1)
}

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

// Semantic similarity calculation (simplified - using keyword matching as proxy)
function calculateSemanticSimilarity(userText, expertText) {
  if (!userText || !expertText) return 0
  
  const userWords = userText.toLowerCase().split(/[\s,]+/).filter(w => w.length > 2)
  const expertWords = expertText.toLowerCase().split(/[\s,]+/).filter(w => w.length > 2)
  
  if (userWords.length === 0 || expertWords.length === 0) return 0
  
  let matches = 0
  for (const userWord of userWords) {
    if (expertWords.some(expertWord => 
      expertWord.includes(userWord) || userWord.includes(expertWord)
    )) {
      matches++
    }
  }
  
  return Math.round((matches / Math.max(userWords.length, expertWords.length)) * 100)
}

// Numeric similarity calculation
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

async function recalculateTastingScores() {
  console.log('Starting tasting score recalculation...\n')

  // Fetch all tastings
  const { data: tastings, error: tastingsError } = await supabase
    .from('tastings')
    .select('*')
    .order('created_at', { ascending: true })

  if (tastingsError) {
    console.error('Error fetching tastings:', tastingsError)
    return
  }

  console.log(`Found ${tastings.length} tastings to process\n`)

  let updated = 0
  let noWine = 0
  let errors = 0

  for (let i = 0; i < tastings.length; i++) {
    const tasting = tastings[i]
    
    if (i % 100 === 0 && i > 0) {
      console.log(`Progress: ${i}/${tastings.length} (${updated} updated, ${noWine} no wine data, ${errors} errors)`)
    }

    try {
      // Fetch the wine data for this tasting
      const { data: wines, error: wineError } = await supabase
        .from('wines')
        .select('*')
        .eq('product_id', tasting.product_id)
        .limit(1)

      const wine = wines?.[0]

      let colorScore = 0
      let smellScore = 0
      let tasteScore = 0
      let fyldeScore = 0
      let friskhetScore = 0
      let snaerpScore = 0
      let sodmeScore = 0
      let percentageScore = 0
      let priceScore = 0

      if (wineError || !wine) {
        noWine++
      } else {
        colorScore = tasting.farge && wine.color
          ? calculateSemanticSimilarity(tasting.farge, wine.color)
          : 0

        smellScore = calculateSemanticSimilarity(
          `${tasting.smell || ''} ${tasting.lukt || ''}`,
          wine.smell || ''
        )

        tasteScore = calculateSemanticSimilarity(
          `${tasting.taste || ''} ${tasting.smak || ''}`,
          wine.taste || ''
        )

        // Get wine characteristics
        const characteristics = wine.content?.characteristics || []
        const vmpFylde = characteristics.find(x => x.name?.toLowerCase() === 'fylde')?.value
        const vmpFriskhet = characteristics.find(x => x.name?.toLowerCase() === 'friskhet')?.value
        const vmpSnaerp = characteristics.find(x => x.name?.toLowerCase() === 'garvestoffer')?.value
        const vmpSodme = characteristics.find(x => x.name?.toLowerCase() === 'sødme')?.value

        percentageScore = tasting.alkohol && wine.content?.traits?.[0]?.readableValue
          ? calculateNumericSimilarity(tasting.alkohol, wine.content.traits[0].readableValue)
          : 0

        priceScore = tasting.pris && wine.price?.value
          ? calculateNumericSimilarity(tasting.pris, wine.price.value)
          : 0

        snaerpScore = tasting.snaerp && vmpSnaerp
          ? calculateNumericSimilarity(tasting.snaerp, vmpSnaerp)
          : 0

        sodmeScore = tasting.sodme && vmpSodme
          ? calculateNumericSimilarity(tasting.sodme, vmpSodme)
          : 0

        fyldeScore = tasting.fylde && vmpFylde
          ? calculateNumericSimilarity(tasting.fylde, vmpFylde)
          : 0

        friskhetScore = tasting.friskhet && vmpFriskhet
          ? calculateNumericSimilarity(tasting.friskhet, vmpFriskhet)
          : 0
      }

      const scores = {
        color: colorScore,
        smell: smellScore,
        taste: tasteScore,
        friskhet: friskhetScore,
        fylde: fyldeScore,
        snaerp: snaerpScore,
        sodme: sodmeScore,
        percentage: percentageScore,
        price: priceScore
      }

      const halfWeightProps = ['price', 'percentage']
      
      const { total, weightSum } = Object.entries(scores).reduce(
        (acc, [key, value]) => {
          if (value === 0) return acc // Skip scores with 0 value
          const weight = halfWeightProps.includes(key) ? 0.2 : 1
          return {
            total: acc.total + value * weight,
            weightSum: acc.weightSum + weight
          }
        },
        { total: 0, weightSum: 0 }
      )

      const overallScore = weightSum > 0 ? Math.round(total / weightSum) : 0

      let transformedKarakter = tasting.karakter
      if (transformedKarakter && transformedKarakter <= 6) {
        transformedKarakter = Math.round(((transformedKarakter - 1) * 9 / 5) + 1)
      }

      const { error: updateError } = await supabase
        .from('tastings')
        .update({
          color_score: colorScore,
          smell_score: smellScore,
          taste_score: tasteScore,
          fylde_score: fyldeScore,
          friskhet_score: friskhetScore,
          sodme_score: sodmeScore,
          snaerp_score: snaerpScore,
          percentage_score: percentageScore,
          price_score: priceScore,
          overall_score: overallScore,
          karakter: transformedKarakter
        })
        .eq('id', tasting.id)

      if (updateError) {
        console.error(`Error updating tasting ${tasting.id}:`, updateError.message)
        errors++
      } else {
        updated++
      }

      // Small delay to avoid rate limiting
      if (i % 10 === 0) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }

    } catch (error) {
      console.error(`Error processing tasting ${tasting.id}:`, error.message)
      errors++
    }
  }

  console.log(`\n✅ Recalculation complete!`)
  console.log(`Updated: ${updated}`)
  console.log(`No wine data: ${noWine}`)
  console.log(`Errors: ${errors}`)
}

recalculateTastingScores()
