import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { stopwords } from '../src/lib/lemmatizeAndWeight';
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

interface AnalysisResults {
  totalWines: number;
  smellTermFrequency: [string, number][];
  tasteTermFrequency: [string, number][];
  colorTermFrequency: [string, number][];
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

    // Build results object
    const results: AnalysisResults = {
      totalWines: wines.length,
      smellTermFrequency: smellTerms,
      tasteTermFrequency: tasteTerms,
      colorTermFrequency: colorTerms,
      analyzedAt: new Date().toISOString()
    };

    // Export to JSON
    await writeFile(
      'wine-vocabulary-analysis.json',
      JSON.stringify(results, null, 2),
      'utf-8'
    );

    // Console output
    console.log('\n=== TOP 10 SMELL TERMS ===');
    smellTerms.slice(0, 10).forEach(([term, count]) => {
      console.log(`${term}: ${count}`);
    });

    console.log('\n=== TOP 10 TASTE TERMS ===');
    tasteTerms.slice(0, 10).forEach(([term, count]) => {
      console.log(`${term}: ${count}`);
    });

    console.log('\n✓ Analysis complete!');
    console.log(`Results exported to: wine-vocabulary-analysis.json`);

  } catch (error) {
    console.error('Error during analysis:', error);
    throw error;
  }
}

// Execute
main().catch(console.error);
