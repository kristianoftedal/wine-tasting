// Import hierarchical category types
import { CategoryPath, MainCategory, WineSubcategory, LemmaDataV2 } from './categories';

// Type definitions
/** @deprecated Use CategoryPath instead - flat categories being phased out */
export type WineCategory =
  | 'struktur'
  | 'kvalitet'
  | 'ettersmak'
  | 'fylde'
  | 'friskhet'
  | 'sødme'
  | 'bær'
  | 'sitrus'
  | 'steinfrukt'
  | 'frukt'
  | 'moden-frukt'
  | 'krydder'
  | 'eik'
  | 'mineral'
  | 'blomst'
  | 'urt'
  | 'annet'
  | 'tekstur'
  | 'generell'
  | 'ukjent';

export type LemmaData = {
  lemma: string;
  weight: number;
  category: WineCategory;  // Keep for backwards compat
  categoryPath?: CategoryPath;  // New hierarchical path
};

export type LemmatizedWord = {
  original: string;
  lemma: string;
  weight: number;
  category: WineCategory;
};

export type TextAnalysis = {
  lemmatized: LemmatizedWord[];
  categories: Record<string, number>;
  weightSum: number;
};

export type CommonLemma = {
  lemma: string;
  weight1: number;
  weight2: number;
};

export type AnalysisResult = {
  data1: TextAnalysis;
  data2: TextAnalysis;
  similarity: number;
  commonLemmas: CommonLemma[];
};

