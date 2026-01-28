import { TastingWizard } from "@/app/components/tasting/TastingWizard"
import { createClient } from "@/lib/supabase/server"
import type { Wine } from "@/lib/types"

export default async function Tasting({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ eventId?: string }>
}) {
  const { id } = await params
  const { eventId } = await searchParams
  const supabase = await createClient()

  const { data: wine } = await supabase.from("wines").select("*").eq("id", id).single<Wine>()

  return <TastingWizard wine={wine} eventId={eventId} />
}
