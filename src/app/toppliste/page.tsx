import { createClient } from '@/lib/supabase/server';
import type { Wine } from '@/lib/types';
import he from 'he';
import Image from 'next/image';
import Link from 'next/link';
import styles from './page.module.css';

interface TopRatedWine {
  wine: Wine;
  average_karakter: number;
  tasting_count: number;
}

export default async function TopRatedWinesPage() {
  const supabase = await createClient();

  // This avoids fetching all tastings and doing aggregation in JS
  const { data: topWinesData, error } = await supabase.rpc('get_top_rated_wines', {
    limit_count: 20
  });

  if (error || !topWinesData || topWinesData.length === 0) {
    // Fallback to original approach if RPC doesn't exist
    return <TopRatedWinesFallback />;
  }

  const topRatedWines: TopRatedWine[] = topWinesData.map(
    (item: { wine: Wine; avg_karakter: number; rating_count: number }) => ({
      wine: item.wine,
      average_karakter: item.avg_karakter,
      tasting_count: item.rating_count
    })
  );

  return (
    <main className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Toppliste</h1>
        <p className={styles.subtitle}>De 20 best vurderte vinene basert på brukernes smakingsnotater</p>
      </div>

      <div className={styles.list}>
        {topRatedWines.map((item, index) => (
          <Link
            key={`${item.wine.product_id}-${item.wine.year || 'no-year'}-${index}`}
            href={`/smaking/${item.wine.product_id}${item.wine.year ? `?year=${item.wine.year}` : ''}`}
            className={styles.wineCard}>
            <div className={styles.rank}>#{index + 1}</div>

            <div className={styles.wineImage}>
              <Image
                src={`/api/wine-image/${item.wine.product_id}`}
                alt={he.decode(item.wine.name)}
                width={80}
                height={120}
                className={styles.image}
              />
            </div>

            <div className={styles.wineDetails}>
              <h2 className={styles.wineName}>{he.decode(item.wine.name)}</h2>
              <p className={styles.wineInfo}>
                {item.wine.main_country} • {item.wine.main_category}
              </p>
              {item.wine.volume && <p className={styles.wineVolume}>{item.wine.volume} cl</p>}
            </div>

            <div className={styles.wineScore}>
              <div className={styles.scoreValue}>{item.average_karakter.toFixed(1)}</div>
              <div className={styles.scoreSuffix}>/10</div>
              <div className={styles.tastingCount}>
                {item.tasting_count} {item.tasting_count === 1 ? 'vurdering' : 'vurderinger'}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}

async function TopRatedWinesFallback() {
  const supabase = await createClient();

  // Get aggregated ratings joined with wines in a single efficient query
  // Only fetch wines that exist in the wines table
  const { data: wines } = await supabase.from('wines').select('product_id, name, main_country, main_category, volume');

  if (!wines || wines.length === 0) {
    return (
      <main className={styles.container}>
        <h1 className={styles.title}>Toppliste</h1>
        <p className={styles.error}>Kunne ikke laste toppliste</p>
      </main>
    );
  }

  // Create a set of valid wine product_ids for fast lookup
  const validWineIds = new Set(wines.map(w => w.product_id));

  // Fetch only tastings for wines that exist
  const { data: topRatedData, error } = await supabase
    .from('tastings')
    .select('product_id, karakter')
    .not('karakter', 'is', null);

  if (error || !topRatedData) {
    return (
      <main className={styles.container}>
        <h1 className={styles.title}>Toppliste</h1>
        <p className={styles.error}>Kunne ikke laste toppliste</p>
      </main>
    );
  }

  // Filter to only include tastings for wines that exist, then aggregate
  const wineScores = topRatedData
    .filter(t => validWineIds.has(t.product_id))
    .reduce((acc, tasting) => {
      const productId = tasting.product_id;
      if (!acc[productId]) {
        acc[productId] = { sum: 0, count: 0 };
      }
      acc[productId].sum += tasting.karakter!;
      acc[productId].count += 1;
      return acc;
    }, {} as Record<string, { sum: number; count: number }>);

  // Calculate averages and sort by rating first, then count
  const sortedWines = Object.entries(wineScores)
    .map(([productId, { sum, count }]) => ({
      productId,
      average: sum / count,
      count
    }))
    .sort((a, b) => {
      if (b.average !== a.average) {
        return b.average - a.average;
      }
      return b.count - a.count;
    })
    .slice(0, 20);

  // Map to final structure
  const wineMap = new Map(wines.map(w => [w.product_id, w]));
  const topRatedWines: TopRatedWine[] = sortedWines
    .map(({ productId, average, count }) => {
      const wine = wineMap.get(productId);
      if (!wine) return null;
      return {
        wine: wine as Wine,
        average_karakter: average,
        tasting_count: count
      };
    })
    .filter(Boolean) as TopRatedWine[];

  return (
    <main className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Toppliste</h1>
        <p className={styles.subtitle}>De 20 best vurderte vinene basert på brukernes smakingsnotater</p>
      </div>

      <div className={styles.list}>
        {topRatedWines.map((item, index) => (
          <Link
            key={`${item.wine.product_id}-${item.wine.year || 'no-year'}-${index}`}
            href={`/smaking/${item.wine.product_id}${item.wine.year ? `?year=${item.wine.year}` : ''}`}
            className={styles.wineCard}>
            <div className={styles.rank}>#{index + 1}</div>

            <div className={styles.wineImage}>
              <Image
                src={`/api/wine-image/${item.wine.product_id}`}
                alt={he.decode(item.wine.name)}
                width={80}
                height={120}
                className={styles.image}
              />
            </div>

            <div className={styles.wineDetails}>
              <h2 className={styles.wineName}>{he.decode(item.wine.name)}</h2>
              <p className={styles.wineInfo}>
                {item.wine.main_country} • {item.wine.main_category}
              </p>
              {item.wine.volume && <p className={styles.wineVolume}>{item.wine.volume} cl</p>}
            </div>

            <div className={styles.wineScore}>
              <div className={styles.scoreValue}>{item.average_karakter.toFixed(1)}</div>
              <div className={styles.scoreSuffix}>/10</div>
              <div className={styles.tastingCount}>
                {item.tasting_count} {item.tasting_count === 1 ? 'vurdering' : 'vurderinger'}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
