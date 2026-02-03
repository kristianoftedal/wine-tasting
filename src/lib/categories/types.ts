// Main categories aligned with Vinmonopolet aromahjul
export type MainCategory = 'Frukt' | 'Krydder' | 'Urter' | 'Blomster' | 'Eik/fat' | 'Mineral';

// Subcategories per main category (use 'annet' as catch-all)
export type FruktSubcategory = 'baer' | 'sitrus' | 'steinfrukt' | 'tropisk' | 'toerket' | 'annet';
export type KrydderSubcategory = 'soet' | 'varm' | 'annet';
export type UrterSubcategory = 'groenn' | 'toerket' | 'annet';
export type BlomsterSubcategory = 'annet';
export type EikSubcategory = 'fatlagring' | 'ristet' | 'annet';
export type MineralSubcategory = 'stein' | 'annet';

// Generic structure categories (separate from aroma categories)
export type GenericCategory = 'structure' | 'quality' | 'finish' | 'body' | 'acidity' | 'sweetness' | 'texture';

// Combined subcategory type
export type WineSubcategory =
  | FruktSubcategory
  | KrydderSubcategory
  | UrterSubcategory
  | BlomsterSubcategory
  | EikSubcategory
  | MineralSubcategory
  | GenericCategory;

// Category path for hierarchical lookups
export interface CategoryPath {
  main: MainCategory | 'GENERIC';
  sub: WineSubcategory;
}

// V2 lemma data with hierarchical categories
export interface LemmaDataV2 {
  lemma: string;
  weight: number;
  category: CategoryPath;
  abstraction: 'generic' | 'specific';
}

// Subcategory data structure
export interface SubcategoryData {
  terms: readonly string[];
  weight: number;
}
