#!/usr/bin/env npx tsx
/**
 * Find Vinmonopolet reference notes too vague to grade a taster against,
 * research the wine against independent sources, and rewrite the notes in the
 * catalogue's own register.
 *
 * Same pipeline the API route runs (src/lib/noteEnrichment.ts) — this is the
 * way to work through the backlog, since the route is bounded by the platform's
 * request timeout and the catalogue has tens of thousands of thin notes.
 *
 * Usage:
 *   npx tsx scripts/enrich-wine-notes.ts --events --execute       # wines in upcoming events (the normal run)
 *   npx tsx scripts/enrich-wine-notes.ts --event=<uuid> --execute # one event's wines
 *   npx tsx scripts/enrich-wine-notes.ts --audit                  # counts only, no LLM
 *   npx tsx scripts/enrich-wine-notes.ts --limit=5                # dry run, prints drafts
 *   npx tsx scripts/enrich-wine-notes.ts --limit=50 --execute     # writes
 *   npx tsx scripts/enrich-wine-notes.ts --product=12267801 --execute
 *   npx tsx scripts/enrich-wine-notes.ts --category="Rødvin" --limit=20 --execute
 *   npx tsx scripts/enrich-wine-notes.ts --limit=20 --allow-unsourced   # accept grape/district-derived notes
 *
 * Writes land in smell_enriched/taste_enriched with enrichment_status
 * 'pending'. wines.smell and wines.taste are never touched.
 */
import { config as dotenvConfig } from 'dotenv';
dotenvConfig({ path: '.env.local' });
dotenvConfig();

import { createClient } from '@supabase/supabase-js';
import { auditNoteQuality, eventWineIds, runEnrichmentBatch, upcomingEventWineIds } from '../src/lib/noteEnrichment';

function flag(name: string): string | undefined {
  const match = process.argv.find(arg => arg.startsWith(`--${name}=`));
  return match?.split('=').slice(1).join('=');
}

const auditOnly = process.argv.includes('--audit');
const execute = process.argv.includes('--execute');
const limit = Number(flag('limit') ?? 5);
const category = flag('category');
const productIds = flag('product')
  ?.split(',')
  .map(id => id.trim());
const includeAttempted = process.argv.includes('--include-attempted');
// Wines scheduled to be poured. Measured on the live data: 29 376 catalogue
// rows need enrichment and 41 wines have ever reached a user, so this is the
// flag that matters and a run over the whole catalogue is the exception.
const upcomingEvents = process.argv.includes('--events');
const eventId = flag('event');
// Off by default: a note with no source behind it is a guess dressed as a fact.
const allowUnsourced = process.argv.includes('--allow-unsourced');

