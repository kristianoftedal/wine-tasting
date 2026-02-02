"use client"

import { tastingAtom, wineAtom } from "@/app/store/tasting"
import { serverSideSimilarity } from "@/actions/similarity"
import { useAtomValue, useSetAtom } from "jotai"
import type React from "react"
import { useEffect, useState } from "react"
import type { Wine } from "@/lib/types"
import styles from "./Summary.module.css"

function calculateNumericSimilarity(
  userValue: string | number | undefined,
  actualValue: string | number | undefined,
): number {
  const normalizeNumber = (val: string | number | undefined): number => {
    if (val === undefined || val === null || val === "" || val === "-") return Number.NaN
    const str = String(val)
    const cleaned = str.replace(/[^\d.,]/g, "").replace("prosent", "")
    return Number.parseFloat(cleaned.replace(",", "."))
  }

  const userNum = normalizeNumber(userValue)
  const actualNum = normalizeNumber(actualValue)

  // If either value is invalid, return 0
  if (isNaN(userNum) || isNaN(actualNum)) {
    return 0
  }

  // If both values are the same, return 100%
  if (userNum === actualNum) {
    return 100
  }

  // Calculate difference as percentage of the larger value
  const maxVal = Math.max(userNum, actualNum)
  const difference = Math.abs(userNum - actualNum)
  const score = Math.max(0, Math.round((1 - difference / maxVal) * 100))

  return score
}



