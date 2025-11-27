// ============================================
// Database Types (from Supabase - snake_case)
// ============================================

export interface Profile {
  id: string
  email: string
  name: string
  created_at: string
  updated_at: string
}

export interface Group {
  id: string
  name: string
  description: string | null
  created_at: string
}

export interface GroupMember {
  id: string
  group_id: string
  user_id: string
  joined_at: string
}

export interface Wine {
  id: string
  product_id: string
  name: string
  description: string | null
  summary: string | null
  color: string | null
  smell: string | null
  taste: string | null
  year: string | null
  price: WinePrice | null
  volume: WinePrice | null
  litre_price: WinePrice | null
  age_limit: number | null
  allergens: string | null
  bio_dynamic: boolean
  buyable: boolean
  cork: string | null
  distributor: string | null
  distributor_id: number | null
  district: WineDistrict | null
  eco: boolean
  environmental_packaging: boolean
  expired: boolean
  main_category: WineCategory | null
  main_country: WineDistrict | null
  main_producer: WineDistrict | null
  sub_district: WineDistrict | null
  package_type: string | null
  release_mode: boolean
  similar_products: boolean
  status: string | null
  status_notification: boolean
  sustainable: boolean
  url: string | null
  whole_saler: string | null
  content: WineContent | null
  created_at: string
}

export interface WinePrice {
  value: number
  formattedValue: string
  readableValue: string
}

export interface WineDistrict {
  code: string
  name: string
  searchQuery?: string
  url?: string
}

export interface WineCategory {
  code: WineType
  name: string
}

export type WineType = "rødvin" | "hvitvin" | "musserende_vin" | "rosevin"

export interface WineContent {
  characteristics: Array<{ name: string; readableValue: string; value: string }>
  ingredients: Array<{ code: string; formattedValue: string; readableValue: string }>
  isGoodFor: Array<{ code: string; name: string }>
  storagePotential: { code: string; formattedValue: string }
  style: { code: string; description: string; name: string }
  traits: Array<{ formattedValue: string; name: string; readableValue: string }>
}

export interface Event {
  id: string
  name: string
  description: string | null
  date: string
  group_id: string
  wines: string[]
  created_at: string
}

export interface Tasting {
  id: string
  user_id: string
  product_id: string
  event_id: string | null
  farge: string | null
  lukt: string | null
  smak: string | null
  friskhet: number | null
  fylde: number | null
  sodme: number | null
  snaerp: number | null
  karakter: number | null
  egenskaper: string | null
  selected_flavors_lukt: SelectedFlavor[]
  selected_flavors_smak: SelectedFlavor[]
  lukt_intensitet: Intensitet | null
  smaks_intensitet: Intensitet | null
  alkohol: string | null
  pris: number | null
  tasted_at: string
  created_at: string
  farge_score: number | null
  lukt_score: number | null
  smak_friskhet_score: number | null
  smak_sott_score: number | null
  smak_fylde_score: number | null
  smak_score: number | null
  finish_score: number | null
  balance_score: number | null
  overall_score: number | null
  vmp_quality_score: number | null
  vmp_price_score: number | null
  vmp_alcohol_score: number | null
  vmp_total_score: number | null
}

// ============================================
// Flavor Types (UI/Domain)
// ============================================

export interface Flavor {
  name: string
  description?: string
  backgroundColor?: string
}

export interface Subcategory {
  name: string
  description?: string
  flavors: Flavor[]
  backgroundColor?: string
  icon?: string
}

export interface Category {
  name: string
  description?: string
  subcategories: Subcategory[]
  backgroundColor?: string
  icon?: string
  image?: string
}

export interface SelectedFlavor {
  category: Category
  subcategory: Subcategory
  flavor: Flavor
}

// ============================================
// Form/UI Types (for local state)
// ============================================

export type Intensitet = "lav" | "middels" | "høy" | ""

export interface TastingFormData {
  eventId?: string
  farge: string
  lukt: string
  smak: string
  friskhet: number
  fylde: number
  sodme: number
  snaerp: number
  karakter: number
  egenskaper: string
  luktIntensitet: Intensitet
  smaksIntensitet: Intensitet
  alkohol: string
  pris: number
  selectedFlavorsLukt: SelectedFlavor[]
  selectedFlavorsSmak: SelectedFlavor[]
  userId: string
  productId: string
  tastedAt: Date
  scoreFarge: number
  scoreLukt: number
  scoreSmakFriskhet: number
  scoreSmakSott: number
  scoreSmakFylde: number
  scoreSmak: number
  scoreFinish: number
  scoreBalance: number
  scoreOverall: number
  scoreVmpQuality: number
  scoreVmpPrice: number
  scoreVmpAlcohol: number
  scoreVmpTotal: number
}

