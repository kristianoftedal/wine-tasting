"use client"
import he from "he"
import { useSetAtom } from "jotai"
import { useRouter } from "next/navigation"
import type React from "react"
import { useState, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import type { Wine } from "@/lib/types"
import { initialTastingForm, tastingAtom } from "../store/tasting"
import styles from "./Search.module.css"

const getWineImageUrl = (productId: string) => `/api/wine-image/${productId}?size=100x100`

export const Search: React.FC = () => {
  const [wines, setWines] = useState<Wine[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [searchValue, setSearchValue] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const setTasting = useSetAtom(tastingAtom)
  const supabase = createClient()
  const router = useRouter()

  const searchWines = useCallback(
    async (searchTerm: string) => {
      if (searchTerm.length < 2) {
        setWines([])
        setIsOpen(false)
        setIsLoading(false)
        return
      }

      setIsLoading(true)

      // Search by name first
      const { data: nameResults, error: nameError } = await supabase
        .from("wines")
        .select("id, product_id, name, year")
        .ilike("name", `%${searchTerm}%`)
        .limit(20)

      // Also search by product_id if the search term looks like an ID (numeric)
      let productIdResults: Wine[] = []
      if (/^\d+$/.test(searchTerm)) {
        const { data: idData } = await supabase
          .from("wines")
          .select("id, product_id, name, year")
          .ilike("product_id", `%${searchTerm}%`)
          .limit(10)
        productIdResults = idData || []
      }

      // Combine results, removing duplicates
      const combinedResults = [...(nameResults || []), ...productIdResults]
      const uniqueResults = combinedResults.filter(
        (wine, index, self) => index === self.findIndex((w) => w.id === wine.id)
      )

      const data = uniqueResults.slice(0, 20)
      const error = nameError

      if (error) {
        console.error("Search error:", error)
        setWines([])
        setIsOpen(false)
      } else {
        setWines(data || [])
        setIsOpen((data || []).length > 0)
      }
      setIsLoading(false)
    },
    [supabase],
  )

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const searchTerm = e.target.value
    setSearchValue(searchTerm)

    const timeoutId = setTimeout(() => {
      searchWines(searchTerm.toLowerCase())
    }, 300)

    return () => clearTimeout(timeoutId)
  }

  const handleSelected = (wine: Wine) => {
    setWines([])
    setIsOpen(false)
    setSearchValue("")
    setIsLoading(false)
    setTasting(initialTastingForm)
    router.push(`/smaking/${wine.id}`)
  }

  const handleClear = () => {
    setSearchValue("")
    setWines([])
    setIsOpen(false)
    setIsLoading(false)
  }

  return (
    <div className={styles.search}>
      <div className={styles.inputWrapper}>
        <svg className={styles.icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
        <input
          type="text"
          placeholder="Søk etter vin (navn eller ID)..."
          onChange={handleChange}
          value={searchValue}
          className={styles.input}
        />
        {searchValue && (
          <button onClick={handleClear} aria-label="Clear search" className={styles.clear}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>

      {isLoading && (
        <div className={styles.loading}>
          <div className={styles.spinner} />
          <span>Søker...</span>
        </div>
      )}

      {isOpen && wines.length > 0 && !isLoading && (
        <div className={styles.results}>
          {wines.map((wine) => (
            <button key={wine.id} onClick={() => handleSelected(wine)} className={styles.resultItem}>
              <img
                src={getWineImageUrl(wine.product_id) || "/placeholder.svg"}
                alt=""
                className={styles.resultImage}
                onError={(e) => {
                  ;(e.target as HTMLImageElement).style.display = "none"
                }}
              />
              <div className={styles.resultContent}>
                <div className={styles.resultName}>{he.decode(wine.name)}</div>
                <div className={styles.resultMeta}>
                  {wine.year && <span className={styles.resultYear}>{wine.year}</span>}
                  <span className={styles.resultId}>ID: {wine.product_id}</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