const supabase = createClient(
  process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/** Wine ids this run is restricted to, or undefined for the whole catalogue. */
async function resolveWineIds(): Promise<string[] | undefined> {
  if (eventId) return eventWineIds(supabase, eventId);
  if (upcomingEvents) return upcomingEventWineIds(supabase);
  return undefined;
}

function percent(part: number, total: number): string {
  return total > 0 ? `${((100 * part) / total).toFixed(1)}%` : '—';
}

async function main() {
  const wineIds = await resolveWineIds();
  if (wineIds?.length === 0) {
    console.log(eventId ? 'Arrangementet har ingen viner.' : 'Ingen kommende arrangementer med viner.');
    return;
  }

  if (auditOnly) {
    const audit = await auditNoteQuality(supabase, { category, includeAttempted, wineIds, candidateLimit: 20 });
    console.log(
      `Scanned ${audit.scanned} wines — ${audit.needingEnrichment} need enrichment (${percent(audit.needingEnrichment, audit.scanned)})\n`
    );

    for (const field of ['smell', 'taste'] as const) {
      const verdicts = Object.entries(audit.verdicts[field]).sort((a, b) => b[1] - a[1]);
      console.log(`${field}: ${verdicts.map(([v, c]) => `${v} ${c} (${percent(c, audit.scanned)})`).join(', ')}`);
    }

    console.log('\nPer kategori:');
    for (const [name, stats] of Object.entries(audit.byCategory).sort((a, b) => b[1].scanned - a[1].scanned)) {
      console.log(
        `  ${name}: ${stats.needingEnrichment}/${stats.scanned} (${percent(stats.needingEnrichment, stats.scanned)})`
      );
    }

    if (Object.keys(audit.alreadyAttempted).length > 0) {
      console.log(`\nAlready attempted: ${JSON.stringify(audit.alreadyAttempted)}`);
    }

    console.log('\nWorst 20:');
    for (const candidate of audit.candidates) {
      console.log(
        `  [${candidate.assessment.priority.toFixed(1)}] ${candidate.name} — ${candidate.assessment.reasons.join('; ')}`
      );
      console.log(`      L: ${candidate.smell ?? '(mangler)'}`);
      console.log(`      S: ${candidate.taste ?? '(mangler)'}`);
    }
    return;
  }

  const scope = eventId
    ? `arrangement ${eventId} (${wineIds!.length} viner)`
    : upcomingEvents
      ? `kommende arrangementer (${wineIds!.length} viner)`
      : 'hele katalogen';
  console.log(
    execute
      ? `Enriching up to ${limit} wines from ${scope} (WRITES ENABLED)`
      : `Dry run over up to ${limit} wines from ${scope} — pass --execute to write`
  );

  const result = await runEnrichmentBatch(supabase, {
    limit,
    dryRun: !execute,
    category,
    productIds,
    wineIds,
    includeAttempted,
    requireSources: !allowUnsourced
  });

  for (const item of result.items) {
    const fanOut = item.appliedToRows > 1 ? ` (${item.appliedToRows} rader)` : '';
    console.log(`\n── ${item.name} [${item.category ?? 'ukjent'}] priority ${item.priority.toFixed(1)}${fanOut}`);
    console.log(`   grunn: ${item.reasons.join('; ')}`);
    console.log(`   før  L: ${item.before.smell ?? '(mangler)'}`);
    console.log(`   før  S: ${item.before.taste ?? '(mangler)'}`);

    if (item.outcome.status === 'enriched') {
      const { before, after, notes, sources } = item.outcome;
      console.log(`   ETTER L: ${notes.smell}`);
      console.log(`   ETTER S: ${notes.taste}`);
      console.log(
        `   aromaord: lukt ${before.smell.aromaLemmas} → ${after.smell.aromaLemmas}, smak ${before.taste.aromaLemmas} → ${after.taste.aromaLemmas}`
      );
      console.log(`   confidence: ${notes.confidence} — ${notes.basis}`);
      console.log(`   kilder: ${sources.map(s => s.url).join('\n            ') || '(ingen)'}`);
      console.log(`   ${item.persisted ? 'LAGRET som pending' : 'ikke lagret (dry run)'}`);
    } else if (item.outcome.status === 'rejected') {
      console.log(`   AVVIST: ${item.outcome.reason}`);
      for (const problem of item.outcome.problems) console.log(`     - ${problem}`);
      if (item.outcome.notes) {
        console.log(`   utkast L: ${item.outcome.notes.smell}`);
        console.log(`   utkast S: ${item.outcome.notes.taste}`);
      }
    } else {
      console.log(`   FEIL: ${item.outcome.reason}`);
    }
  }

  console.log(
    `\n${result.processed} behandlet — ${result.enriched} godkjent, ${result.rejected} avvist, ${result.errored} feilet` +
      `${result.dryRun ? ' (dry run, ingenting lagret)' : ''}`
  );
  console.log(
    `${wineIds ? 'I dette utvalget' : 'Katalogen'}: ${result.audit.needingEnrichment}/${result.audit.scanned} ` +
      `viner trenger fortsatt bedre notater`
  );
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
