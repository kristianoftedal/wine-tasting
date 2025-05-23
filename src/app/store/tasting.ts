import { atom } from 'jotai';
import { Wine } from '../models/productModel';
import { TastingModel } from '../models/tastingModel';

export const initialTastingValue = {
  farge: '',
  lukt: '',
  smak: '',
  friskhet: 0,
  fylde: 0,
  sødme: 0,
  snærp: 0,
  karakter: 0,
  egenskaper: '',
  selectedFlavorsLukt: [],
  selectedFlavorsSmak: [],
  luktIntensitet: '',
  smaksIntensitet: '',
  userId: '',
  productId: '',
  alkohol: '',
  pris: 0,
  tastedAt: new Date()
} as TastingModel;

export const tastingAtom = atom<TastingModel>(initialTastingValue);

export const wineAtom = atom<Wine | null, [Wine], void>(
  get => get(wineAtom),
  (get, set, newWine) => set(wineAtom, newWine)
);
