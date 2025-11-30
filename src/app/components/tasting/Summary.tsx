"use client"

import { tastingAtom, wineAtom } from "@/app/store/tasting"
import { useAtomValue } from "jotai"
import type React from "react"
import { useEffect, useState } from "react"
import { semanticSimilarity } from "@/actions/similarity"
import type { Wine } from "@/lib/types"
import styles from "./summary-1.module.css"

function calculateNumericSimilarity(userValue: string, actualValue: string): number {
  const normalizeNumber = (str: string) => {
    const cleaned = str.replace(/[^\d.,]/g, "").replace("prosent", "")
    return Number.parseFloat(cleaned.replace(",", "."))
  }
  const userNum = normalizeNumber(userValue)
  const actualNum = normalizeNumber(actualValue)

  if (isNaN(userNum) || isNaN(actualNum)) return 0

  const difference = Math.abs(userNum - actualNum)
  const average = (userNum + actualNum) / 2
  const percentDifference = (difference / average) * 100

  // Convert to 0-100 score (closer = higher score)
  return Math.max(0, Math.round(100 - percentDifference))
}

export const Summary: React.FC = () => {
  const tastingState = useAtomValue(tastingAtom)
  const wine = useAtomValue<Wine>(wineAtom)

  const [showComparison, setShowComparison] = useState<boolean>(false)
  const [scores, setScores] = useState(initState())
  const [overallScore, setOverallScore] = useState(0)
  const [isCalculating, setIsCalculating] = useState(true)

  const vmpFylde = wine!.content.characteristics.find((x) => x.name.toLocaleLowerCase() === "fylde")?.value
  const vmpFriskhet = wine!.content.characteristics.find((x) => x.name.toLocaleLowerCase() === "friskhet")?.value
  const vmpSnærp = wine!.content.characteristics.find((x) => x.name.toLocaleLowerCase() === "garvestoffer")?.value
  const vmpSødme = wine!.content.characteristics.find((x) => x.name.toLocaleLowerCase() === "sødme")?.value

  useEffect(() => {
    async function calculateScores() {
      setIsCalculating(true)
      try {
        // Calculate color score
        const colorScore =
          tastingState.farge.length > 0 && wine.color && wine.color.length > 0
            ? await semanticSimilarity(tastingState.farge, wine.color!)
            : 0 // Default to 0 if sommelier has no color data

        // Calculate smell score
        const smellScore = await semanticSimilarity(
          `${tastingState.selectedFlavorsLukt.map((x) => x.flavor.name).join(", ")} ${tastingState.lukt}`,
          wine.smell!,
        )

        // Calculate taste score
        const tasteScore = await semanticSimilarity(
          `${tastingState.selectedFlavorsSmak.map((x) => x.flavor.name).join(", ")} ${tastingState.smak}`,
          wine.taste!,
        )

        // Calculate alcohol % score (numeric comparison)
        const prosentScore = calculateNumericSimilarity(
          tastingState.alkohol,
          wine?.content.traits[0].readableValue || "0",
        )

        // Calculate price score (numeric comparison)
        const priceScore = calculateNumericSimilarity(tastingState.pris.toString()!, wine.price.value!.toString())

        const snærpScore =
          wine!.main_category?.code === "rødvin"
            ? calculateNumericSimilarity(tastingState.snærp.toString(), vmpSnærp.toString())
            : 0
        const sødmeScore =
          wine!.main_category?.code !== "rødvin"
            ? calculateNumericSimilarity(tastingState.sødme.toString()!, vmpSødme.toString())
            : 0
        const fyldeScore = calculateNumericSimilarity(tastingState.fylde.toString()!, vmpFylde.toString())
        const friskhetScore = calculateNumericSimilarity(tastingState.friskhet.toString()!, vmpFriskhet.toString())

        const newScores = {
          farge: colorScore,
          lukt: smellScore,
          smak: tasteScore,
          alkoholProsent: prosentScore,
          pris: priceScore,
          snærp: snærpScore,
          sødme: sødmeScore,
          fylde: fyldeScore,
          friskhet: friskhetScore,
        }

        setScores(newScores)
        const halfWeightProps = ["pris", "alkoholProsent"]

        const { total, weightSum } = Object.entries(newScores).reduce(
          (acc, [key, value]) => {
            const weight = halfWeightProps.includes(key) ? 0.2 : 1
            return {
              total: acc.total + value * weight,
              weightSum: acc.weightSum + weight,
            }
          },
          { total: 0, weightSum: 0 },
        )

        const averageScore = Math.round(total / weightSum)

        setOverallScore(averageScore)
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
    tastingState.snærp,
    tastingState.sødme,
    tastingState.fylde,
    tastingState.friskhet,
    wine,
    vmpSnærp,
    vmpSødme,
    vmpFylde,
    vmpFriskhet,
  ]) // Run once on mount

  // const userLuktWords = tastingState.selectedFlavorsLukt.map(x => x.flavor.name.toLowerCase());
  // const userSmakWords = tastingState.selectedFlavorsSmak.map(x => x.flavor.name.toLowerCase());
  const vmpLuktWords = wine.smell?.toLowerCase().split(/[\s,]+/) || []
  const vmpSmakWords = wine.taste?.toLowerCase().split(/[\s,]+/) || []

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

            {wine!.main_category?.code !== "rødvin" && (
              <div className={styles.summaryRow}>
                <div className={styles.summaryLabel}>Sødme</div>
                <div className={styles.summaryValue}>{tastingState.sødme}</div>
              </div>
            )}

            {wine!.main_category?.code === "rødvin" && (
              <div className={styles.summaryRow}>
                <div className={styles.summaryLabel}>Snærp</div>
                <div className={styles.summaryValue}>{tastingState.snærp}</div>
              </div>
            )}

            <div className={styles.summaryRow}>
              <div className={styles.summaryLabel}>Karakter</div>
              <div className={styles.summaryValue}>{tastingState.karakter}</div>
            </div>

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
                    <span
                      key={i}
                      className={`${styles.flavorPill} ${vmpLuktWords.some((w) => w.includes(x.flavor.name.toLowerCase()) || x.flavor.name.toLowerCase().includes(w)) ? styles.matched : ""}`}
                    >
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
                    <span
                      key={i}
                      className={`${styles.flavorPill} ${vmpSmakWords.some((w) => w.includes(x.flavor.name.toLowerCase()) || x.flavor.name.toLowerCase().includes(w)) ? styles.matched : ""}`}
                    >
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
              <div className={styles.attributeValue}>{vmpFriskhet}</div>
              <div className={styles.scoreValue}>{scores.friskhet}%</div>
            </div>

            <div className={styles.tableRow}>
              <div className={styles.attributeName}>Fylde</div>
              <div className={styles.attributeValue}>{tastingState.fylde}</div>
              <div className={styles.attributeValue}>{vmpFylde}</div>
              <div className={styles.scoreValue}>{scores.fylde}%</div>
            </div>

            {wine!.main_category?.code === "rødvin" && (
              <div className={styles.tableRow}>
                <div className={styles.attributeName}>Snærp</div>
                <div className={styles.attributeValue}>{tastingState.snærp}</div>
                <div className={styles.attributeValue}>{vmpSnærp}</div>
                <div className={styles.scoreValue}>{scores.snærp}%</div>
              </div>
            )}

            {wine!.main_category?.code !== "rødvin" && (
              <div className={styles.tableRow}>
                <div className={styles.attributeName}>Sødme</div>
                <div className={styles.attributeValue}>{tastingState.sødme}</div>
                <div className={styles.attributeValue}>{vmpSødme}</div>
                <div className={styles.scoreValue}>{scores.sødme}%</div>
              </div>
            )}

            <div className={styles.tableRow}>
              <div className={styles.attributeName}>Alkohol</div>
              <div className={styles.attributeValue}>{tastingState.alkohol}%</div>
              <div className={styles.attributeValue}>{wine?.content.traits[0].readableValue}</div>
              <div className={styles.scoreValue}>{scores.alkoholProsent}%</div>
            </div>

            <div className={styles.tableRow}>
              <div className={styles.attributeName}>Pris</div>
              <div className={styles.attributeValue}>{tastingState.pris} kr</div>
              <div className={styles.attributeValue}>{wine?.price.value} kr</div>
              <div className={styles.scoreValue}>{scores.pris}%</div>
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

function initState():
  | {
      farge: number
      lukt: number
      smak: number
      friskhet: number
      fylde: number
      snærp: number
      sødme: number
      alkoholProsent: number
      pris: number
    }
  | (() => {
      farge: number
      lukt: number
      smak: number
      friskhet: number
      fylde: number
      snærp: number
      sødme: number
      alkoholProsent: number
      pris: number
    }) {
  return {
    farge: 0,
    lukt: 0,
    smak: 0,
    friskhet: 0,
    fylde: 0,
    snærp: 0,
    sødme: 0,
    alkoholProsent: 0,
    pris: 0,
  }
}
