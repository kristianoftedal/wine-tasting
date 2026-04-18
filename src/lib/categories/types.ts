// Main categories aligned with Vinmonopolet aromahjul
export type MainCategory = 'Frukt' | 'Krydder' | 'Urter' | 'Blomster' | 'Eik/fat' | 'Mineral';

// All valid subcategory slugs across every main category. Kept as a single flat
// union — the per-main subtypes weren't referenced anywhere and their names
// didn't prevent invalid combinations (e.g. Blomster/stein) anyway, so they
// added file surface without buying type safety.
export type WineSubcategory =
  // Frukt
  | 'baer'
  | 'sitrus'
  | 'steinfrukt'
  | 'tropisk'
  | 'toerket'
  // Krydder
  | 'soet'
  | 'varm'
  // Urter
  | 'groenn'
  // Eik/fat
  | 'fatlagring'
  | 'ristet'
  // Mineral
  | 'stein'
  // GENERIC structure subcategories
  | 'structure'
  | 'quality'
  | 'finish'
  | 'body'
  | 'acidity'
  | 'sweetness'
  | 'texture'
  | 'general'
  // Shared catch-all
  | 'annet';

// Category path for hierarchical lookups
export interface CategoryPath {
  main: MainCategory | 'GENERIC';
  sub: WineSubcategory;
}
