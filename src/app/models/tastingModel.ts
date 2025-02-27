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
  selectedFlavorsLukt: SelectedFlavor[];
  selectedFlavorsSmak: SelectedFlavor[];
  userId: string;
  productId: string;
};
