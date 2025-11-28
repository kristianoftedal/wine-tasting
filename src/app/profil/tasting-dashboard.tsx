"use client"

import type React from "react"
import type { Event, Group, Tasting, Wine } from "@/lib/types"
import { format } from "date-fns"
import Link from "next/link"
import { useMemo, useState, useEffect } from "react"
import styles from "./page.module.css"
import { findSimilarWines } from "@/actions/wine-similarity"

interface TastingDashboardProps {
  tastings: Tasting[]
  wines: Wine[]
  allWines: Wine[]
  groups: Group[]
  events: Event[]
}

type Accolade = {
  id: string
  title: string
  description: string
  icon: string
  color: string
  earned: boolean
}

type StylePreference = {
  style: string
  avgScore: number
  count: number
  liked: boolean
}

export function TastingDashboard({ tastings, wines, allWines, groups, events }: TastingDashboardProps) {
  const [activeTab, setActiveTab] = useState<"overview" | "accolades" | "karakter" | "history">("overview")
  const [similarWineRecommendations, setSimilarWineRecommendations] = useState<Wine[]>([])
  const [loadingRecommendations, setLoadingRecommendations] = useState(false)

  // Calculate average scores
  const avgScores = useMemo(() => {
    if (tastings.length === 0) return null

    const totals = {
      overall: 0,
      color: 0,
      smell: 0,
      taste: 0,
      friskhet: 0,
      fylde: 0,
      sodme: 0,
      snaerp: 0,
      karakter: 0,
    }

    let count = 0
    tastings.forEach((t) => {
      if (t.overall_score) {
        totals.overall += t.overall_score
        totals.color += t.color_score || 0
        totals.smell += t.smell_score || 0
        totals.taste += t.taste_score || 0
        totals.friskhet += t.friskhet || 0
        totals.fylde += t.fylde || 0
        totals.sodme += t.sodme || 0
        totals.snaerp += t.snaerp || 0
        totals.karakter += t.karakter || 0
        count++
      }
    })

    if (count === 0) return null

    return {
      overall: totals.overall / count,
      color: totals.color / count,
      smell: totals.smell / count,
      taste: totals.taste / count,
      friskhet: totals.friskhet / count,
      fylde: totals.fylde / count,
      sodme: totals.sodme / count,
      snaerp: totals.snaerp / count,
      karakter: totals.karakter / count,
      count,
    }
  }, [tastings])

  // Calculate accolades
  const accolades = useMemo<Accolade[]>(() => {
    const highSmellCount = tastings.filter((t) => (t.smell_score || 0) >= 80).length
    const highTasteCount = tastings.filter((t) => (t.taste_score || 0) >= 80).length
    const highOverallCount = tastings.filter((t) => (t.overall_score || 0) >= 85).length
    const perfectKarakter = tastings.filter((t) => (t.karakter || 0) >= 9).length
    const totalTastings = tastings.length

    return [
      {
        id: "nose-master",
        title: "Nesemester",
        description: "Ga 80+ i lukt til 5 viner",
        icon: "👃",
        color: "#a78bfa",
        earned: highSmellCount >= 5,
      },
      {
        id: "taste-connoisseur",
        title: "Smakskjenner",
        description: "Ga 80+ i smak til 5 viner",
        icon: "👅",
        color: "#f472b6",
        earned: highTasteCount >= 5,
      },
      {
        id: "wine-expert",
        title: "Vinekspert",
        description: "Vurdert 10 viner totalt",
        icon: "🍷",
        color: "#c084fc",
        earned: totalTastings >= 10,
      },
      {
        id: "quality-hunter",
        title: "Kvalitetsjeger",
        description: "Funnet 3 viner med 85+ totalscore",
        icon: "⭐",
        color: "#fbbf24",
        earned: highOverallCount >= 3,
      },
      {
        id: "perfectionist",
        title: "Perfeksjonist",
        description: "Ga 9+ i karakter til 3 viner",
        icon: "💎",
        color: "#34d399",
        earned: perfectKarakter >= 3,
      },
      {
        id: "sommelier",
        title: "Sommelier",
        description: "Vurdert 25 viner totalt",
        icon: "🏆",
        color: "#f59e0b",
        earned: totalTastings >= 25,
      },
    ]
  }, [tastings])

  const stylePreferences = useMemo<StylePreference[]>(() => {
    const styleMap = new Map<string, { total: number; count: number }>()

    // Only include wines with karakter >= 8
    const highRatedTastings = tastings.filter((t) => (t.karakter || 0) >= 8)

    highRatedTastings.forEach((t) => {
      const wine = wines.find((w) => w.product_id === t.product_id)
      const styleName = wine?.content?.style?.name || "Ukjent"

      if (!styleMap.has(styleName)) {
        styleMap.set(styleName, { total: 0, count: 0 })
      }

      const current = styleMap.get(styleName)!
      current.total += t.karakter || 0
      current.count++
    })

    return Array.from(styleMap.entries())
      .map(([style, data]) => ({
        style,
        avgScore: data.total / data.count,
        count: data.count,
        liked: data.total / data.count >= 8,
      }))
      .sort((a, b) => b.avgScore - a.avgScore)
  }, [tastings, wines])

  useEffect(() => {
    if (activeTab === "karakter" && similarWineRecommendations.length === 0 && tastings.length > 0) {
      setLoadingRecommendations(true)
      const userId = tastings[0]?.user_id
      if (userId) {
        findSimilarWines(userId, 6)
          .then((wines) => setSimilarWineRecommendations(wines))
          .catch((error) => console.error("Failed to load recommendations:", error))
          .finally(() => setLoadingRecommendations(false))
      }
    }
  }, [activeTab, tastings, similarWineRecommendations.length])

  // Get wine recommendations based on preferences (fallback to style-based)
  const recommendations = useMemo(() => {
    // Use similar wine recommendations if available
    if (similarWineRecommendations.length > 0) {
      return similarWineRecommendations
    }

    // Fallback to style-based recommendations
    if (stylePreferences.length === 0) return []

    const likedStyles = stylePreferences.filter((s) => s.liked).map((s) => s.style)
    const tastedCodes = new Set(tastings.map((t) => t.product_id))

    const recommended = allWines
      .filter((wine) => {
        const wineStyle = wine.content?.style?.name
        return wineStyle && likedStyles.includes(wineStyle) && !tastedCodes.has(wine.product_id)
      })
      .slice(0, 6)

    if (recommended.length < 6) {
      const additional = allWines
        .filter((wine) => !tastedCodes.has(wine.product_id) && !recommended.includes(wine))
        .slice(0, 6 - recommended.length)
      recommended.push(...additional)
    }

    return recommended
  }, [stylePreferences, allWines, tastings, similarWineRecommendations])

  const earnedCount = accolades.filter((a) => a.earned).length

  return (
    <div className={styles.dashboard}>
      {/* Tab Navigation */}
      <div className={styles.tabNav}>
        <button
          className={`${styles.tab} ${activeTab === "overview" ? styles.tabActive : ""}`}
          onClick={() => setActiveTab("overview")}
        >
          Oversikt
        </button>
        <button
          className={`${styles.tab} ${activeTab === "accolades" ? styles.tabActive : ""}`}
          onClick={() => setActiveTab("accolades")}
        >
          Utmerkelser ({earnedCount}/{accolades.length})
        </button>
        <button
          className={`${styles.tab} ${activeTab === "karakter" ? styles.tabActive : ""}`}
          onClick={() => setActiveTab("karakter")}
        >
          Din Karakter
        </button>
        <button
          className={`${styles.tab} ${activeTab === "history" ? styles.tabActive : ""}`}
          onClick={() => setActiveTab("history")}
        >
          Historikk
        </button>
      </div>

      {/* Overview Tab */}
      {activeTab === "overview" && (
        <div className={styles.overviewGrid}>
          {/* Stats Cards */}
          <div className={styles.statsRow}>
            <div className={styles.statCard}>
              <div className={styles.statValue}>{tastings.length}</div>
              <div className={styles.statLabel}>Viner smakt</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statValue}>{avgScores?.overall.toFixed(1) || "-"}</div>
              <div className={styles.statLabel}>Snitt totalscore</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statValue}>{avgScores?.karakter.toFixed(1) || "-"}</div>
              <div className={styles.statLabel}>Snitt karakter</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statValue}>{earnedCount}</div>
              <div className={styles.statLabel}>Utmerkelser</div>
            </div>
          </div>

          {/* Score Breakdown */}
          {avgScores && (
            <div className={styles.scoreBreakdown}>
              <h3 className={styles.sectionTitle}>Dine gjennomsnittlige vurderinger</h3>
              <div className={styles.scoreGrid}>
                <ScoreBar label="Farge" value={avgScores.color} max={100} color="#a78bfa" />
                <ScoreBar label="Lukt" value={avgScores.smell} max={100} color="#f472b6" />
                <ScoreBar label="Smak" value={avgScores.taste} max={100} color="#c084fc" />
                <ScoreBar label="Friskhet" value={avgScores.friskhet} max={10} color="#34d399" />
                <ScoreBar label="Fylde" value={avgScores.fylde} max={10} color="#fbbf24" />
                <ScoreBar label="Sødme" value={avgScores.sodme} max={10} color="#fb923c" />
                <ScoreBar label="Snærp" value={avgScores.snaerp} max={10} color="#f87171" />
              </div>
            </div>
          )}

          {/* Quick Links */}
          <div className={styles.quickLinks}>
            <div className={styles.linkCard}>
              <h3 className={styles.linkTitle}>Dine grupper</h3>
              <div className={styles.linkList}>
                {groups.length === 0 ? (
                  <p className={styles.emptyText}>Ingen grupper ennå</p>
                ) : (
                  groups.slice(0, 3).map((group) => (
                    <Link key={group.id} href={`/gruppe/${group.id}`} className={styles.linkItem}>
                      {group.name}
                    </Link>
                  ))
                )}
              </div>
              <Link href="/gruppe/opprett-gruppe" className={styles.linkButton}>
                Opprett gruppe
              </Link>
            </div>

            <div className={styles.linkCard}>
              <h3 className={styles.linkTitle}>Kommende arrangement</h3>
              <div className={styles.linkList}>
                {events.length === 0 ? (
                  <p className={styles.emptyText}>Ingen arrangement</p>
                ) : (
                  events.slice(0, 3).map((event) => (
                    <Link
                      key={event.id}
                      href={`/gruppe/${event.group_id}/arrangement/${event.id}`}
                      className={styles.linkItem}
                    >
                      <span className={styles.eventDate}>{new Date(event.date).toLocaleDateString()}</span>
                      <span>{event.name}</span>
                    </Link>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Accolades Tab */}
      {activeTab === "accolades" && (
        <div className={styles.accoladesGrid}>
          {accolades.map((accolade) => (
            <div
              key={accolade.id}
              className={`${styles.accoladeCard} ${accolade.earned ? styles.accoladeEarned : styles.accoladeLocked}`}
              style={{ "--accolade-color": accolade.color } as React.CSSProperties}
            >
              <div className={styles.accoladeIcon}>{accolade.icon}</div>
              <h4 className={styles.accoladeTitle}>{accolade.title}</h4>
              <p className={styles.accoladeDesc}>{accolade.description}</p>
              {accolade.earned && <div className={styles.accoladeBadge}>Oppnådd!</div>}
            </div>
          ))}
        </div>
      )}

      {/* Karakter Tab */}
      {activeTab === "karakter" && (
        <div className={styles.karakterSection}>
          <div className={styles.preferencesCard}>
            <h3 className={styles.sectionTitle}>Dine stilpreferanser</h3>
            <p className={styles.sectionDesc}>Basert på viner du har gitt 8+ i karakter</p>

            {stylePreferences.length === 0 ? (
              <p className={styles.emptyText}>Gi minst én vin 8+ i karakter for å se dine preferanser</p>
            ) : (
              <div className={styles.preferencesList}>
                {stylePreferences.map((pref) => (
                  <div key={pref.style} className={styles.preferenceItem}>
                    <div className={styles.preferenceHeader}>
                      <span className={styles.preferenceName}>{pref.style}</span>
                      <span className={styles.preferenceCount}>({pref.count} viner)</span>
                    </div>
                    <div className={styles.preferenceBar}>
                      <div
                        className={styles.preferenceProgress}
                        style={{
                          width: `${(pref.avgScore / 10) * 100}%`,
                          backgroundColor: pref.liked ? "#34d399" : "#f87171",
                        }}
                      />
                    </div>
                    <div className={styles.preferenceScore}>
                      {pref.avgScore.toFixed(1)}/10
                      {pref.liked ? (
                        <span className={styles.likedBadge}>Favoritt</span>
                      ) : (
                        <span className={styles.dislikedBadge}>Ikke din stil</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className={styles.recommendationsCard}>
            <h3 className={styles.sectionTitle}>Anbefalte viner for deg</h3>
            <p className={styles.sectionDesc}>
              Basert på likhet med viner du har gitt høy karakter (fylde, friskhet, snærp, sødme, smak og lukt)
            </p>

            {loadingRecommendations ? (
              <p className={styles.emptyText}>Laster anbefalinger...</p>
            ) : recommendations.length === 0 ? (
              <p className={styles.emptyText}>Gi flere viner 8+ i karakter for å få anbefalinger</p>
            ) : (
              <div className={styles.recommendationsGrid}>
                {recommendations.map((wine) => (
                  <div key={wine.id} className={styles.recommendationCard}>
                    <div className={styles.recommendationImage}>
                      <img
                        src={`/api/wine-image/${wine.product_id}?size=100x100`}
                        alt={wine.name}
                        onError={(e) => {
                          e.currentTarget.style.display = "none"
                        }}
                      />
                    </div>
                    <div className={styles.recommendationInfo}>
                      <h4 className={styles.recommendationName}>{wine.name}</h4>
                      <p className={styles.recommendationMeta}>
                        {wine.year && <span>{wine.year}</span>}
                        {wine.content?.style?.name && (
                          <span className={styles.recommendationStyle}>{wine.content.style.name}</span>
                        )}
                      </p>
                      {wine.price && <p className={styles.recommendationPrice}>{wine.price.formattedValue}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* History Tab */}
      {activeTab === "history" && (
        <div className={styles.historySection}>
          {tastings.length === 0 ? (
            <p className={styles.emptyText}>Ingen smaksnotater ennå</p>
          ) : (
            <div className={styles.historyList}>
              {tastings.map((tasting, index) => {
                const wine = wines.find((w) => w.product_id === tasting.product_id)
                return (
                  <details key={index} className={styles.historyItem}>
                    <summary className={styles.historySummary}>
                      <div className={styles.historyThumb}>
                        <img
                          src={`/api/wine-image/${tasting.product_id}?size=80x80`}
                          alt=""
                          onError={(e) => {
                            e.currentTarget.style.display = "none"
                          }}
                        />
                      </div>
                      <div className={styles.historyInfo}>
                        <h5 className={styles.historyName}>{wine?.name || tasting.product_id}</h5>
                        <p className={styles.historyDate}>{format(new Date(tasting.tasted_at), "PPP")}</p>
                      </div>
                      <div className={styles.historyScores}>
                        <span className={styles.historyScore}>
                          Total: <strong>{tasting.overall_score?.toFixed(0) || "-"}</strong>
                        </span>
                        <span className={styles.historyKarakter}>
                          Karakter: <strong>{tasting.karakter || "-"}</strong>/10
                        </span>
                      </div>
                    </summary>
                    <div className={styles.historyDetails}>
                      <div className={styles.historyDetailGrid}>
                        <p>
                          <strong>Farge:</strong> {tasting.farge}
                        </p>
                        <p>
                          <strong>Lukt:</strong> {tasting.smell}, {tasting.lukt}
                        </p>
                        <p>
                          <strong>Smak:</strong> {tasting.taste}, {tasting.smak}
                        </p>
                        <p>
                          <strong>Friskhet:</strong> {tasting.friskhet}/10
                        </p>
                        <p>
                          <strong>Fylde:</strong> {tasting.fylde}/10
                        </p>
                        <p>
                          <strong>Sødme:</strong> {tasting.sodme}/10
                        </p>
                        <p>
                          <strong>Snærp:</strong> {tasting.snaerp}/10
                        </p>
                        <p>
                          <strong>Kommentar:</strong> {tasting.egenskaper || "Ingen"}
                        </p>
                      </div>
                    </div>
                  </details>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ScoreBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const percentage = (value / max) * 100
  return (
    <div className={styles.scoreBarContainer}>
      <div className={styles.scoreBarLabel}>
        <span>{label}</span>
        <span className={styles.scoreBarValue}>{value.toFixed(1)}</span>
      </div>
      <div className={styles.scoreBarTrack}>
        <div className={styles.scoreBarFill} style={{ width: `${percentage}%`, backgroundColor: color }} />
      </div>
    </div>
  )
}
