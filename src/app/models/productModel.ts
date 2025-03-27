export interface Wine {
  ageLimit: number;
  allergens: string;
  bioDynamic: boolean;
  buyable: boolean;
  code: string;
  color: string;
  content: Content;
  cork: string;
  description: string;
  distributor: string;
  distributorId: number;
  district: District;
  eco: boolean;
  environmentalPackaging: boolean;
  expired: boolean;
  litrePrice: LitrePrice;
  mainCategory: MainCategory;
  mainCountry: District;
  mainProducer: District;
  name: string;
  packageType: string;
  price: LitrePrice;
  releaseMode: boolean;
  similarProducts: boolean;
  smell: string;
  status: string;
  statusNotification: boolean;
  sub_District: District;
  summary: string;
  sustainable: boolean;
  taste: string;
  url: string;
  volume: LitrePrice;
  wholeSaler: string;
  year: string;
}

export interface Content {
  characteristics: Characteristic[];
  ingredients: Ingredient[];
  isGoodFor: MainCategory[];
  storagePotential: StoragePotential;
  style: Style;
  traits: Trait[];
}

export interface Characteristic {
  name: string;
  readableValue: string;
  value: string;
}

export interface Ingredient {
  code: string;
  formattedValue: string;
  readableValue: string;
}

export type WineType = 'rødvin' | 'hvitvin' | 'musserende_vin' | 'rosevin';

export interface MainCategory {
  code: WineType;
  name: string;
}

export interface StoragePotential {
  code: string;
  formattedValue: string;
}

export interface Style {
  code: string;
  description: string;
  name: string;
}

export interface Trait {
  formattedValue: string;
  name: string;
  readableValue: string;
}

export interface District {
  code: string;
  name: string;
  searchQuery: string;
  url: string;
}

export interface Image {
  altText: string;
  format: string;
  imageType: string;
  url: string;
}

export interface LitrePrice {
  formattedValue: string;
  readableValue: string;
  value: number;
}
