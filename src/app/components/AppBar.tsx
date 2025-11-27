"use client"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import styles from "./AppBar.module.css"

export default function AppBar() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    if (!supabase) {
      setLoading(false)
      return
    }

    const checkAuth = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      setIsAuthenticated(!!user)
      setLoading(false)
    }

    checkAuth()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(!!session?.user)
    })

    return () => subscription.unsubscribe()
  }, [supabase])

  const handleSignOut = async () => {
    if (!supabase) return
    await supabase.auth.signOut()
    router.push("/")
    router.refresh()
  }

  const loginStatus = () => {
    if (loading) {
      return null
    }

    if (isAuthenticated) {
      return (
        <div className={styles.actions}>
          <button onClick={() => router.push("/profil")} className={`${styles.button} ${styles.buttonOutline}`}>
            Profil
          </button>
          <button className={`${styles.button} ${styles.buttonOutline}`} onClick={handleSignOut}>
            Logg ut
          </button>
        </div>
      )
    } else {
      return (
        <div className={styles.actions}>
          <button onClick={() => router.push("/login")} className={`${styles.button} ${styles.buttonOutline}`}>
            Logg inn
          </button>
          <button onClick={() => router.push("/register")} className={`${styles.button} ${styles.buttonPrimary}`}>
            Registrer deg
          </button>
        </div>
      )
    }
  }

  return (
    <header className={styles.appBar}>
      <div className={styles.container}>
        <div className={styles.logo}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M8 22h8M12 11v11M12 11c3.5 0 6-3 6-7H6c0 4 2.5 7 6 7z" />
            <line x1="9" y1="9" x2="15" y2="9" />
          </svg>
          <span>Smak Vin!</span>
        </div>
        {loginStatus()}
      </div>
    </header>
  )
}
