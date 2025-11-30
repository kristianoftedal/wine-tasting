"use client"

import { addTasting } from "@/actions/tasting"
import { tastingAtom, wineAtom } from "@/app/store/tasting"
import he from "he"
import { useAtomValue, useSetAtom } from "jotai"
import { useRouter, useSearchParams } from "next/navigation"
import type React from "react"
import { useState } from "react"
import toast, { Toaster } from "react-hot-toast"
import { Progress } from "../Progress"
import { Color } from "./Color"
import { FlavorSelection } from "./FlavorSelection"
import { Summary } from "./Summary"
import { TastingAttributes } from "./TastingAttributes"
import styles from "./TastingWizard.module.css"
import type { Wine } from "@/lib/types"
import { createClient } from "@/lib/supabase/client"
import { useEffect } from "react"

export type TastingProps = {
  wine: Wine
}

export type WizardStep = {
  title: string
}

export const TastingWizard: React.FC<TastingProps> = ({ wine }) => {
  const searchParams = useSearchParams()
  const eventId = searchParams.get("eventId")

  const setWine = useSetAtom(wineAtom)
  setWine(wine)

  const tasting = useAtomValue(tastingAtom)
  const router = useRouter()
  const [isSaving, setIsSaving] = useState<boolean>(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const checkUser = async () => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      setUserId(user?.id || null)
      setIsLoading(false)
    }
    checkUser()
  }, [])

  const [index, setIndex] = useState<number>(0)
  const steps = ["Se", "Aroma", "Smak", "Egenskaper", "Oppsummering"]

  const onSave = async () => {
    setIsSaving(true)
    if (!userId) return
    const productId = wine.product_id
    const tastedAt = new Date()
    await addTasting({ ...tasting, userId, productId, tastedAt, eventId: eventId || undefined })
    toast("Smaksnotat lagret 🥂")
    setIsSaving(false)
  }

  const handleNextStep = () => {
    setIndex(index + 1 <= steps.length ? index + 1 : index)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  const handlePreviousStep = () => {
    setIndex(index > 0 ? index - 1 : 0)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  return (
    <div className={styles.wizardContainer}>
      {isLoading && <Progress />}
      {!isLoading && (
        <>
          <header className={styles.header}>
            <button className={styles.backButton} onClick={() => router.push("/")}>
              ←
            </button>
            <h1 className={styles.wineTitle}>{he.decode(wine.name)}</h1>
          </header>

          <div className={styles.content}>
            <h2 className={styles.stepTitle}>{steps[index]}</h2>

            {index === 0 && <Color />}
            {index === 1 && <FlavorSelection type="lukt" vintype={wine.main_category?.code || "rødvin"} />}
            {index === 2 && <FlavorSelection type="smak" vintype={wine.main_category?.code || "rødvin"} />}
            {index === 3 && <TastingAttributes />}
            {index === 4 && <Summary />}

            {index === 4 && userId && (
              <div className={styles.saveSection}>
                <p>Lagre smaksnotat</p>
                <button className={styles.saveButton} disabled={isSaving} onClick={async () => await onSave()}>
                  Lagre
                </button>
                <Toaster />
              </div>
            )}
          </div>

          <footer className={styles.footer}>
            {index > 0 && (
              <button className={styles.previousButton} onClick={handlePreviousStep}>
                Forrige
              </button>
            )}
            {index === 0 && <div />}
            {index < steps.length && index + 1 !== steps.length && (
              <button className={styles.nextButton} onClick={handleNextStep}>
                Neste
              </button>
            )}
            {index + 1 === steps.length && (
              <button
                className={styles.nextButton}
                onClick={() => router.push(eventId ? `/arrangement/${eventId}` : "/")}
              >
                Ferdig
              </button>
            )}
          </footer>
        </>
      )}
    </div>
  )
}