export const norwegianLemmas: Record<string, LemmaData> = {
  // STRUKTUR OG KVALITET (GENERIC - lav vekt 0.8x) - Weight inversion: generic = easy to guess
  balansert: { lemma: 'balanse', weight: 0.8, category: 'struktur', categoryPath: { main: 'GENERIC', sub: 'structure' } },
  balanserte: { lemma: 'balanse', weight: 0.8, category: 'struktur', categoryPath: { main: 'GENERIC', sub: 'structure' } },
  balanse: { lemma: 'balanse', weight: 0.8, category: 'struktur', categoryPath: { main: 'GENERIC', sub: 'structure' } },
  strukturert: { lemma: 'struktur', weight: 0.8, category: 'struktur', categoryPath: { main: 'GENERIC', sub: 'structure' } },
  struktur: { lemma: 'struktur', weight: 0.8, category: 'struktur', categoryPath: { main: 'GENERIC', sub: 'structure' } },
  tanniner: { lemma: 'tannin', weight: 0.8, category: 'struktur', categoryPath: { main: 'GENERIC', sub: 'structure' } },
  tannin: { lemma: 'tannin', weight: 0.8, category: 'struktur', categoryPath: { main: 'GENERIC', sub: 'structure' } },
  tanninene: { lemma: 'tannin', weight: 0.8, category: 'struktur', categoryPath: { main: 'GENERIC', sub: 'structure' } },
  garvestoffer: { lemma: 'tannin', weight: 0.8, category: 'struktur', categoryPath: { main: 'GENERIC', sub: 'structure' } },
  garvestoffene: { lemma: 'tannin', weight: 0.8, category: 'struktur', categoryPath: { main: 'GENERIC', sub: 'structure' } },
  snerper: { lemma: 'snerp', weight: 0.8, category: 'struktur', categoryPath: { main: 'GENERIC', sub: 'structure' } },
  snerpende: { lemma: 'snerp', weight: 0.8, category: 'struktur', categoryPath: { main: 'GENERIC', sub: 'structure' } },
  snerp: { lemma: 'snerp', weight: 0.8, category: 'struktur', categoryPath: { main: 'GENERIC', sub: 'structure' } },
  konsentrasjon: { lemma: 'konsentrasjon', weight: 0.8, category: 'kvalitet', categoryPath: { main: 'GENERIC', sub: 'quality' } },
  konsentrert: { lemma: 'konsentrasjon', weight: 0.8, category: 'kvalitet', categoryPath: { main: 'GENERIC', sub: 'quality' } },
  dybde: { lemma: 'dybde', weight: 0.8, category: 'kvalitet', categoryPath: { main: 'GENERIC', sub: 'quality' } },
  dyp: { lemma: 'dyp', weight: 0.8, category: 'kvalitet', categoryPath: { main: 'GENERIC', sub: 'quality' } },
  kompleks: { lemma: 'kompleks', weight: 0.8, category: 'kvalitet', categoryPath: { main: 'GENERIC', sub: 'quality' } },
  komplekse: { lemma: 'kompleks', weight: 0.8, category: 'kvalitet', categoryPath: { main: 'GENERIC', sub: 'quality' } },
  kompleksitet: { lemma: 'kompleks', weight: 0.8, category: 'kvalitet', categoryPath: { main: 'GENERIC', sub: 'quality' } },
  sammensatt: { lemma: 'sammensatt', weight: 0.8, category: 'kvalitet', categoryPath: { main: 'GENERIC', sub: 'quality' } },
  elegant: { lemma: 'elegant', weight: 0.8, category: 'kvalitet', categoryPath: { main: 'GENERIC', sub: 'quality' } },
  elegante: { lemma: 'elegant', weight: 0.8, category: 'kvalitet', categoryPath: { main: 'GENERIC', sub: 'quality' } },

  // AVSLUTNING/ETTERSMAK (GENERIC - lav vekt 0.8x)
  ettersmak: { lemma: 'ettersmak', weight: 0.8, category: 'ettersmak', categoryPath: { main: 'GENERIC', sub: 'finish' } },
  avslutning: { lemma: 'avslutning', weight: 0.8, category: 'ettersmak', categoryPath: { main: 'GENERIC', sub: 'finish' } },
  finish: { lemma: 'finish', weight: 0.8, category: 'ettersmak', categoryPath: { main: 'GENERIC', sub: 'finish' } },
  lang: { lemma: 'lang', weight: 0.8, category: 'ettersmak', categoryPath: { main: 'GENERIC', sub: 'finish' } },
  langvarig: { lemma: 'lang', weight: 0.8, category: 'ettersmak', categoryPath: { main: 'GENERIC', sub: 'finish' } },
  lange: { lemma: 'lang', weight: 0.8, category: 'ettersmak', categoryPath: { main: 'GENERIC', sub: 'finish' } },
  lengde: { lemma: 'lengde', weight: 0.8, category: 'ettersmak', categoryPath: { main: 'GENERIC', sub: 'finish' } },

  // FYLDE (GENERIC - lav vekt 0.8x)
  fylde: { lemma: 'fylde', weight: 0.8, category: 'fylde', categoryPath: { main: 'GENERIC', sub: 'body' } },
  fyldig: { lemma: 'fyldig', weight: 0.8, category: 'fylde', categoryPath: { main: 'GENERIC', sub: 'body' } },
  fyldige: { lemma: 'fyldig', weight: 0.8, category: 'fylde', categoryPath: { main: 'GENERIC', sub: 'body' } },
  fyldighetene: { lemma: 'fylde', weight: 0.8, category: 'fylde', categoryPath: { main: 'GENERIC', sub: 'body' } },
  kropp: { lemma: 'kropp', weight: 0.8, category: 'fylde', categoryPath: { main: 'GENERIC', sub: 'body' } },
  kroppen: { lemma: 'kropp', weight: 0.8, category: 'fylde', categoryPath: { main: 'GENERIC', sub: 'body' } },
  rik: { lemma: 'rik', weight: 0.8, category: 'fylde', categoryPath: { main: 'GENERIC', sub: 'body' } },
  rikt: { lemma: 'rik', weight: 0.8, category: 'fylde', categoryPath: { main: 'GENERIC', sub: 'body' } },
  rike: { lemma: 'rik', weight: 0.8, category: 'fylde', categoryPath: { main: 'GENERIC', sub: 'body' } },
  rikhet: { lemma: 'rik', weight: 0.8, category: 'fylde', categoryPath: { main: 'GENERIC', sub: 'body' } },
  intens: { lemma: 'intens', weight: 0.8, category: 'fylde', categoryPath: { main: 'GENERIC', sub: 'body' } },
  intense: { lemma: 'intens', weight: 0.8, category: 'fylde', categoryPath: { main: 'GENERIC', sub: 'body' } },

  // FRISKHET/SYRE (GENERIC - lav vekt 0.8x)
  friskhet: { lemma: 'frisk', weight: 0.8, category: 'friskhet', categoryPath: { main: 'GENERIC', sub: 'acidity' } },
  frisk: { lemma: 'frisk', weight: 0.8, category: 'friskhet', categoryPath: { main: 'GENERIC', sub: 'acidity' } },
  friskt: { lemma: 'frisk', weight: 0.8, category: 'friskhet', categoryPath: { main: 'GENERIC', sub: 'acidity' } },
  friske: { lemma: 'frisk', weight: 0.8, category: 'friskhet', categoryPath: { main: 'GENERIC', sub: 'acidity' } },
  syre: { lemma: 'syre', weight: 0.8, category: 'friskhet', categoryPath: { main: 'GENERIC', sub: 'acidity' } },
  syren: { lemma: 'syre', weight: 0.8, category: 'friskhet', categoryPath: { main: 'GENERIC', sub: 'acidity' } },
  syrlig: { lemma: 'syre', weight: 0.8, category: 'friskhet', categoryPath: { main: 'GENERIC', sub: 'acidity' } },
  syrlige: { lemma: 'syre', weight: 0.8, category: 'friskhet', categoryPath: { main: 'GENERIC', sub: 'acidity' } },
  saftighet: { lemma: 'saftig', weight: 0.8, category: 'friskhet', categoryPath: { main: 'GENERIC', sub: 'acidity' } },
  saftig: { lemma: 'saftig', weight: 0.8, category: 'friskhet', categoryPath: { main: 'GENERIC', sub: 'acidity' } },

  // SØDME (GENERIC - lav vekt 0.8x)
  sødme: { lemma: 'søt', weight: 0.8, category: 'sødme', categoryPath: { main: 'GENERIC', sub: 'sweetness' } },
  søt: { lemma: 'søt', weight: 0.8, category: 'sødme', categoryPath: { main: 'GENERIC', sub: 'sweetness' } },
  søtt: { lemma: 'søt', weight: 0.8, category: 'sødme', categoryPath: { main: 'GENERIC', sub: 'sweetness' } },
  søte: { lemma: 'søt', weight: 0.8, category: 'sødme', categoryPath: { main: 'GENERIC', sub: 'sweetness' } },
  tørr: { lemma: 'tørr', weight: 0.8, category: 'sødme', categoryPath: { main: 'GENERIC', sub: 'sweetness' } },
  tørt: { lemma: 'tørr', weight: 0.8, category: 'sødme', categoryPath: { main: 'GENERIC', sub: 'sweetness' } },
  tørre: { lemma: 'tørr', weight: 0.8, category: 'sødme', categoryPath: { main: 'GENERIC', sub: 'sweetness' } },
  halvtørr: { lemma: 'halvtørr', weight: 0.8, category: 'sødme', categoryPath: { main: 'GENERIC', sub: 'sweetness' } },

  // BÆR (MERGED: mørke bær 1.7 + røde bær 1.5 → average 1.6x) - SPECIFIC descriptors
  solbær: { lemma: 'solbær', weight: 1.6, category: 'bær', categoryPath: { main: 'Frukt', sub: 'baer' } },
  bjørnebær: { lemma: 'bjørnebær', weight: 1.6, category: 'bær', categoryPath: { main: 'Frukt', sub: 'baer' } },
  blåbær: { lemma: 'blåbær', weight: 1.6, category: 'bær', categoryPath: { main: 'Frukt', sub: 'baer' } },
  moreller: { lemma: 'morell', weight: 1.6, category: 'bær', categoryPath: { main: 'Frukt', sub: 'baer' } },
  morell: { lemma: 'morell', weight: 1.6, category: 'bær', categoryPath: { main: 'Frukt', sub: 'baer' } },
  kirsebær: { lemma: 'kirsebær', weight: 1.6, category: 'bær', categoryPath: { main: 'Frukt', sub: 'baer' } },
  jordbær: { lemma: 'jordbær', weight: 1.6, category: 'bær', categoryPath: { main: 'Frukt', sub: 'baer' } },
  bringebær: { lemma: 'bringebær', weight: 1.6, category: 'bær', categoryPath: { main: 'Frukt', sub: 'baer' } },
  rips: { lemma: 'rips', weight: 1.6, category: 'bær', categoryPath: { main: 'Frukt', sub: 'baer' } },

  // SITRUS (medium vekt - 1.5x) - SPECIFIC descriptors
  sitrus: { lemma: 'sitrus', weight: 1.5, category: 'sitrus', categoryPath: { main: 'Frukt', sub: 'sitrus' } },
  sitron: { lemma: 'sitron', weight: 1.5, category: 'sitrus', categoryPath: { main: 'Frukt', sub: 'sitrus' } },
  lime: { lemma: 'lime', weight: 1.5, category: 'sitrus', categoryPath: { main: 'Frukt', sub: 'sitrus' } },
  grapefrukt: { lemma: 'grapefrukt', weight: 1.5, category: 'sitrus', categoryPath: { main: 'Frukt', sub: 'sitrus' } },

  // STEINFRUKTER (medium vekt - 1.5x) - SPECIFIC descriptors
  plomme: { lemma: 'plomme', weight: 1.5, category: 'steinfrukt', categoryPath: { main: 'Frukt', sub: 'steinfrukt' } },
  plommer: { lemma: 'plomme', weight: 1.5, category: 'steinfrukt', categoryPath: { main: 'Frukt', sub: 'steinfrukt' } },
  fersken: { lemma: 'fersken', weight: 1.5, category: 'steinfrukt', categoryPath: { main: 'Frukt', sub: 'steinfrukt' } },
  aprikos: { lemma: 'aprikos', weight: 1.5, category: 'steinfrukt', categoryPath: { main: 'Frukt', sub: 'steinfrukt' } },

  // ANNEN FRUKT (medium vekt - 1.4x) - SPECIFIC descriptors
  eple: { lemma: 'eple', weight: 1.4, category: 'frukt', categoryPath: { main: 'Frukt', sub: 'annet' } },
  epler: { lemma: 'eple', weight: 1.4, category: 'frukt', categoryPath: { main: 'Frukt', sub: 'annet' } },
  eplet: { lemma: 'eple', weight: 1.4, category: 'frukt', categoryPath: { main: 'Frukt', sub: 'annet' } },
  pære: { lemma: 'pære', weight: 1.4, category: 'frukt', categoryPath: { main: 'Frukt', sub: 'annet' } },
  pærer: { lemma: 'pære', weight: 1.4, category: 'frukt', categoryPath: { main: 'Frukt', sub: 'annet' } },
  tropisk: { lemma: 'tropisk', weight: 1.4, category: 'frukt', categoryPath: { main: 'Frukt', sub: 'tropisk' } },
  tropiske: { lemma: 'tropisk', weight: 1.4, category: 'frukt', categoryPath: { main: 'Frukt', sub: 'tropisk' } },
  mango: { lemma: 'mango', weight: 1.4, category: 'frukt', categoryPath: { main: 'Frukt', sub: 'tropisk' } },
  ananas: { lemma: 'ananas', weight: 1.4, category: 'frukt', categoryPath: { main: 'Frukt', sub: 'tropisk' } },
  melon: { lemma: 'melon', weight: 1.4, category: 'frukt', categoryPath: { main: 'Frukt', sub: 'tropisk' } },

  // MODNE/TØRKEDE FRUKTER (medium vekt - 1.6x) - SPECIFIC descriptors
  moden: { lemma: 'moden', weight: 1.6, category: 'moden-frukt', categoryPath: { main: 'Frukt', sub: 'toerket' } },
  modne: { lemma: 'moden', weight: 1.6, category: 'moden-frukt', categoryPath: { main: 'Frukt', sub: 'toerket' } },
  tørket: { lemma: 'tørket', weight: 1.6, category: 'moden-frukt', categoryPath: { main: 'Frukt', sub: 'toerket' } },
  tørkede: { lemma: 'tørket', weight: 1.6, category: 'moden-frukt', categoryPath: { main: 'Frukt', sub: 'toerket' } },
  svisker: { lemma: 'sviske', weight: 1.6, category: 'moden-frukt', categoryPath: { main: 'Frukt', sub: 'toerket' } },
  sviske: { lemma: 'sviske', weight: 1.6, category: 'moden-frukt', categoryPath: { main: 'Frukt', sub: 'toerket' } },
  fiken: { lemma: 'fiken', weight: 1.6, category: 'moden-frukt', categoryPath: { main: 'Frukt', sub: 'toerket' } },
  dadler: { lemma: 'daddel', weight: 1.6, category: 'moden-frukt', categoryPath: { main: 'Frukt', sub: 'toerket' } },
  daddel: { lemma: 'daddel', weight: 1.6, category: 'moden-frukt', categoryPath: { main: 'Frukt', sub: 'toerket' } },
  rosiner: { lemma: 'rosin', weight: 1.6, category: 'moden-frukt', categoryPath: { main: 'Frukt', sub: 'toerket' } },
  rosin: { lemma: 'rosin', weight: 1.6, category: 'moden-frukt', categoryPath: { main: 'Frukt', sub: 'toerket' } },

  // KRYDDER (medium-høy vekt - 1.7x) - SPECIFIC descriptors
  krydder: { lemma: 'krydder', weight: 1.7, category: 'krydder', categoryPath: { main: 'Krydder', sub: 'annet' } },
  krydrete: { lemma: 'krydder', weight: 1.7, category: 'krydder', categoryPath: { main: 'Krydder', sub: 'annet' } },
  pepper: { lemma: 'pepper', weight: 1.7, category: 'krydder', categoryPath: { main: 'Krydder', sub: 'varm' } },
  nellik: { lemma: 'nellik', weight: 1.7, category: 'krydder', categoryPath: { main: 'Krydder', sub: 'varm' } },
  kanel: { lemma: 'kanel', weight: 1.7, category: 'krydder', categoryPath: { main: 'Krydder', sub: 'soet' } },
  anis: { lemma: 'anis', weight: 1.7, category: 'krydder', categoryPath: { main: 'Krydder', sub: 'annet' } },

  // EIK/FAT (medium-høy vekt - 1.8x) - SPECIFIC descriptors
  eik: { lemma: 'eik', weight: 1.8, category: 'eik', categoryPath: { main: 'Eik/fat', sub: 'fatlagring' } },
  eiken: { lemma: 'eik', weight: 1.8, category: 'eik', categoryPath: { main: 'Eik/fat', sub: 'fatlagring' } },
  fat: { lemma: 'fat', weight: 1.8, category: 'eik', categoryPath: { main: 'Eik/fat', sub: 'fatlagring' } },
  fatet: { lemma: 'fat', weight: 1.8, category: 'eik', categoryPath: { main: 'Eik/fat', sub: 'fatlagring' } },
  fatpreg: { lemma: 'fatpreg', weight: 1.8, category: 'eik', categoryPath: { main: 'Eik/fat', sub: 'fatlagring' } },
  fatlagret: { lemma: 'fatlagret', weight: 1.8, category: 'eik', categoryPath: { main: 'Eik/fat', sub: 'fatlagring' } },
  vanilje: { lemma: 'vanilje', weight: 1.8, category: 'eik', categoryPath: { main: 'Krydder', sub: 'soet' } },
  toast: { lemma: 'toast', weight: 1.8, category: 'eik', categoryPath: { main: 'Eik/fat', sub: 'ristet' } },
  ristet: { lemma: 'ristet', weight: 1.8, category: 'eik', categoryPath: { main: 'Eik/fat', sub: 'ristet' } },
  ristede: { lemma: 'ristet', weight: 1.8, category: 'eik', categoryPath: { main: 'Eik/fat', sub: 'ristet' } },

  // MINERALITET (medium vekt - 1.5x) - SPECIFIC descriptors
  mineralsk: { lemma: 'mineral', weight: 1.5, category: 'mineral', categoryPath: { main: 'Mineral', sub: 'stein' } },
  mineralske: { lemma: 'mineral', weight: 1.5, category: 'mineral', categoryPath: { main: 'Mineral', sub: 'stein' } },
  mineralitet: { lemma: 'mineral', weight: 1.5, category: 'mineral', categoryPath: { main: 'Mineral', sub: 'stein' } },
  mineraler: { lemma: 'mineral', weight: 1.5, category: 'mineral', categoryPath: { main: 'Mineral', sub: 'stein' } },
  stein: { lemma: 'stein', weight: 1.5, category: 'mineral', categoryPath: { main: 'Mineral', sub: 'stein' } },
  steinet: { lemma: 'stein', weight: 1.5, category: 'mineral', categoryPath: { main: 'Mineral', sub: 'stein' } },
  flint: { lemma: 'flint', weight: 1.5, category: 'mineral', categoryPath: { main: 'Mineral', sub: 'stein' } },

  // BLOMSTER (medium vekt - 1.3x) - SPECIFIC descriptors
  blomster: { lemma: 'blomst', weight: 1.3, category: 'blomst', categoryPath: { main: 'Blomster', sub: 'annet' } },
  blomsten: { lemma: 'blomst', weight: 1.3, category: 'blomst', categoryPath: { main: 'Blomster', sub: 'annet' } },
  blomsteret: { lemma: 'blomst', weight: 1.3, category: 'blomst', categoryPath: { main: 'Blomster', sub: 'annet' } },
  blomstrete: { lemma: 'blomst', weight: 1.3, category: 'blomst', categoryPath: { main: 'Blomster', sub: 'annet' } },
  blomsterpreget: { lemma: 'blomst', weight: 1.3, category: 'blomst', categoryPath: { main: 'Blomster', sub: 'annet' } },
  roser: { lemma: 'rose', weight: 1.3, category: 'blomst', categoryPath: { main: 'Blomster', sub: 'annet' } },
  rose: { lemma: 'rose', weight: 1.3, category: 'blomst', categoryPath: { main: 'Blomster', sub: 'annet' } },
  fioler: { lemma: 'fiol', weight: 1.3, category: 'blomst', categoryPath: { main: 'Blomster', sub: 'annet' } },
  fiol: { lemma: 'fiol', weight: 1.3, category: 'blomst', categoryPath: { main: 'Blomster', sub: 'annet' } },

  // URTER (medium vekt - 1.3x) - SPECIFIC descriptors
  urter: { lemma: 'urt', weight: 1.3, category: 'urt', categoryPath: { main: 'Urter', sub: 'groenn' } },
  urtete: { lemma: 'urt', weight: 1.3, category: 'urt', categoryPath: { main: 'Urter', sub: 'groenn' } },
  urtepreg: { lemma: 'urt', weight: 1.3, category: 'urt', categoryPath: { main: 'Urter', sub: 'groenn' } },
  gress: { lemma: 'gress', weight: 1.3, category: 'urt', categoryPath: { main: 'Urter', sub: 'groenn' } },
  gressete: { lemma: 'gress', weight: 1.3, category: 'urt', categoryPath: { main: 'Urter', sub: 'groenn' } },
  timian: { lemma: 'timian', weight: 1.3, category: 'urt', categoryPath: { main: 'Urter', sub: 'groenn' } },
  rosmarin: { lemma: 'rosmarin', weight: 1.3, category: 'urt', categoryPath: { main: 'Urter', sub: 'groenn' } },
  laurbær: { lemma: 'laurbær', weight: 1.3, category: 'urt', categoryPath: { main: 'Urter', sub: 'groenn' } },
  salvie: { lemma: 'salvie', weight: 1.3, category: 'urt', categoryPath: { main: 'Urter', sub: 'groenn' } },
  mynte: { lemma: 'mynte', weight: 1.3, category: 'urt', categoryPath: { main: 'Urter', sub: 'annet' } },
  eukalyptus: { lemma: 'eukalyptus', weight: 1.3, category: 'urt', categoryPath: { main: 'Urter', sub: 'annet' } },

  // ANDRE AROMAER (medium vekt - 1.4x) - SPECIFIC descriptors
  nøtter: { lemma: 'nøtt', weight: 1.4, category: 'annet', categoryPath: { main: 'Eik/fat', sub: 'annet' } },
  nøtt: { lemma: 'nøtt', weight: 1.4, category: 'annet', categoryPath: { main: 'Eik/fat', sub: 'annet' } },
  kaffe: { lemma: 'kaffe', weight: 1.4, category: 'annet', categoryPath: { main: 'Eik/fat', sub: 'annet' } },
  sjokolade: { lemma: 'sjokolade', weight: 1.4, category: 'annet', categoryPath: { main: 'Eik/fat', sub: 'annet' } },
  lakris: { lemma: 'lakris', weight: 1.4, category: 'annet', categoryPath: { main: 'Krydder', sub: 'annet' } },
  honning: { lemma: 'honning', weight: 1.4, category: 'annet', categoryPath: { main: 'Eik/fat', sub: 'annet' } },
  karamell: { lemma: 'karamell', weight: 1.4, category: 'annet', categoryPath: { main: 'Eik/fat', sub: 'annet' } },
  smør: { lemma: 'smør', weight: 1.4, category: 'annet', categoryPath: { main: 'Eik/fat', sub: 'annet' } },
  kjeks: { lemma: 'kjeks', weight: 1.4, category: 'annet', categoryPath: { main: 'Eik/fat', sub: 'annet' } },
  brød: { lemma: 'brød', weight: 1.4, category: 'annet', categoryPath: { main: 'Eik/fat', sub: 'annet' } },
  brøddeig: { lemma: 'brøddeig', weight: 1.4, category: 'annet', categoryPath: { main: 'Eik/fat', sub: 'annet' } },
  brioche: { lemma: 'brioche', weight: 1.4, category: 'annet', categoryPath: { main: 'Eik/fat', sub: 'annet' } },
  tjære: { lemma: 'tjære', weight: 1.4, category: 'annet', categoryPath: { main: 'Eik/fat', sub: 'annet' } },
  tobakk: { lemma: 'tobakk', weight: 1.4, category: 'annet', categoryPath: { main: 'Eik/fat', sub: 'annet' } },
  lær: { lemma: 'lær', weight: 1.4, category: 'annet', categoryPath: { main: 'Eik/fat', sub: 'annet' } },

  // TEKSTUR/MUNNFØLELSE (GENERIC - lav vekt 0.8x)
  myk: { lemma: 'myk', weight: 0.8, category: 'tekstur', categoryPath: { main: 'GENERIC', sub: 'texture' } },
  myke: { lemma: 'myk', weight: 0.8, category: 'tekstur', categoryPath: { main: 'GENERIC', sub: 'texture' } },
  mykhet: { lemma: 'myk', weight: 0.8, category: 'tekstur', categoryPath: { main: 'GENERIC', sub: 'texture' } },
  rund: { lemma: 'rund', weight: 0.8, category: 'tekstur', categoryPath: { main: 'GENERIC', sub: 'texture' } },
  runde: { lemma: 'rund', weight: 0.8, category: 'tekstur', categoryPath: { main: 'GENERIC', sub: 'texture' } },
  bløt: { lemma: 'bløt', weight: 0.8, category: 'tekstur', categoryPath: { main: 'GENERIC', sub: 'texture' } },
  bløte: { lemma: 'bløt', weight: 0.8, category: 'tekstur', categoryPath: { main: 'GENERIC', sub: 'texture' } },
  silkemyk: { lemma: 'silkemyk', weight: 0.8, category: 'tekstur', categoryPath: { main: 'GENERIC', sub: 'texture' } },
  kremaktig: { lemma: 'kremaktig', weight: 0.8, category: 'tekstur', categoryPath: { main: 'GENERIC', sub: 'texture' } },
  fast: { lemma: 'fast', weight: 0.8, category: 'tekstur', categoryPath: { main: 'GENERIC', sub: 'texture' } },
  faste: { lemma: 'fast', weight: 0.8, category: 'tekstur', categoryPath: { main: 'GENERIC', sub: 'texture' } },
  fasthet: { lemma: 'fast', weight: 0.8, category: 'tekstur', categoryPath: { main: 'GENERIC', sub: 'texture' } },

  // GENERELLE DESKRIPTORER (GENERIC - lav vekt 0.8x)
  god: { lemma: 'god', weight: 0.8, category: 'generell', categoryPath: { main: 'GENERIC', sub: 'general' } },
  godt: { lemma: 'god', weight: 0.8, category: 'generell', categoryPath: { main: 'GENERIC', sub: 'general' } },
  gode: { lemma: 'god', weight: 0.8, category: 'generell', categoryPath: { main: 'GENERIC', sub: 'general' } },
  fin: { lemma: 'fin', weight: 0.8, category: 'generell', categoryPath: { main: 'GENERIC', sub: 'general' } },
  fint: { lemma: 'fin', weight: 0.8, category: 'generell', categoryPath: { main: 'GENERIC', sub: 'general' } },
  fine: { lemma: 'fin', weight: 0.8, category: 'generell', categoryPath: { main: 'GENERIC', sub: 'general' } },
  pen: { lemma: 'pen', weight: 0.8, category: 'generell', categoryPath: { main: 'GENERIC', sub: 'general' } },
  pent: { lemma: 'pen', weight: 0.8, category: 'generell', categoryPath: { main: 'GENERIC', sub: 'general' } },
  pene: { lemma: 'pen', weight: 0.8, category: 'generell', categoryPath: { main: 'GENERIC', sub: 'general' } },
  behagelig: { lemma: 'behagelig', weight: 0.8, category: 'generell', categoryPath: { main: 'GENERIC', sub: 'general' } },
  tiltalende: { lemma: 'tiltalende', weight: 0.8, category: 'generell', categoryPath: { main: 'GENERIC', sub: 'general' } }
};

