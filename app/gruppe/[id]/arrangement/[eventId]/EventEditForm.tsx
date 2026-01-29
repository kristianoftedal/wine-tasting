"use client"
import type { Wine } from "@/lib/types"
import { createClient } from "@/lib/supabase/client"
import { decode } from "he"
import { useState, useEffect, useCallback } from "react"
import styles from "./page.module.css"

interface EventEditFormProps {
  eventId: string
  initialName: string
  initialDescription: string
  initialDate: string
  initialWines: string[]
  allWines: Wine[]
  onSave: (data: { name: string; description: string; date: string; wines: string[] }) => Promise<void>
  onCancel: () => void
}

export default function EventEditForm({
  eventId,
  initialName,
  initialDescription,
  initialDate,
  initialWines,
  allWines,
  onSave,
  onCancel,
}: EventEditFormProps) {
  const [name, setName] = useState(initialName)
  const [description, setDescription] = useState(initialDescription)
  const [date, setDate] = useState(initialDate)
  const [selectedWines, setSelectedWines] = useState<string[]>(initialWines)
  const [selectedWineNames, setSelectedWineNames] = useState<Map<string, string>>(new Map())
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<Wine[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // Load wine names for selected wines on mount
  useEffect(() => {
    const loadWineNames = async () => {
      if (initialWines.length === 0) return
      
      const supabase = createClient()
      const { data } = await supabase
        .from("wines")
        .select("id, name")
        .in("id", initialWines)
      
      if (data) {
        const namesMap = new Map<string, string>()
        data.forEach(w => namesMap.set(w.id, w.name))
        setSelectedWineNames(namesMap)
      }
    }
    loadWineNames()
  }, [initialWines])

  // Server-side search for wines
  const searchWines = useCallback(async (query: string) => {
    if (query.length < 2) {
      setSearchResults([])
      return
    }

    setIsSearching(true)
    const supabase = createClient()
    
    const { data, error } = await supabase
      .from("wines")
      .select("id, product_id, name, year")
      .ilike("name", `%${query}%`)
      .limit(20)

    if (error) {
      console.error("[v0] Wine search error:", error)
      setSearchResults([])
    } else {
      // Filter out already selected wines
      const filtered = (data || []).filter(w => !selectedWines.includes(w.id))
      setSearchResults(filtered as Wine[])
    }
    setIsSearching(false)
  }, [selectedWines])

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      searchWines(searchQuery)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery, searchWines])

  const handleSubmit = async () => {
    setIsSaving(true)
    try {
      await onSave({ name, description, date, wines: selectedWines })
    } finally {
      setIsSaving(false)
    }
  }

  const addWine = (wine: Wine) => {
    if (!selectedWines.includes(wine.id)) {
      setSelectedWines([...selectedWines, wine.id])
      setSelectedWineNames(prev => new Map(prev).set(wine.id, wine.name))
    }
    setSearchQuery("")
    setSearchResults([])
  }

  const removeWine = (wineId: string) => {
    setSelectedWines(selectedWines.filter((c) => c !== wineId))
  }

  const moveWine = (index: number, direction: "up" | "down") => {
    const newWines = [...selectedWines]
    const newIndex = direction === "up" ? index - 1 : index + 1
    if (newIndex < 0 || newIndex >= newWines.length) return
    ;[newWines[index], newWines[newIndex]] = [newWines[newIndex], newWines[index]]
    setSelectedWines(newWines)
  }

  // Use server-side search results instead of client-side filtering
  const filteredWines = searchResults

  // Get wine name from either the names map or allWines
  const getWineName = (wineId: string) => {
    const fromMap = selectedWineNames.get(wineId)
    if (fromMap) return decode(fromMap)
    const fromAll = allWines.find(w => w.id === wineId)
    if (fromAll) return decode(fromAll.name)
    return wineId
  }

  return (
    <div className={styles.editForm}>
      <div className={styles.header}>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={styles.titleInput}
          placeholder="Navn på arrangement"
        />
      </div>

      <section className={styles.section}>
        <div className={styles.formGroup}>
          <label className={styles.label}>Dato</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={styles.dateInput} />
        </div>

        <div className={styles.formGroup}>
          <label className={styles.label}>Beskrivelse</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className={styles.descriptionInput}
            rows={4}
            placeholder="Beskrivelse av arrangementet"
          />
        </div>
      </section>

      <section className={styles.winesSection}>
        <h2 className={styles.sectionTitle}>Viner</h2>

        <div className={styles.wineSearch}>
          <div className={styles.searchInputWrapper}>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Søk etter vin å legge til..."
              className={styles.searchInput}
            />
            {isSearching && (
              <div className={styles.searchSpinner}>
                <div className={styles.spinner} />
              </div>
            )}
          </div>
          {filteredWines.length > 0 && (
            <div className={styles.searchResults}>
              {filteredWines.map((wine) => (
                <button key={wine.id} onClick={() => addWine(wine)} className={styles.searchResultItem}>
                  {decode(wine.name)}
                </button>
              ))}
            </div>
          )}
          {searchQuery.length >= 2 && !isSearching && filteredWines.length === 0 && (
            <div className={styles.noResults}>Ingen treff</div>
          )}
        </div>

        <div className={styles.selectedWines}>
          {selectedWines.map((wineId, index) => (
            <div key={wineId} className={styles.selectedWineItem}>
              <span className={styles.wineNumber}>{index + 1}</span>
              <span className={styles.selectedWineName}>{getWineName(wineId)}</span>
              <div className={styles.wineActions}>
                <button onClick={() => moveWine(index, "up")} disabled={index === 0} className={styles.moveButton}>
                  ↑
                </button>
                <button
                  onClick={() => moveWine(index, "down")}
                  disabled={index === selectedWines.length - 1}
                  className={styles.moveButton}
                >
                  ↓
                </button>
                <button onClick={() => removeWine(wineId)} className={styles.removeButton}>
                  ×
                </button>
              </div>
            </div>
          ))}
          {selectedWines.length === 0 && <p className={styles.emptyWines}>Ingen viner valgt</p>}
        </div>
      </section>

      <div className={styles.formActions}>
        <button onClick={onCancel} className={styles.cancelButton} disabled={isSaving}>
          Avbryt
        </button>
        <button onClick={handleSubmit} className={styles.saveButton} disabled={isSaving}>
          {isSaving ? "Lagrer..." : "Lagre"}
        </button>
      </div>
    </div>
  )
}
