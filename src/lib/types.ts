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

  // Basic tasting attributes
  farge: string | null
  smell: string | null // Transformed from selectedFlavorsLukt
  taste: string | null // Transformed from selectedFlavorsSmak
  lukt: string | null
  smak: string | null

  // Numeric characteristics (1-10 scale)
  friskhet: number | null
  fylde: number | null
  sodme: number | null
  snaerp: number | null
  karakter: number | null

  // Additional attributes
  egenskaper: string | null
  lukt_intensitet: Intensitet | null
  smaks_intensitet: Intensitet | null
  alkohol: string | null
  pris: number | null

  color_score: number | null
  smell_score: number | null
  taste_score: number | null
  percentage_score: number | null
  price_score: number | null
  snaerp_score: number | null
  sodme_score: number | null
  fylde_score: number | null
  friskhet_score: number | null
  overall_score: number | null

  // Timestamps
  tasted_at: string
  created_at: string
  updated_at: string
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
  smell: string // Transformed from selectedFlavorsLukt
  taste: string // Transformed from selectedFlavorsSmak
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
  selectedFlavorsLukt: SelectedFlavor[] // Keep for UI, will be transformed to smell
  selectedFlavorsSmak: SelectedFlavor[] // Keep for UI, will be transformed to taste
  userId: string
  productCode: string
  tastedAt: Date

  colorScore: number
  smellScore: number
  tasteScore: number
  percentageScore: number
  priceScore: number
  snaerpScore: number
  sodmeScore: number
  fyldeScore: number
  friskhetScore: number
  overallScore: number
}

// ============================================
// Utility: Convert between Form and DB types
// ============================================

export function tastingFormToDb(form: TastingFormData): Omit<Tasting, "id" | "created_at" | "updated_at"> {
  const smellFlavors = form.selectedFlavorsLukt.map((f) => f.flavor.name).join(", ")
  const tasteFlavors = form.selectedFlavorsSmak.map((f) => f.flavor.name).join(", ")

  return {
    user_id: form.userId,
    product_id: form.productCode,
    event_id: form.eventId || null,
    farge: form.farge || null,
    smell: smellFlavors || null,
    taste: tasteFlavors || null,
    lukt: form.lukt || null,
    smak: form.smak || null,
    friskhet: form.friskhet || null,
    fylde: form.fylde || null,
    sodme: form.sodme || null,
    snaerp: form.snaerp || null,
    karakter: form.karakter || null,
    egenskaper: form.egenskaper || null,
    lukt_intensitet: form.luktIntensitet || null,
    smaks_intensitet: form.smaksIntensitet || null,
    alkohol: form.alkohol || null,
    pris: form.pris || null,
    tasted_at: form.tastedAt.toISOString(),
    color_score: form.colorScore || null,
    smell_score: form.smellScore || null,
    taste_score: form.tasteScore || null,
    percentage_score: form.percentageScore || null,
    price_score: form.priceScore || null,
    snaerp_score: form.snaerpScore || null,
    sodme_score: form.sodmeScore || null,
    fylde_score: form.fyldeScore || null,
    friskhet_score: form.friskhetScore || null,
    overall_score: form.overallScore || null,
  }
}

export function tastingDbToForm(db: Tasting): TastingFormData {
  const selectedFlavorsLukt: SelectedFlavor[] = []
  const selectedFlavorsSmak: SelectedFlavor[] = []

  return {
    eventId: db.event_id || undefined,
    farge: db.farge || "",
    smell: db.smell || "",
    taste: db.taste || "",
    lukt: db.lukt || "",
    smak: db.smak || "",
    friskhet: db.friskhet || 0,
    fylde: db.fylde || 0,
    sodme: db.sodme || 0,
    snaerp: db.snaerp || 0,
    karakter: db.karakter || 0,
    egenskaper: db.egenskaper || "",
    selectedFlavorsLukt,
    selectedFlavorsSmak,
    userId: db.user_id,
    productCode: db.product_id,
    tastedAt: new Date(db.tasted_at),
    colorScore: db.color_score || 0,
    smellScore: db.smell_score || 0,
    tasteScore: db.taste_score || 0,
    percentageScore: db.percentage_score || 0,
    priceScore: db.price_score || 0,
    snaerpScore: db.snaerp_score || 0,
    sodmeScore: db.sodme_score || 0,
    fyldeScore: db.fylde_score || 0,
    friskhetScore: db.friskhet_score || 0,
    overallScore: db.overall_score || 0,
  }
}

// Initial form values
export const initialTastingForm: TastingFormData = {
  farge: "",
  smell: "",
  taste: "",
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
  productCode: "",
  alkohol: "",
  pris: 0,
  tastedAt: new Date(),
  colorScore: 0,
  smellScore: 0,
  tasteScore: 0,
  percentageScore: 0,
  priceScore: 0,
  snaerpScore: 0,
  sodmeScore: 0,
  fyldeScore: 0,
  friskhetScore: 0,
  overallScore: 0,
}
