"use server"

import { createClient } from "@/lib/supabase/server"

export type WineSearchResult = {
  id: string
  product_id: string
  name: string
  year: number | null
  volume: number | null
  main_category: string | null
  main_country: string | null
  price: number | null
  similarity: number
}

export async function searchWines(
  query: string,
  limit = 20
): Promise<WineSearchResult[]> {
  if (!query || query.trim().length < 2) {
    return []
  }

  const supabase = await createClient()
  const searchTerm = query.trim()

  // Use trigram similarity for fuzzy matching
  // This query combines exact matching with fuzzy matching for best results
  const { data, error } = await supabase.rpc("search_wines_fuzzy", {
    search_query: searchTerm,
    result_limit: limit,
  })

  if (error) {
    console.error("[v0] Wine search error:", error)
    // Fallback to basic ILIKE search if RPC fails
    const { data: fallbackData } = await supabase
      .from("wines")
      .select("id, product_id, name, year, volume, main_category, main_country, price")
      .ilike("name", `%${searchTerm}%`)
      .limit(limit)

    return (fallbackData || []).map((w) => ({ ...w, similarity: 0.5 }))
  }

  return data || []
}
