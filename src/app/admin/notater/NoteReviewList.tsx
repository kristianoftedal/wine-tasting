'use client';

import { useState, useTransition } from 'react';
import { approveNote, rejectNote } from '@/actions/note-review';
import styles from './page.module.css';

export type ReviewRow = {
  id: string;
  productId: string;
  name: string;
  category: string | null;
  country: string | null;
  producer: string | null;
  year: string | null;
  smellBefore: string | null;
  tasteBefore: string | null;
  smellAfter: string;
  tasteAfter: string;
  smellLemmas: { before: number; after: number };
  tasteLemmas: { before: number; after: number };
  sources: Array<{ url: string; title: string }>;
  confidence: 'high' | 'medium' | 'low' | null;
  basis: string | null;
  sourceVintages: string[];
  vintageMatch: 'exact' | 'neighbour' | 'unknown' | null;
};

const CONFIDENCE_LABEL: Record<string, string> = {
  high: 'Flere kilder om denne vinen',
  medium: 'Én kilde om denne vinen',
  low: 'Tynn dekning'
};

/**
 * Why a row might deserve a second look, stated up front.
 *
 * The automated gates have already rejected everything they can decide. These
 * are the residual signals they deliberately do not act on, because each of
 * them can be legitimate: a neighbouring vintage is real evidence about a wine,
 * just weaker, and one good source beats three bad ones. Surfacing them is the
 * difference between a reviewer skimming and a reviewer checking.
 */
function warningsFor(row: ReviewRow): string[] {
  const warnings: string[] = [];

  // null means the row predates vintage tracking, which is not the same as the
  // pipeline having looked and found nothing. Warning on both made every row in
  // the first batch light up, and a warning that fires on 100% of rows tells a
  // reviewer nothing.
  if (row.vintageMatch === 'neighbour') {
    warnings.push(`Kildene beskriver ${row.sourceVintages.join(', ') || 'en annen årgang'}, ikke ${row.year}`);
  } else if (row.vintageMatch === 'unknown') {
    warnings.push('Ingen kilde oppgir årgang');
  }
  if (row.sources.length <= 1) {
    warnings.push('Bare én kilde');
  }
  if (row.confidence === 'low') {
    warnings.push('Modellen oppgir lav sikkerhet');
  }
  if (row.tasteLemmas.after < 4) {
    warnings.push(`Smaksnotatet navngir bare ${row.tasteLemmas.after} aromaord`);
  }

  return warnings;
}

function Delta({ before, after }: { before: number; after: number }) {
  return (
    <span className={styles.delta}>
      {before} <span aria-hidden>→</span> <strong>{after}</strong> aromaord
    </span>
  );
}

export default function NoteReviewList({ rows }: { rows: ReviewRow[] }) {
  // Decided rows leave the list immediately. The server action revalidates, but
  // waiting for a round trip before acknowledging a click makes a queue of
  // sixty feel broken.
  const [decided, setDecided] = useState<Record<string, 'approved' | 'rejected'>>({});
  // Feedback is inline rather than a toast: no toast provider is mounted in
  // this app, so a toast here would fail silently — and a reviewer who thinks
  // they approved a note and did not is the one failure this page must never
  // produce.
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  const decide = (row: ReviewRow, action: 'approved' | 'rejected') => {
    setDecided(current => ({ ...current, [row.id]: action }));
    setErrors(current => {
      const next = { ...current };
      delete next[row.id];
      return next;
    });

    startTransition(async () => {
      const result = await (action === 'approved' ? approveNote(row.id) : rejectNote(row.id));
      if (result.ok) return;

      // Put it back — the reviewer has not actually decided anything yet.
      setDecided(current => {
        const next = { ...current };
        delete next[row.id];
        return next;
      });
      setErrors(current => ({ ...current, [row.id]: result.error }));
    });
  };

  const remaining = rows.filter(row => !decided[row.id]);

  if (remaining.length === 0) {
    return <p className={styles.empty}>Ingen notater venter på vurdering.</p>;
  }

  return (
    <div className={styles.list}>
      {remaining.map(row => {
        const warnings = warningsFor(row);

        return (
          <article
            key={row.id}
            className={styles.card}>
            <div className={styles.cardHeader}>
              <div>
                <h2 className={styles.wineName}>{row.name}</h2>
                <p className={styles.meta}>
                  {[row.category, row.country, row.producer].filter(Boolean).join(' · ')} · varenr {row.productId}
                </p>
              </div>
              {row.confidence && (
                <span
                  className={`${styles.badge} ${styles[`confidence_${row.confidence}`]}`}
                  title={CONFIDENCE_LABEL[row.confidence]}>
                  {row.confidence}
                </span>
              )}
            </div>

            {warnings.length > 0 && (
              <ul className={styles.warnings}>
                {warnings.map(warning => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            )}

            <div className={styles.notes}>
              <section className={styles.note}>
                <h3 className={styles.noteLabel}>
                  Lukt <Delta {...row.smellLemmas} />
                </h3>
                <p className={styles.before}>{row.smellBefore || 'Vinmonopolet har ingen luktnote'}</p>
                <p className={styles.after}>{row.smellAfter}</p>
              </section>

              <section className={styles.note}>
                <h3 className={styles.noteLabel}>
                  Smak <Delta {...row.tasteLemmas} />
                </h3>
                <p className={styles.before}>{row.tasteBefore || 'Vinmonopolet har ingen smaksnote'}</p>
                <p className={styles.after}>{row.tasteAfter}</p>
              </section>
            </div>

            {row.vintageMatch === null && (
              <p className={styles.provenanceNote}>
                Laget før årgangssporing — kildene er ikke kontrollert mot årgang {row.year}.
              </p>
            )}

            {row.basis && <p className={styles.basis}>{row.basis}</p>}

            <ul className={styles.sources}>
              {row.sources.length === 0 && <li className={styles.noSources}>Ingen kilder lagret</li>}
              {row.sources.map(source => (
                <li key={source.url}>
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer">
                    {source.title || new URL(source.url).hostname}
                  </a>
                </li>
              ))}
            </ul>

            {errors[row.id] && (
              <p
                className={styles.actionError}
                role="alert">
                {errors[row.id]}
              </p>
            )}

            <div className={styles.actions}>
              <button
                type="button"
                className={styles.reject}
                disabled={pending}
                onClick={() => decide(row, 'rejected')}>
                Avvis
              </button>
              <button
                type="button"
                className={styles.approve}
                disabled={pending}
                onClick={() => decide(row, 'approved')}>
                Godkjenn
              </button>
            </div>
          </article>
        );
      })}
    </div>
  );
}
