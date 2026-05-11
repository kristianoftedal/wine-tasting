// Import hierarchical category types
import { CategoryPath } from './categories';
// Import profile-based weight lookup
import { getCategoryWeight } from './profiles';
// Norwegian Porter Stemmer — fallback for inflected forms not in the lemma dict
import { PorterStemmerNo } from 'natural';
// Pre-computed IDF multipliers from wine corpus (floored at 1.0, so scores never decrease)
import idfWeights from './idf-weights.generated.json';

const getIdfMultiplier = (lemma: string): number =>
  (idfWeights as Record<string, number>)[lemma] ?? 1.0;

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
  category: WineCategory; // Keep for backwards compat
  categoryPath?: CategoryPath; // New hierarchical path
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
  balansert: {
    lemma: 'balanse',
    weight: 0.8,
    category: 'struktur',
    categoryPath: { main: 'GENERIC', sub: 'structure' }
  },
  balanserte: {
    lemma: 'balanse',
    weight: 0.8,
    category: 'struktur',
    categoryPath: { main: 'GENERIC', sub: 'structure' }
  },
  balanse: { lemma: 'balanse', weight: 0.8, category: 'struktur', categoryPath: { main: 'GENERIC', sub: 'structure' } },
  strukturert: {
    lemma: 'struktur',
    weight: 0.8,
    category: 'struktur',
    categoryPath: { main: 'GENERIC', sub: 'structure' }
  },
  struktur: {
    lemma: 'struktur',
    weight: 0.8,
    category: 'struktur',
    categoryPath: { main: 'GENERIC', sub: 'structure' }
  },
  tanniner: { lemma: 'tannin', weight: 0.8, category: 'struktur', categoryPath: { main: 'GENERIC', sub: 'structure' } },
  tannin: { lemma: 'tannin', weight: 0.8, category: 'struktur', categoryPath: { main: 'GENERIC', sub: 'structure' } },
  tanninene: {
    lemma: 'tannin',
    weight: 0.8,
    category: 'struktur',
    categoryPath: { main: 'GENERIC', sub: 'structure' }
  },
  garvestoffer: {
    lemma: 'tannin',
    weight: 0.8,
    category: 'struktur',
    categoryPath: { main: 'GENERIC', sub: 'structure' }
  },
  garvestoffene: {
    lemma: 'tannin',
    weight: 0.8,
    category: 'struktur',
    categoryPath: { main: 'GENERIC', sub: 'structure' }
  },
  snerper: { lemma: 'snerp', weight: 0.8, category: 'struktur', categoryPath: { main: 'GENERIC', sub: 'structure' } },
  snerpende: { lemma: 'snerp', weight: 0.8, category: 'struktur', categoryPath: { main: 'GENERIC', sub: 'structure' } },
  snerp: { lemma: 'snerp', weight: 0.8, category: 'struktur', categoryPath: { main: 'GENERIC', sub: 'structure' } },
  konsentrasjon: {
    lemma: 'konsentrasjon',
    weight: 0.8,
    category: 'kvalitet',
    categoryPath: { main: 'GENERIC', sub: 'quality' }
  },
  konsentrert: {
    lemma: 'konsentrasjon',
    weight: 0.8,
    category: 'kvalitet',
    categoryPath: { main: 'GENERIC', sub: 'quality' }
  },
  dybde: { lemma: 'dybde', weight: 0.8, category: 'kvalitet', categoryPath: { main: 'GENERIC', sub: 'quality' } },
  dyp: { lemma: 'dyp', weight: 0.8, category: 'kvalitet', categoryPath: { main: 'GENERIC', sub: 'quality' } },
  kompleks: { lemma: 'kompleks', weight: 0.8, category: 'kvalitet', categoryPath: { main: 'GENERIC', sub: 'quality' } },
  komplekse: {
    lemma: 'kompleks',
    weight: 0.8,
    category: 'kvalitet',
    categoryPath: { main: 'GENERIC', sub: 'quality' }
  },
  kompleksitet: {
    lemma: 'kompleks',
    weight: 0.8,
    category: 'kvalitet',
    categoryPath: { main: 'GENERIC', sub: 'quality' }
  },
  sammensatt: {
    lemma: 'sammensatt',
    weight: 0.8,
    category: 'kvalitet',
    categoryPath: { main: 'GENERIC', sub: 'quality' }
  },
  elegant: { lemma: 'elegant', weight: 0.8, category: 'kvalitet', categoryPath: { main: 'GENERIC', sub: 'quality' } },
  elegante: { lemma: 'elegant', weight: 0.8, category: 'kvalitet', categoryPath: { main: 'GENERIC', sub: 'quality' } },

  // AVSLUTNING/ETTERSMAK (GENERIC - lav vekt 0.8x)
  ettersmak: {
    lemma: 'ettersmak',
    weight: 0.8,
    category: 'ettersmak',
    categoryPath: { main: 'GENERIC', sub: 'finish' }
  },
  avslutning: {
    lemma: 'avslutning',
    weight: 0.8,
    category: 'ettersmak',
    categoryPath: { main: 'GENERIC', sub: 'finish' }
  },
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
  steinfrukt: { lemma: 'steinfrukt', weight: 1.5, category: 'steinfrukt', categoryPath: { main: 'Frukt', sub: 'steinfrukt' } },
  plomme: { lemma: 'plomme', weight: 1.5, category: 'steinfrukt', categoryPath: { main: 'Frukt', sub: 'steinfrukt' } },
  plommer: { lemma: 'plomme', weight: 1.5, category: 'steinfrukt', categoryPath: { main: 'Frukt', sub: 'steinfrukt' } },
  fersken: {
    lemma: 'fersken',
    weight: 1.5,
    category: 'steinfrukt',
    categoryPath: { main: 'Frukt', sub: 'steinfrukt' }
  },
  aprikos: {
    lemma: 'aprikos',
    weight: 1.5,
    category: 'steinfrukt',
    categoryPath: { main: 'Frukt', sub: 'steinfrukt' }
  },

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
  krydret: { lemma: 'krydder', weight: 1.7, category: 'krydder', categoryPath: { main: 'Krydder', sub: 'annet' } },
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
  blomsterpreget: {
    lemma: 'blomst',
    weight: 1.3,
    category: 'blomst',
    categoryPath: { main: 'Blomster', sub: 'annet' }
  },
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
  munnfølelse: { lemma: 'munnfølelse', weight: 0.8, category: 'tekstur', categoryPath: { main: 'GENERIC', sub: 'texture' } },
  myk: { lemma: 'myk', weight: 0.8, category: 'tekstur', categoryPath: { main: 'GENERIC', sub: 'texture' } },
  myke: { lemma: 'myk', weight: 0.8, category: 'tekstur', categoryPath: { main: 'GENERIC', sub: 'texture' } },
  mykhet: { lemma: 'myk', weight: 0.8, category: 'tekstur', categoryPath: { main: 'GENERIC', sub: 'texture' } },
  rund: { lemma: 'rund', weight: 0.8, category: 'tekstur', categoryPath: { main: 'GENERIC', sub: 'texture' } },
  runde: { lemma: 'rund', weight: 0.8, category: 'tekstur', categoryPath: { main: 'GENERIC', sub: 'texture' } },
  bløt: { lemma: 'bløt', weight: 0.8, category: 'tekstur', categoryPath: { main: 'GENERIC', sub: 'texture' } },
  bløte: { lemma: 'bløt', weight: 0.8, category: 'tekstur', categoryPath: { main: 'GENERIC', sub: 'texture' } },
  silkemyk: { lemma: 'silkemyk', weight: 0.8, category: 'tekstur', categoryPath: { main: 'GENERIC', sub: 'texture' } },
  kremaktig: {
    lemma: 'kremaktig',
    weight: 0.8,
    category: 'tekstur',
    categoryPath: { main: 'GENERIC', sub: 'texture' }
  },
  fast: { lemma: 'fast', weight: 0.8, category: 'tekstur', categoryPath: { main: 'GENERIC', sub: 'texture' } },
  faste: { lemma: 'fast', weight: 0.8, category: 'tekstur', categoryPath: { main: 'GENERIC', sub: 'texture' } },
  fasthet: { lemma: 'fast', weight: 0.8, category: 'tekstur', categoryPath: { main: 'GENERIC', sub: 'texture' } },

  // GENERELLE DESKRIPTORER (GENERIC - lav vekt 0.8x)
  ren: { lemma: 'ren', weight: 0.8, category: 'generell', categoryPath: { main: 'GENERIC', sub: 'general' } },
  rene: { lemma: 'ren', weight: 0.8, category: 'generell', categoryPath: { main: 'GENERIC', sub: 'general' } },
  rent: { lemma: 'ren', weight: 0.8, category: 'generell', categoryPath: { main: 'GENERIC', sub: 'general' } },
  utviklet: { lemma: 'utviklet', weight: 0.8, category: 'kvalitet', categoryPath: { main: 'GENERIC', sub: 'quality' } },
  utviklede: { lemma: 'utviklet', weight: 0.8, category: 'kvalitet', categoryPath: { main: 'GENERIC', sub: 'quality' } },
  utgang: { lemma: 'utgang', weight: 0.8, category: 'ettersmak', categoryPath: { main: 'GENERIC', sub: 'finish' } },
  god: { lemma: 'god', weight: 0.8, category: 'generell', categoryPath: { main: 'GENERIC', sub: 'general' } },
  godt: { lemma: 'god', weight: 0.8, category: 'generell', categoryPath: { main: 'GENERIC', sub: 'general' } },
  gode: { lemma: 'god', weight: 0.8, category: 'generell', categoryPath: { main: 'GENERIC', sub: 'general' } },
  fin: { lemma: 'fin', weight: 0.8, category: 'generell', categoryPath: { main: 'GENERIC', sub: 'general' } },
  fint: { lemma: 'fin', weight: 0.8, category: 'generell', categoryPath: { main: 'GENERIC', sub: 'general' } },
  fine: { lemma: 'fin', weight: 0.8, category: 'generell', categoryPath: { main: 'GENERIC', sub: 'general' } },
  pen: { lemma: 'pen', weight: 0.8, category: 'generell', categoryPath: { main: 'GENERIC', sub: 'general' } },
  pent: { lemma: 'pen', weight: 0.8, category: 'generell', categoryPath: { main: 'GENERIC', sub: 'general' } },
  pene: { lemma: 'pen', weight: 0.8, category: 'generell', categoryPath: { main: 'GENERIC', sub: 'general' } },
  behagelig: {
    lemma: 'behagelig',
    weight: 0.8,
    category: 'generell',
    categoryPath: { main: 'GENERIC', sub: 'general' }
  },
  tiltalende: {
    lemma: 'tiltalende',
    weight: 0.8,
    category: 'generell',
    categoryPath: { main: 'GENERIC', sub: 'general' }
  },

  // GENERIC HYPERNYMS — broad terms users actually type. Map to hierarchical categories
  // so "mørke bær" vs "solbær" share main:Frukt/sub:baer and earn category credit.
  bær: { lemma: 'bær', weight: 1.6, category: 'bær', categoryPath: { main: 'Frukt', sub: 'baer' } },
  bæret: { lemma: 'bær', weight: 1.6, category: 'bær', categoryPath: { main: 'Frukt', sub: 'baer' } },
  bærene: { lemma: 'bær', weight: 1.6, category: 'bær', categoryPath: { main: 'Frukt', sub: 'baer' } },
  bærrik: { lemma: 'bær', weight: 1.6, category: 'bær', categoryPath: { main: 'Frukt', sub: 'baer' } },
  skogsbær: { lemma: 'skogsbær', weight: 1.6, category: 'bær', categoryPath: { main: 'Frukt', sub: 'baer' } },
  skogsbæra: { lemma: 'skogsbær', weight: 1.6, category: 'bær', categoryPath: { main: 'Frukt', sub: 'baer' } },
  krekling: { lemma: 'krekling', weight: 1.6, category: 'bær', categoryPath: { main: 'Frukt', sub: 'baer' } },
  tyttebær: { lemma: 'tyttebær', weight: 1.6, category: 'bær', categoryPath: { main: 'Frukt', sub: 'baer' } },

  frukt: { lemma: 'frukt', weight: 1.4, category: 'frukt', categoryPath: { main: 'Frukt', sub: 'annet' } },
  frukten: { lemma: 'frukt', weight: 1.4, category: 'frukt', categoryPath: { main: 'Frukt', sub: 'annet' } },
  fruktig: { lemma: 'frukt', weight: 1.4, category: 'frukt', categoryPath: { main: 'Frukt', sub: 'annet' } },
  fruktige: { lemma: 'frukt', weight: 1.4, category: 'frukt', categoryPath: { main: 'Frukt', sub: 'annet' } },
  fruktrik: { lemma: 'frukt', weight: 1.4, category: 'frukt', categoryPath: { main: 'Frukt', sub: 'annet' } },
  fruktrike: { lemma: 'frukt', weight: 1.4, category: 'frukt', categoryPath: { main: 'Frukt', sub: 'annet' } },
  fruktighet: { lemma: 'frukt', weight: 1.4, category: 'frukt', categoryPath: { main: 'Frukt', sub: 'annet' } },

  urt: { lemma: 'urt', weight: 1.3, category: 'urt', categoryPath: { main: 'Urter', sub: 'groenn' } },
  urtig: { lemma: 'urt', weight: 1.3, category: 'urt', categoryPath: { main: 'Urter', sub: 'groenn' } },
  urtaktig: { lemma: 'urt', weight: 1.3, category: 'urt', categoryPath: { main: 'Urter', sub: 'groenn' } },

  // MINERAL / TERROIR (jord, salt, sjø, svovel, skogbunn)
  jord: { lemma: 'jord', weight: 1.5, category: 'mineral', categoryPath: { main: 'Mineral', sub: 'annet' } },
  jordet: { lemma: 'jord', weight: 1.5, category: 'mineral', categoryPath: { main: 'Mineral', sub: 'annet' } },
  jordig: { lemma: 'jord', weight: 1.5, category: 'mineral', categoryPath: { main: 'Mineral', sub: 'annet' } },
  jordpreg: { lemma: 'jord', weight: 1.5, category: 'mineral', categoryPath: { main: 'Mineral', sub: 'annet' } },
  skogbunn: { lemma: 'skogbunn', weight: 1.5, category: 'mineral', categoryPath: { main: 'Mineral', sub: 'annet' } },
  svovel: { lemma: 'svovel', weight: 1.5, category: 'mineral', categoryPath: { main: 'Mineral', sub: 'stein' } },
  svovelet: { lemma: 'svovel', weight: 1.5, category: 'mineral', categoryPath: { main: 'Mineral', sub: 'stein' } },
  svovelpreg: { lemma: 'svovel', weight: 1.5, category: 'mineral', categoryPath: { main: 'Mineral', sub: 'stein' } },
  salt: { lemma: 'salt', weight: 1.5, category: 'mineral', categoryPath: { main: 'Mineral', sub: 'stein' } },
  saltet: { lemma: 'salt', weight: 1.5, category: 'mineral', categoryPath: { main: 'Mineral', sub: 'stein' } },
  salte: { lemma: 'salt', weight: 1.5, category: 'mineral', categoryPath: { main: 'Mineral', sub: 'stein' } },
  havsalt: { lemma: 'salt', weight: 1.5, category: 'mineral', categoryPath: { main: 'Mineral', sub: 'stein' } },
  sjøaktig: { lemma: 'sjø', weight: 1.5, category: 'mineral', categoryPath: { main: 'Mineral', sub: 'stein' } },
  sjø: { lemma: 'sjø', weight: 1.5, category: 'mineral', categoryPath: { main: 'Mineral', sub: 'stein' } },

  // NUTS (mandler, mandel → nøtt family)
  mandel: { lemma: 'mandel', weight: 1.4, category: 'annet', categoryPath: { main: 'Eik/fat', sub: 'annet' } },
  mandler: { lemma: 'mandel', weight: 1.4, category: 'annet', categoryPath: { main: 'Eik/fat', sub: 'annet' } },
  hasselnøtt: { lemma: 'nøtt', weight: 1.4, category: 'annet', categoryPath: { main: 'Eik/fat', sub: 'annet' } },
  hasselnøtter: { lemma: 'nøtt', weight: 1.4, category: 'annet', categoryPath: { main: 'Eik/fat', sub: 'annet' } },
  valnøtt: { lemma: 'nøtt', weight: 1.4, category: 'annet', categoryPath: { main: 'Eik/fat', sub: 'annet' } },

  // DRIED / JAMMY FRUIT
  marmelade: {
    lemma: 'marmelade',
    weight: 1.6,
    category: 'moden-frukt',
    categoryPath: { main: 'Frukt', sub: 'toerket' }
  },
  syltetøy: {
    lemma: 'marmelade',
    weight: 1.6,
    category: 'moden-frukt',
    categoryPath: { main: 'Frukt', sub: 'toerket' }
  },
  modent: { lemma: 'moden', weight: 1.6, category: 'moden-frukt', categoryPath: { main: 'Frukt', sub: 'toerket' } },

  // TEXTURE / BODY colloquials
  juicy: { lemma: 'saftig', weight: 0.8, category: 'friskhet', categoryPath: { main: 'GENERIC', sub: 'acidity' } },
  kremet: { lemma: 'kremaktig', weight: 0.8, category: 'tekstur', categoryPath: { main: 'GENERIC', sub: 'texture' } },
  kremete: { lemma: 'kremaktig', weight: 0.8, category: 'tekstur', categoryPath: { main: 'GENERIC', sub: 'texture' } },
  feit: { lemma: 'fyldig', weight: 0.8, category: 'fylde', categoryPath: { main: 'GENERIC', sub: 'body' } },
  feite: { lemma: 'fyldig', weight: 0.8, category: 'fylde', categoryPath: { main: 'GENERIC', sub: 'body' } },

  // Common wood/oak variants
  tre: { lemma: 'eik', weight: 1.8, category: 'eik', categoryPath: { main: 'Eik/fat', sub: 'fatlagring' } },
  treaktig: { lemma: 'eik', weight: 1.8, category: 'eik', categoryPath: { main: 'Eik/fat', sub: 'fatlagring' } },
  trepreg: { lemma: 'eik', weight: 1.8, category: 'eik', categoryPath: { main: 'Eik/fat', sub: 'fatlagring' } },
  trekrydder: { lemma: 'krydder', weight: 1.7, category: 'krydder', categoryPath: { main: 'Krydder', sub: 'soet' } },

  // ── CORPUS GAP FILL (from corpus analysis of 49 000 wines) ─────────────────

  // BLOMSTER — singular and floral adjectives missing from original dict
  blomst: { lemma: 'blomst', weight: 1.3, category: 'blomst', categoryPath: { main: 'Blomster', sub: 'annet' } },
  floral: { lemma: 'blomst', weight: 1.3, category: 'blomst', categoryPath: { main: 'Blomster', sub: 'annet' } },
  florale: { lemma: 'blomst', weight: 1.3, category: 'blomst', categoryPath: { main: 'Blomster', sub: 'annet' } },
  blomsteraktig: { lemma: 'blomst', weight: 1.3, category: 'blomst', categoryPath: { main: 'Blomster', sub: 'annet' } },

  // MINERAL — singular + limestone/chalk + smoke + mushroom
  mineral: { lemma: 'mineral', weight: 1.5, category: 'mineral', categoryPath: { main: 'Mineral', sub: 'stein' } },
  kalk: { lemma: 'kalk', weight: 1.5, category: 'mineral', categoryPath: { main: 'Mineral', sub: 'stein' } },
  kalkstein: { lemma: 'kalk', weight: 1.5, category: 'mineral', categoryPath: { main: 'Mineral', sub: 'stein' } },
  kalkmineraler: { lemma: 'kalk', weight: 1.5, category: 'mineral', categoryPath: { main: 'Mineral', sub: 'stein' } },
  kalkaktig: { lemma: 'kalk', weight: 1.5, category: 'mineral', categoryPath: { main: 'Mineral', sub: 'stein' } },
  røyk: { lemma: 'røyk', weight: 1.5, category: 'mineral', categoryPath: { main: 'Mineral', sub: 'stein' } },
  røykig: { lemma: 'røyk', weight: 1.5, category: 'mineral', categoryPath: { main: 'Mineral', sub: 'stein' } },
  røykaktig: { lemma: 'røyk', weight: 1.5, category: 'mineral', categoryPath: { main: 'Mineral', sub: 'stein' } },
  røykete: { lemma: 'røyk', weight: 1.5, category: 'mineral', categoryPath: { main: 'Mineral', sub: 'stein' } },
  sopp: { lemma: 'sopp', weight: 1.5, category: 'mineral', categoryPath: { main: 'Mineral', sub: 'annet' } },
  soppaktig: { lemma: 'sopp', weight: 1.5, category: 'mineral', categoryPath: { main: 'Mineral', sub: 'annet' } },
  saltaktig: { lemma: 'salt', weight: 1.5, category: 'mineral', categoryPath: { main: 'Mineral', sub: 'stein' } },

  // URTER — camphor + balsam/resin
  kamfer: { lemma: 'kamfer', weight: 1.3, category: 'urt', categoryPath: { main: 'Urter', sub: 'annet' } },
  kamferaktig: { lemma: 'kamfer', weight: 1.3, category: 'urt', categoryPath: { main: 'Urter', sub: 'annet' } },
  balsam: { lemma: 'balsam', weight: 1.3, category: 'urt', categoryPath: { main: 'Urter', sub: 'annet' } },
  balsamisk: { lemma: 'balsam', weight: 1.3, category: 'urt', categoryPath: { main: 'Urter', sub: 'annet' } },
  balsamiske: { lemma: 'balsam', weight: 1.3, category: 'urt', categoryPath: { main: 'Urter', sub: 'annet' } },

  // EIK/FAT — cedar + cacao + mocha
  sedertre: { lemma: 'sedertre', weight: 1.8, category: 'eik', categoryPath: { main: 'Eik/fat', sub: 'fatlagring' } },
  seder: { lemma: 'sedertre', weight: 1.8, category: 'eik', categoryPath: { main: 'Eik/fat', sub: 'fatlagring' } },
  kakao: { lemma: 'kakao', weight: 1.4, category: 'annet', categoryPath: { main: 'Eik/fat', sub: 'annet' } },
  kakaopulver: { lemma: 'kakao', weight: 1.4, category: 'annet', categoryPath: { main: 'Eik/fat', sub: 'annet' } },
  mokka: { lemma: 'mokka', weight: 1.4, category: 'annet', categoryPath: { main: 'Eik/fat', sub: 'annet' } },
  syltet: { lemma: 'marmelade', weight: 1.6, category: 'moden-frukt', categoryPath: { main: 'Frukt', sub: 'toerket' } },
  syltede: { lemma: 'marmelade', weight: 1.6, category: 'moden-frukt', categoryPath: { main: 'Frukt', sub: 'toerket' } },

  // KRYDDER — paprika
  paprika: { lemma: 'paprika', weight: 1.7, category: 'krydder', categoryPath: { main: 'Krydder', sub: 'varm' } },
  kryddertoner: { lemma: 'krydder', weight: 1.7, category: 'krydder', categoryPath: { main: 'Krydder', sub: 'annet' } },
  krydderaktig: { lemma: 'krydder', weight: 1.7, category: 'krydder', categoryPath: { main: 'Krydder', sub: 'annet' } },

  // FRUKT/BÆR — missing berries + berry-compound adjectives
  stikkelsbær: { lemma: 'stikkelsbær', weight: 1.6, category: 'bær', categoryPath: { main: 'Frukt', sub: 'baer' } },
  stikkelsbæret: { lemma: 'stikkelsbær', weight: 1.6, category: 'bær', categoryPath: { main: 'Frukt', sub: 'baer' } },
  markjordbær: { lemma: 'jordbær', weight: 1.6, category: 'bær', categoryPath: { main: 'Frukt', sub: 'baer' } },
  tranebær: { lemma: 'tranebær', weight: 1.6, category: 'bær', categoryPath: { main: 'Frukt', sub: 'baer' } },
  granateple: { lemma: 'granateple', weight: 1.6, category: 'bær', categoryPath: { main: 'Frukt', sub: 'baer' } },
  nype: { lemma: 'nype', weight: 1.6, category: 'bær', categoryPath: { main: 'Frukt', sub: 'baer' } },
  nypebær: { lemma: 'nype', weight: 1.6, category: 'bær', categoryPath: { main: 'Frukt', sub: 'baer' } },
  bærpreget: { lemma: 'bær', weight: 1.6, category: 'bær', categoryPath: { main: 'Frukt', sub: 'baer' } },
  bærpregede: { lemma: 'bær', weight: 1.6, category: 'bær', categoryPath: { main: 'Frukt', sub: 'baer' } },
  bærfrukt: { lemma: 'bær', weight: 1.6, category: 'bær', categoryPath: { main: 'Frukt', sub: 'baer' } },
  rødbær: { lemma: 'bær', weight: 1.6, category: 'bær', categoryPath: { main: 'Frukt', sub: 'baer' } },
  mørkkryddret: { lemma: 'bær', weight: 1.6, category: 'bær', categoryPath: { main: 'Frukt', sub: 'baer' } },

  // FRUKT/SITRUS — orange + citrus compounds
  appelsin: { lemma: 'appelsin', weight: 1.5, category: 'sitrus', categoryPath: { main: 'Frukt', sub: 'sitrus' } },
  appelsiner: { lemma: 'appelsin', weight: 1.5, category: 'sitrus', categoryPath: { main: 'Frukt', sub: 'sitrus' } },
  appelsinskall: { lemma: 'appelsin', weight: 1.5, category: 'sitrus', categoryPath: { main: 'Frukt', sub: 'sitrus' } },
  sitrusfrukt: { lemma: 'sitrus', weight: 1.5, category: 'sitrus', categoryPath: { main: 'Frukt', sub: 'sitrus' } },
  sitruspreget: { lemma: 'sitrus', weight: 1.5, category: 'sitrus', categoryPath: { main: 'Frukt', sub: 'sitrus' } },
  sitrusnote: { lemma: 'sitrus', weight: 1.5, category: 'sitrus', categoryPath: { main: 'Frukt', sub: 'sitrus' } },

  // FRUKT/TROPISK
  pasjonsfrukt: { lemma: 'pasjonsfrukt', weight: 1.4, category: 'frukt', categoryPath: { main: 'Frukt', sub: 'tropisk' } },

  // FRUKT/STEINFRUKT — alternative spelling
  stenfrukt: { lemma: 'steinfrukt', weight: 1.5, category: 'steinfrukt', categoryPath: { main: 'Frukt', sub: 'steinfrukt' } },

  // FRUKT/ANNET — quince + fruit-compound adjectives
  kvede: { lemma: 'kvede', weight: 1.4, category: 'frukt', categoryPath: { main: 'Frukt', sub: 'annet' } },
  fruktdrevet: { lemma: 'frukt', weight: 1.4, category: 'frukt', categoryPath: { main: 'Frukt', sub: 'annet' } },
  fruktkonsentrasjon: { lemma: 'frukt', weight: 1.4, category: 'frukt', categoryPath: { main: 'Frukt', sub: 'annet' } },

  // AROMA / DUFT — general scent terms (GENERIC — not specific flavor descriptors)
  aroma: { lemma: 'aroma', weight: 0.8, category: 'generell', categoryPath: { main: 'GENERIC', sub: 'general' } },
  aromaer: { lemma: 'aroma', weight: 0.8, category: 'generell', categoryPath: { main: 'GENERIC', sub: 'general' } },
  aromaene: { lemma: 'aroma', weight: 0.8, category: 'generell', categoryPath: { main: 'GENERIC', sub: 'general' } },
  aromaen: { lemma: 'aroma', weight: 0.8, category: 'generell', categoryPath: { main: 'GENERIC', sub: 'general' } },
  aromatisk: { lemma: 'aroma', weight: 0.8, category: 'generell', categoryPath: { main: 'GENERIC', sub: 'general' } },
  aromatiske: { lemma: 'aroma', weight: 0.8, category: 'generell', categoryPath: { main: 'GENERIC', sub: 'general' } },
  duft: { lemma: 'duft', weight: 0.8, category: 'generell', categoryPath: { main: 'GENERIC', sub: 'general' } },
  dufter: { lemma: 'duft', weight: 0.8, category: 'generell', categoryPath: { main: 'GENERIC', sub: 'general' } },
  duften: { lemma: 'duft', weight: 0.8, category: 'generell', categoryPath: { main: 'GENERIC', sub: 'general' } },

  // GENERIC — quality/structure/body terms missing from original dict
  tekstur: { lemma: 'tekstur', weight: 0.8, category: 'tekstur', categoryPath: { main: 'GENERIC', sub: 'texture' } },
  fokusert: { lemma: 'fokusert', weight: 0.8, category: 'kvalitet', categoryPath: { main: 'GENERIC', sub: 'quality' } },
  fokuserte: { lemma: 'fokusert', weight: 0.8, category: 'kvalitet', categoryPath: { main: 'GENERIC', sub: 'quality' } },
  integrert: { lemma: 'integrert', weight: 0.8, category: 'struktur', categoryPath: { main: 'GENERIC', sub: 'structure' } },
  integrerte: { lemma: 'integrert', weight: 0.8, category: 'struktur', categoryPath: { main: 'GENERIC', sub: 'structure' } },
  kraftig: { lemma: 'kraftig', weight: 0.8, category: 'fylde', categoryPath: { main: 'GENERIC', sub: 'body' } },
  kraftige: { lemma: 'kraftig', weight: 0.8, category: 'fylde', categoryPath: { main: 'GENERIC', sub: 'body' } },
  intensitet: { lemma: 'intens', weight: 0.8, category: 'kvalitet', categoryPath: { main: 'GENERIC', sub: 'quality' } },
  fersk: { lemma: 'fersk', weight: 0.8, category: 'friskhet', categoryPath: { main: 'GENERIC', sub: 'acidity' } },
  ferske: { lemma: 'fersk', weight: 0.8, category: 'friskhet', categoryPath: { main: 'GENERIC', sub: 'acidity' } },
  slank: { lemma: 'slank', weight: 0.8, category: 'fylde', categoryPath: { main: 'GENERIC', sub: 'body' } },
  slanke: { lemma: 'slank', weight: 0.8, category: 'fylde', categoryPath: { main: 'GENERIC', sub: 'body' } },
  kjølig: { lemma: 'kjølig', weight: 0.8, category: 'generell', categoryPath: { main: 'GENERIC', sub: 'general' } },
  kjølige: { lemma: 'kjølig', weight: 0.8, category: 'generell', categoryPath: { main: 'GENERIC', sub: 'general' } },
  delikat: { lemma: 'delikat', weight: 0.8, category: 'kvalitet', categoryPath: { main: 'GENERIC', sub: 'quality' } },
  delikate: { lemma: 'delikat', weight: 0.8, category: 'kvalitet', categoryPath: { main: 'GENERIC', sub: 'quality' } },
  presis: { lemma: 'presis', weight: 0.8, category: 'kvalitet', categoryPath: { main: 'GENERIC', sub: 'quality' } },
  presise: { lemma: 'presis', weight: 0.8, category: 'kvalitet', categoryPath: { main: 'GENERIC', sub: 'quality' } },
  syrlighet: { lemma: 'syre', weight: 0.8, category: 'friskhet', categoryPath: { main: 'GENERIC', sub: 'acidity' } },
  sødmefull: { lemma: 'søt', weight: 0.8, category: 'sødme', categoryPath: { main: 'GENERIC', sub: 'sweetness' } },
  sødmefulle: { lemma: 'søt', weight: 0.8, category: 'sødme', categoryPath: { main: 'GENERIC', sub: 'sweetness' } },
  syrefrisk: { lemma: 'frisk', weight: 0.8, category: 'friskhet', categoryPath: { main: 'GENERIC', sub: 'acidity' } },
  tanninstruktur: { lemma: 'tannin', weight: 0.8, category: 'struktur', categoryPath: { main: 'GENERIC', sub: 'structure' } },
  anslag: { lemma: 'anslag', weight: 0.8, category: 'generell', categoryPath: { main: 'GENERIC', sub: 'general' } },
  nese: { lemma: 'nese', weight: 0.8, category: 'generell', categoryPath: { main: 'GENERIC', sub: 'general' } },
  bitter: { lemma: 'bitter', weight: 0.8, category: 'struktur', categoryPath: { main: 'GENERIC', sub: 'structure' } },
  bitre: { lemma: 'bitter', weight: 0.8, category: 'struktur', categoryPath: { main: 'GENERIC', sub: 'structure' } },
  bitterhet: { lemma: 'bitter', weight: 0.8, category: 'struktur', categoryPath: { main: 'GENERIC', sub: 'structure' } },
  saftige: { lemma: 'saftig', weight: 0.8, category: 'friskhet', categoryPath: { main: 'GENERIC', sub: 'acidity' } },
  avslutningen: { lemma: 'ettersmak', weight: 0.8, category: 'ettersmak', categoryPath: { main: 'GENERIC', sub: 'finish' } },
  avslutningene: { lemma: 'ettersmak', weight: 0.8, category: 'ettersmak', categoryPath: { main: 'GENERIC', sub: 'finish' } },
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
  'mye',
  'smak',
  'hint',
  'toner',
  'høy',
  // Color adjectives — semantically subsumed by the noun they modify
  // ("røde bær" and "solbær" both mean "red berries"; dropping the adjective
  // removes a mismatch when the wine note doesn't repeat the color).
  'rød',
  'røde',
  'rødt',
  'mørk',
  'mørke',
  'mørkt',
  'grønn',
  'grønne',
  'grønt',
  'hvit',
  'hvite',
  'gul',
  'gule',
  // Vague intensity / age qualifiers that don't carry flavor
  'middels',
  'ung',
  'unge',
  'ungdommelig',
  'sval',
  'svale',
  'livlig',
  'leskende',
  'nyansert',
  'nyanserte',
  // Conjunctions / prepositions that appear frequently but carry no flavor meaning
  'samt',
  'noen',
  'over',
  'under',
  'etter',
  // Wine-context noise words
  'preget',   // standalone "characterized" — covered by compound forms like bærpreget
  'noter',    // "notes of" — the noun itself adds no flavor info
  'note',
  'karakter',
  'stil',
  'vin',
]);

