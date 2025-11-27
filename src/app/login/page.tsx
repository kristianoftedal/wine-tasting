"use client"
import { createClient } from "@/lib/supabase/client"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { type FormEvent, useState } from "react"
import styles from "./page.module.css"

export default function Login() {
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLoading(true)
    setError("")

    const formData = new FormData(event.currentTarget)
    const email = formData.get("email") as string
    const password = formData.get("password") as string

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    router.push("/")
    router.refresh()
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <form onSubmit={handleSubmit}>
          {error && <div className={styles.error}>{error}</div>}
          <h1 className={styles.title}>Logg inn</h1>

          <div className={styles.field}>
            <label htmlFor="email">E-post</label>
            <input type="email" id="email" name="email" required />
          </div>

          <div className={styles.field}>
            <label htmlFor="password">Passord</label>
            <input type="password" id="password" name="password" required />
          </div>

          <div className={styles.buttonGroup}>
            <button type="submit" className={styles.primaryButton} disabled={loading}>
              {loading ? "Logger inn..." : "Logg inn"}
            </button>
            <Link href="/register" className={styles.secondaryButton}>
              Opprett konto
            </Link>
            <Link href="/" className={styles.secondaryButton}>
              Fortsett uten innlogging
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}
