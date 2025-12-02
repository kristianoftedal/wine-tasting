import { atom, type PrimitiveAtom } from "jotai"
import { type Wine, type TastingFormData, initialTastingForm } from "@/lib/types"

export { initialTastingForm }
export const initialTastingValue = initialTastingForm

export const tastingAtom = atom<TastingFormData>(initialTastingForm)

export const wineAtom = atom<Wine | null>(null) as PrimitiveAtom<Wine | null>
