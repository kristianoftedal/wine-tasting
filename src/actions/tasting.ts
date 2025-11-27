"use server"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import type { TastingFormData } from "@/lib/types"

export const addTasting = async (tastingModel: TastingFormData) => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  const { error } = await supabase.from("tastings").insert({
    user_id: user.id,
    product_id: tastingModel.productId,
    event_id: tastingModel.eventId || null,
    farge: tastingModel.farge,
    lukt: tastingModel.lukt,
    smak: tastingModel.smak,
    friskhet: tastingModel.friskhet,
    fylde: tastingModel.fylde,
    sodme: tastingModel.sodme,
    snaerp: tastingModel.snaerp,
    karakter: tastingModel.karakter,
    egenskaper: tastingModel.egenskaper,
    selected_flavors_lukt: tastingModel.selectedFlavorsLukt,
    selected_flavors_smak: tastingModel.selectedFlavorsSmak,
    lukt_intensitet: tastingModel.luktIntensitet,
    smaks_intensitet: tastingModel.smaksIntensitet,
    alkohol: tastingModel.alkohol,
    pris: tastingModel.pris,
    tasted_at: tastingModel.tastedAt || new Date().toISOString(),
    farge_score: tastingModel.scoreFarge,
    lukt_score: tastingModel.scoreLukt,
    smak_friskhet_score: tastingModel.scoreSmakFriskhet,
    smak_sott_score: tastingModel.scoreSmakSott,
    smak_fylde_score: tastingModel.scoreSmakFylde,
    smak_score: tastingModel.scoreSmak,
    finish_score: tastingModel.scoreFinish,
    balance_score: tastingModel.scoreBalance,
    overall_score: tastingModel.scoreOverall,
    vmp_quality_score: tastingModel.scoreVmpQuality,
    vmp_price_score: tastingModel.scoreVmpPrice,
    vmp_alcohol_score: tastingModel.scoreVmpAlcohol,
    vmp_total_score: tastingModel.scoreVmpTotal,
  })

  if (error) {
    console.error("Error adding tasting:", error)
    throw new Error("Failed to add tasting")
  }
}