export const Summary: React.FC = () => {
  const tastingState = useAtomValue(tastingAtom)
  const setTastingState = useSetAtom(tastingAtom)
  const wine = useAtomValue<Wine>(wineAtom)

  const [showComparison, setShowComparison] = useState<boolean>(false)
  const [scores, setScores] = useState(initState())
  const [overallScore, setOverallScore] = useState(0)
  const [isCalculating, setIsCalculating] = useState(true)

  const isRedWine = wine?.main_category?.toLowerCase().includes("rød")

  const vmpFylde = wine?.fylde ?? null
  const vmpFriskhet = wine?.friskhet ?? null
  const vmpSnærp = wine?.garvestoff ?? null
  const vmpSødme = wine?.sodme ?? null

  useEffect(() => {
    async function calculateScores() {
      setIsCalculating(true)
      try {
        // Calculate server-side scores (lemma + category + OpenAI embedding)
        const userSmellText = `${tastingState.selectedFlavorsLukt.map((x) => x.flavor.name).join(", ")} ${tastingState.lukt}`
        const userTasteText = `${tastingState.selectedFlavorsSmak.map((x) => x.flavor.name).join(", ")} ${tastingState.smak}`

        const [colorScore, smellScore, tasteScore] = await Promise.all([
          tastingState.farge.length > 0 && wine?.color && wine.color.length > 0
            ? serverSideSimilarity(tastingState.farge, wine.color!)
            : 0,
          wine?.smell ? serverSideSimilarity(userSmellText, wine.smell!) : 0,
          wine?.taste ? serverSideSimilarity(userTasteText, wine.taste!) : 0,
        ])

        // Get alcohol value from wine.alcohol field
        const wineAlcohol = wine?.alcohol || "0"
        const prosentScore = calculateNumericSimilarity(tastingState.alkohol, wineAlcohol)

        const priceScore = calculateNumericSimilarity(tastingState.pris?.toString(), wine?.price)

        const snærpScore = vmpSnærp ? calculateNumericSimilarity(tastingState.snaerp, vmpSnærp) : 0
        const sødmeScore = vmpSødme ? calculateNumericSimilarity(tastingState.sodme, vmpSødme) : 0
        const fyldeScore = vmpFylde ? calculateNumericSimilarity(tastingState.fylde, vmpFylde) : 0
        const friskhetScore = vmpFriskhet ? calculateNumericSimilarity(tastingState.friskhet, vmpFriskhet) : 0

        const newScores = {
          farge: colorScore,
          lukt: smellScore,
          smak: tasteScore,
          friskhet: friskhetScore,
          fylde: fyldeScore,
          snaerp: snærpScore,
          sodme: sødmeScore,
          alkoholProsent: prosentScore,
          pris: priceScore,
        }

        setScores(newScores)

        const halfWeightProps = ["pris", "alkoholProsent"]
        const scoreEntries = Object.entries(newScores).filter(([key, value]) => {
          // Skip characteristics that don't have expert data
          if (key === "friskhet" && vmpFriskhet === null) return false
          if (key === "fylde" && vmpFylde === null) return false
          if (key === "snaerp" && vmpSnærp === null) return false
          if (key === "sodme" && vmpSødme === null) return false
          return true
        })

        const { total, weightSum } = scoreEntries.reduce(
          (acc, [key, value]) => {
            const weight = halfWeightProps.includes(key) ? 0.2 : 1
            return {
              total: acc.total + value * weight,
              weightSum: acc.weightSum + weight,
            }
          },
          { total: 0, weightSum: 0 },
        )

        const averageScore = weightSum > 0 ? Math.round(total / weightSum) : 0

        setOverallScore(averageScore)

        setTastingState((prev) => ({
          ...prev,
          colorScore: colorScore,
          smellScore: smellScore,
          tasteScore: tasteScore,
          percentageScore: prosentScore,
          priceScore: priceScore,
          snaerpScore: snærpScore,
          sodmeScore: sødmeScore,
          fyldeScore: fyldeScore,
          friskhetScore: friskhetScore,
          overallScore: averageScore,
        }))
      } catch (error) {
        console.log(JSON.stringify(error))
        setScores(initState())
        setOverallScore(0)
      } finally {
        setIsCalculating(false)
      }
    }

    calculateScores()
  }, [
    tastingState.farge,
    tastingState.alkohol,
    tastingState.selectedFlavorsLukt,
    tastingState.lukt,
    tastingState.selectedFlavorsSmak,
    tastingState.smak,
    tastingState.pris,
    tastingState.snaerp,
    tastingState.sodme,
    tastingState.fylde,
    tastingState.friskhet,
    wine,
    vmpSnærp,
    vmpSødme,
    vmpFylde,
    vmpFriskhet,
    setTastingState,
  ])

  const vmpLuktWords = wine?.smell?.toLowerCase().split(/[\s,]+/) || []
  const vmpSmakWords = wine?.taste?.toLowerCase().split(/[\s,]+/) || []

  if (isCalculating)
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner} />
        <p className={styles.loadingText}>Beregner din smaksscore...</p>
      </div>
    )

  return (
    <div className={styles.summaryContainer}>
      {!showComparison && (
        <>
          <div className={styles.scoreHeader}>
            <p className={styles.overallScore}>{overallScore}%</p>
            <p className={styles.scoreLabel}>Din smaksscore</p>
          </div>

          <div className={styles.summaryTable}>
            <div className={styles.summaryRow}>
              <div className={styles.summaryLabel}>Farge</div>
              <div className={styles.summaryValue}>{tastingState.farge}</div>
            </div>

            <div className={styles.summaryRow}>
              <div className={styles.summaryLabel}>Lukt</div>
              <div className={styles.summaryValue}>
                <div className={styles.flavorPills}>
                  {tastingState.selectedFlavorsLukt.map((x, i) => (
                    <span key={i} className={styles.flavorPill}>
                      {x.flavor.name}
                    </span>
                  ))}
                </div>
                {tastingState.lukt && <p className={styles.commentText}>{tastingState.lukt}</p>}
              </div>
            </div>

            <div className={styles.summaryRow}>
              <div className={styles.summaryLabel}>Smak</div>
              <div className={styles.summaryValue}>
                <div className={styles.flavorPills}>
                  {tastingState.selectedFlavorsSmak.map((x, i) => (
                    <span key={i} className={styles.flavorPill}>
                      {x.flavor.name}
                    </span>
                  ))}
                </div>
                {tastingState.smak && <p className={styles.commentText}>{tastingState.smak}</p>}
              </div>
            </div>

            <div className={styles.summaryRow}>
              <div className={styles.summaryLabel}>Friskhet</div>
              <div className={styles.summaryValue}>{tastingState.friskhet}</div>
            </div>

            <div className={styles.summaryRow}>
              <div className={styles.summaryLabel}>Fylde</div>
              <div className={styles.summaryValue}>{tastingState.fylde}</div>
            </div>

            {isRedWine && (
              <div className={styles.summaryRow}>
                <div className={styles.summaryLabel}>Snærp</div>
                <div className={styles.summaryValue}>{tastingState.snaerp || "-"}</div>
              </div>
            )}

            {!isRedWine && (
              <div className={styles.summaryRow}>
                <div className={styles.summaryLabel}>Sødme</div>
                <div className={styles.summaryValue}>{tastingState.sodme || "-"}</div>
              </div>
            )}

            <div className={styles.summaryRow}>
              <div className={styles.summaryLabel}>Alkohol</div>
              <div className={styles.summaryValue}>{tastingState.alkohol}%</div>
            </div>

            <div className={styles.summaryRow}>
              <div className={styles.summaryLabel}>Pris</div>
              <div className={styles.summaryValue}>{tastingState.pris} kr</div>
            </div>

            {tastingState.egenskaper && (
              <div className={styles.summaryRow}>
                <div className={styles.summaryLabel}>Kommentar</div>
                <div className={styles.summaryValue}>{tastingState.egenskaper}</div>
              </div>
            )}

            <div className={styles.summaryRow}>
              <div className={styles.summaryLabel}>Karakter</div>
              <div className={styles.summaryValue}>{tastingState.karakter}</div>
            </div>
          </div>

          <div className={styles.comparisonToggle}>
            <button className={styles.revealButton} onClick={() => setShowComparison(true)}>
              Sammenlign med eksperten
            </button>
          </div>
        </>
      )}
      {showComparison && (
        <>
          <div className={styles.scoreHeader}>
            <p className={styles.overallScore}>{overallScore}%</p>
            <p className={styles.scoreLabel}>Din smaksscore</p>
          </div>

          <div className={styles.comparisonTable}>
            <div className={styles.tableHeader}>
              <div></div>
              <div>Min score</div>
              <div>Eksperten</div>
              <div></div>
            </div>

            <div className={styles.tableRow}>
              <div className={styles.attributeName}>Farge</div>
              <div className={styles.attributeValue}>{tastingState.farge}</div>
              <div className={styles.attributeValue}>{wine!.color}</div>
              <div className={styles.scoreValue}>{scores.farge}%</div>
            </div>

            <div className={styles.tableRow}>
              <div className={styles.attributeName}>Lukt</div>
              <div className={styles.attributeValue}>
                <div className={styles.flavorPills}>
                  {tastingState.selectedFlavorsLukt.map((x, i) => (
                    <span key={i} className={styles.flavorPill}>
                      {x.flavor.name}
                    </span>
                  ))}
                </div>
                {tastingState.lukt}
              </div>
              <div className={styles.attributeValue}>{wine!.smell}</div>
              <div className={styles.scoreValue}>{scores.lukt}%</div>
            </div>

            <div className={styles.tableRow}>
              <div className={styles.attributeName}>Smak</div>
              <div className={styles.attributeValue}>
                <div className={styles.flavorPills}>
                  {tastingState.selectedFlavorsSmak.map((x, i) => (
                    <span key={i} className={styles.flavorPill}>
                      {x.flavor.name}
                    </span>
                  ))}
                </div>
                {tastingState.smak}
              </div>
              <div className={styles.attributeValue}>{wine!.taste}</div>
              <div className={styles.scoreValue}>{scores.smak}%</div>
            </div>

            <div className={styles.tableRow}>
              <div className={styles.attributeName}>Friskhet</div>
              <div className={styles.attributeValue}>{tastingState.friskhet}</div>
              <div className={styles.attributeValue}>
                {vmpFriskhet != null ? vmpFriskhet.toString() : "Ikke tilgjengelig"}
              </div>
              <div className={styles.scoreValue}>{vmpFriskhet != null ? `${scores.friskhet}%` : "-"}</div>
            </div>

            <div className={styles.tableRow}>
              <div className={styles.attributeName}>Fylde</div>
              <div className={styles.attributeValue}>{tastingState.fylde}</div>
              <div className={styles.attributeValue}>
                {vmpFylde != null ? vmpFylde.toString() : "Ikke tilgjengelig"}
              </div>
              <div className={styles.scoreValue}>{vmpFylde != null ? `${scores.fylde}%` : "-"}</div>
            </div>

            {isRedWine && (
              <div className={styles.tableRow}>
                <div className={styles.attributeName}>Snærp</div>
                <div className={styles.attributeValue}>{tastingState.snaerp || "-"}</div>
                <div className={styles.attributeValue}>
                  {vmpSnærp != null ? vmpSnærp.toString() : "Ikke tilgjengelig"}
                </div>
                <div className={styles.scoreValue}>{vmpSnærp != null ? `${scores.snaerp}%` : "-"}</div>
              </div>
            )}

            {!isRedWine && (
              <div className={styles.tableRow}>
                <div className={styles.attributeName}>Sødme</div>
                <div className={styles.attributeValue}>{tastingState.sodme || "-"}</div>
                <div className={styles.attributeValue}>
                  {vmpSødme != null ? vmpSødme.toString() : "Ikke tilgjengelig"}
                </div>
                <div className={styles.scoreValue}>{vmpSødme != null ? `${scores.sodme}%` : "-"}</div>
              </div>
            )}

            <div className={styles.tableRow}>
              <div className={styles.attributeName}>Alkohol</div>
              <div className={styles.attributeValue}>{tastingState.alkohol}%</div>
              <div className={styles.attributeValue}>{wine?.alcohol || "-"}%</div>
              <div className={styles.scoreValue}>{scores.alkoholProsent}%</div>
            </div>

            <div className={styles.tableRow}>
              <div className={styles.attributeName}>Pris</div>
              <div className={styles.attributeValue}>{tastingState.pris} kr</div>
              <div className={styles.attributeValue}>{wine?.price} kr</div>
              <div className={styles.scoreValue}>{scores.pris}%</div>
            </div>

            <div className={styles.tableRow}>
              <div className={styles.attributeName}>Karakter</div>
              <div className={styles.attributeValue}></div>
              <div className={styles.attributeValue}></div>
              <div className={styles.scoreValue}>{tastingState.karakter}</div>
            </div>
          </div>

          <div className={styles.comparisonToggle}>
            <button className={styles.reviewButton} onClick={() => setShowComparison(false)}>
              Gjennomgå notatene mine
            </button>
          </div>
        </>
      )}
    </div>
  )
}

function initState() {
  return {
    farge: 0,
    lukt: 0,
    smak: 0,
    friskhet: 0,
    fylde: 0,
    snaerp: 0,
    sodme: 0,
    alkoholProsent: 0,
    pris: 0,
  }
}
