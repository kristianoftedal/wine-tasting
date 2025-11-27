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
	let skipped = 0
	let errors = 0

	for (let i = 0; i < tastings.length; i++) {
		const tasting = tastings[i]

		if (i % 100 === 0 && i > 0) {
			console.log(`Progress: ${i}/${tastings.length} (${updated} updated, ${skipped} skipped, ${errors} errors)`)
		}

		try {
			// Fetch the wine data for this tasting
			const { data: wine, error: wineError } = await supabase
				.from('wines')
				.select('*')
				.eq('product_id', tasting.product_id)
				.single()

			if (wineError || !wine) {
				skipped++
				continue
			}

			const colorScore = tasting.farge && wine.color
				? calculateSemanticSimilarity(tasting.farge, wine.color)
				: 0

			const smellScore = calculateSemanticSimilarity(
				`${(tasting.selected_flavors_lukt || []).map(f => f.flavor?.name || f).join(', ')} ${tasting.lukt || ''}`,
				wine.smell || ''
			)

			const tasteScore = calculateSemanticSimilarity(
				`${(tasting.selected_flavors_smak || []).map(f => f.flavor?.name || f).join(', ')} ${tasting.smak || ''}`,
				wine.taste || ''
			)

			// Get wine characteristics
			const characteristics = wine.content?.characteristics || []
			const vmpFylde = characteristics.find(x => x.name?.toLowerCase() === 'fylde')?.value
			const vmpFriskhet = characteristics.find(x => x.name?.toLowerCase() === 'friskhet')?.value
			const vmpSnaerp = characteristics.find(x => x.name?.toLowerCase() === 'garvestoffer')?.value
			const vmpSodme = characteristics.find(x => x.name?.toLowerCase() === 'sødme')?.value

			const alcoholScore = tasting.alkohol && wine.content?.traits?.[0]?.readableValue
				? calculateNumericSimilarity(tasting.alkohol, wine.content.traits[0].readableValue)
				: 0

			const priceScore = tasting.pris && wine.price?.value
				? calculateNumericSimilarity(tasting.pris, wine.price.value)
				: 0

			const snaerpScore = wine.main_category?.code === 'rødvin' && tasting.snaerp && vmpSnaerp
				? calculateNumericSimilarity(tasting.snaerp, vmpSnaerp)
				: 0

			const sodmeScore = wine.main_category?.code !== 'rødvin' && tasting.sodme && vmpSodme
				? calculateNumericSimilarity(tasting.sodme, vmpSodme)
				: 0

			const fyldeScore = tasting.fylde && vmpFylde
				? calculateNumericSimilarity(tasting.fylde, vmpFylde)
				: 0

			const friskhetScore = tasting.friskhet && vmpFriskhet
				? calculateNumericSimilarity(tasting.friskhet, vmpFriskhet)
				: 0

			// Calculate VMP scores (quality, price, alcohol)
			const vmpQualityScore = Math.round((colorScore + smellScore + tasteScore) / 3)
			const vmpPriceScore = priceScore
			const vmpAlcoholScore = alcoholScore
			const vmpTotalScore = Math.round((vmpQualityScore + vmpPriceScore * 0.2 + vmpAlcoholScore * 0.2) / 1.4)

			// Calculate overall score
			const scores = {
				farge: colorScore,
				lukt: smellScore,
				smak: tasteScore,
				friskhet: friskhetScore,
				fylde: fyldeScore,
				snaerp: snaerpScore,
				sodme: sodmeScore,
				alkohol: alcoholScore,
				pris: priceScore
			}

			const halfWeightProps = ['pris', 'alkohol']

			const { total, weightSum } = Object.entries(scores).reduce(
				(acc, [key, value]) => {
					const weight = halfWeightProps.includes(key) ? 0.2 : 1
					return {
						total: acc.total + value * weight,
						weightSum: acc.weightSum + weight
					}
				},
				{ total: 0, weightSum: 0 }
			)

			const overallScore = Math.round(total / weightSum)

			let transformedKarakter = tasting.karakter
			if (transformedKarakter && transformedKarakter <= 6) {
				transformedKarakter = Math.round((transformedKarakter / 6) * 10)
			}

			const { error: updateError } = await supabase
				.from('tastings')
				.update({
					farge_score: colorScore,
					lukt_score: smellScore,
					smak_score: tasteScore,
					smak_fylde_score: fyldeScore,
					smak_friskhet_score: friskhetScore,
					smak_sott_score: sodmeScore,
					finish_score: snaerpScore,
					balance_score: Math.round((fyldeScore + friskhetScore + (wine.main_category?.code === 'rødvin' ? snaerpScore : sodmeScore)) / 3),
					overall_score: overallScore,
					vmp_quality_score: vmpQualityScore,
					vmp_price_score: vmpPriceScore,
					vmp_alcohol_score: vmpAlcoholScore,
					vmp_total_score: vmpTotalScore,
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
	console.log(`Skipped: ${skipped}`)
	console.log(`Errors: ${errors}`)
}

recalculateTastingScores()
