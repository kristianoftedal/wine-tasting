import { createClient } from "@/lib/supabase/server"
import Link from "next/link"
import styles from "./UpcomingEvents.module.css"

export async function UpcomingEvents() {
  const supabase = await createClient()

  if (!supabase) {
    return null
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return null
  }

  // Get groups the user is a member of
  const { data: memberships } = await supabase.from("group_members").select("group_id").eq("user_id", user.id)

  const groupIds = memberships?.map((m) => m.group_id) || []

  if (groupIds.length === 0) {
    return (
      <section className={styles.upcomingEvents}>
        <h2 className={styles.title}>Kommende arrangementer</h2>
        <p>Du er ikke medlem av noen grupper ennå.</p>
      </section>
    )
  }

  // Get upcoming events for those groups with group name
  const today = new Date().toISOString().split("T")[0]
  const { data: events } = await supabase
    .from("events")
    .select("*, groups(name)")
    .in("group_id", groupIds)
    .gte("date", today)
    .order("date", { ascending: true })

  const formatDate = (date: string) => {
    return new Intl.DateTimeFormat("nb-NO", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(new Date(date))
  }

  return (
    <section className={styles.upcomingEvents}>
      <h2 className={styles.title}>Kommende arrangementer</h2>

      <div className={styles.list}>
        {events && events.length > 0 ? (
          events.map((event) => (
            <Link key={event.id} href={`/arrangement/${event.id}`} className={styles.eventCard}>
              <div className={styles.eventCard}>
                <div className={styles.header}>
                  <h3 className={styles.eventTitle}>{event.name}</h3>
                  <span className={styles.badge}>{event.wines?.length || 0} viner</span>
                </div>

                {event.groups?.name && (
                  <p className={styles.groupName}>{event.groups.name}</p>
                )}

                <p className={styles.description}>{event.description}</p>

                <div className={styles.footer}>
                  <div className={styles.info}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                      <line x1="16" y1="2" x2="16" y2="6" />
                      <line x1="8" y1="2" x2="8" y2="6" />
                      <line x1="3" y1="10" x2="21" y2="10" />
                    </svg>
                    {formatDate(event.date)}
                  </div>
                  <div className={styles.info}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                    </svg>
                  </div>
                </div>
              </div>
            </Link>
          ))
        ) : (
          <p>Ingen kommende arrangementer.</p>
        )}
      </div>
    </section>
  )
}
