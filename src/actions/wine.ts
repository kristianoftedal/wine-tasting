import { createClient } from "@/lib/supabase/server"
import type { Wine } from "@/lib/types"

export const getWineById = async (id: string): Promise<Wine | null> => {
  const supabase = await createClient()

  const { data: wine, error } = await supabase.from("wines").select("*").eq("product_id", id).single<Wine>()

  if (error) {
    console.error("Error fetching wine:", error)
    return null
  }

  return wine
}
