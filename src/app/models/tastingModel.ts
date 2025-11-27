import type { SelectedFlavor } from "./flavorModel"

export type TastingScores = {
  scoreOverall: number
  scoreFarge: number
  scoreLukt: number
  scoreSmak: number
  scoreFriskhet: number
  scoreFylde: number
  scoreSodme: number
  scoreSnaerp: number
  scoreAlkohol: number
  scorePris: number
}

export type TastingModel = {
  eventId?: string
  farge: string
  lukt: string
  smak: string
  friskhet: number
  fylde: number
  sødme: number
  snærp: number
  karakter: number
  egenskaper: string
  luktIntensitet: "lav" | "middels" | "høy" | ""
  smaksIntensitet: "lav" | "middels" | "høy" | ""
  alkohol: string
  pris: number
  selectedFlavorsLukt: SelectedFlavor[]
  selectedFlavorsSmak: SelectedFlavor[]
  userId: string
  productId: string
  tastedAt: Date
} & TastingScores
