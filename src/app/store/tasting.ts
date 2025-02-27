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
  userId: '',
  productId: ''
} as TastingModel;

export const wineAtom = atom<Wine | null>(null);
export const tastingAtom = atom<TastingModel>({
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
  userId: '',
  productId: ''
});
