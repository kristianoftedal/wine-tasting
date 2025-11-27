import { createClient } from "@/lib/supabase/server"
import type { Event, Wine } from "@/lib/types"
import Link from "next/link"
import styles from "./page.module.css"

export default async function Arrangement({ params }: { params: { eventId: string } }) {
  const { eventId } = params
  const supabase = await createClient()

  const { data: event } = await supabase.from("events").select("*").eq("id", eventId).single<Event>()

  if (!event) {
    return (
      <div className={styles.container}>
        <p>Arrangement ikke funnet</p>
      </div>
    )
  }

  const { data: wines } = await supabase
    .from("wines")
    .select("*")
    .in("product_id", event.wines.length > 0 ? event.wines : [""])

  // Sort wines by event order
  const sortedWines = wines?.sort((a, b) => event.wines.indexOf(a.product_id) - event.wines.indexOf(b.product_id)) || []

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>{event.name}</h1>
      <section className={styles.section}>
        <p className={styles.description}>{event.description}</p>
        {sortedWines.map((x: Wine) => (
          <article key={x.product_id} className={styles.wineCard}>
            <h5 className={styles.wineTitle}>
              <Link href={`/smaking/${x.product_id}?eventId=${event.id}`}>{x.name}</Link>
            </h5>
            <p className={styles.wineDescription}>{x.description}</p>
          </article>
        ))}
      </section>
    </div>
  )
}
