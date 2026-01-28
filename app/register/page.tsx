"use client"
import { createClient } from "@/lib/supabase/client"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useRef, useState } from "react"
import styles from "./page.module.css"

export default function Register() {
  const [error, setError] = useState<string>()
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const ref = useRef<HTMLFormElement>(null)
  const supabase = createClient()

  const handleSubmit = async (formData: FormData) => {
    setLoading(true)
    setError(undefined)

    const email = formData.get("email") as string
    const password = formData.get("password") as string
    const name = formData.get("name") as string

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL || window.location.origin,
        data: {
          name,
        },
      },
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    ref.current?.reset()
    router.push("/login?message=Check your email to confirm your account")
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <form ref={ref} action={handleSubmit}>
          {error && <div className={styles.error}>{error}</div>}
          <h1 className={styles.title}>Registrer deg</h1>

          <div className={styles.field}>
            <label htmlFor="name">Navn</label>
            <input type="text" id="name" name="name" required />
          </div>

          <div className={styles.field}>
            <label htmlFor="email">E-post</label>
            <input type="email" id="email" name="email" required />
          </div>

          <div className={styles.field}>
            <label htmlFor="password">Passord</label>
            <input type="password" id="password" name="password" required minLength={6} />
          </div>

          <div className={styles.buttonGroup}>
            <button type="submit" className={styles.primaryButton} disabled={loading}>
              {loading ? "Registrerer..." : "Registrer"}
            </button>
          </div>

          <div style={{ marginTop: "1rem" }}>
            <Link href="/login" className={styles.link}>
              Har du allerede en konto?
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}
