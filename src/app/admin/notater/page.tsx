import { redirect } from 'next/navigation';
import { canReviewNotes } from '@/actions/note-review';
import { createClient } from '@/lib/supabase/server';
import { assessNote } from '@/lib/noteQuality';
import type { Wine } from '@/lib/types';
import NoteReviewList, { type ReviewRow } from './NoteReviewList';
import styles from './page.module.css';

/**
 * Editorial queue for generated wine notes.
 *
 * Every row here is a draft that already cleared the automated gates in
 * src/lib/noteQuality.ts — style, preservation, improvement, sourcing and
 * wine identity. What is left is the judgement no gate can make: whether the
 * sources are convincing for this bottle. Approving promotes the note to
 * reference data the scoring engine may grade tasters against.
 *
 * The page shows the things a reviewer needs to reject quickly — the vintage
 * the sources actually describe, how many sources survived the identity check,
 * and the descriptor counts — rather than making them open each link first.
 */

/** Pending queue size. Large enough to clear a batch, small enough to render. */
const QUEUE_LIMIT = 60;

export default async function NoteReviewPage() {
  if (!(await canReviewNotes())) redirect('/');

  const supabase = await createClient();
  if (!supabase) {
    return (
      <main className={styles.container}>
        <p className={styles.error}>Supabase er ikke konfigurert.</p>
      </main>
    );
  }

  const { data, error } = await supabase
    .from('wines')
    .select('*')
    .eq('enrichment_status', 'pending')
    .order('enriched_at', { ascending: true })
    .limit(QUEUE_LIMIT)
    .returns<Wine[]>();

  if (error) {
    console.error('[admin/notater] queue lookup failed', error);
    return (
      <main className={styles.container}>
        <p className={styles.error}>Kunne ikke hente køen.</p>
      </main>
    );
  }

  const { count: approved } = await supabase
    .from('wines')
    .select('*', { count: 'exact', head: true })
    .eq('enrichment_status', 'approved');
  const { count: rejected } = await supabase
    .from('wines')
    .select('*', { count: 'exact', head: true })
    .eq('enrichment_status', 'rejected');

  // Descriptor counts are computed here rather than read from enrichment_meta:
  // the meta records what the pipeline measured at write time, and the lemma
  // dictionary may have changed since. The reviewer should see today's numbers.
  const rows: ReviewRow[] = (data ?? []).map(wine => ({
    id: wine.id,
    productId: wine.product_id,
    name: wine.name,
    category: wine.main_category,
    country: wine.main_country,
    producer: wine.main_producer,
    year: wine.year,
    smellBefore: wine.smell,
    tasteBefore: wine.taste,
    smellAfter: wine.smell_enriched ?? '',
    tasteAfter: wine.taste_enriched ?? '',
    smellLemmas: { before: assessNote(wine.smell).aromaLemmas, after: assessNote(wine.smell_enriched).aromaLemmas },
    tasteLemmas: { before: assessNote(wine.taste).aromaLemmas, after: assessNote(wine.taste_enriched).aromaLemmas },
    sources: wine.enrichment_sources ?? [],
    confidence: wine.enrichment_meta?.confidence ?? null,
    basis: wine.enrichment_meta?.basis ?? null,
    sourceVintages: wine.enrichment_meta?.sourceVintages ?? [],
    vintageMatch: wine.enrichment_meta?.vintageMatch ?? null
  }));

  return (
    <main className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>Notatgodkjenning</h1>
        <p className={styles.subtitle}>
          Genererte lukt- og smaksnotater som venter på vurdering. Godkjente notater kan brukes som fasit når smakinger
          scores — avviste blir liggende, men tas aldri i bruk.
        </p>
        <div className={styles.stats}>
          <span className={styles.stat}>
            <strong>{rows.length}</strong> til vurdering
          </span>
          <span className={styles.stat}>
            <strong>{approved ?? 0}</strong> godkjent
          </span>
          <span className={styles.stat}>
            <strong>{rejected ?? 0}</strong> avvist
          </span>
        </div>
      </header>

      <NoteReviewList rows={rows} />
    </main>
  );
}
