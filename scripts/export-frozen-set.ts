#!/usr/bin/env npx tsx
/**
 * Freeze the real tasting corpus for scoring evaluation.
 *
 * Writes scripts/validation-results/frozen-set-<date>.json: every non-empty
 * lukt/smak field with its reference note, the score that is STORED on the row
 * (never recomputed; history is read-only by decision) and, where the row
 * existed in August 2026, the score the previous engine gave it, read from the
 * snapshot in scripts/validation-results/tasting-scores-20260818-204626.json.
 *
 * Frozen means frozen: an existing file is not overwritten without --force.
 * New tastings go into a new file with a new date.
 *
 * Tasters are anonymised to T1..Tn in order of first tasting; the mapping is
 * not written anywhere. Tasting ids are kept so ratings can be joined back.
 *
 * --sheet also writes a blank rating sheet (semicolon-separated, so Norwegian
 * Excel opens it) under scripts/validation-results/ratings/, one row per
 * field, grouped by event and wine so a rater sees the same wine together.
 *
 *   npx tsx --env-file=.env.local scripts/export-frozen-set.ts [--sheet] [--force]
 */
import { createClient } from '@supabase/supabase-js';
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const DATE = new Date().toISOString().slice(0, 7); // YYYY-MM: one frozen set per month at most
const OUT = `scripts/validation-results/frozen-set-${DATE}.json`;
const SHEET = `scripts/validation-results/ratings/rating-sheet-${DATE}.csv`;
const SNAPSHOT = 'scripts/validation-results/tasting-scores-20260818-204626.json';
const force = process.argv.includes('--force');
const sheet = process.argv.includes('--sheet');

export type FrozenField = {
  key: string;
  tastingId: string;
  field: 'lukt' | 'smak';
  taster: string;
  tastedAt: string | null;
  event: { id: string; name: string; date: string } | null;
  wine: { id: string; name: string; year: string | null };
  userNote: string;
  referenceNote: string;
  /** smell_score / taste_score as stored on the row. */
  storedScore: number | null;
  /** Same field under the previous engine, from the August 2026 snapshot; null if the row is newer. */
  previousScore: number | null;
};

export type FrozenSet = {
  meta: { exportedAt: string; commit: string; tastings: number; fields: number; tasters: number; wines: number; events: number; snapshot: string | null };
  fields: FrozenField[];
};

async function main() {
  if (existsSync(OUT) && !force) {
    console.error(`${OUT} exists. A frozen set is not regenerated; pass --force only if it was never used.`);
    process.exit(1);
  }
  const sb = createClient(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  const { data: tastings, error } = await sb
    .from('tastings')
    .select('id,user_id,wine_id,event_id,lukt,smak,smell_score,taste_score,tasted_at,created_at')
    .order('created_at');
  if (error) throw error;
  const rows = tastings ?? [];

  const wineIds = [...new Set(rows.map(r => r.wine_id).filter(Boolean))];
  const eventIds = [...new Set(rows.map(r => r.event_id).filter(Boolean))];
  const [{ data: wines }, { data: events }] = await Promise.all([
    sb.from('wines').select('id,name,year,smell,taste').in('id', wineIds),
    eventIds.length ? sb.from('events').select('id,name,date').in('id', eventIds) : Promise.resolve({ data: [] as { id: string; name: string; date: string }[] }),
  ]);
  const wineById = new Map((wines ?? []).map(w => [w.id, w]));
  const eventById = new Map((events ?? []).map(e => [e.id, e]));

  const snapshot = existsSync(SNAPSHOT)
    ? new Map((JSON.parse(readFileSync(SNAPSHOT, 'utf8')) as { id: string; smell_score: number | null; taste_score: number | null }[]).map(r => [r.id, r]))
    : null;

  const tasterIds = new Map<string, string>();
  for (const r of rows) if (!tasterIds.has(r.user_id)) tasterIds.set(r.user_id, `T${tasterIds.size + 1}`);

  const fields: FrozenField[] = [];
  for (const r of rows) {
    const wine = wineById.get(r.wine_id);
    if (!wine) continue;
    const event = r.event_id ? eventById.get(r.event_id) : undefined;
    const snap = snapshot?.get(r.id);
    for (const [field, userNote, referenceNote, stored, prev] of [
      ['lukt', r.lukt, wine.smell, r.smell_score, snap?.smell_score],
      ['smak', r.smak, wine.taste, r.taste_score, snap?.taste_score],
    ] as const) {
      if (!userNote?.trim() || !referenceNote?.trim()) continue;
      fields.push({
        key: `${r.id}:${field}`,
        tastingId: r.id,
        field,
        taster: tasterIds.get(r.user_id)!,
        tastedAt: r.tasted_at ?? r.created_at ?? null,
        event: event ? { id: event.id, name: event.name, date: event.date } : null,
        wine: { id: wine.id, name: wine.name, year: wine.year ?? null },
        userNote: userNote.trim(),
        referenceNote: referenceNote.trim(),
        storedScore: stored ?? null,
        previousScore: prev ?? null,
      });
    }
  }

  let commit = 'unknown';
  try { commit = execSync('git rev-parse --short HEAD').toString().trim(); } catch { /* ignore */ }

  const out: FrozenSet = {
    meta: {
      exportedAt: new Date().toISOString(),
      commit,
      tastings: rows.length,
      fields: fields.length,
      tasters: tasterIds.size,
      wines: wineById.size,
      events: eventById.size,
      snapshot: snapshot ? SNAPSHOT : null,
    },
    fields,
  };
  mkdirSync('scripts/validation-results', { recursive: true });
  writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n');
  console.log(`written ${OUT}: ${fields.length} fields from ${rows.length} tastings, ${tasterIds.size} tasters, ${wineById.size} wines, ${eventById.size} events`);
  console.log(`previous-engine scores available for ${fields.filter(f => f.previousScore !== null).length} fields`);

  if (sheet) {
    const q = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const sorted = [...fields].sort((a, b) =>
      (a.event?.date ?? '').localeCompare(b.event?.date ?? '') || a.wine.name.localeCompare(b.wine.name, 'nb') || a.field.localeCompare(b.field) || a.taster.localeCompare(b.taster));
    const header = ['key', 'event', 'event_date', 'wine', 'field', 'reference_note', 'user_note', 'rating', 'comment', 'attended'];
    const csv = [header.join(';'), ...sorted.map(f => [
      f.key, f.event?.name ?? '', f.event?.date?.slice(0, 10) ?? '', `${f.wine.name}${f.wine.year ? ` ${f.wine.year}` : ''}`,
      f.field, f.referenceNote, f.userNote, '', '', '',
    ].map(q).join(';'))].join('\n');
    mkdirSync('scripts/validation-results/ratings', { recursive: true });
    writeFileSync(SHEET, '﻿' + csv + '\n'); // BOM so Excel reads UTF-8
    console.log(`written ${SHEET}: ${sorted.length} rows`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
