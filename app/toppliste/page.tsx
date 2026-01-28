import { createClient } from "@/lib/supabase/server"
import type { Wine } from "@/lib/types"
import styles from "./page.module.css"
import TopRatedWinesList from "./TopRatedWinesList"

interface TopRatedWine {
  wine: Wine
  average_karakter: number
  tasting_count: number
}

export default async function TopRatedWinesPage() {
  const supabase = await createClient()

  // This avoids fetching all tastings and doing aggregation in JS
  const { data: topWinesData, error } = await supabase.rpc("get_top_rated_wines", {
    limit_count: 20,
  })

  if (error || !topWinesData || topWinesData.length === 0) {
    // Fallback to original approach if RPC doesn't exist
    return <TopRatedWinesFallback />
  }

  const topRatedWines: TopRatedWine[] = topWinesData.map(
    (item: { wine: Wine; avg_karakter: number; rating_count: number }) => ({
      wine: item.wine,
      average_karakter: item.avg_karakter,
      tasting_count: item.rating_count,
    }),
  )

  return (
    <main className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Toppliste</h1>
        <p className={styles.subtitle}>De 20 best vurderte vinene basert på brukernes smakingsnotater</p>
      </div>

      <TopRatedWinesList topRatedWines={topRatedWines} />
    </main>
  )
}

async function TopRatedWinesFallback() {
  const supabase = await createClient()

  const { data: wines } = await supabase
    .from("wines")
    .select("id, product_id, name, main_country, main_category, volume")

  if (!wines || wines.length === 0) {
    return (
      <main className={styles.container}>
        <h1 className={styles.title}>Toppliste</h1>
        <p className={styles.error}>Kunne ikke laste toppliste</p>
      </main>
    )
  }

  const validWineIds = new Set(wines.map((w) => w.id))

  const { data: topRatedData, error } = await supabase
    .from("tastings")
    .select("wine_id, karakter")
    .not("karakter", "is", null)

  if (error || !topRatedData) {
    return (
      <main className={styles.container}>
        <h1 className={styles.title}>Toppliste</h1>
        <p className={styles.error}>Kunne ikke laste toppliste</p>
      </main>
    )
  }

  const wineScores = topRatedData
    .filter((t) => validWineIds.has(t.wine_id))
    .reduce(
      (acc, tasting) => {
        const wineId = tasting.wine_id
        if (!acc[wineId]) {
          acc[wineId] = { sum: 0, count: 0 }
        }
        acc[wineId].sum += tasting.karakter!
        acc[wineId].count += 1
        return acc
      },
      {} as Record<string, { sum: number; count: number }>,
    )

  // Calculate averages and sort by rating first, then count
  const sortedWines = Object.entries(wineScores)
    .map(([wineId, { sum, count }]) => ({
      wineId,
      average: sum / count,
      count,
    }))
    .sort((a, b) => {
      if (b.average !== a.average) {
        return b.average - a.average
      }
      return b.count - a.count
    })
    .slice(0, 20)

  const wineMap = new Map(wines.map((w) => [w.id, w]))
  const topRatedWines: TopRatedWine[] = sortedWines
    .map(({ wineId, average, count }) => {
      const wine = wineMap.get(wineId)
      if (!wine) return null
      return {
        wine: wine as Wine,
        average_karakter: average,
        tasting_count: count,
      }
    })
    .filter(Boolean) as TopRatedWine[]

  return (
    <main className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Toppliste</h1>
        <p className={styles.subtitle}>De 20 best vurderte vinene basert på brukernes smakingsnotater</p>
      </div>

      <TopRatedWinesList topRatedWines={topRatedWines} />
    </main>
  )
}
