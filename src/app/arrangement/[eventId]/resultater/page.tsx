import { createClient } from "@/lib/supabase/server"
import type { Event } from "@/lib/types"
import Link from "next/link"
import { EventScoresRealtime } from "./event-scores-realtime"
import styles from "./page.module.css"

export default async function EventScoresPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params
  const supabase = await createClient()

  const { data: event } = await supabase.from("events").select("*").eq("id", eventId).single<Event>()

  if (!event) {
    return (
      <div className={styles.container}>
        <p>Arrangement ikke funnet</p>
      </div>
    )
  }

  // Fetch wines for the event
  const { data: wines } = await supabase
    .from("wines")
    .select("code, name, year")
    .in("code", event.wines.length > 0 ? event.wines : [""])

  // Sort wines by event order
  const sortedWines = wines?.sort((a, b) => event.wines.indexOf(a.code) - event.wines.indexOf(b.code)) || []

  // Fetch initial tastings for the event
  const { data: initialTastings } = await supabase
    .from("tastings")
    .select(
      "id, product_id, user_id, score_overall, score_farge, score_lukt, score_smak, score_friskhet, score_fylde, score_sodme, score_snaerp, score_alkohol, score_pris, karakter",
    )
    .eq("event_id", eventId)

  // Fetch user profiles for the tastings
  const userIds = [...new Set(initialTastings?.map((t) => t.user_id) || [])]
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, name")
    .in("id", userIds.length > 0 ? userIds : [""])

  const profileMap = new Map(profiles?.map((p) => [p.id, p.name]) || [])

  return (
    <div className={styles.container}>
      <Link href={`/arrangement/${eventId}`} className={styles.backButton}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
        Tilbake til arrangement
      </Link>

      <header className={styles.header}>
        <h1 className={styles.title}>Resultater</h1>
        <p className={styles.subtitle}>{event.name}</p>
        <div className={styles.liveIndicator}>
          <span className={styles.liveDot} />
          Live oppdateringer
        </div>
      </header>

      <EventScoresRealtime
        eventId={eventId}
        wines={sortedWines}
        initialTastings={initialTastings || []}
        initialProfileMap={Object.fromEntries(profileMap)}
      />
    </div>
  )
}
