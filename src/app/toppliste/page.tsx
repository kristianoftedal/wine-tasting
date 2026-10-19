import { createClient } from '@/lib/supabase/server'
import type { Wine } from '@/lib/types'
import styles from './page.module.css'
import TopRatedWinesList, { type TopRatedWine } from './TopRatedWinesList'

/*
 * The leaderboard is aggregated here from `tastings`, not by an RPC.
 *
 * It used to call `get_top_rated_wines`, a function that exists only in the live database
 * (no file in scripts/ defines it), and silently fall back to a JS aggregation on any error.
 * That fallback went stale in two ways, both from PostgREST's default 1 000-row response cap:
 *   - it loaded `wines` to build a set of valid ids, but got only the first 1 000 of ~50 000
 *     rows, so a tasting of any wine outside that arbitrary slice was dropped;
 *   - it loaded `tastings` unpaged and unordered, so once there were more than 1 000 rated
 *     tastings an arbitrary subset was ranked.
 * Because the fallback never reported the RPC error, the page looked fine and just stopped moving.
 *
 * Now: page through every rated tasting (ordered by id, so pages never overlap), aggregate,
 * then fetch only the 20 winning wines. Errors are shown, not masked.
 *
 * Visibility follows RLS on `tastings`: tastings outside any event plus events in the viewer's groups.
 */

const TOP_N = 20
const PAGE_SIZE = 1000

// The Supabase client carries no generated schema types, so query results are `any`.
// These pin down exactly what each query selects.
type RatedTasting = { wine_id: string; karakter: number }

type SupabaseClient = NonNullable<Awaited<ReturnType<typeof createClient>>>

async function fetchRatedTastings(supabase: SupabaseClient): Promise<RatedTasting[]> {
  const rows: RatedTasting[] = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('tastings')
      .select('wine_id, karakter')
      .not('karakter', 'is', null)
      .not('wine_id', 'is', null)
      .order('id')
      .range(from, from + PAGE_SIZE - 1)
    if (error) throw error
    const page: RatedTasting[] = data ?? []
    rows.push(...page)
    if (page.length < PAGE_SIZE) return rows
  }
}

async function getTopRatedWines(supabase: SupabaseClient): Promise<TopRatedWine[]> {
  const tastings = await fetchRatedTastings(supabase)

  const scores = new Map<string, { sum: number; count: number }>()
  for (const { wine_id, karakter } of tastings) {
    const entry = scores.get(wine_id) ?? { sum: 0, count: 0 }
    entry.sum += karakter
    entry.count += 1
    scores.set(wine_id, entry)
  }

  const ranked = [...scores.entries()]
    .map(([wineId, { sum, count }]) => ({ wineId, average: sum / count, count }))
    .sort((a, b) => b.average - a.average || b.count - a.count)
    .slice(0, TOP_N)

  if (ranked.length === 0) return []

  const { data, error } = await supabase
    .from('wines')
    .select('*')
    .in(
      'id',
      ranked.map(r => r.wineId)
    )
  if (error) throw error

  const wines: Wine[] = data ?? []
  const wineById = new Map(wines.map(w => [w.id, w]))
  return ranked.flatMap(r => {
    const wine = wineById.get(r.wineId)
    return wine ? [{ wine, average_karakter: r.average, tasting_count: r.count }] : []
  })
}

export default async function TopRatedWinesPage() {
  const supabase = await createClient()

  let topRatedWines: TopRatedWine[] | null = null
  if (supabase) {
    try {
      topRatedWines = await getTopRatedWines(supabase)
    } catch (error) {
      console.error('Kunne ikke laste toppliste', error)
    }
  }

  return (
    <main className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Toppliste</h1>
        <p className={styles.subtitle}>De {TOP_N} best vurderte vinene basert på brukernes smakingsnotater</p>
      </div>

      {topRatedWines === null ? (
        <p className={styles.error}>Kunne ikke laste toppliste</p>
      ) : topRatedWines.length === 0 ? (
        <p className={styles.subtitle}>Ingen vurderinger ennå</p>
      ) : (
        <TopRatedWinesList topRatedWines={topRatedWines} />
      )}
    </main>
  )
}
