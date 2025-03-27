import { SelectedFlavor } from './flavorModel';

export type TastingModel = {
  farge: string;
  lukt: string;
  smak: string;
  friskhet: number;
  fylde: number;
  sødme: number;
  snærp: number;
  karakter: number;
  egenskaper: string;
  luktIntensitet: 'lav' | 'middels' | 'høy';
  smaksIntensitet: 'lav' | 'middels' | 'høy';
  selectedFlavorsLukt: SelectedFlavor[];
  selectedFlavorsSmak: SelectedFlavor[];
  userId: string;
  productId: string;
  tastedAt: Date;
};
