"use client"

import type { ReactNode } from "react"
import { LightboxProvider, ToastProvider } from "./kit"

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <LightboxProvider>{children}</LightboxProvider>
    </ToastProvider>
  )
}
