import { createClient } from '@/lib/supabase/server';
import ScoringDemo from './ScoringDemo';
import EngineComparison from './EngineComparison';
import { listSoftEngines } from '@/lib/softEngines';
import { listStyleCategories } from '@/actions/scoring-debug';
import type { EngineComparison as EngineComparisonData } from '@/lib/softEngines/comparison';
import comparisonJson from './engine-comparison.generated.json';
import styles from './page.module.css';

export const metadata = { title: 'Scoring Demo' };

export type PastTasting = {
  id: string;
  wineName: string;
  wineYear: string | null;
  wineCategory: string | null;
  tastedAt: string;
  userSmak: string;
  userLukt: string;
  wineTaste: string;
  wineSmell: string;
  tasteScore: number | null;
  smellScore: number | null;
};

async function getPastTastings(): Promise<PastTasting[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('tastings')
    .select('id, wine_id, smak, lukt, tasted_at, taste_score, smell_score, wines(name, year, taste, smell, main_category)')
    .eq('user_id', user.id)
    .not('smak', 'is', null)
    .order('tasted_at', { ascending: false })
    .limit(50);

  if (error || !data) return [];

  return data
    .filter((t: any) => t.wines && t.smak)
    .map((t: any) => ({
      id: t.id,
      wineName: t.wines.name ?? 'Ukjent vin',
      wineYear: t.wines.year ?? null,
      wineCategory: t.wines.main_category ?? null,
      tastedAt: t.tasted_at,
      userSmak: t.smak ?? '',
      userLukt: t.lukt ?? '',
      wineTaste: t.wines.taste ?? '',
      wineSmell: t.wines.smell ?? '',
      tasteScore: t.taste_score ?? null,
      smellScore: t.smell_score ?? null,
    }));
}

export default async function ScoringDemoPage() {
  const [pastTastings, engines, style] = await Promise.all([
    getPastTastings(),
    listSoftEngines(),
    listStyleCategories(),
  ]);
  const comparison = comparisonJson as unknown as EngineComparisonData;

  return (
    <main className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Scoring Demo</h1>
        <p className={styles.subtitle}>
          Analyser likheten mellom to smakingsnotater og se hvordan scoren beregnes
        </p>
      </div>
      <ScoringDemo
        pastTastings={pastTastings}
        engines={engines}
        styleCategories={style.categories}
        styleDefault={style.enabledByDefault}
      />
      <EngineComparison data={comparison} />
    </main>
  );
}