export const stopwords = new Set([
  'og',
  'i',
  'av',
  'med',
  'en',
  'et',
  'er',
  'som',
  'på',
  'til',
  'har',
  'den',
  'det',
  'de',
  'om',
  'for',
  'kan',
  'var',
  'meg',
  'seg',
  'han',
  'hun',
  'dette',
  'eller',
  'men',
  'fra',
  'ved',
  'da',
  'hvis',
  'nå',
  'denne',
  'dette',
  'ikke',
  'bare',
  'også',
  'mer',
  'meget',
  'noe',
  'inn',
  'har',
  'innslag',
  'preg',
  'tydelig',
  'lett',
  'litt',
  'noe',
  'mye'
]);

export const lemmatizeAndWeight = (text: string): TextAnalysis => {
  const words: string[] = text
    .toLowerCase()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, '')
    .split(/\s+/)
    .filter(word => word.length > 0 && !stopwords.has(word));

  const lemmatized: LemmatizedWord[] = [];
  const categories: Record<string, number> = {};
  let weightSum: number = 0;

  words.forEach(word => {
    const lemmaData: LemmaData | undefined = norwegianLemmas[word];
    if (lemmaData) {
      lemmatized.push({
        original: word,
        lemma: lemmaData.lemma,
        weight: lemmaData.weight,
        category: lemmaData.category
      });

      categories[lemmaData.category] = (categories[lemmaData.category] || 0) + 1;
      weightSum += lemmaData.weight;
    } else {
      lemmatized.push({
        original: word,
        lemma: word,
        weight: 1.0,
        category: 'ukjent'
      });
      weightSum += 1.0;
    }
  });

  return { lemmatized, categories, weightSum };
};

