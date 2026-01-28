import { createClient } from '@supabase/supabase-js'
import { pipeline } from '@xenova/transformers'

// Check for required environment variables
const requiredEnvVars = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']
const missingEnvVars = requiredEnvVars.filter((varName) => !process.env[varName])

if (missingEnvVars.length > 0) {
  console.error('Missing required environment variables:')
  missingEnvVars.forEach((varName) => console.error(`- ${varName}`))
  process.exit(1)
}

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

// ============================================
// Lemmatize and Weight Implementation
// ============================================

const stopwords = new Set([
  'og', 'i', 'av', 'med', 'en', 'et', 'er', 'som', 'på', 'til', 'har', 'den', 'det', 'de',
  'om', 'for', 'kan', 'var', 'meg', 'seg', 'han', 'hun', 'dette', 'eller', 'men', 'fra',
  'ved', 'da', 'hvis', 'nå', 'denne', 'dette', 'ikke', 'bare', 'også', 'mer', 'meget',
  'noe', 'inn', 'har', 'innslag', 'preg', 'tydelig', 'lett', 'litt', 'noe', 'mye'
])

const norwegianLemmas = {
  // STRUKTUR OG KVALITET (høyest vekt - 2.5x)
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

  // FYLDE (høy vekt - 2.0x)
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

  // FRISKHET/SYRE (høy vekt - 2.0x)
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
  solbær: { lemma: 'solbær', weight: 1.7, category: 'mørke-bær' },
  bjørnebær: { lemma: 'bjørnebær', weight: 1.7, category: 'mørke-bær' },
  blåbær: { lemma: 'blåbær', weight: 1.7, category: 'mørke-bær' },
  moreller: { lemma: 'morell', weight: 1.7, category: 'mørke-bær' },
  morell: { lemma: 'morell', weight: 1.7, category: 'mørke-bær' },

  // RØDE BÆR (medium vekt - 1.5x)
  kirsebær: { lemma: 'kirsebær', weight: 1.5, category: 'røde-bær' },
  jordbær: { lemma: 'jordbær', weight: 1.5, category: 'røde-bær' },
  bringebær: { lemma: 'bringebær', weight: 1.5, category: 'røde-bær' },
  rips: { lemma: 'rips', weight: 1.5, category: 'røde-bær' },

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
}

function lemmatizeAndWeight(text) {
  const words = text
    .toLowerCase()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, '')
    .split(/\s+/)
    .filter(word => word.length > 0 && !stopwords.has(word))

  const lemmatized = []
  const categories = {}
  let weightSum = 0

  words.forEach(word => {
    const lemmaData = norwegianLemmas[word]
    if (lemmaData) {
      lemmatized.push({
        original: word,
        lemma: lemmaData.lemma,
        weight: lemmaData.weight,
        category: lemmaData.category
      })
      categories[lemmaData.category] = (categories[lemmaData.category] || 0) + 1
      weightSum += lemmaData.weight
    } else {
      lemmatized.push({
        original: word,
        lemma: word,
        weight: 1.0,
        category: 'ukjent'
      })
      weightSum += 1.0
    }
  })

  return { lemmatized, categories, weightSum }
}

// ============================================
// Embedding-based Semantic Similarity
// ============================================

let embedder = null

async function getEmbedder() {
  if (!embedder) {
    console.log('Loading embedding model...')
    embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2')
    console.log('Embedding model loaded!')
  }
  return embedder
}

function cosineSimilarity(a, b) {
  const dot = a.reduce((sum, val, i) => sum + val * b[i], 0)
  const normA = Math.sqrt(a.reduce((sum, val) => sum + val ** 2, 0))
  const normB = Math.sqrt(b.reduce((sum, val) => sum + val ** 2, 0))
  return dot / (normA * normB)
}

/**
 * Standard semantic similarity using embeddings (0-100)
 */
async function standardSemanticSimilarity(text1, text2) {
  if (!text1 || !text2 || text1.trim() === '' || text2.trim() === '') return 0

  try {
    const embed = await getEmbedder()

    const cleanedText1 = text1
      .toLowerCase()
      .replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 0 && !stopwords.has(word))

    const cleanedText2 = text2
      .toLowerCase()
      .replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 0 && !stopwords.has(word))

    if (cleanedText1.length === 0 || cleanedText2.length === 0) return 0

    const [out1, out2] = await Promise.all([
      embed(cleanedText1, { pooling: 'mean', normalize: true }),
      embed(cleanedText2, { pooling: 'mean', normalize: true })
    ])

    const emb1 = Array.from(out1.data)
    const emb2 = Array.from(out2.data)

    const similarity = cosineSimilarity(emb1, emb2)
    const score = Math.round(similarity * 100)
    return isNaN(score) ? 0 : score
  } catch (error) {
    console.error('Standard semantic similarity error:', error.message)
    return 0
  }
}

