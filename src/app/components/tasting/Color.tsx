"use client"

import { useAtom, useAtomValue } from "jotai"
import type React from "react"
import type { Wine, TastingFormData } from "@/lib/types"
import { tastingAtom, wineAtom } from "../../store/tasting"
import styles from "./Color.module.css"

export const Color: React.FC = () => {
  const [tasting, setTasting] = useAtom(tastingAtom)
  const wine = useAtomValue<Wine | null>(wineAtom)

  const onChange = (value: string) => {
    setTasting((prev: TastingFormData) => {
      return { ...prev, farge: value }
    })
  }

  if (!wine) {
    return <p>Ingen vin valgt</p>
  }

  return (
    <div className={styles.colorContainer}>
      <div className={styles.wineInfoCard}>
        <div className={styles.wineInfoRow}>
          <span className={styles.wineInfoLabel}>Druer:</span>
          <div className={styles.grapeList}>
            {wine.content?.ingredients?.map((x) => (
              <div key={x.code} className={styles.grapeItem}>
                • {x.formattedValue}
              </div>
            ))}
          </div>
        </div>
        <div className={styles.wineInfoRow}>
          <span className={styles.wineInfoLabel}>Land:</span> {wine.main_country?.name}
        </div>
        {wine.district && (
          <div className={styles.wineInfoRow}>
            <span className={styles.wineInfoLabel}>Område:</span> {wine.district.name}
          </div>
        )}
        <div className={styles.wineInfoRow}>
          <span className={styles.wineInfoLabel}>Årgang:</span> {wine.year}
        </div>
      </div>

      <div className={styles.colorInputField}>
        <label className={styles.colorInputLabel}>Farge</label>
        <input
          type="text"
          className={styles.colorInputBox}
          value={tasting.farge ?? ""}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Beskriv vinens farge..."
        />
      </div>
    </div>
  )
}
