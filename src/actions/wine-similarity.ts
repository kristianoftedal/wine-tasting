"use server"

import { createClient } from "@/lib/supabase/server"
import { semanticSimilarity } from "./similarity"
import type { Wine } from "@/lib/types"

interface WineSimilarityScore {
  wine: Wine
  similarityScore: number
  attributeScores: {
    fylde: number
    friskhet: number
    snaerp: number
    sodme: number
    smell: number
    taste: number
  }
}

/**
 * Find wines similar to the user's highly-rated wines (karakter >= 8)
 * Based on numeric attributes (fylde, friskhet, snaerp, sodme) and semantic similarity (smell, taste)
 */
export async function findSimilarWines(userId: string, limit = 10): Promise<Wine[]> {
  const supabase = await createClient()

  const { data: highRatedTastings } = await supabase
    .from("tastings")
    .select("*")
    .eq("user_id", userId)
    .gte("karakter", 8)
    .order("karakter", { ascending: false })

  if (!highRatedTastings || highRatedTastings.length === 0) {
    return []
  }

  const highRatedCodes = highRatedTastings.map((t) => t.product_id)
  const { data: highRatedWines } = await supabase.from("wines").select("*").in("product_id", highRatedCodes)

  if (!highRatedWines || highRatedWines.length === 0) {
    return []
  }

  const { data: allUserTastings } = await supabase.from("tastings").select("product_id").eq("user_id", userId)

  const tastedCodes = new Set(allUserTastings?.map((t) => t.product_id) || [])

  // Get wines from high-rated tastings

  // Calculate average attributes from high-rated tastings
  const avgAttributes = {
    fylde: 0,
    friskhet: 0,
    snaerp: 0,
    sodme: 0,
  }

  let count = 0
  highRatedTastings.forEach((t) => {
    if (t.fylde !== null) avgAttributes.fylde += t.fylde
    if (t.friskhet !== null) avgAttributes.friskhet += t.friskhet
    if (t.snaerp !== null) avgAttributes.snaerp += t.snaerp
    if (t.sodme !== null) avgAttributes.sodme += t.sodme
    count++
  })

  if (count > 0) {
    avgAttributes.fylde /= count
    avgAttributes.friskhet /= count
    avgAttributes.snaerp /= count
    avgAttributes.sodme /= count
  }

  // Get candidate wines - filter by similar styles and characteristics to reduce dataset
  const preferredCategories = [...new Set(highRatedWines.map((w) => w.main_category?.name).filter(Boolean))]

  const { data: candidateWines } = await supabase.from("wines").select("*").limit(100)

  if (!candidateWines || candidateWines.length === 0) {
    return []
  }

  // Combine smell and taste descriptions from high-rated wines
  const highRatedSmells = highRatedWines.map((w) => w.smell || "").filter(Boolean)
  const highRatedTastes = highRatedWines.map((w) => w.taste || "").filter(Boolean)
  const combinedSmell = highRatedSmells.join(" ")
  const combinedTaste = highRatedTastes.join(" ")

  const numericFiltered: Array<{ wine: Wine; numericScore: number }> = []

  for (const wine of candidateWines) {
    if (tastedCodes.has(wine.product_id)) {
      continue
    }

    // Extract wine characteristics
    const wineCharacteristics = wine.content?.characteristics || []

    // Find numeric attribute values (fylde, friskhet, etc.) from characteristics
    const getFylde = () => {
      const trait = wineCharacteristics.find((c) => c.name.toLowerCase().includes("fylde"))
      return trait ? Number.parseFloat(trait.value) || 0 : 0
    }

    const getFriskhet = () => {
      const trait = wineCharacteristics.find((c) => c.name.toLowerCase().includes("friskhet"))
      return trait ? Number.parseFloat(trait.value) || 0 : 0
    }

    const getSnaerp = () => {
      const trait = wineCharacteristics.find((c) => c.name.toLowerCase().includes("garvestoffer"))
      return trait ? Number.parseFloat(trait.value) || 0 : 0
    }

    const getSodme = () => {
      const trait = wineCharacteristics.find((c) => c.name.toLowerCase().includes("sødme"))
      return trait ? Number.parseFloat(trait.value) || 0 : 0
    }

    const wineFylde = getFylde()
    const wineFriskhet = getFriskhet()
    const wineSnaerp = getSnaerp()
    const wineSodme = getSodme()

    // Calculate numeric attribute similarity (inverse of difference, normalized to 0-100)
    const fyldeSimilarity = wineFylde ? 100 - Math.abs(avgAttributes.fylde - wineFylde) * 20 : 50
    const friskhetSimilarity = wineFriskhet ? 100 - Math.abs(avgAttributes.friskhet - wineFriskhet) * 20 : 50
    const snaerpSimilarity = wineSnaerp ? 100 - Math.abs(avgAttributes.snaerp - wineSnaerp) * 20 : 50
    const sodmeSimilarity = wineSodme ? 100 - Math.abs(avgAttributes.sodme - wineSodme) * 20 : 50

    const numericScore = (fyldeSimilarity + friskhetSimilarity + snaerpSimilarity + sodmeSimilarity) / 4

    numericFiltered.push({ wine, numericScore })
  }

  numericFiltered.sort((a, b) => b.numericScore - a.numericScore)
  const topCandidates = numericFiltered.slice(0, limit * 3) // Get 3x limit for semantic filtering

  const scoredWines: WineSimilarityScore[] = []

  for (const { wine, numericScore } of topCandidates) {
    const wineCharacteristics = wine.content?.characteristics || []

    const getFylde = () => {
      const trait = wineCharacteristics.find((c) => c.name.toLowerCase().includes("fylde"))
      return trait ? Number.parseFloat(trait.value) || 0 : 0
    }

    const getFriskhet = () => {
      const trait = wineCharacteristics.find((c) => c.name.toLowerCase().includes("friskhet"))
      return trait ? Number.parseFloat(trait.value) || 0 : 0
    }

    const getSnaerp = () => {
      const trait = wineCharacteristics.find((c) => c.name.toLowerCase().includes("garvestoffer"))
      return trait ? Number.parseFloat(trait.value) || 0 : 0
    }

    const getSodme = () => {
      const trait = wineCharacteristics.find((c) => c.name.toLowerCase().includes("sødme"))
      return trait ? Number.parseFloat(trait.value) || 0 : 0
    }

    const wineFylde = getFylde()
    const wineFriskhet = getFriskhet()
    const wineSnaerp = getSnaerp()
    const wineSodme = getSodme()

    const fyldeSimilarity = wineFylde ? 100 - Math.abs(avgAttributes.fylde - wineFylde) * 20 : 50
    const friskhetSimilarity = wineFriskhet ? 100 - Math.abs(avgAttributes.friskhet - wineFriskhet) * 20 : 50
    const snaerpSimilarity = wineSnaerp ? 100 - Math.abs(avgAttributes.snaerp - wineSnaerp) * 20 : 50
    const sodmeSimilarity = wineSodme ? 100 - Math.abs(avgAttributes.sodme - wineSodme) * 20 : 50

    // Calculate semantic similarity for smell and taste
    let smellSimilarity = 50 // Default neutral score
    let tasteSimilarity = 50 // Default neutral score

    if (combinedSmell && wine.smell) {
      smellSimilarity = await semanticSimilarity(combinedSmell, wine.smell)
    }

    if (combinedTaste && wine.taste) {
      tasteSimilarity = await semanticSimilarity(combinedTaste, wine.taste)
    }

    const overallScore =
      fyldeSimilarity * 0.15 +
      friskhetSimilarity * 0.15 +
      snaerpSimilarity * 0.15 +
      sodmeSimilarity * 0.15 +
      smellSimilarity * 0.2 +
      tasteSimilarity * 0.2

    scoredWines.push({
      wine,
      similarityScore: overallScore,
      attributeScores: {
        fylde: fyldeSimilarity,
        friskhet: friskhetSimilarity,
        snaerp: snaerpSimilarity,
        sodme: sodmeSimilarity,
        smell: smellSimilarity,
        taste: tasteSimilarity,
      },
    })
  }

  // Sort by similarity score and return top wines
  scoredWines.sort((a, b) => b.similarityScore - a.similarityScore)

  return scoredWines.slice(0, limit).map((sw) => sw.wine)
}
