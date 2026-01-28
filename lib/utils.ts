import { clsx, type ClassValue } from "clsx"

// <CHANGE> Removed tailwind-merge, now using clsx only
export function cn(...inputs: ClassValue[]) {
  return clsx(inputs)
}
