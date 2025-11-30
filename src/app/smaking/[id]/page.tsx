import { TastingWizard } from "@/app/components/tasting/TastingWizard"
import { createClient } from "@/lib/supabase/server"
import type { Wine } from "@/lib/types"

export default async function Tasting({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: wine } = await supabase.from("wines").select("*").eq("code", id).single<Wine>()

  return <TastingWizard wine={wine} />
}