/**
 * Lemma-based semantic similarity (0-100)
 * Compares the semantic similarity of lemmatized words
 */
async function lemmaSemanticSimilarity(text1, text2) {
  if (!text1 || !text2) return 0

  try {
    const data1 = lemmatizeAndWeight(text1)
    const data2 = lemmatizeAndWeight(text2)

    const lemmas1 = Array.from(new Set(data1.lemmatized.map(item => item.lemma))).join(' ')
    const lemmas2 = Array.from(new Set(data2.lemmatized.map(item => item.lemma))).join(' ')

    if (!lemmas1 || !lemmas2) return 0

    return await standardSemanticSimilarity(lemmas1, lemmas2)
  } catch (error) {
    console.error('Lemma semantic similarity error:', error.message)
    return 0
  }
}

/**
 * Category-based semantic similarity (0-100)
 * Compares the wine descriptor categories found in both texts
 */
async function categorySemanticSimilarity(text1, text2) {
  if (!text1 || !text2) return 0

  try {
    const data1 = lemmatizeAndWeight(text1)
    const data2 = lemmatizeAndWeight(text2)

    const categories1 = Object.keys(data1.categories).join(' ')
    const categories2 = Object.keys(data2.categories).join(' ')

    if (!categories1 || !categories2) return 0

    return await standardSemanticSimilarity(categories1, categories2)
  } catch (error) {
    console.error('Category semantic similarity error:', error.message)
    return 0
  }
}

/**
 * Comprehensive similarity: average of standard, lemma, and category semantic similarity
 */
async function comprehensiveSimilarity(text1, text2) {
  if (!text1 || !text2 || text1.trim() === '' || text2.trim() === '') return 0

  try {
    const [standardScore, lemmaScore, categoryScore] = await Promise.all([
      standardSemanticSimilarity(text1, text2),
      lemmaSemanticSimilarity(text1, text2),
      categorySemanticSimilarity(text1, text2)
    ])

    const validScores = [standardScore, lemmaScore, categoryScore].filter(s => !isNaN(s) && s !== null)
    
    if (validScores.length === 0) return 0
    
    const averageScore = Math.round(validScores.reduce((a, b) => a + b, 0) / validScores.length)
    return isNaN(averageScore) ? 0 : averageScore
  } catch (error) {
    console.error('Comprehensive similarity error:', error.message)
    return 0
  }
}

// ============================================
// Numeric Similarity
// ============================================

function calculateNumericSimilarity(userValue, actualValue) {
  const normalizeNumber = (str) => {
    if (typeof str === 'number') return str
    const cleaned = String(str).replace(/[^\d.,]/g, '').replace('prosent', '')
    return parseFloat(cleaned.replace(',', '.'))
  }

  const userNum = normalizeNumber(userValue)
  const actualNum = normalizeNumber(actualValue)

  if (isNaN(userNum) || isNaN(actualNum)) return 0

  const difference = Math.abs(userNum - actualNum)
  const average = (userNum + actualNum) / 2
  const percentDifference = (difference / average) * 100

  return Math.max(0, Math.round(100 - percentDifference))
}

// ============================================
// Main Recalculation Logic
// ============================================

