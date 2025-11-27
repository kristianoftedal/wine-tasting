import { createClient } from "@/lib/supabase/server"
import type { Event, Group, Profile } from "@/lib/types"
import { format } from "date-fns"
import Link from "next/link"
import { redirect } from "next/navigation"
import Member from "./Member"
import styles from "./page.module.css"

export default async function GroupPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Get the group
  const { data: group } = await supabase.from("groups").select("*").eq("id", id).single<Group>()

  if (!group) {
    return (
      <div className={styles.container}>
        <div className={styles.emptyState}>
          <h4 className={styles.emptyStateTitle}>Fant ingen gruppe</h4>
        </div>
      </div>
    )
  }

  // Get group members
  const { data: memberIds } = await supabase.from("group_members").select("user_id").eq("group_id", id)

  const userIds = memberIds?.map((m) => m.user_id) || []

  // Get member profiles
  const { data: users } = await supabase
    .from("profiles")
    .select("*")
    .in("id", userIds.length > 0 ? userIds : ["00000000-0000-0000-0000-000000000000"])

  // Check if current user is a member
  const isMember = user ? userIds.includes(user.id) : false

  // Get events for this group
  const { data: events } = await supabase.from("events").select("*").eq("group_id", id)

  const addUser = async () => {
    "use server"
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      redirect("/login")
    }

    await supabase.from("group_members").insert({ group_id: id, user_id: user.id })
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>{group.name}</h1>
      </header>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Medlemmer</h2>
        <div className={styles.membersList}>
          {(users as Profile[])?.map((x) => (
            <article key={x.id} className={styles.memberCard}>
              <p className={styles.memberName}>{x.name}</p>
            </article>
          ))}
        </div>
        <Member addUser={addUser} userIsMember={isMember} groupId={group.id} />
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Arrangement</h2>
          <Link href={`/gruppe/${id}/arrangement/opprett`} className={styles.addButton}>
            Legg til
          </Link>
        </div>
        <div className={styles.eventsList}>
          {(events as Event[])?.map((x) => (
            <article key={x.id} className={styles.eventCard}>
              <h3 className={styles.eventTitle}>
                <Link href={`/gruppe/${id}/arrangement/${x.id}`} className={styles.eventLink}>
                  {x.name} {format(new Date(x.date), "Pp")}
                </Link>
              </h3>
              <p className={styles.eventDescription}>{x.description}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}
