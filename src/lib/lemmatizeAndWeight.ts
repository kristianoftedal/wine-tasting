// Type definitions
export type WineCategory =
  | 'struktur'
  | 'kvalitet'
  | 'ettersmak'
  | 'fylde'
  | 'friskhet'
  | 'sødme'
  | 'mørke bær'
  | 'røde bær'
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
  category: WineCategory;
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
  // STRUKTUR OG KVALITET (høyest vekt - 2.5x) - Vinmonopolets nøkkelbeskrivelser
  balansert: { lemma: 'balanse', weight: 2.5, category: 'struktur' },
  balanserte: { lemma: 'balanse', weight: 2.5, category: 'struktur' },
  balanse: { lemma: 'balanse', weight: 2.5, category: 'struktur' },
  strukturert: { lemma: 'struktur', weight: 2.5, category: 'struktur' },
  struktur: { lemma: 'struktur', weight: 2.5, category: 'struktur' },
  tanniner: { lemma: 'tannin', weight: 2.5, category: 'struktur' },
  tannin: { lemma: 'tannin', weight: 2.5, category: 'struktur' },
  tanninene: { lemma: 'tannin', weight: 2.5, category: 'struktur' },
  garvestoffer: { lemma: 'tannin', weight: 2.5, category: 'struktur' },
  garvestoffene: { lemma: 'tannin', weight: 2.5, category: 'struktur' },
  snerper: { lemma: 'snerp', weight: 2.5, category: 'struktur' },
  snerpende: { lemma: 'snerp', weight: 2.5, category: 'struktur' },
  snerp: { lemma: 'snerp', weight: 2.5, category: 'struktur' },
  konsentrasjon: { lemma: 'konsentrasjon', weight: 2.5, category: 'kvalitet' },
  konsentrert: { lemma: 'konsentrasjon', weight: 2.5, category: 'kvalitet' },
  dybde: { lemma: 'dybde', weight: 2.5, category: 'kvalitet' },
  dyp: { lemma: 'dyp', weight: 2.5, category: 'kvalitet' },
  kompleks: { lemma: 'kompleks', weight: 2.5, category: 'kvalitet' },
  komplekse: { lemma: 'kompleks', weight: 2.5, category: 'kvalitet' },
  kompleksitet: { lemma: 'kompleks', weight: 2.5, category: 'kvalitet' },
  sammensatt: { lemma: 'sammensatt', weight: 2.5, category: 'kvalitet' },
  elegant: { lemma: 'elegant', weight: 2.5, category: 'kvalitet' },
  elegante: { lemma: 'elegant', weight: 2.5, category: 'kvalitet' },

  // AVSLUTNING/ETTERSMAK (svært høy vekt - 2.3x)
  ettersmak: { lemma: 'ettersmak', weight: 2.3, category: 'ettersmak' },
  avslutning: { lemma: 'avslutning', weight: 2.3, category: 'ettersmak' },
  finish: { lemma: 'finish', weight: 2.3, category: 'ettersmak' },
  lang: { lemma: 'lang', weight: 2.3, category: 'ettersmak' },
  langvarig: { lemma: 'lang', weight: 2.3, category: 'ettersmak' },
  lange: { lemma: 'lang', weight: 2.3, category: 'ettersmak' },
  lengde: { lemma: 'lengde', weight: 2.3, category: 'ettersmak' },

  // FYLDE (høy vekt - 2.0x) - Vinmonopolets klokkeindikator
  fylde: { lemma: 'fylde', weight: 2.0, category: 'fylde' },
  fyldig: { lemma: 'fyldig', weight: 2.0, category: 'fylde' },
  fyldige: { lemma: 'fyldig', weight: 2.0, category: 'fylde' },
  fyldighetene: { lemma: 'fylde', weight: 2.0, category: 'fylde' },
  kropp: { lemma: 'kropp', weight: 2.0, category: 'fylde' },
  kroppen: { lemma: 'kropp', weight: 2.0, category: 'fylde' },
  rik: { lemma: 'rik', weight: 2.0, category: 'fylde' },
  rikt: { lemma: 'rik', weight: 2.0, category: 'fylde' },
  rike: { lemma: 'rik', weight: 2.0, category: 'fylde' },
  rikhet: { lemma: 'rik', weight: 2.0, category: 'fylde' },
  intens: { lemma: 'intens', weight: 2.0, category: 'fylde' },
  intense: { lemma: 'intens', weight: 2.0, category: 'fylde' },

  // FRISKHET/SYRE (høy vekt - 2.0x) - Vinmonopolets klokkeindikator
  friskhet: { lemma: 'frisk', weight: 2.0, category: 'friskhet' },
  frisk: { lemma: 'frisk', weight: 2.0, category: 'friskhet' },
  friskt: { lemma: 'frisk', weight: 2.0, category: 'friskhet' },
  friske: { lemma: 'frisk', weight: 2.0, category: 'friskhet' },
  syre: { lemma: 'syre', weight: 2.0, category: 'friskhet' },
  syren: { lemma: 'syre', weight: 2.0, category: 'friskhet' },
  syrlig: { lemma: 'syre', weight: 2.0, category: 'friskhet' },
  syrlige: { lemma: 'syre', weight: 2.0, category: 'friskhet' },
  saftighet: { lemma: 'saftig', weight: 2.0, category: 'friskhet' },
  saftig: { lemma: 'saftig', weight: 2.0, category: 'friskhet' },

  // SØDME (medium-høy vekt - 1.8x)
  sødme: { lemma: 'søt', weight: 1.8, category: 'sødme' },
  søt: { lemma: 'søt', weight: 1.8, category: 'sødme' },
  søtt: { lemma: 'søt', weight: 1.8, category: 'sødme' },
  søte: { lemma: 'søt', weight: 1.8, category: 'sødme' },
  tørr: { lemma: 'tørr', weight: 1.8, category: 'sødme' },
  tørt: { lemma: 'tørr', weight: 1.8, category: 'sødme' },
  tørre: { lemma: 'tørr', weight: 1.8, category: 'sødme' },
  halvtørr: { lemma: 'halvtørr', weight: 1.8, category: 'sødme' },

  // MØRKE BÆR (medium-høy vekt - 1.7x)
  solbær: { lemma: 'solbær', weight: 1.7, category: 'mørke bær' },
  bjørnebær: { lemma: 'bjørnebær', weight: 1.7, category: 'mørke bær' },
  blåbær: { lemma: 'blåbær', weight: 1.7, category: 'mørke bær' },
  moreller: { lemma: 'morell', weight: 1.7, category: 'mørke bær' },
  morell: { lemma: 'morell', weight: 1.7, category: 'mørke bær' },

  // RØDE BÆR (medium vekt - 1.5x)
  kirsebær: { lemma: 'kirsebær', weight: 1.5, category: 'røde bær' },
  jordbær: { lemma: 'jordbær', weight: 1.5, category: 'røde bær' },
  bringebær: { lemma: 'bringebær', weight: 1.5, category: 'røde bær' },
  rips: { lemma: 'rips', weight: 1.5, category: 'røde bær' },

  // SITRUS (medium vekt - 1.5x)
  sitrus: { lemma: 'sitrus', weight: 1.5, category: 'sitrus' },
  sitron: { lemma: 'sitron', weight: 1.5, category: 'sitrus' },
  lime: { lemma: 'lime', weight: 1.5, category: 'sitrus' },
  grapefrukt: { lemma: 'grapefrukt', weight: 1.5, category: 'sitrus' },

  // STEINFRUKTER (medium vekt - 1.5x)
  plomme: { lemma: 'plomme', weight: 1.5, category: 'steinfrukt' },
  plommer: { lemma: 'plomme', weight: 1.5, category: 'steinfrukt' },
  fersken: { lemma: 'fersken', weight: 1.5, category: 'steinfrukt' },
  aprikos: { lemma: 'aprikos', weight: 1.5, category: 'steinfrukt' },

  // ANNEN FRUKT (medium vekt - 1.4x)
  eple: { lemma: 'eple', weight: 1.4, category: 'frukt' },
  epler: { lemma: 'eple', weight: 1.4, category: 'frukt' },
  eplet: { lemma: 'eple', weight: 1.4, category: 'frukt' },
  pære: { lemma: 'pære', weight: 1.4, category: 'frukt' },
  pærer: { lemma: 'pære', weight: 1.4, category: 'frukt' },
  tropisk: { lemma: 'tropisk', weight: 1.4, category: 'frukt' },
  tropiske: { lemma: 'tropisk', weight: 1.4, category: 'frukt' },
  mango: { lemma: 'mango', weight: 1.4, category: 'frukt' },
  ananas: { lemma: 'ananas', weight: 1.4, category: 'frukt' },
  melon: { lemma: 'melon', weight: 1.4, category: 'frukt' },

  // MODNE/TØRKEDE FRUKTER (medium vekt - 1.6x)
  moden: { lemma: 'moden', weight: 1.6, category: 'moden-frukt' },
  modne: { lemma: 'moden', weight: 1.6, category: 'moden-frukt' },
  tørket: { lemma: 'tørket', weight: 1.6, category: 'moden-frukt' },
  tørkede: { lemma: 'tørket', weight: 1.6, category: 'moden-frukt' },
  svisker: { lemma: 'sviske', weight: 1.6, category: 'moden-frukt' },
  sviske: { lemma: 'sviske', weight: 1.6, category: 'moden-frukt' },
  fiken: { lemma: 'fiken', weight: 1.6, category: 'moden-frukt' },
  dadler: { lemma: 'daddel', weight: 1.6, category: 'moden-frukt' },
  daddel: { lemma: 'daddel', weight: 1.6, category: 'moden-frukt' },
  rosiner: { lemma: 'rosin', weight: 1.6, category: 'moden-frukt' },
  rosin: { lemma: 'rosin', weight: 1.6, category: 'moden-frukt' },

  // KRYDDER (medium-høy vekt - 1.7x)
  krydder: { lemma: 'krydder', weight: 1.7, category: 'krydder' },
  krydrete: { lemma: 'krydder', weight: 1.7, category: 'krydder' },
  pepper: { lemma: 'pepper', weight: 1.7, category: 'krydder' },
  nellik: { lemma: 'nellik', weight: 1.7, category: 'krydder' },
  kanel: { lemma: 'kanel', weight: 1.7, category: 'krydder' },
  anis: { lemma: 'anis', weight: 1.7, category: 'krydder' },

  // EIK/FAT (medium-høy vekt - 1.8x)
  eik: { lemma: 'eik', weight: 1.8, category: 'eik' },
  eiken: { lemma: 'eik', weight: 1.8, category: 'eik' },
  fat: { lemma: 'fat', weight: 1.8, category: 'eik' },
  fatet: { lemma: 'fat', weight: 1.8, category: 'eik' },
  fatpreg: { lemma: 'fatpreg', weight: 1.8, category: 'eik' },
  fatlagret: { lemma: 'fatlagret', weight: 1.8, category: 'eik' },
  vanilje: { lemma: 'vanilje', weight: 1.8, category: 'eik' },
  toast: { lemma: 'toast', weight: 1.8, category: 'eik' },
  ristet: { lemma: 'ristet', weight: 1.8, category: 'eik' },
  ristede: { lemma: 'ristet', weight: 1.8, category: 'eik' },

  // MINERALITET (medium vekt - 1.5x)
  mineralsk: { lemma: 'mineral', weight: 1.5, category: 'mineral' },
  mineralske: { lemma: 'mineral', weight: 1.5, category: 'mineral' },
  mineralitet: { lemma: 'mineral', weight: 1.5, category: 'mineral' },
  mineraler: { lemma: 'mineral', weight: 1.5, category: 'mineral' },
  stein: { lemma: 'stein', weight: 1.5, category: 'mineral' },
  steinet: { lemma: 'stein', weight: 1.5, category: 'mineral' },
  flint: { lemma: 'flint', weight: 1.5, category: 'mineral' },

  // BLOMSTER (medium vekt - 1.3x)
  blomster: { lemma: 'blomst', weight: 1.3, category: 'blomst' },
  blomsten: { lemma: 'blomst', weight: 1.3, category: 'blomst' },
  blomsteret: { lemma: 'blomst', weight: 1.3, category: 'blomst' },
  blomstrete: { lemma: 'blomst', weight: 1.3, category: 'blomst' },
  blomsterpreget: { lemma: 'blomst', weight: 1.3, category: 'blomst' },
  roser: { lemma: 'rose', weight: 1.3, category: 'blomst' },
  rose: { lemma: 'rose', weight: 1.3, category: 'blomst' },
  fioler: { lemma: 'fiol', weight: 1.3, category: 'blomst' },
  fiol: { lemma: 'fiol', weight: 1.3, category: 'blomst' },

  // URTER (medium vekt - 1.3x)
  urter: { lemma: 'urt', weight: 1.3, category: 'urt' },
  urtete: { lemma: 'urt', weight: 1.3, category: 'urt' },
  urtepreg: { lemma: 'urt', weight: 1.3, category: 'urt' },
  gress: { lemma: 'gress', weight: 1.3, category: 'urt' },
  gressete: { lemma: 'gress', weight: 1.3, category: 'urt' },
  timian: { lemma: 'timian', weight: 1.3, category: 'urt' },
  rosmarin: { lemma: 'rosmarin', weight: 1.3, category: 'urt' },
  laurbær: { lemma: 'laurbær', weight: 1.3, category: 'urt' },
  salvie: { lemma: 'salvie', weight: 1.3, category: 'urt' },
  mynte: { lemma: 'mynte', weight: 1.3, category: 'urt' },
  eukalyptus: { lemma: 'eukalyptus', weight: 1.3, category: 'urt' },

  // ANDRE AROMAER (medium vekt - 1.4x)
  nøtter: { lemma: 'nøtt', weight: 1.4, category: 'annet' },
  nøtt: { lemma: 'nøtt', weight: 1.4, category: 'annet' },
  kaffe: { lemma: 'kaffe', weight: 1.4, category: 'annet' },
  sjokolade: { lemma: 'sjokolade', weight: 1.4, category: 'annet' },
  lakris: { lemma: 'lakris', weight: 1.4, category: 'annet' },
  honning: { lemma: 'honning', weight: 1.4, category: 'annet' },
  karamell: { lemma: 'karamell', weight: 1.4, category: 'annet' },
  smør: { lemma: 'smør', weight: 1.4, category: 'annet' },
  kjeks: { lemma: 'kjeks', weight: 1.4, category: 'annet' },
  brød: { lemma: 'brød', weight: 1.4, category: 'annet' },
  brøddeig: { lemma: 'brøddeig', weight: 1.4, category: 'annet' },
  brioche: { lemma: 'brioche', weight: 1.4, category: 'annet' },
  tjære: { lemma: 'tjære', weight: 1.4, category: 'annet' },
  tobakk: { lemma: 'tobakk', weight: 1.4, category: 'annet' },
  lær: { lemma: 'lær', weight: 1.4, category: 'annet' },

  // TEKSTUR/MUNNFØLELSE (medium vekt - 1.5x)
  myk: { lemma: 'myk', weight: 1.5, category: 'tekstur' },
  myke: { lemma: 'myk', weight: 1.5, category: 'tekstur' },
  mykhet: { lemma: 'myk', weight: 1.5, category: 'tekstur' },
  rund: { lemma: 'rund', weight: 1.5, category: 'tekstur' },
  runde: { lemma: 'rund', weight: 1.5, category: 'tekstur' },
  bløt: { lemma: 'bløt', weight: 1.5, category: 'tekstur' },
  bløte: { lemma: 'bløt', weight: 1.5, category: 'tekstur' },
  silkemyk: { lemma: 'silkemyk', weight: 1.5, category: 'tekstur' },
  kremaktig: { lemma: 'kremaktig', weight: 1.5, category: 'tekstur' },
  fast: { lemma: 'fast', weight: 1.5, category: 'tekstur' },
  faste: { lemma: 'fast', weight: 1.5, category: 'tekstur' },
  fasthet: { lemma: 'fast', weight: 1.5, category: 'tekstur' },

  // GENERELLE DESKRIPTORER (lav vekt - 0.8x)
  god: { lemma: 'god', weight: 0.8, category: 'generell' },
  godt: { lemma: 'god', weight: 0.8, category: 'generell' },
  gode: { lemma: 'god', weight: 0.8, category: 'generell' },
  fin: { lemma: 'fin', weight: 0.8, category: 'generell' },
  fint: { lemma: 'fin', weight: 0.8, category: 'generell' },
  fine: { lemma: 'fin', weight: 0.8, category: 'generell' },
  pen: { lemma: 'pen', weight: 0.8, category: 'generell' },
  pent: { lemma: 'pen', weight: 0.8, category: 'generell' },
  pene: { lemma: 'pen', weight: 0.8, category: 'generell' },
  behagelig: { lemma: 'behagelig', weight: 0.8, category: 'generell' },
  tiltalende: { lemma: 'tiltalende', weight: 0.8, category: 'generell' }
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
