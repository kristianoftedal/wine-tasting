#!/usr/bin/env npx tsx
/**
 * Colour lexicon against the stored OpenAI colour scores.
 *
 * Every tasting with a colour phrase carries a stored colour score, computed
 * as the cosine of OpenAI embeddings of the two phrases. The lexicon has no
 * human target of its own, so agreement with those scores is the check that
 * it ranks colours the way the old engine did, and the fitted level line
 * (stored ≈ a + b·lexicon) is what keeps totals from moving at the switch.
 *
 *   npx tsx --env-file=.env.local scripts/measure-colour.ts
 */
import { createClient } from '@supabase/supabase-js';
import { writeFileSync } from 'node:fs';
import { colourSimilarity } from '../src/lib/colourScoring';
import { mean, spearman, pearson } from '../src/lib/stats';

const OUT = `scripts/validation-results/colour-lexicon-${new Date().toISOString().slice(0, 10)}.md`;

async function main() {
  const sb = createClient(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data: t, error } = await sb.from('tastings').select('farge,color_score,wine_id').not('farge', 'is', null);
  if (error) throw error;
  const ids = [...new Set((t ?? []).map(x => x.wine_id).filter(Boolean))];
  const { data: w } = await sb.from('wines').select('id,color').in('id', ids);
  const colourOf = new Map((w ?? []).map(x => [x.id, x.color as string | null]));
  const rows = (t ?? []).flatMap(x => { const ref = colourOf.get(x.wine_id); if (!x.farge?.trim() || !ref || x.color_score === null) return []; const lex = colourSimilarity(x.farge, ref); return lex === null ? [] : [{ user: x.farge.trim(), ref, stored: x.color_score as number, lex }]; });
  const stored = rows.map(r => r.stored), lex = rows.map(r => r.lex);
  const mx = mean(lex), my = mean(stored);
  const b = lex.reduce((s, xi, i) => s + (xi - mx) * (stored[i] - my), 0) / (lex.reduce((s, xi) => s + (xi - mx) ** 2, 0) || 1);
  const a = my - b * mx;
  const lines = [`# Colour lexicon vs stored OpenAI colour scores — ${new Date().toISOString().slice(0, 10)}`, '', `${rows.length} tastings with a colour phrase and a stored score.`, '',
    `| | value |`, `| --- | --- |`, `| Spearman(lexicon, stored) | ${spearman(lex, stored).toFixed(3)} |`, `| Pearson | ${pearson(lex, stored).toFixed(3)} |`,
    `| stored mean / sd | ${my.toFixed(1)} / ${Math.sqrt(mean(stored.map(v => (v - my) ** 2))).toFixed(1)} |`, `| lexicon mean / sd | ${mx.toFixed(1)} / ${Math.sqrt(mean(lex.map(v => (v - mx) ** 2))).toFixed(1)} |`,
    `| level fit stored ≈ a + b·lexicon | a ${a.toFixed(2)}, b ${b.toFixed(3)} |`, '',
    '## Largest disagreements', '', '| taster | reference | stored (OpenAI) | lexicon | lexicon levelled |', '| --- | --- | --- | --- | --- |'];
  const ranked = rows.map(r => ({ ...r, lev: Math.round(a + b * r.lex), d: Math.abs(a + b * r.lex - r.stored) })).sort((p, q) => q.d - p.d).slice(0, 14);
  for (const r of ranked) lines.push(`| ${r.user} | ${r.ref} | ${r.stored} | ${r.lex} | ${r.lev} |`);
  lines.push('', '## Sanity pairs', '', '| taster | reference | lexicon |', '| --- | --- | --- |');
  for (const [u, r] of [['lys strågul', 'Dyp rød.'], ['rubinrød', 'Dyp rød.'], ['lys rød', 'Lys rubinrød.'], ['rosa', 'Lys lakserosa.'], ['gyllen', 'Lys strågul.'], ['dyp rød/lilla', 'Dyp blårød.'], ['mørk rød, lett brun', 'Dyp rubinrød, brunskjær.'], ['uringul', 'Lys gul.']]) lines.push(`| ${u} | ${r} | ${colourSimilarity(u, r)} |`);
  writeFileSync(OUT, lines.join('\n') + '\n');
  console.log(lines.join('\n'));
  console.log(`\nwritten ${OUT}`);
  console.log(`\nLEVEL ${JSON.stringify({ a: Number(a.toFixed(4)), b: Number(b.toFixed(4)) })}`);
}

main().catch(e => { console.error(e); process.exit(1); });