async function recalculateTastingScores() {
  console.log('Starting tasting score recalculation with comprehensive similarity...\n')

  // Pre-load the embedding model
  await getEmbedder()

  // Fetch all tastings
  const { data: tastings, error: tastingsError } = await supabase
    .from('tastings')
    .select('*')
    .order('created_at', { ascending: true })

  if (tastingsError) {
    console.error('Error fetching tastings:', tastingsError)
    return
  }

  console.log(`Found ${tastings.length} tastings to process\n`)

  let updated = 0
  let noWine = 0
  let errors = 0

  for (let i = 0; i < tastings.length; i++) {
    const tasting = tastings[i]

    console.log(`Processing ${i + 1}/${tastings.length}: Tasting ${tasting.id}`)

    try {
      // Fetch the wine data for this tasting
      const { data: wines, error: wineError } = await supabase
        .from('wines')
        .select('*')
        .eq('product_id', tasting.product_id)
        .limit(1)

      const wine = wines?.[0]

      let colorScore = 0
      let smellScore = 0
      let tasteScore = 0
      let fyldeScore = 0
      let friskhetScore = 0
      let snaerpScore = 0
      let sodmeScore = 0
      let percentageScore = 0
      let priceScore = 0

      if (wineError || !wine) {
        console.log(`  No wine found for product_id: ${tasting.product_id}`)
        noWine++
      } else {
        // Calculate comprehensive similarity for color, smell, taste
        if (tasting.farge && wine.color) {
          colorScore = await comprehensiveSimilarity(tasting.farge, wine.color)
          console.log(`  Color score: ${colorScore}`)
        }

        const userSmell = `${tasting.smell || ''} ${tasting.lukt || ''}`.trim()
        if (userSmell && wine.smell) {
          smellScore = await comprehensiveSimilarity(userSmell, wine.smell)
          console.log(`  Smell score: ${smellScore}`)
        }

        const userTaste = `${tasting.taste || ''} ${tasting.smak || ''}`.trim()
        if (userTaste && wine.taste) {
          tasteScore = await comprehensiveSimilarity(userTaste, wine.taste)
          console.log(`  Taste score: ${tasteScore}`)
        }

        // Get wine characteristics
        const characteristics = wine.content?.characteristics || []
        const vmpFylde = characteristics.find(x => x.name?.toLowerCase() === 'fylde')?.value
        const vmpFriskhet = characteristics.find(x => x.name?.toLowerCase() === 'friskhet')?.value
        const vmpSnaerp = characteristics.find(x => x.name?.toLowerCase() === 'garvestoffer')?.value
        const vmpSodme = characteristics.find(x => x.name?.toLowerCase() === 'sødme')?.value

        percentageScore = tasting.alkohol && wine.content?.traits?.[0]?.readableValue
          ? calculateNumericSimilarity(tasting.alkohol, wine.content.traits[0].readableValue)
          : 0

        priceScore = tasting.pris && wine.price?.value
          ? calculateNumericSimilarity(tasting.pris, wine.price.value)
          : 0

        snaerpScore = tasting.snaerp && vmpSnaerp
          ? calculateNumericSimilarity(tasting.snaerp, vmpSnaerp)
          : 0

        sodmeScore = tasting.sodme && vmpSodme
          ? calculateNumericSimilarity(tasting.sodme, vmpSodme)
          : 0

        fyldeScore = tasting.fylde && vmpFylde
          ? calculateNumericSimilarity(tasting.fylde, vmpFylde)
          : 0

        friskhetScore = tasting.friskhet && vmpFriskhet
          ? calculateNumericSimilarity(tasting.friskhet, vmpFriskhet)
          : 0
      }

      const scores = {
        color: colorScore,
        smell: smellScore,
        taste: tasteScore,
        friskhet: friskhetScore,
        fylde: fyldeScore,
        snaerp: snaerpScore,
        sodme: sodmeScore,
        percentage: percentageScore,
        price: priceScore
      }

      const halfWeightProps = ['price', 'percentage']

      const { total, weightSum } = Object.entries(scores).reduce(
        (acc, [key, value]) => {
          if (value === 0) return acc
          const weight = halfWeightProps.includes(key) ? 0.2 : 1
          return {
            total: acc.total + value * weight,
            weightSum: acc.weightSum + weight
          }
        },
        { total: 0, weightSum: 0 }
      )

      const overallScore = weightSum > 0 ? Math.round(total / weightSum) : 0

      let transformedKarakter = tasting.karakter
      if (transformedKarakter && transformedKarakter <= 6) {
        transformedKarakter = Math.round(((transformedKarakter - 1) * 9 / 5) + 1)
      }

      const { error: updateError } = await supabase
        .from('tastings')
        .update({
          color_score: isNaN(colorScore) ? 0 : colorScore,
          smell_score: isNaN(smellScore) ? 0 : smellScore,
          taste_score: isNaN(tasteScore) ? 0 : tasteScore,
          fylde_score: isNaN(fyldeScore) ? 0 : fyldeScore,
          friskhet_score: isNaN(friskhetScore) ? 0 : friskhetScore,
          sodme_score: isNaN(sodmeScore) ? 0 : sodmeScore,
          snaerp_score: isNaN(snaerpScore) ? 0 : snaerpScore,
          percentage_score: isNaN(percentageScore) ? 0 : percentageScore,
          price_score: isNaN(priceScore) ? 0 : priceScore,
          overall_score: overallScore,
          karakter: transformedKarakter
        })
        .eq('id', tasting.id)

      if (updateError) {
        console.error(`  Error updating tasting ${tasting.id}:`, updateError.message)
        errors++
      } else {
        console.log(`  Overall score: ${overallScore} - Updated!`)
        updated++
      }

    } catch (error) {
      console.error(`  Error processing tasting ${tasting.id}:`, error.message)
      errors++
    }
  }

  console.log(`\n✅ Recalculation complete!`)
  console.log(`Updated: ${updated}`)
  console.log(`No wine data: ${noWine}`)
  console.log(`Errors: ${errors}`)
}

recalculateTastingScores()