export interface SearchResult {
  productId: string
  productShortName: string
}

// ============================================
// Utility: Convert between Form and DB types
// ============================================

export function tastingFormToDb(form: TastingFormData): Omit<Tasting, "id" | "created_at"> {
  return {
    user_id: form.userId,
    product_id: form.productId,
    event_id: form.eventId || null,
    farge: form.farge || null,
    lukt: form.lukt || null,
    smak: form.smak || null,
    friskhet: form.friskhet || null,
    fylde: form.fylde || null,
    sodme: form.sodme || null,
    snaerp: form.snaerp || null,
    karakter: form.karakter || null,
    egenskaper: form.egenskaper || null,
    selected_flavors_lukt: form.selectedFlavorsLukt,
    selected_flavors_smak: form.selectedFlavorsSmak,
    lukt_intensitet: form.luktIntensitet || null,
    smaks_intensitet: form.smaksIntensitet || null,
    alkohol: form.alkohol || null,
    pris: form.pris || null,
    tasted_at: form.tastedAt.toISOString(),
    farge_score: form.scoreFarge || null,
    lukt_score: form.scoreLukt || null,
    smak_friskhet_score: form.scoreSmakFriskhet || null,
    smak_sott_score: form.scoreSmakSott || null,
    smak_fylde_score: form.scoreSmakFylde || null,
    smak_score: form.scoreSmak || null,
    finish_score: form.scoreFinish || null,
    balance_score: form.scoreBalance || null,
    overall_score: form.scoreOverall || null,
    vmp_quality_score: form.scoreVmpQuality || null,
    vmp_price_score: form.scoreVmpPrice || null,
    vmp_alcohol_score: form.scoreVmpAlcohol || null,
    vmp_total_score: form.scoreVmpTotal || null,
  }
}

export function tastingDbToForm(db: Tasting): TastingFormData {
  return {
    eventId: db.event_id || undefined,
    farge: db.farge || "",
    lukt: db.lukt || "",
    smak: db.smak || "",
    friskhet: db.friskhet || 0,
    fylde: db.fylde || 0,
    sodme: db.sodme || 0,
    snaerp: db.snaerp || 0,
    karakter: db.karakter || 0,
    egenskaper: db.egenskaper || "",
    luktIntensitet: (db.lukt_intensitet as Intensitet) || "",
    smaksIntensitet: (db.smaks_intensitet as Intensitet) || "",
    alkohol: db.alkohol || "",
    pris: db.pris || 0,
    selectedFlavorsLukt: db.selected_flavors_lukt || [],
    selectedFlavorsSmak: db.selected_flavors_smak || [],
    userId: db.user_id,
    productId: db.product_id,
    tastedAt: new Date(db.tasted_at),
    scoreFarge: db.farge_score || 0,
    scoreLukt: db.lukt_score || 0,
    scoreSmakFriskhet: db.smak_friskhet_score || 0,
    scoreSmakSott: db.smak_sott_score || 0,
    scoreSmakFylde: db.smak_fylde_score || 0,
    scoreSmak: db.smak_score || 0,
    scoreFinish: db.finish_score || 0,
    scoreBalance: db.balance_score || 0,
    scoreOverall: db.overall_score || 0,
    scoreVmpQuality: db.vmp_quality_score || 0,
    scoreVmpPrice: db.vmp_price_score || 0,
    scoreVmpAlcohol: db.vmp_alcohol_score || 0,
    scoreVmpTotal: db.vmp_total_score || 0,
  }
}

// Initial form values
export const initialTastingForm: TastingFormData = {
  farge: "",
  lukt: "",
  smak: "",
  friskhet: 0,
  fylde: 0,
  sodme: 0,
  snaerp: 0,
  karakter: 0,
  egenskaper: "",
  selectedFlavorsLukt: [],
  selectedFlavorsSmak: [],
  luktIntensitet: "",
  smaksIntensitet: "",
  userId: "",
  productId: "",
  alkohol: "",
  pris: 0,
  tastedAt: new Date(),
  scoreFarge: 0,
  scoreLukt: 0,
  scoreSmakFriskhet: 0,
  scoreSmakSott: 0,
  scoreSmakFylde: 0,
  scoreSmak: 0,
  scoreFinish: 0,
  scoreBalance: 0,
  scoreOverall: 0,
  scoreVmpQuality: 0,
  scoreVmpPrice: 0,
  scoreVmpAlcohol: 0,
  scoreVmpTotal: 0,
}
