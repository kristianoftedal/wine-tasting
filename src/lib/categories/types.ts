// Main categories aligned with flavor wheel (red-flavor.json + white-flavor.json)
export type MainCategory =
  | 'Frukt og bær'
  | 'Krydder'
  | 'Urter'
  | 'Blomst'
  | 'Treverk'
  | 'Karamellisert'
  | 'Nøtter'
  | 'Jordaktig'
  | 'Animalsk'
  | 'Grønnsaker';

export type WineSubcategory =
  // Frukt og bær
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
  // Jordaktig
  | 'stein'
  | 'jord'
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

export interface CategoryPath {
  main: MainCategory | 'GENERIC';
  sub: WineSubcategory;
}
