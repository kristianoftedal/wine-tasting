"use client"
import type { Group, Tasting, Wine, Event } from "@/lib/types"
import { useMemo, useState } from "react"
import { useAtom } from "jotai"
import { wineAtom } from "@/app/store/tasting"
import styles from "./page.module.css"
import OverviewTab from "./tabs/OverviewTab"
import AwardsTab from "./tabs/AwardsTab"
import PreferenceTab from "./tabs/PreferenceTab"
import HistoryTab from "./tabs/HistoryTab"

interface TastingDashboardProps {
  tastings: Tasting[]
  wines: Wine[]
  allWines: Wine[]
  groups: Group[]
  events: Event[]
}

function TastingDashboard({ tastings, wines, allWines: allWinesProp, groups, events }: TastingDashboardProps) {
  const [allWinesFromAtom] = useAtom(wineAtom)
  const allWines = allWinesProp.length > 0 ? allWinesProp : allWinesFromAtom
  const [activeTab, setActiveTab] = useState<"overview" | "awards" | "karakter" | "history">("overview")

  const sortedTastings = useMemo(() => {
    return [...tastings].sort((a, b) => {
      const dateA = new Date(a.tasted_at).getTime()
      const dateB = new Date(b.tasted_at).getTime()
      return dateB - dateA // Newest first
    })
  }, [tastings])

  const earnedCount = useMemo(() => {
    const highSmellCount = sortedTastings.filter((t) => (t.smell_score || 0) >= 70).length
    const highTasteCount = sortedTastings.filter((t) => (t.taste_score || 0) >= 70).length
    const highOverallCount = sortedTastings.filter((t) => (t.overall_score || 0) >= 70).length
    const perfectKarakter = sortedTastings.filter((t) => (t.karakter || 0) >= 9).length
    const totalTastings = sortedTastings.length

    let earned = 0
    if (highSmellCount >= 5) earned++
    if (highTasteCount >= 5) earned++
    if (totalTastings >= 10) earned++
    if (highOverallCount >= 3) earned++
    if (perfectKarakter >= 3) earned++
    if (totalTastings >= 25) earned++

    return earned
  }, [sortedTastings])

  return (
    <div className={styles.dashboard}>
      <div className={styles.tabNav}>
        <button
          className={`${styles.tab} ${activeTab === "overview" ? styles.tabActive : ""}`}
          onClick={() => setActiveTab("overview")}
        >
          Oversikt
        </button>
        <button
          className={`${styles.tab} ${activeTab === "awards" ? styles.tabActive : ""}`}
          onClick={() => setActiveTab("awards")}
        >
          Utmerkelser ({earnedCount}/18)
        </button>
        <button
          className={`${styles.tab} ${activeTab === "karakter" ? styles.tabActive : ""}`}
          onClick={() => setActiveTab("karakter")}
        >
          Din smaksprofil
        </button>
        <button
          className={`${styles.tab} ${activeTab === "history" ? styles.tabActive : ""}`}
          onClick={() => setActiveTab("history")}
        >
          Historikk
        </button>
      </div>

      {activeTab === "overview" && (
        <OverviewTab tastings={sortedTastings} wines={wines} groups={groups} events={events} />
      )}

      {activeTab === "awards" && <AwardsTab tastings={sortedTastings} wines={wines} />}

      {activeTab === "karakter" && <PreferenceTab tastings={sortedTastings} wines={wines} allWines={allWines} />}

      {activeTab === "history" && <HistoryTab tastings={sortedTastings} wines={wines} />}
    </div>
  )
}

export default TastingDashboard
export { TastingDashboard }
