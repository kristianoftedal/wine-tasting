#!/usr/bin/env npx tsx
/**
 * OOV audit: finds tokens that appear in wine reference notes (or user tasting
 * notes) but resolve to category `ukjent` — i.e. the lemma layer cannot see them.
 *
 * Unknown tokens are silently skipped by the scorers, so a descriptor the
 * reference note actually names can be invisible to scoring. This ranks the
 * gaps by corpus frequency so the highest-impact ones get added first.
 *
 * Run: npx tsx --env-file=.env.local scripts/audit-oov.ts [--limit 60]
 */
import { createClient } from '@supabase/supabase-js';
import { lemmatizeAndWeight, tokenizeSanitized } from '../src/lib/lemmatizeAndWeight';
import { normalizeWineSynonyms } from '../src/lib/synonymNormalization';

const LIMIT = Number(process.argv[process.argv.indexOf('--limit') + 1]) || 60;

async function main() {
  const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  const notes: string[] = [];
  for (let from = 0; from < 8000; from += 1000) {
    const { data } = await sb.from('wines').select('smell,taste')
      .not('taste', 'is', null).range(from, from + 999);
    if (!data?.length) break;
    for (const w of data) { if (w.smell) notes.push(w.smell); if (w.taste) notes.push(w.taste); }
  }
  const { data: ts } = await sb.from('tastings').select('lukt,smak').limit(500);
  const userNotes = (ts ?? []).flatMap(t => [t.lukt, t.smak].filter(Boolean) as string[]);

  const count = (texts: string[]) => {
    const oov = new Map<string, number>();
    const docs = new Map<string, Set<number>>();
    texts.forEach((text, i) => {
      const norm = normalizeWineSynonyms(text);
      const known = new Set(lemmatizeAndWeight(norm).lemmatized
        .filter(l => l.category !== 'ukjent').map(l => l.original));
      for (const tok of new Set(tokenizeSanitized(norm))) {
        if (known.has(tok) || tok.length < 3 || /^\d+$/.test(tok)) continue;
        oov.set(tok, (oov.get(tok) ?? 0) + 1);
        (docs.get(tok) ?? docs.set(tok, new Set()).get(tok)!).add(i);
      }
    });
    return [...oov.entries()].sort((a, b) => b[1] - a[1]);
  };

  const wineOov = count(notes);
  const userOov = count(userNotes);
  const wineTotal = wineOov.reduce((s, [, c]) => s + c, 0);

  console.log(`\nReference notes scanned : ${notes.length}`);
  console.log(`User notes scanned      : ${userNotes.length}`);
  console.log(`Distinct OOV tokens     : ${wineOov.length} in reference notes, ${userOov.length} in user notes`);
  console.log(`Total OOV occurrences   : ${wineTotal} in reference notes\n`);

  console.log(`TOP ${LIMIT} OOV TOKENS IN REFERENCE NOTES (invisible to the lemma layer)`);
  console.log('-'.repeat(72));
  console.log('token'.padEnd(26), 'in wine notes'.padStart(14), '% of notes'.padStart(12));
  console.log('-'.repeat(72));
  for (const [tok, c] of wineOov.slice(0, LIMIT))
    console.log(tok.padEnd(26), String(c).padStart(14), (c / notes.length * 100).toFixed(2).padStart(11) + '%');

  console.log(`\nTOP 25 OOV TOKENS IN USER NOTES`);
  console.log('-'.repeat(72));
  for (const [tok, c] of userOov.slice(0, 25))
    console.log(tok.padEnd(26), String(c).padStart(14), (c / userNotes.length * 100).toFixed(2).padStart(11) + '%');
}

main().catch(e => { console.error(e); process.exit(1); });
