import { initialTastingForm, type TastingFormData, type Wine } from '@/lib/types';
import { atom, type PrimitiveAtom } from 'jotai';

export { initialTastingForm };
export const initialTastingValue = initialTastingForm;

export const tastingAtom = atom<TastingFormData>(initialTastingForm);

export const wineAtom = atom<Wine | null>(null) as PrimitiveAtom<Wine | null>;
