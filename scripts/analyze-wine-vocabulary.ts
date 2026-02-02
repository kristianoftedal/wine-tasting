import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { stopwords, norwegianLemmas } from '../src/lib/lemmatizeAndWeight';
import { writeFile } from 'fs/promises';
import { Wine } from '../src/lib/types';

// Load environment variables
config({ path: '.env.local' });

// Environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Initialize Supabase client
const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Fetch all wines from Supabase with pagination
 */
async function fetchAllWines(): Promise<Wine[]> {
  console.log('Fetching wines from Supabase...');

  const wines: Wine[] = [];
  const pageSize = 1000;
  let page = 0;

  while (true) {
    const start = page * pageSize;
    const end = start + pageSize - 1;

    const { data, error } = await supabase
      .from('wines')
      .select('id, name, smell, taste, color')
      .order('id')
      .range(start, end);

    if (error) {
      console.error('Error fetching wines:', error);
      throw error;
    }

    if (!data || data.length === 0) {
      break;
    }

    wines.push(...data as Wine[]);

    console.log(`Fetched ${wines.length} wines so far...`);

    if (data.length < pageSize) {
      break;
    }

    page++;
  }

  return wines;
}

/**
 * Tokenize text into words, filtering out stopwords and punctuation
 */
function tokenize(text: string | null): string[] {
  if (!text || text.trim() === '') {
    return [];
  }

  const words = text
    .toLowerCase()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, '')
    .split(/\s+/)
    .filter(word => word.length > 0 && !stopwords.has(word));

  return words;
}

/**
 * Analyze frequency of terms in an array of texts
 */
function analyzeFrequency(texts: (string | null)[]): Map<string, number> {
  const frequency = new Map<string, number>();

  for (const text of texts) {
    const words = tokenize(text);

    for (const word of words) {
      frequency.set(word, (frequency.get(word) || 0) + 1);
    }
  }

  return frequency;
}

/**
 * Find terms that appear in database but not in lemma dictionary
 */
