// ============================================
// Database Types (from Supabase - snake_case)
// ============================================

export type Profile = {
  id: string;
  email: string;
  name: string;
  created_at: string;
  updated_at: string;
};

export type Group = {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
};

export type GroupMember = {
  id: string;
  group_id: string;
  user_id: string;
  joined_at: string;
};

export type Wine = {
  id: string;
  product_id: string;
  name: string;
  color: string | null;
  smell: string | null;
  taste: string | null;
  year: string | null;
  price: string | null;
  volume: string | null;
  district: string | null;
  main_category: WineType | null;
  main_country: string | null;
  main_producer: string | null;
  sub_district: string | null;
  whole_saler: string | null;
  fylde: number | null;
  friskhet: number | null;
  garvestoff: number | null;
  sodme: number | null;
  alcohol: string;
  grapes: string[];
  sugar: string;
  acidity: string;
  is_good_for: string[];
};

export type WineType = 'Rødvin' | 'Hvitvin' | 'Musserende vin' | 'Rosévin';

export type Event = {
  id: string;
  name: string;
  description: string | null;
  date: string;
  group_id: string;
  wines: string[];
  created_at: string;
};

export type Tasting = {
  id: string;
  user_id: string;
  product_id: string;
  event_id: string | null;

  // Basic tasting attributes
  farge: string | null;
  smell: string | null; // Transformed from selectedFlavorsLukt
  taste: string | null; // Transformed from selectedFlavorsSmak
  lukt: string | null;
  smak: string | null;

  // Numeric characteristics (1-10 scale)
  friskhet: number | null;
  fylde: number | null;
  sodme: number | null;
  snaerp: number | null;
  karakter: number | null;

  // Additional attributes
  egenskaper: string | null;
  lukt_intensitet: Intensitet | null;
  smaks_intensitet: Intensitet | null;
  alkohol: string | null;
  pris: number | null;

  color_score: number | null;
  smell_score: number | null;
  taste_score: number | null;
  percentage_score: number | null;
  price_score: number | null;
  snaerp_score: number | null;
  sodme_score: number | null;
  fylde_score: number | null;
  friskhet_score: number | null;
  overall_score: number | null;

  // Timestamps
  tasted_at: string;
  created_at: string;
  updated_at: string;
};

// ============================================
// Flavor Types (UI/Domain)
// ============================================

export type Flavor = {
  name: string;
  description?: string;
  backgroundColor?: string;
};

export type Subcategory = {
  name: string;
  description?: string;
  flavors: Flavor[];
  backgroundColor?: string;
  icon?: string;
};

export type Category = {
  name: string;
  description?: string;
  subcategories: Subcategory[];
  backgroundColor?: string;
  icon?: string;
  image?: string;
};

export type SelectedFlavor = {
  category: Category;
  subcategory: Subcategory;
  flavor: Flavor;
};

// ============================================
// Form/UI Types (for local state)
// ============================================

export type Intensitet = 'lav' | 'middels' | 'høy' | '';

export type TastingFormData = {
  eventId?: string;
  farge: string;
  smell: string; // Transformed from selectedFlavorsLukt
  taste: string; // Transformed from selectedFlavorsSmak
  lukt: string;
  smak: string;
  friskhet: number;
  fylde: number;
  sodme: number;
  snaerp: number;
  karakter: number;
  egenskaper: string;
  luktIntensitet: Intensitet;
  smaksIntensitet: Intensitet;
  alkohol: string;
  pris: number;
  selectedFlavorsLukt: SelectedFlavor[]; // Keep for UI, will be transformed to smell
  selectedFlavorsSmak: SelectedFlavor[]; // Keep for UI, will be transformed to taste
  userId: string;
  wineId: string;
  tastedAt: Date;
  colorScore: number;
  smellScore: number;
  tasteScore: number;
  percentageScore: number;
  priceScore: number;
  snaerpScore: number;
  sodmeScore: number;
  fyldeScore: number;
  friskhetScore: number;
  overallScore: number;
};

// Initial form values
export const initialTastingForm: TastingFormData = {
  farge: '',
  smell: '',
  taste: '',
  lukt: '',
  smak: '',
  friskhet: 0,
  fylde: 0,
  sodme: 0,
  snaerp: 0,
  karakter: 0,
  egenskaper: '',
  selectedFlavorsLukt: [],
  selectedFlavorsSmak: [],
  luktIntensitet: '',
  smaksIntensitet: '',
  userId: '',
  wineId: '',
  alkohol: '',
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
  overallScore: 0
};
