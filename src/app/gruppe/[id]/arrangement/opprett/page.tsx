import { createClient } from "@/lib/supabase/server"
import type { Event, Wine } from "@/lib/types"
import { parseISO } from "date-fns"
import { redirect } from "next/navigation"
import CreateEventForm from "./CreateEvent"
import styles from "./page.module.css"

async function searchWines(query: string) {
  "use server"

  const supabase = await createClient()
  const { data: wines } = await supabase
    .from("wines")
    .select("name, product_id")
    .or(`name.ilike.%${query}%,product_id.ilike.%${query}%`)
    .limit(10)

  return (wines as Pick<Wine, "name" | "product_id">[]) || []
}

async function createEvent(formData: FormData): Promise<Event> {
  "use server"

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  const name = formData.get("name") as string
  const description = formData.get("description") as string
  const date = parseISO(formData.get("date") as string)
  const wines = formData.getAll("wines") as string[]
  const groupId = formData.get("groupId") as string

  const { data: event, error } = await supabase
    .from("events")
    .insert({
      name,
      description,
      date: date.toISOString(),
      wines,
      group_id: groupId,
    })
    .select()
    .single<Event>()

  if (error || !event) {
    throw new Error("Failed to create event")
  }

  return event
}

export default async function CreateEventPage({ params }: { params: { id: string } }) {
  const { id } = params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Opprett nytt arrangement</h1>
      <section className={styles.section}>
        <CreateEventForm createEvent={createEvent} searchWines={searchWines} groupId={id} />
      </section>
    </div>
  )
}