function findMissingTerms(
  allFrequencies: Map<string, number>,
  existingLemmas: Record<string, unknown>,
  minFrequency: number = 3
): { term: string; count: number }[] {
  const missing: { term: string; count: number }[] = [];

  allFrequencies.forEach((count, term) => {
    // Term not in lemmas and appears frequently
    if (!existingLemmas[term] && count >= minFrequency) {
      missing.push({ term, count });
    }
  });

  return missing.sort((a, b) => b.count - a.count);
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Find potential typos by comparing words to existing lemmas
 */
function findTypoSuggestions(
  allFrequencies: Map<string, number>,
  existingLemmas: Record<string, unknown>,
  maxDistance: number = 1
): { word: string; suggestion: string; count: number; distance: number }[] {
  const typos: { word: string; suggestion: string; count: number; distance: number }[] = [];
  const lemmaKeys = Object.keys(existingLemmas);

  allFrequencies.forEach((count, word) => {
    // Only check words NOT in lemmas
    if (existingLemmas[word]) return;

    // Check against all lemma keys
    for (const lemma of lemmaKeys) {
      const distance = levenshteinDistance(word, lemma);
      // Only consider close matches (1 edit away) and words > 3 chars
      if (distance > 0 && distance <= maxDistance && word.length > 3) {
        typos.push({ word, suggestion: lemma, count, distance });
        break; // Only first match per word
      }
    }
  });

  return typos.sort((a, b) => b.count - a.count);
}

interface AnalysisResults {
  totalWines: number;
  smellTermFrequency: [string, number][];
  tasteTermFrequency: [string, number][];
  colorTermFrequency: [string, number][];
  missingTerms: { term: string; count: number }[];
  typoSuggestions: { word: string; suggestion: string; count: number; distance: number }[];
  summary: {
    totalWines: number;
    uniqueSmellTerms: number;
    uniqueTasteTerms: number;
    termsInLemmas: number;
    termsNotInLemmas: number;
    potentialTypos: number;
    coveragePercent: number;
  };
  analyzedAt: string;
}

/**
 * Main execution function
 */
async function main() {
  try {
    // Fetch all wines
    const wines = await fetchAllWines();
    console.log(`\nTotal wines fetched: ${wines.length}`);

    // Analyze frequency for each field
    console.log('\nAnalyzing term frequencies...');
    const smellFreq = analyzeFrequency(wines.map(w => w.smell));
    const tasteFreq = analyzeFrequency(wines.map(w => w.taste));
    const colorFreq = analyzeFrequency(wines.map(w => w.color));

    // Convert Maps to sorted arrays
    const smellTerms = Array.from(smellFreq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 100);

    const tasteTerms = Array.from(tasteFreq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 100);

    const colorTerms = Array.from(colorFreq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 50);

    // Combine smell and taste frequencies into allTerms Map
    const allTerms = new Map<string, number>();
    smellFreq.forEach((count, term) => {
      allTerms.set(term, (allTerms.get(term) || 0) + count);
    });
    tasteFreq.forEach((count, term) => {
      allTerms.set(term, (allTerms.get(term) || 0) + count);
    });

    // Find missing terms
    const missingTerms = findMissingTerms(allTerms, norwegianLemmas, 3);
    console.log(`\nFound ${missingTerms.length} missing terms (appearing 3+ times)`);

    // Find typo suggestions
    const typoSuggestions = findTypoSuggestions(allTerms, norwegianLemmas, 1);
    console.log(`Found ${typoSuggestions.length} potential typos (edit distance 1)`);

    // Calculate coverage statistics
    let termsInLemmas = 0;
    let termsNotInLemmas = 0;

    allTerms.forEach((count, term) => {
      if (norwegianLemmas[term]) {
        termsInLemmas++;
      } else {
        termsNotInLemmas++;
      }
    });

    const totalUniqueTerms = termsInLemmas + termsNotInLemmas;
    const coveragePercent = (termsInLemmas / totalUniqueTerms) * 100;

    // Build results object
    const results: AnalysisResults = {
      totalWines: wines.length,
      smellTermFrequency: smellTerms,
      tasteTermFrequency: tasteTerms,
      colorTermFrequency: colorTerms,
      missingTerms: missingTerms,
      typoSuggestions: typoSuggestions,
      summary: {
        totalWines: wines.length,
        uniqueSmellTerms: smellFreq.size,
        uniqueTasteTerms: tasteFreq.size,
        termsInLemmas: termsInLemmas,
        termsNotInLemmas: termsNotInLemmas,
        potentialTypos: typoSuggestions.length,
        coveragePercent: Math.round(coveragePercent * 100) / 100
      },
      analyzedAt: new Date().toISOString()
    };

    // Export to JSON
    await writeFile(
      'wine-vocabulary-analysis.json',
      JSON.stringify(results, null, 2),
      'utf-8'
    );

    // Console output
    console.log('\n=== ANALYSIS SUMMARY ===');
    console.log(`Total wines analyzed: ${results.summary.totalWines}`);
    console.log(`Unique smell terms: ${results.summary.uniqueSmellTerms}`);
    console.log(`Unique taste terms: ${results.summary.uniqueTasteTerms}`);

    console.log('\n=== LEMMA COVERAGE ===');
    console.log(`Terms in dictionary: ${results.summary.termsInLemmas} (${results.summary.coveragePercent}%)`);
    console.log(`Terms missing: ${results.summary.termsNotInLemmas}`);
    console.log(`Potential typos: ${results.summary.potentialTypos}`);

    console.log('\n=== TOP 10 MISSING TERMS (add to lemmas) ===');
    missingTerms.slice(0, 10).forEach(({ term, count }, index) => {
      console.log(`${index + 1}. ${term}: ${count} occurrences`);
    });

    console.log('\n=== TOP 5 LIKELY TYPOS (fix in lemmas) ===');
    typoSuggestions.slice(0, 5).forEach(({ word, suggestion, count }, index) => {
      console.log(`${index + 1}. "${word}" -> "${suggestion}" (${count} occurrences)`);
    });

    console.log('\n✓ Analysis complete!');
    console.log(`Full results saved to wine-vocabulary-analysis.json`);

  } catch (error) {
    console.error('Error during analysis:', error);
    throw error;
  }
}

// Execute
main().catch(console.error);
