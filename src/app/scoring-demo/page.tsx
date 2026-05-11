import { createClient } from '@/lib/supabase/server';
import { norwegianLemmas } from '@/lib/lemmatizeAndWeight';
import ScoringDemo from './ScoringDemo';
import styles from './page.module.css';

export const metadata = { title: 'Scoring Demo' };

export type PastTasting = {
  id: string;
  wineName: string;
  wineYear: string | null;
  tastedAt: string;
  userSmak: string;
  userLukt: string;
  wineTaste: string;
  wineSmell: string;
  tasteScore: number | null;
  smellScore: number | null;
};

export type LemmaEntry = {
  lemma: string;
  sub: string;
  category: string;
};

export type LemmaSub = {
  name: string;
  terms: LemmaEntry[];
};

export type LemmaGroup = {
  main: string;
  subs: LemmaSub[];
  total: number;
};

const SUB_LABELS: Record<string, string> = {
  baer: 'Bær', sitrus: 'Sitrus', steinfrukt: 'Steinfrukt', tropisk: 'Tropisk',
  toerket: 'Tørket/modent', annet: 'Annet',
  varm: 'Varme krydder', soet: 'Søte krydder',
  fatlagring: 'Fatlagring', ristet: 'Ristet',
  stein: 'Stein/mineraler',
  groenn: 'Grønne urter',
  structure: 'Struktur', quality: 'Kvalitet', finish: 'Finish',
  body: 'Fylde', acidity: 'Syre', sweetness: 'Sødme',
  texture: 'Tekstur', general: 'Generelt',
};

function computeLemmaGroups(): LemmaGroup[] {
  const seen = new Set<string>();
  const grouped = new Map<string, Map<string, LemmaEntry[]>>();

  for (const entry of Object.values(norwegianLemmas)) {
    if (seen.has(entry.lemma)) continue;
    seen.add(entry.lemma);
    const main = entry.categoryPath?.main ?? 'GENERIC';
    const sub = entry.categoryPath?.sub ?? '';
    if (!grouped.has(main)) grouped.set(main, new Map());
    const subMap = grouped.get(main)!;
    if (!subMap.has(sub)) subMap.set(sub, []);
    subMap.get(sub)!.push({ lemma: entry.lemma, sub, category: entry.category });
  }

  const ORDER = ['Frukt', 'Krydder', 'Eik/fat', 'Mineral', 'Urter', 'Blomster', 'GENERIC'];

  return [...grouped.entries()]
    .map(([main, subMap]) => ({
      main,
      subs: [...subMap.entries()]
        .map(([name, terms]) => ({
          name: SUB_LABELS[name] ?? name,
          terms: terms.sort((a, b) => a.lemma.localeCompare(b.lemma, 'nb')),
        }))
        .sort((a, b) => a.name.localeCompare(b.name, 'nb')),
      total: [...subMap.values()].reduce((s, t) => s + t.length, 0),
    }))
    .sort((a, b) => {
      const ai = ORDER.indexOf(a.main);
      const bi = ORDER.indexOf(b.main);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });
}

async function getPastTastings(): Promise<PastTasting[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('tastings')
    .select('id, wine_id, smak, lukt, tasted_at, taste_score, smell_score, wines(name, year, taste, smell)')
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
  const [pastTastings, lemmaGroups] = await Promise.all([
    getPastTastings(),
    Promise.resolve(computeLemmaGroups()),
  ]);

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
        lemmaGroups={lemmaGroups}
        defaultRecall={process.env.SCORING_RECALL_ENABLED === 'true'}
        defaultFlavorFilter={process.env.SEMANTIC_FLAVOR_FILTER_ENABLED === 'true'}
      />
    </main>
  );
}
