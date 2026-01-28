"use client"

import type { Tasting, Wine } from "@/lib/types"
import { useMemo } from "react"
import Image from "next/image"
import { decode } from "he"
import styles from "../page.module.css"

interface HistoryTabProps {
  tastings: Tasting[]
  wines: Wine[]
}

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  const day = date.getDate().toString().padStart(2, "0")
  const month = (date.getMonth() + 1).toString().padStart(2, "0")
  const year = date.getFullYear()
  return `${day}.${month}.${year}`
}

export default function HistoryTab({ tastings, wines }: HistoryTabProps) {
  const sortedTastings = useMemo(() => {
    return [...tastings].sort((a, b) => {
      const dateA = new Date(a.tasted_at).getTime()
      const dateB = new Date(b.tasted_at).getTime()
      return dateB - dateA
    })
  }, [tastings])

  return (
    <div className={styles.historySection}>
      {sortedTastings.length === 0 ? (
        <div className={styles.noRecommendations}>
          Du har ikke smakt noen viner ennå. Start din smaksreise ved å delta på et arrangement!
        </div>
      ) : (
        <div className={styles.historyList}>
          {sortedTastings.map((tasting) => {
            const wine = wines.find((w) => w.id === tasting.wine_id)
            if (!wine) return null

            const overallScore = tasting.overall_score || 0
            const karakter = tasting.karakter || 0

            return (
              <details key={tasting.id} className={styles.historyItem}>
                <summary className={styles.historySummary}>
                  <div className={styles.historyThumb}>
                    {wine.image_url ? (
                      <Image src={wine.image_url || "/placeholder.svg"} alt={wine.name} width={50} height={70} />
                    ) : (
                      <div style={{ fontSize: "1.5rem" }}>🍷</div>
                    )}
                  </div>
                  <div className={styles.historyInfo}>
                    <h3 className={styles.historyName}>{decode(wine.name)}</h3>
                    <p className={styles.historyDate}>{formatDate(tasting.tasted_at)}</p>
                  </div>
                  <div className={styles.historyScores}>
                    {overallScore > 0 && (
                      <div className={styles.historyScore}>
                        Total: <strong>{overallScore.toFixed(1)}</strong>
                      </div>
                    )}
                    {karakter > 0 && (
                      <div className={styles.historyKarakter}>
                        Karakter: <strong>{karakter.toFixed(1)}</strong>
                      </div>
                    )}
                  </div>
                </summary>
                <div className={styles.historyDetails}>
                  <div className={styles.historyNotesSection}>
                    {tasting.farge && (
                      <div className={styles.historyNoteItem}>
                        <div className={styles.historyNoteLabel}>
                          Farge {tasting.color_score && <span>({tasting.color_score})</span>}
                        </div>
                        <div className={styles.historyNoteValue}>{tasting.farge}</div>
                      </div>
                    )}
                    {tasting.lukt && (
                      <div className={styles.historyNoteItem}>
                        <div className={styles.historyNoteLabel}>
                          Lukt
                          {tasting.lukt_intensitet && <span> - Intensitet: {tasting.lukt_intensitet}</span>}
                          {tasting.smell_score && <span> ({tasting.smell_score})</span>}
                        </div>
                        <div className={styles.historyNoteValue}>{tasting.lukt}</div>
                      </div>
                    )}
                    {tasting.smell && (
                      <div className={styles.historyNoteItem}>
                        <div className={styles.historyNoteLabel}>Luktflavors</div>
                        <div className={styles.historyNoteValue}>{tasting.smell}</div>
                      </div>
                    )}
                    {tasting.smak && (
                      <div className={styles.historyNoteItem}>
                        <div className={styles.historyNoteLabel}>
                          Smak
                          {tasting.smaks_intensitet && <span> - Intensitet: {tasting.smaks_intensitet}</span>}
                          {tasting.taste_score && <span> ({tasting.taste_score})</span>}
                        </div>
                        <div className={styles.historyNoteValue}>{tasting.smak}</div>
                      </div>
                    )}
                    {tasting.taste && (
                      <div className={styles.historyNoteItem}>
                        <div className={styles.historyNoteLabel}>Smaksflavors</div>
                        <div className={styles.historyNoteValue}>{tasting.taste}</div>
                      </div>
                    )}
                    {tasting.egenskaper && (
                      <div className={styles.historyNoteItem}>
                        <div className={styles.historyNoteLabel}>Egenskaper</div>
                        <div className={styles.historyNoteValue}>{tasting.egenskaper}</div>
                      </div>
                    )}
                    {tasting.alkohol && (
                      <div className={styles.historyNoteItem}>
                        <div className={styles.historyNoteLabel}>
                          Alkohol {tasting.percentage_score && <span>({tasting.percentage_score})</span>}
                        </div>
                        <div className={styles.historyNoteValue}>{tasting.alkohol}</div>
                      </div>
                    )}
                  </div>
                  <div className={styles.historyScoresSection}>
                    <h4 className={styles.historyScoresTitle}>Vurdering (1-12 skala)</h4>
                    <div className={styles.historyScoresList}>
                      {tasting.friskhet !== null && (
                        <div className={styles.historyScoreItem}>
                          <span className={styles.historyScoreLabel}>
                            Friskhet {tasting.friskhet_score && <span>({tasting.friskhet_score})</span>}
                          </span>
                          <div className={styles.historyScoreBarTrack}>
                            <div
                              className={styles.historyScoreBarFill}
                              style={{ width: `${(tasting.friskhet / 12) * 100}%` }}
                            />
                          </div>
                          <span className={styles.historyScoreNumber}>{tasting.friskhet}/12</span>
                        </div>
                      )}
                      {tasting.fylde !== null && (
                        <div className={styles.historyScoreItem}>
                          <span className={styles.historyScoreLabel}>
                            Fylde {tasting.fylde_score && <span>({tasting.fylde_score})</span>}
                          </span>
                          <div className={styles.historyScoreBarTrack}>
                            <div
                              className={styles.historyScoreBarFill}
                              style={{ width: `${(tasting.fylde / 12) * 100}%` }}
                            />
                          </div>
                          <span className={styles.historyScoreNumber}>{tasting.fylde}/12</span>
                        </div>
                      )}
                      {tasting.sodme !== null && (
                        <div className={styles.historyScoreItem}>
                          <span className={styles.historyScoreLabel}>
                            Sødme {tasting.sodme_score && <span>({tasting.sodme_score})</span>}
                          </span>
                          <div className={styles.historyScoreBarTrack}>
                            <div
                              className={styles.historyScoreBarFill}
                              style={{ width: `${(tasting.sodme / 12) * 100}%` }}
                            />
                          </div>
                          <span className={styles.historyScoreNumber}>{tasting.sodme}/12</span>
                        </div>
                      )}
                      {tasting.snaerp !== null && (
                        <div className={styles.historyScoreItem}>
                          <span className={styles.historyScoreLabel}>
                            Snerphet {tasting.snaerp_score && <span>({tasting.snaerp_score})</span>}
                          </span>
                          <div className={styles.historyScoreBarTrack}>
                            <div
                              className={styles.historyScoreBarFill}
                              style={{ width: `${(tasting.snaerp / 12) * 100}%` }}
                            />
                          </div>
                          <span className={styles.historyScoreNumber}>{tasting.snaerp}/12</span>
                        </div>
                      )}
                      {tasting.karakter !== null && (
                        <div className={styles.historyScoreItem}>
                          <span className={styles.historyScoreLabel}>
                            Karakter {tasting.karakter_score && <span>({tasting.karakter_score})</span>}
                          </span>
                          <div className={styles.historyScoreBarTrack}>
                            <div
                              className={styles.historyScoreBarFill}
                              style={{ width: `${(tasting.karakter / 10) * 100}%` }}
                            />
                          </div>
                          <span className={styles.historyScoreNumber}>{tasting.karakter}/10</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className={styles.historyFooter}>
                    {overallScore > 0 && (
                      <div className={styles.historyFooterScore}>
                        <div className={styles.historyFooterLabel}>Total Score</div>
                        <div className={styles.historyFooterValue}>{overallScore.toFixed(1)}</div>
                      </div>
                    )}
                    {karakter > 0 && (
                      <div className={styles.historyFooterScore}>
                        <div className={styles.historyFooterLabel}>Karakter</div>
                        <div className={styles.historyFooterValue}>{karakter.toFixed(1)}</div>
                      </div>
                    )}
                    {tasting.pris && (
                      <div className={styles.historyFooterScore}>
                        <div className={styles.historyFooterLabel}>
                          Pris {tasting.price_score && `(${tasting.price_score})`}
                        </div>
                        <div className={styles.historyFooterValue}>{tasting.pris} kr</div>
                      </div>
                    )}
                  </div>
                </div>
              </details>
            )
          })}
        </div>
      )}
    </div>
  )
}
