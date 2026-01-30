"use client"
import type { WineSearchResult } from "@/actions/wine-search"
import { WineSearch } from "@/app/components/WineSearch"
import type { Wine } from "@/types/wine"
import { createClient } from "@/lib/supabase/client"
import { decode } from "he"
import { useState, useEffect } from "react"
import styles from "./page.module.css"

type WineWithMeta = WineSearchResult & { product_id: string; year: number | null; volume: number | null }

interface EventEditFormProps {
  eventId: string
  initialName: string
  initialDescription: string
  initialDate: string
  initialWines: string[]
  onSave: (data: { name: string; description: string; date: string; wines: string[] }) => Promise<void>
  onCancel: () => void
  allWines: Wine[] // Include allWines in props
}

export default function EventEditForm({
  initialName,
  initialDescription,
  initialDate,
  initialWines,
  onSave,
  onCancel,
  allWines,
}: EventEditFormProps) {
  const [name, setName] = useState(initialName)
  const [description, setDescription] = useState(initialDescription)
  const [date, setDate] = useState(initialDate)
  const [selectedWines, setSelectedWines] = useState<string[]>(initialWines)
  const [selectedWineData, setSelectedWineData] = useState<Map<string, WineWithMeta>>(new Map())
  const [isSaving, setIsSaving] = useState(false)

  // Load wine data for selected wines on mount
  useEffect(() => {
    const loadWineData = async () => {
      if (initialWines.length === 0) return
      
      const supabase = createClient()
      const { data } = await supabase
        .from("wines")
        .select("id, product_id, name, year, volume")
        .in("id", initialWines)
      
      if (data) {
        const dataMap = new Map<string, WineWithMeta>()
        data.forEach(w => dataMap.set(w.id, w as WineWithMeta))
        setSelectedWineData(dataMap)
      }
    }
    loadWineData()
  }, [initialWines])

  const handleSubmit = async () => {
    setIsSaving(true)
    try {
      await onSave({ name, description, date, wines: selectedWines })
    } finally {
      setIsSaving(false)
    }
  }

  const addWine = (wine: WineSearchResult) => {
    if (!selectedWines.includes(wine.id)) {
      setSelectedWines([...selectedWines, wine.id])
      setSelectedWineData(prev => new Map(prev).set(wine.id, wine as WineWithMeta))
    }
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

  // Get wine data from the map or allWines
  const getWineData = (wineId: string) => {
    const fromMap = selectedWineData.get(wineId)
    if (fromMap) return fromMap
    const fromAll = allWines.find(w => w.id === wineId)
    if (fromAll) return { id: fromAll.id, name: fromAll.name, product_id: fromAll.product_id, year: fromAll.year, volume: fromAll.volume }
    return null
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

        <WineSearch onSelect={addWine} placeholder="Søk etter vin å legge til..." />

        <div className={styles.selectedWines}>
          {selectedWines.map((wineId, index) => {
            const wineData = getWineData(wineId)
            return (
            <div key={wineId} className={styles.selectedWineItem}>
              <span className={styles.wineNumber}>{index + 1}</span>
              <div className={styles.wineInfo}>
                <span className={styles.selectedWineName}>{wineData ? decode(wineData.name) : wineId}</span>
                {wineData && (
                  <span className={styles.wineMeta}>
                    #{wineData.product_id} {wineData.year && `| ${wineData.year}`} {wineData.volume && `| ${wineData.volume >= 1 ? `${wineData.volume}L` : `${(wineData.volume ?? 0) * 100}cl`}`}
                  </span>
                )}
              </div>
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
          )})}
          
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
