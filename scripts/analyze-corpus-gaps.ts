/**
 * Fetches all wine taste/smell notes, tokenizes them, and reports:
 * 1. Most frequent uncovered tokens (not in lemma dict, not stopwords)
 * 2. Tokens that look like Norwegian chars written as ASCII (ae→æ, oe→ø, aa→å)
 *
 * Run: set -a; source .env.local; set +a; npx tsx scripts/analyze-corpus-gaps.ts
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { sanitizeText, norwegianLemmas, stopwords } from '../src/lib/lemmatizeAndWeight';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Tokens we knowingly skip (numbers, etc.) — filter before reporting
const NOISE = /^\d+$|^[a-z]$|^\d/;

function applyNorwegianChars(token: string): string {
  return token
    .replace(/ae/g, 'æ')
    .replace(/oe/g, 'ø')
    .replace(/aa/g, 'å');
}

async function main() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  console.log('Fetching all wine notes...');
  const PAGE = 1000;
  const wines: { taste: string | null; smell: string | null }[] = [];
  let from = 0;
  while (true) {
    const { data: page, error } = await supabase
      .from('wines')
      .select('taste, smell')
      .range(from, from + PAGE - 1);
    if (error) { console.error('Fetch failed:', error); process.exit(1); }
    if (!page || page.length === 0) break;
    wines.push(...page);
    if (page.length < PAGE) break;
    from += PAGE;
  }
  console.log(`Loaded ${wines.length} wines`);

  const freq = new Map<string, number>();          // uncovered token → count
  const asciiCandidates = new Map<string, number>(); // ae/oe/aa tokens → count
  let totalTokens = 0;
  let coveredTokens = 0;

  for (const wine of wines) {
    for (const text of [wine.taste, wine.smell]) {
      if (!text) continue;
      const tokens = sanitizeText(text).split(' ').filter(Boolean);
      totalTokens += tokens.length;

      for (const token of tokens) {
        if (norwegianLemmas[token]) { coveredTokens++; continue; }

        // Check if it would be covered after ASCII→Norwegian conversion
        const converted = applyNorwegianChars(token);
        if (converted !== token) {
          asciiCandidates.set(token, (asciiCandidates.get(token) ?? 0) + 1);
          if (norwegianLemmas[converted]) { coveredTokens++; continue; }
        }

        if (!NOISE.test(token) && token.length > 2) {
          freq.set(token, (freq.get(token) ?? 0) + 1);
        }
      }
    }
  }

  const coverage = ((coveredTokens / totalTokens) * 100).toFixed(1);
  console.log(`\nToken coverage: ${coveredTokens}/${totalTokens} = ${coverage}%`);

  // Top uncovered terms (min freq 5)
  const top = [...freq.entries()]
    .filter(([, c]) => c >= 5)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 80);

  console.log(`\n── Top uncovered tokens (freq ≥ 5) ─────────────────────`);
  for (const [token, count] of top) {
    const fixedVersion = applyNorwegianChars(token);
    const note = fixedVersion !== token ? `  → ${fixedVersion}${norwegianLemmas[fixedVersion] ? ' (already in dict after fix!)' : ''}` : '';
    console.log(`  ${token.padEnd(28)} ${String(count).padStart(6)}${note}`);
  }

  // ASCII-encoded Norwegian chars
  const topAscii = [...asciiCandidates.entries()]
    .sort(([, a], [, b]) => b - a)
    .slice(0, 40);

  if (topAscii.length > 0) {
    console.log(`\n── Tokens with ASCII-encoded Norwegian chars (ae/oe/aa) ─`);
    for (const [token, count] of topAscii) {
      const converted = applyNorwegianChars(token);
      const inDict = norwegianLemmas[converted] ? '✓ dict hit after fix' : '✗ still missing';
      console.log(`  ${token.padEnd(28)} ${String(count).padStart(6)}  → ${converted}  ${inDict}`);
    }
  }
}

main().catch(console.error);
