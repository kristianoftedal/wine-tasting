import mongoose from 'mongoose';

const TastingSchema = new mongoose.Schema(
  {
    farge: String,
    lukt: String,
    smak: String,
    friskhet: Number,
    fylde: Number,
    sødme: Number,
    snærp: Number,
    karakter: Number,
    egenskaper: String,
    selectedFlavorsLukt: Array,
    selectedFlavorsSmak: Array,
    userId: String,
    productId: String,
    tastedAt: String
  },
  { collection: 'Tastings' } // Specifies the collection name
);

const Tasting = mongoose.models.Tasting || mongoose.model('Tasting', TastingSchema);

export default Tasting;
