import { createClient } from "@/lib/supabase/server"
import type { Wine } from "@/lib/types"
import Image from "next/image"
import Link from "next/link"
import styles from "./page.module.css"

interface TopRatedWine {
  wine: Wine
  average_karakter: number
  tasting_count: number
}

export default async function TopRatedWinesPage() {
  const supabase = await createClient()

  // Get top 20 wines based on average karakter from tastings
  const { data: topRatedData, error } = await supabase
    .from("tastings")
    .select(`
      product_id,
      karakter
    `)
    .not("karakter", "is", null)

  if (error || !topRatedData) {
    return (
      <main className={styles.container}>
        <h1 className={styles.title}>Toppliste</h1>
        <p className={styles.error}>Kunne ikke laste toppliste</p>
      </main>
    )
  }

  // Group by product_id and calculate averages
  const wineScores = topRatedData.reduce(
    (acc, tasting) => {
      const productId = tasting.product_id
      if (!acc[productId]) {
        acc[productId] = { sum: 0, count: 0 }
      }
      acc[productId].sum += tasting.karakter!
      acc[productId].count += 1
      return acc
    },
    {} as Record<string, { sum: number; count: number }>,
  )

  // Calculate averages and sort
  const sortedWines = Object.entries(wineScores)
    .map(([productId, { sum, count }]) => ({
      productId,
      average: sum / count,
      count,
    }))
    .sort((a, b) => b.average - a.average)
    .slice(0, 20)

  // Fetch wine details for top 20
  const wineCodes = sortedWines.map((w) => w.productId)
  const { data: wines } = await supabase.from("wines").select("*").in("product_id", wineCodes)

  const topRatedWines: TopRatedWine[] = sortedWines
    .map(({ productId, average, count }) => {
      const wine = wines?.find((w) => w.product_id === productId)
      if (!wine) return null
      return {
        wine,
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

      <div className={styles.list}>
        {topRatedWines.map((item, index) => (
          <Link key={item.wine.product_id} href={`/smaking/${item.wine.product_id}`} className={styles.wineCard}>
            <div className={styles.rank}>#{index + 1}</div>

            <div className={styles.wineImage}>
              <Image
                src={`/api/wine-image/${item.wine.product_id}`}
                alt={item.wine.name}
                width={80}
                height={120}
                className={styles.image}
              />
            </div>

            <div className={styles.wineDetails}>
              <h2 className={styles.wineName}>{item.wine.name}</h2>
              <p className={styles.wineInfo}>
                {item.wine.main_country?.name} • {item.wine.main_category?.name}
              </p>
              {item.wine.volume && <p className={styles.wineVolume}>{item.wine.volume.formattedValue}</p>}
            </div>

            <div className={styles.wineScore}>
              <div className={styles.scoreValue}>{item.average_karakter.toFixed(1)}</div>
              <div className={styles.scoreSuffix}>/10</div>
              <div className={styles.tastingCount}>
                {item.tasting_count} {item.tasting_count === 1 ? "vurdering" : "vurderinger"}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </main>
  )
}