const calculateWeightedSimilarity = (
  text1Data: TextAnalysis,
  text2Data: TextAnalysis
): { similarity: number; commonLemmas: CommonLemma[] } => {
  const lemmas1 = new Map<string, number>();
  const lemmas2 = new Map<string, number>();

  text1Data.lemmatized.forEach(item => {
    lemmas1.set(item.lemma, (lemmas1.get(item.lemma) || 0) + item.weight);
  });

  text2Data.lemmatized.forEach(item => {
    lemmas2.set(item.lemma, (lemmas2.get(item.lemma) || 0) + item.weight);
  });

  const allLemmas: Set<string> = new Set([...lemmas1.keys(), ...lemmas2.keys()]);

  let dotProduct: number = 0;
  let magnitude1: number = 0;
  let magnitude2: number = 0;

  allLemmas.forEach(lemma => {
    const val1: number = lemmas1.get(lemma) || 0;
    const val2: number = lemmas2.get(lemma) || 0;

    dotProduct += val1 * val2;
    magnitude1 += val1 * val1;
    magnitude2 += val2 * val2;
  });

  const similarity: number =
    magnitude1 === 0 || magnitude2 === 0 ? 0 : dotProduct / (Math.sqrt(magnitude1) * Math.sqrt(magnitude2));

  return { similarity, commonLemmas: findCommonLemmas(lemmas1, lemmas2) };
};

const findCommonLemmas = (lemmas1: Map<string, number>, lemmas2: Map<string, number>): CommonLemma[] => {
  const common: CommonLemma[] = [];
  lemmas1.forEach((weight1, lemma) => {
    const weight2: number | undefined = lemmas2.get(lemma);
    if (weight2 !== undefined) {
      common.push({ lemma, weight1, weight2 });
    }
  });
  return common.sort((a, b) => b.weight1 + b.weight2 - (a.weight1 + a.weight2));
};

export const analyze = (text1: string, text2: string) => {
  if (!text1.trim() || !text2.trim()) {
    alert('Vennligst fyll inn begge tekstfeltene');
    return;
  }

  const data1 = lemmatizeAndWeight(text1);
  const data2 = lemmatizeAndWeight(text2);
  const { similarity, commonLemmas } = calculateWeightedSimilarity(data1, data2);

  return {
    data1,
    data2,
    similarity,
    commonLemmas
  };
};
