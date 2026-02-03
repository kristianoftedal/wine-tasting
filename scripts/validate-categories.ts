import { config } from 'dotenv';
import { readFile } from 'fs/promises';
import path from 'path';

config({ path: '.env.local' });

import { norwegianLemmas } from '../src/lib/lemmatizeAndWeight';
import { WINE_CATEGORIES, GENERIC_STRUCTURE_TERMS } from '../src/lib/categories';

interface ValidationResult {
  success: boolean;
  errors: string[];
  warnings: string[];
  stats: {
    totalOldTerms: number;
    totalNewTerms: number;
    categorizedTerms: number;
    uncategorizedFromOld: number;
    duplicates: number;
    mainCategories: number;
    subcategories: number;
  };
}

async function validateCategories(): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Build flat map of all terms in new structure
  const newTerms = new Map<string, string>(); // term -> category path
  let subcategoryCount = 0;

  // Process WINE_CATEGORIES
  for (const [mainCat, subcats] of Object.entries(WINE_CATEGORIES)) {
    for (const [subCat, data] of Object.entries(subcats)) {
      subcategoryCount++;
      for (const term of data.terms) {
        const termPath = `${mainCat}/${subCat}`;
        if (newTerms.has(term)) {
          errors.push(`DUPLICATE: "${term}" in ${termPath} AND ${newTerms.get(term)}`);
        }
        newTerms.set(term, termPath);
      }
    }
  }

  // Process GENERIC_STRUCTURE_TERMS
  for (const [cat, data] of Object.entries(GENERIC_STRUCTURE_TERMS)) {
    subcategoryCount++;
    for (const term of data.terms) {
      const termPath = `GENERIC/${cat}`;
      if (newTerms.has(term)) {
        errors.push(`DUPLICATE: "${term}" in ${termPath} AND ${newTerms.get(term)}`);
      }
      newTerms.set(term, termPath);
    }
  }

  // Check all old lemmas can be mapped
  const oldLemmas = new Set<string>();
  const uncategorized: string[] = [];

  for (const [word, data] of Object.entries(norwegianLemmas)) {
    oldLemmas.add(data.lemma);
    oldLemmas.add(word);
  }

  for (const term of oldLemmas) {
    // Normalize: replace Norwegian chars for lookup
    const normalized = term
      .replace(/æ/g, 'ae')
      .replace(/ø/g, 'oe')
      .replace(/å/g, 'aa')
      .toLowerCase();

    if (!newTerms.has(term) && !newTerms.has(normalized)) {
      uncategorized.push(term);
    }
  }

  // Some uncategorized terms are expected (variants, inflections)
  // Warn only if core lemmas are missing
  const coreLemmas = ['balanse', 'struktur', 'tannin', 'solbaer', 'kirsbaer', 'eple', 'pepper'];
  for (const core of coreLemmas) {
    const found = newTerms.has(core) ||
      [...newTerms.keys()].some(k => k.includes(core.replace(/ae|oe/g, '')));
    if (!found) {
      warnings.push(`CORE LEMMA MISSING: "${core}" not found in new structure`);
    }
  }

  // Verify berry merge
  const expectedBerries = ['solbaer', 'bjoernbaer', 'blabaer', 'morell', 'kirsbaer', 'jordbaer', 'bringbaer', 'rips'];
  const berryCategory = WINE_CATEGORIES.Frukt.baer.terms as readonly string[];
  const missingBerries = expectedBerries.filter(b => !berryCategory.includes(b));
  if (missingBerries.length > 0) {
    errors.push(`BERRY MERGE INCOMPLETE: Missing ${missingBerries.join(', ')}`);
  }

  // Verify weight inversion (generic < specific)
  const genericWeights = Object.values(GENERIC_STRUCTURE_TERMS).map(d => d.weight);
  const specificWeights = Object.values(WINE_CATEGORIES)
    .flatMap(cat => Object.values(cat))
    .map(d => d.weight);

  const maxGeneric = Math.max(...genericWeights);
  const minSpecific = Math.min(...specificWeights);

  if (maxGeneric >= minSpecific) {
    warnings.push(`WEIGHT OVERLAP: Generic max (${maxGeneric}) >= Specific min (${minSpecific})`);
  }

  // Count stats
  const mainCategoryCount = Object.keys(WINE_CATEGORIES).length;

  return {
    success: errors.length === 0,
    errors,
    warnings,
    stats: {
      totalOldTerms: oldLemmas.size,
      totalNewTerms: newTerms.size,
      categorizedTerms: newTerms.size,
      uncategorizedFromOld: uncategorized.length,
      duplicates: errors.filter(e => e.startsWith('DUPLICATE')).length,
      mainCategories: mainCategoryCount,
      subcategories: subcategoryCount
    }
  };
}

// Run validation
validateCategories().then(result => {
  console.log('\n========================================');
  console.log('   CATEGORY VALIDATION RESULTS');
  console.log('========================================\n');

  console.log(`Status: ${result.success ? '✓ PASS' : '✗ FAIL'}\n`);

  console.log('STATISTICS:');
  console.log(`  Main categories: ${result.stats.mainCategories}`);
  console.log(`  Subcategories: ${result.stats.subcategories}`);
  console.log(`  Terms in new structure: ${result.stats.totalNewTerms}`);
  console.log(`  Terms in old structure: ${result.stats.totalOldTerms}`);
  console.log(`  Uncategorized from old: ${result.stats.uncategorizedFromOld}`);
  console.log(`  Duplicates found: ${result.stats.duplicates}`);

  if (result.errors.length > 0) {
    console.log('\n✗ ERRORS:');
    result.errors.forEach(e => console.log(`  ${e}`));
  }

  if (result.warnings.length > 0) {
    console.log('\n⚠ WARNINGS:');
    result.warnings.forEach(w => console.log(`  ${w}`));
  }

  console.log('\n========================================\n');

  process.exit(result.success ? 0 : 1);
});
