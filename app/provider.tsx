"use client"

import { Provider as JotaiProvider } from "jotai"
import type React from "react"

type Props = {
  children?: React.ReactNode
}

export const Provider = ({ children }: Props) => {
  return <JotaiProvider>{children}</JotaiProvider>
}
