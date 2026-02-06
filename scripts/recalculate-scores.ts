#!/usr/bin/env npx tsx
/**
 * Score Recalculation Migration Script
 *
 * Recalculates lemmatization/weight analysis for all wines using the currently
 * active weight profile. This script is useful for:
 * - Verifying how wines would be scored with a new profile
 * - Debugging weight distribution across categories
 * - Migration planning when changing profiles
 *
 * Usage:
 *   npm run recalculate-scores           # Dry run (default)
 *   npm run recalculate-scores -- --execute  # Actually execute (future: write to DB)
 *   npm run recalculate-scores -- --verbose  # Show detailed per-wine analysis
 *
 * Environment variables:
 *   SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL - Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY - Service role key for read access
 *   NEXT_PUBLIC_WEIGHT_PROFILE - Profile to use (inverted, moderate, data-driven)
 */

import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import { lemmatizeAndWeight, type TextAnalysis } from '../src/lib/lemmatizeAndWeight'
import { getActiveProfile } from '../src/lib/profiles'

interface Wine {
  id: string
  name: string
  smell: string | null
  taste: string | null
  main_category: string | null
}

interface WineAnalysis {
  wine: Wine
  smellAnalysis: TextAnalysis | null
  tasteAnalysis: TextAnalysis | null
  combinedWeight: number
  categoryBreakdown: Record<string, number>
}

async function main() {
  const isDryRun = !process.argv.includes('--execute')
  const isVerbose = process.argv.includes('--verbose')

  console.log('='.repeat(60))
  console.log('WINE SCORE RECALCULATION SCRIPT')
  console.log('='.repeat(60))

  // Get active profile
  const profile = getActiveProfile()
  console.log(`\nProfile: ${profile.name}`)
  console.log(`Mode: ${isDryRun ? 'DRY RUN (no changes)' : 'EXECUTE'}`)
  console.log(`Verbose: ${isVerbose ? 'YES' : 'NO'}`)

  // Display profile weights
  console.log('\nProfile weights:')
  Object.entries(profile.weights).forEach(([category, weight]) => {
    console.log(`  ${category}: ${weight}`)
  })

  // Initialize Supabase client
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl) {
    console.error('\nError: SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL not set')
    process.exit(1)
  }

  if (!supabaseKey) {
    console.error('\nError: SUPABASE_SERVICE_ROLE_KEY not set')
    process.exit(1)
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  console.log('\nFetching wines from database...')

  // Fetch all wines with smell/taste notes
  const { data: wines, error } = await supabase
    .from('wines')
    .select('id, name, smell, taste, main_category')
    .or('smell.neq.,taste.neq.')
    .order('name')

  if (error) {
    console.error('\nError fetching wines:', error.message)
    process.exit(1)
  }

  if (!wines || wines.length === 0) {
    console.log('\nNo wines found with smell/taste notes.')
    return
  }

  console.log(`Found ${wines.length} wines with notes\n`)

  // Process each wine
  const analyses: WineAnalysis[] = []
  const categoryTotals: Record<string, number> = {}
  let errorsCount = 0

  for (const wine of wines as Wine[]) {
    try {
      let smellAnalysis: TextAnalysis | null = null
      let tasteAnalysis: TextAnalysis | null = null
      let combinedWeight = 0
      const categoryBreakdown: Record<string, number> = {}

      if (wine.smell) {
        smellAnalysis = lemmatizeAndWeight(wine.smell)
        combinedWeight += smellAnalysis.weightSum

        // Track categories
        Object.entries(smellAnalysis.categories).forEach(([cat, count]) => {
          categoryBreakdown[cat] = (categoryBreakdown[cat] || 0) + count
          categoryTotals[cat] = (categoryTotals[cat] || 0) + count
        })
      }

      if (wine.taste) {
        tasteAnalysis = lemmatizeAndWeight(wine.taste)
        combinedWeight += tasteAnalysis.weightSum

        // Track categories
        Object.entries(tasteAnalysis.categories).forEach(([cat, count]) => {
          categoryBreakdown[cat] = (categoryBreakdown[cat] || 0) + count
          categoryTotals[cat] = (categoryTotals[cat] || 0) + count
        })
      }

      analyses.push({
        wine,
        smellAnalysis,
        tasteAnalysis,
        combinedWeight,
        categoryBreakdown
      })

      if (isVerbose) {
        console.log(`\n--- ${wine.name} ---`)
        console.log(`  Main category: ${wine.main_category || 'N/A'}`)
        console.log(`  Combined weight: ${combinedWeight.toFixed(2)}`)

        if (smellAnalysis) {
          console.log(`  Smell (${smellAnalysis.lemmatized.length} terms):`)
          smellAnalysis.lemmatized.slice(0, 5).forEach(item => {
            console.log(`    - ${item.original} -> ${item.lemma} (${item.category}, w=${item.weight.toFixed(1)})`)
          })
          if (smellAnalysis.lemmatized.length > 5) {
            console.log(`    ... and ${smellAnalysis.lemmatized.length - 5} more terms`)
          }
        }

        if (tasteAnalysis) {
          console.log(`  Taste (${tasteAnalysis.lemmatized.length} terms):`)
          tasteAnalysis.lemmatized.slice(0, 5).forEach(item => {
            console.log(`    - ${item.original} -> ${item.lemma} (${item.category}, w=${item.weight.toFixed(1)})`)
          })
          if (tasteAnalysis.lemmatized.length > 5) {
            console.log(`    ... and ${tasteAnalysis.lemmatized.length - 5} more terms`)
          }
        }
      }
    } catch (err) {
      errorsCount++
      console.error(`Error processing wine ${wine.id}: ${err}`)
    }
  }

  // Summary statistics
  console.log('\n' + '='.repeat(60))
  console.log('SUMMARY')
  console.log('='.repeat(60))

  console.log(`\nTotal wines processed: ${analyses.length}`)
  console.log(`Errors encountered: ${errorsCount}`)

  // Weight distribution
  const weights = analyses.map(a => a.combinedWeight).filter(w => w > 0)
  if (weights.length > 0) {
    const avgWeight = weights.reduce((a, b) => a + b, 0) / weights.length
    const minWeight = Math.min(...weights)
    const maxWeight = Math.max(...weights)

    console.log(`\nWeight distribution:`)
    console.log(`  Min: ${minWeight.toFixed(2)}`)
    console.log(`  Max: ${maxWeight.toFixed(2)}`)
    console.log(`  Avg: ${avgWeight.toFixed(2)}`)
  }

  // Category distribution
  console.log(`\nCategory frequency (total term occurrences):`)
  const sortedCategories = Object.entries(categoryTotals)
    .sort((a, b) => b[1] - a[1])

  sortedCategories.forEach(([cat, count]) => {
    const bar = '#'.repeat(Math.min(Math.round(count / 10), 50))
    console.log(`  ${cat.padEnd(15)} ${count.toString().padStart(5)} ${bar}`)
  })

  // Profile used reminder
  console.log(`\nProfile used: ${profile.name}`)
  console.log(`Environment: NEXT_PUBLIC_WEIGHT_PROFILE=${process.env.NEXT_PUBLIC_WEIGHT_PROFILE || '(not set, defaulted to inverted)'}`)

  if (isDryRun) {
    console.log('\n[DRY RUN] No database changes were made.')
    console.log('Use --execute flag to apply changes (currently: read-only).')
  } else {
    console.log('\n[EXECUTE] Mode enabled but no write operations implemented yet.')
    console.log('This script currently only reads data for verification purposes.')
  }

  console.log('\nDone.')
}

main().catch(err => {
  console.error('Script failed:', err)
  process.exit(1)
})
