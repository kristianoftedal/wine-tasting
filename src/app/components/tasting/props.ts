import { Wine } from '@/app/models/productModel';

export type TastingProps = {
  wine: Wine;
  eventId?: string;
};

export type WizardStep = {
  title: string;
};
