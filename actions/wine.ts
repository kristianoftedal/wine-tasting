import { createClient } from "@/lib/supabase/server"
import type { Wine } from "@/lib/types"

export const getWineById = async (wineId: string): Promise<Wine | null> => {
  const supabase = await createClient()

  const { data: wine, error } = await supabase.from("wines").select("*").eq("id", wineId).single<Wine>()

  if (error) {
    console.error("Error fetching wine:", error)
    return null
  }

  return wine
}

// Keep backward compatibility function that looks up by product_id
export const getWineByProductId = async (productId: string): Promise<Wine | null> => {
  const supabase = await createClient()

  const { data: wine, error } = await supabase.from("wines").select("*").eq("product_id", productId).single<Wine>()

  if (error) {
    console.error("Error fetching wine by product_id:", error)
    return null
  }

  return wine
}
