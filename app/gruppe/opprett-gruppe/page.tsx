import { createClient } from "@/lib/supabase/server"
import type { Group, Profile } from "@/lib/types"
import { redirect } from "next/navigation"
import CreateGroupForm from "./OpprettGruppe"
import styles from "./page.module.css"

async function searchUsers(query: string) {
  "use server"

  const supabase = await createClient()
  const { data: users } = await supabase
    .from("profiles")
    .select("*")
    .or(`name.ilike.%${query}%,email.ilike.%${query}%`)
    .limit(5)

  return (users as Profile[])?.map((x) => ({ _id: x.id, name: x.name, email: x.email })) || []
}

async function createGroup(formData: FormData): Promise<Group> {
  "use server"

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  const name = formData.get("name") as string
  const memberIds = formData.getAll("members") as string[]

  // Create the group
  const { data: group, error } = await supabase.from("groups").insert({ name }).select().single<Group>()

  if (error || !group) {
    throw new Error("Failed to create group")
  }

  // Add creator as member
  await supabase.from("group_members").insert({ group_id: group.id, user_id: user.id })

  // Add other members
  if (memberIds.length > 0) {
    const memberInserts = memberIds.map((userId) => ({
      group_id: group.id,
      user_id: userId,
    }))
    await supabase.from("group_members").insert(memberInserts)
  }

  return group
}

export default async function CreateGroupPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Opprett ny gruppe</h1>
      <div className={styles.card}>
        <CreateGroupForm createGroup={createGroup} searchUsers={searchUsers} />
      </div>
    </div>
  )
}
