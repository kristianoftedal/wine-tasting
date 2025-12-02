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

  const getCountry = () => {
    if (wine.main_country?.name) {
      return wine.main_country.name
    }
    // Try to extract country from district search query (e.g., "frankrike_champagne" -> "Frankrike")
    if (wine.district?.code) {
      const countryCode = wine.district.code.split("_")[0]
      return countryCode.charAt(0).toUpperCase() + countryCode.slice(1)
    }
    return null
  }

  const hasGrapes = wine.content?.ingredients && wine.content.ingredients.length > 0

  return (
    <div className={styles.colorContainer}>
      <div className={styles.wineInfoCard}>
        <div className={styles.wineInfoRow}>
          <span className={styles.wineInfoLabel}>Druer:</span>
          {hasGrapes ? (
            <div className={styles.grapeList}>
              {wine.content.ingredients.map((x) => (
                <div key={x.code} className={styles.grapeItem}>
                  • {x.formattedValue}
                </div>
              ))}
            </div>
          ) : (
            <span className={styles.wineInfoValue}>Ikke oppgitt</span>
          )}
        </div>
        <div className={styles.wineInfoRow}>
          <span className={styles.wineInfoLabel}>Land:</span>
          <span className={styles.wineInfoValue}>{getCountry() || "Ikke oppgitt"}</span>
        </div>
        <div className={styles.wineInfoRow}>
          <span className={styles.wineInfoLabel}>Område:</span>
          <span className={styles.wineInfoValue}>
            {wine.district?.name || wine.sub_district?.name || "Ikke oppgitt"}
          </span>
        </div>
        <div className={styles.wineInfoRow}>
          <span className={styles.wineInfoLabel}>Årgang:</span>
          <span className={styles.wineInfoValue}>{wine.year || "Ikke oppgitt"}</span>
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
