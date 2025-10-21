"use client"

import type React from "react"

import { ThemeProvider } from "@/components/theme-provider"
import { CartProvider } from "@/contexts/CartContext"

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
      <CartProvider>{children}</CartProvider>
    </ThemeProvider>
  )
}
