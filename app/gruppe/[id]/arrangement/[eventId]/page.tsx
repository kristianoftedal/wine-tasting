"use client"

import { createClient } from "@/lib/supabase/client"
import type { Event, Wine } from "@/lib/types"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { decode } from "he"
import styles from "./page.module.css"
import EventEditForm from "./EventEditForm"

export default function EditArrangement({ params }: { params: Promise<{ id: string; eventId: string }> }) {
  const router = useRouter()
  const [event, setEvent] = useState<Event | null>(null)
  const [wines, setWines] = useState<Wine[]>([])
  const [allWines, setAllWines] = useState<Wine[]>([])
  const [isEditing, setIsEditing] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [groupId, setGroupId] = useState("")
  const [eventId, setEventId] = useState("")

  useEffect(() => {
    async function loadData() {
      const { id, eventId } = await params
      setGroupId(id)
      setEventId(eventId)

      const supabase = createClient()

      const { data: eventData, error: eventError } = await supabase
        .from("events")
        .select("*")
        .eq("id", eventId)
        .single<Event>()

      if (eventError || !eventData) {
        console.error("Failed to load event:", eventError)
        return
      }

      setEvent(eventData)

      if (eventData.wines?.length > 0) {
        const { data: winesData } = await supabase.from("wines").select("*").in("id", eventData.wines)

        if (winesData) {
          const sorted = winesData.sort((a, b) => eventData.wines.indexOf(a.id) - eventData.wines.indexOf(b.id))
          setWines(sorted)
          setAllWines(winesData)
        }
      } else {
        setWines([])
        setAllWines([])
      }
    }

    loadData()
  }, [params])

  const handleSave = async (data: { name: string; description: string; date: string; wines: string[] }) => {
    const supabase = createClient()

    const { error } = await supabase
      .from("events")
      .update({
        name: data.name,
        description: data.description,
        date: data.date ? new Date(data.date).toISOString() : null,
        wines: data.wines,
      })
      .eq("id", eventId)

    if (error) {
      console.error("Failed to update event:", error)
      alert("Kunne ikke oppdatere arrangement")
      throw error
    }

    const { data: updatedEvent } = await supabase.from("events").select("*").eq("id", eventId).single<Event>()

    if (updatedEvent) {
      setEvent(updatedEvent)

      if (updatedEvent.wines?.length > 0) {
        const { data: winesData } = await supabase.from("wines").select("*").in("id", updatedEvent.wines)

        if (winesData) {
          const sorted = winesData.sort((a, b) => updatedEvent.wines.indexOf(a.id) - updatedEvent.wines.indexOf(b.id))
          setWines(sorted)
          setAllWines(winesData)
        }
      } else {
        setWines([])
        setAllWines([])
      }
    }

    setIsEditing(false)
  }

  const handleDelete = async () => {
    if (!confirm("Er du sikker på at du vil slette dette arrangementet?")) return

    setIsDeleting(true)
    const supabase = createClient()

    console.log("[v0] Attempting to delete event:", eventId)

    const { data: existingEvent, error: fetchError } = await supabase
      .from("events")
      .select("id, group_id")
      .eq("id", eventId)
      .single()

    if (fetchError) {
      console.error("[v0] Error fetching event before delete:", fetchError)
      alert("Kunne ikke finne arrangement: " + fetchError.message)
      setIsDeleting(false)
      return
    }

    if (!existingEvent) {
      alert("Arrangementet finnes ikke")
      setIsDeleting(false)
      return
    }

    console.log("[v0] Event exists, proceeding with deletion")

    const { error, data } = await supabase.from("events").delete().eq("id", eventId).select()

    if (error) {
      console.error("[v0] Failed to delete event:", error)
      alert(`Kunne ikke slette arrangement: ${error.message}\nDetaljer: ${JSON.stringify(error)}`)
      setIsDeleting(false)
    } else {
      console.log("[v0] Event deleted successfully:", data)
      window.location.href = `/gruppe/${groupId}`
    }
  }

  if (!event) {
    return (
      <div className={styles.container}>
        <p>Laster arrangement...</p>
      </div>
    )
  }

  if (isEditing) {
    return (
      <div className={styles.container}>
        <Link href={`/gruppe/${groupId}`} className={styles.backLink}>
          ← Tilbake til gruppe
        </Link>
        <EventEditForm
          eventId={eventId}
          initialName={event.name}
          initialDescription={event.description || ""}
          initialDate={event.date ? new Date(event.date).toISOString().split("T")[0] : ""}
          initialWines={event.wines || []}
          allWines={allWines}
          onSave={handleSave}
          onCancel={() => setIsEditing(false)}
        />
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <Link href={`/gruppe/${groupId}`} className={styles.backLink}>
        ← Tilbake til gruppe
      </Link>

      <div className={styles.header}>
        <h1 className={styles.title}>{decode(event.name)}</h1>

        <div className={styles.headerActions}>
          <button onClick={() => setIsEditing(true)} className={styles.editButton}>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
              <path d="m15 5 4 4" />
            </svg>
            Rediger
          </button>
          <button onClick={handleDelete} className={styles.deleteButton} disabled={isDeleting}>
            {isDeleting ? "Sletter..." : "Slett"}
          </button>
        </div>
      </div>

      <section className={styles.section}>
        {event.date && (
          <p className={styles.date}>
            {new Date(event.date).toLocaleDateString("nb-NO", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        )}

        {event.description && <p className={styles.description}>{event.description}</p>}
      </section>

      <section className={styles.winesSection}>
        <h2 className={styles.sectionTitle}>Viner</h2>

        <div className={styles.wineList}>
          {wines.length === 0 ? (
            <p className={styles.emptyWines}>Ingen viner i dette arrangementet</p>
          ) : (
            wines.map((wine, index) => (
              <article key={wine.id} className={styles.wineCard}>
                <span className={styles.wineNumber}>{index + 1}</span>
                <div className={styles.wineInfo}>
                  <h5 className={styles.wineTitle}>
                    <Link href={`/smaking/${wine.id}?eventId=${event.id}`}>{decode(wine.name)}</Link>
                  </h5>
                  {wine.description && <p className={styles.wineDescription}>{wine.description}</p>}
                </div>
              </article>
            ))
          )}
        </div>
      </section>
    </div>
  )
}
