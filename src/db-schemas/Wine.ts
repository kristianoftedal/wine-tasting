import mongoose from 'mongoose';

const CharacteristicSchema = new mongoose.Schema({
  name: String,
  readableValue: String,
  value: String
});

const IngredientSchema = new mongoose.Schema({
  code: String,
  formattedValue: String,
  readableValue: String
});

const MainCategorySchema = new mongoose.Schema({
  code: String,
  name: String
});

const StoragePotentialSchema = new mongoose.Schema({
  code: String,
  formattedValue: String
});

const StyleSchema = new mongoose.Schema({
  code: String,
  description: String,
  name: String
});

const TraitSchema = new mongoose.Schema({
  formattedValue: String,
  name: String,
  readableValue: String
});

const DistrictSchema = new mongoose.Schema({
  code: String,
  name: String,
  searchQuery: String,
  url: String
});

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const ImageSchema = new mongoose.Schema({
  altText: String,
  format: String,
  imageType: String,
  url: String
});

const LitrePriceSchema = new mongoose.Schema({
  formattedValue: String,
  readableValue: String,
  value: Number
});

const ContentSchema = new mongoose.Schema({
  characteristics: [CharacteristicSchema],
  ingredients: [IngredientSchema],
  isGoodFor: [MainCategorySchema],
  storagePotential: StoragePotentialSchema,
  style: StyleSchema,
  traits: [TraitSchema]
});

const WineSchema = new mongoose.Schema(
  {
    ageLimit: Number,
    allergens: String,
    bioDynamic: Boolean,
    buyable: Boolean,
    code: String,
    color: String,
    content: ContentSchema,
    cork: String,
    description: String,
    distributor: String,
    distributorId: Number,
    district: DistrictSchema,
    eco: Boolean,
    environmentalPackaging: Boolean,
    expired: Boolean,
    litrePrice: LitrePriceSchema,
    mainCategory: MainCategorySchema,
    mainCountry: DistrictSchema,
    mainProducer: DistrictSchema,
    name: String,
    packageType: String,
    price: LitrePriceSchema,
    releaseMode: Boolean,
    similarProducts: Boolean,
    smell: String,
    status: String,
    statusNotification: Boolean,
    sub_District: DistrictSchema,
    summary: String,
    sustainable: Boolean,
    taste: String,
    url: String,
    volume: LitrePriceSchema,
    wholeSaler: String,
    year: String
  },
  { collection: 'WinesDetailed' } // Specifies the collection name in MongoDB
);

// Ensure the model is registered only once
const Wine = mongoose.models.Wine || mongoose.model('Wines', WineSchema);

export default Wine;