/**
 * Normalize free-text input before similarity/embedding:
 * lowercase, strip punctuation and other noise, collapse whitespace, drop stopwords.
 * Preserves Norwegian characters (æ, ø, å) and digits.
 */
export const sanitizeText = (text: string): string => {
  if (!text) return '';
  return text
    .toLowerCase()
    .replace(/[.,\/#!?$%\^&\*;:{}=\-_`~()"'«»“”‘’<>\[\]|\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(word => word.length > 0 && !stopwords.has(word))
    .join(' ');
};

// All surface forms whose categoryPath.main is 'GENERIC' — used to strip
// structural/quality/texture terms before semantic embedding so that the
// embedding comparison focuses on aroma/flavor descriptors only.
export const genericWords = new Set(
  Object.entries(norwegianLemmas)
    .filter(([, v]) => v.categoryPath?.main === 'GENERIC')
    .map(([k]) => k)
);

export const stripGenericTerms = (text: string): string => {
  return sanitizeText(text)
    .split(' ')
    .filter(w => !genericWords.has(w))
    .join(' ');
};

// Sub-categories that map to numeric wine attributes (fylde, friskhet,
// garvestoff, sødme) — strip these before semantic similarity so the
// embedding focuses on aroma/flavour descriptors, not structure.
const STRUCTURAL_SUBS = new Set([
  'structure', 'body', 'acidity', 'sweetness', 'finish', 'texture', 'quality',
]);

export function flavorOnlyText(text: string): string {
  const tokens = sanitizeText(text).split(' ').filter(Boolean);
  const kept: string[] = [];
  for (const token of tokens) {
    let entry = norwegianLemmas[token];
    if (!entry) {
      const normalized = token.replace(/ae/g, 'æ').replace(/oe/g, 'ø').replace(/aa/g, 'å');
      if (normalized !== token) entry = norwegianLemmas[normalized];
    }
    if (entry) {
      const main = entry.categoryPath?.main ?? 'GENERIC';
      const sub = entry.categoryPath?.sub ?? '';
      if (main === 'GENERIC' && STRUCTURAL_SUBS.has(sub)) continue;
    }
    kept.push(token);
  }
  return kept.join(' ');
}

export const tokenizeSanitized = (text: string): string[] => {
  const cleaned = sanitizeText(text);
  return cleaned ? cleaned.split(' ') : [];
};

export const lemmatizeAndWeight = (text: string): TextAnalysis => {
  const words: string[] = tokenizeSanitized(text);

  const lemmatized: LemmatizedWord[] = [];
  const categories: Record<string, number> = {};
  let weightSum: number = 0;

  words.forEach(word => {
    const lemmaData: LemmaData | undefined = norwegianLemmas[word];
    if (lemmaData) {
      const profileWeight = lemmaData.categoryPath
        ? getCategoryWeight(lemmaData.categoryPath.main)
        : getCategoryWeight('GENERIC');
      // IDF multiplier floored at 1.0 — rare descriptors get a boost, nothing decreases
      const finalWeight = profileWeight * getIdfMultiplier(lemmaData.lemma);

      lemmatized.push({ original: word, lemma: lemmaData.lemma, weight: finalWeight, category: lemmaData.category });
      categories[lemmaData.category] = (categories[lemmaData.category] || 0) + 1;
      weightSum += finalWeight;
    } else {
      // Norwegian Porter Stemmer fallback: normalises inflected forms not in the dict
      // e.g. "mineralske" → "mineralsk" → found in dict as mineral (specific category)
      //      "krydderte"  → "krydder"  → found in dict
      // If stem still not found, use stem as lemma so inflected variants match each other
      const stem = PorterStemmerNo.stem(word);
      const stemEntry = stem !== word ? norwegianLemmas[stem] : undefined;

      // Norwegian char normalization fallback: ae→æ, oe→ø, aa→å
      // Only activates when both Porter and direct lookup failed, and only when
      // the normalized form produces a dictionary hit (avoids false positives).
      const normalized = word.replace(/ae/g, 'æ').replace(/oe/g, 'ø').replace(/aa/g, 'å');
      const normalizedEntry = normalized !== word ? norwegianLemmas[normalized] : undefined;

      const resolvedEntry = stemEntry ?? normalizedEntry;

      if (resolvedEntry) {
        const profileWeight = resolvedEntry.categoryPath
          ? getCategoryWeight(resolvedEntry.categoryPath.main)
          : getCategoryWeight('GENERIC');
        const finalWeight = profileWeight * getIdfMultiplier(resolvedEntry.lemma);
        lemmatized.push({ original: word, lemma: resolvedEntry.lemma, weight: finalWeight, category: resolvedEntry.category });
        categories[resolvedEntry.category] = (categories[resolvedEntry.category] || 0) + 1;
        weightSum += finalWeight;
      } else {
        const genericWeight = getCategoryWeight('GENERIC');
        // Use stem (not raw word) so inflected unknowns still match each other
        lemmatized.push({ original: word, lemma: stem, weight: genericWeight, category: 'ukjent' });
        weightSum += genericWeight;
      }
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
