"use client"

import type { Group } from "@/lib/types"
import { useRouter } from "next/navigation"
import type React from "react"
import { useState } from "react"
import styles from "./OpprettGruppe.module.css"

interface User {
  _id: string
  name: string
  email: string
}

export default function CreateGroupForm({
  createGroup,
  searchUsers,
}: {
  createGroup: (formData: FormData) => Promise<Group>
  searchUsers: (query: string) => Promise<User[]>
}) {
  const [groupName, setGroupName] = useState("")
  const [description, setDescription] = useState("")
  const [members, setMembers] = useState<User[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<User[]>([])
  const router = useRouter()

  const onSearchChanged = async (value: string) => {
    setSearchQuery(value)
    if (value.trim() && value.length > 2) {
      const results = await searchUsers(value)
      setSearchResults(results)
    } else {
      setSearchResults([])
    }
  }

  const addMember = (user: User) => {
    if (!members.some((member) => member._id === user._id)) {
      setMembers([...members, user])
    }
    setSearchQuery("")
    setSearchResults([])
  }

  const removeMember = (userId: string) => {
    setMembers(members.filter((member) => member._id !== userId))
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData()
    formData.append("name", groupName)
    members.forEach((member) => formData.append("members", member._id))
    const group = await createGroup(formData)
    router.push(`/gruppe/${group.id}`)
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <div className={styles.inputGroup}>
        <input
          type="text"
          value={groupName}
          onChange={(e) => setGroupName(e.target.value)}
          required
          placeholder="Gruppenavn"
          className={styles.input}
        />
      </div>
      <div className={styles.inputGroup}>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
          placeholder="Beskrivelse"
          className={styles.input}
        />
      </div>
      <div className={styles.inputGroup}>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChanged(e.target.value)}
          placeholder="Søk etter brukere..."
          className={styles.input}
        />
      </div>
      {searchResults.length > 0 && (
        <div className={styles.section}>
          <p className={styles.sectionTitle}>Treff:</p>
          <ul className={styles.list}>
            {searchResults.map((user) => (
              <li key={user._id} className={styles.listItem}>
                <div className={styles.userInfo}>
                  <span className={styles.userName}>{user.name}</span>
                  <span className={styles.userEmail}>{user.email}</span>
                </div>
                <button
                  type="button"
                  onClick={() => addMember(user)}
                  className={styles.addButton}
                  aria-label="Legg til medlem"
                >
                  +
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {members.length > 0 && (
        <div className={styles.section}>
          <p className={styles.sectionTitle}>Valgte medlemmer:</p>
          <ul className={styles.list}>
            {members.map((member) => (
              <li key={member._id} className={styles.listItem}>
                <div className={styles.userInfo}>
                  <span className={styles.userName}>{member.name}</span>
                  <span className={styles.userEmail}>{member.email}</span>
                </div>
                <button
                  type="button"
                  onClick={() => removeMember(member._id)}
                  className={styles.removeButton}
                  aria-label="Fjern medlem"
                >
                  -
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <button type="submit" className={styles.submitButton}>
        Opprett gruppe
      </button>
    </form>
  )
}
