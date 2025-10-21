"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"

export type CartItem = {
  id: number
  name: string
  price: number
  quantity: number
  isGift?: boolean
  giftEmail?: string
}

type CartContextType = {
  cartItems: CartItem[]
  addToCart: (item: CartItem) => void
  removeFromCart: (id: number) => void
  updateQuantity: (id: number, quantity: number) => void
  updateGiftStatus: (id: number, isGift: boolean, giftEmail?: string) => void
  clearCart: () => void
  subtotal: number
  tax: number
  total: number
}

const CartContext = createContext<CartContextType | undefined>(undefined)

export const useCart = () => {
  const context = useContext(CartContext)
  if (context === undefined) {
    // During SSR or when not wrapped in a provider, return a default empty state
    // This prevents errors during initial render
    if (typeof window === "undefined") {
      return {
        cartItems: [],
        addToCart: () => {},
        removeFromCart: () => {},
        updateQuantity: () => {},
        updateGiftStatus: () => {},
        clearCart: () => {},
        subtotal: 0,
        tax: 0,
        total: 0,
      }
    }
    throw new Error("useCart must be used within a CartProvider")
  }
  return context
}

export const CartProvider = ({ children }: { children: ReactNode }) => {
  const [cartItems, setCartItems] = useState<CartItem[]>([])
  const [isInitialized, setIsInitialized] = useState(false)

  // Load cart from localStorage on initial render
  useEffect(() => {
    try {
      const savedCart = localStorage.getItem("cart")
      if (savedCart) {
        setCartItems(JSON.parse(savedCart))
      }
    } catch (error) {
      console.error("Failed to parse cart from localStorage:", error)
    } finally {
      setIsInitialized(true)
    }
  }, [])

  // Save cart to localStorage whenever it changes
  useEffect(() => {
    if (isInitialized) {
      try {
        localStorage.setItem("cart", JSON.stringify(cartItems))
      } catch (error) {
        console.error("Failed to save cart to localStorage:", error)
      }
    }
  }, [cartItems, isInitialized])

  const addToCart = (item: CartItem) => {
    setCartItems((prev) => {
      // Check if item already exists in cart
      const existingItemIndex = prev.findIndex((i) => i.id === item.id)

      if (existingItemIndex >= 0) {
        // Update quantity if item exists
        const updatedItems = [...prev]
        updatedItems[existingItemIndex] = {
          ...updatedItems[existingItemIndex],
          quantity: updatedItems[existingItemIndex].quantity + item.quantity,
        }
        return updatedItems
      } else {
        // Add new item if it doesn't exist
        return [...prev, item]
      }
    })
  }

  const removeFromCart = (id: number) => {
    setCartItems((prev) => prev.filter((item) => item.id !== id))
  }

  const updateQuantity = (id: number, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(id)
      return
    }

    setCartItems((prev) => prev.map((item) => (item.id === id ? { ...item, quantity } : item)))
  }

  const updateGiftStatus = (id: number, isGift: boolean, giftEmail?: string) => {
    setCartItems((prev) => prev.map((item) => (item.id === id ? { ...item, isGift, giftEmail } : item)))
  }

  const clearCart = () => {
    setCartItems([])
  }

  // Calculate totals
  const subtotal = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const tax = subtotal * 0.05 // 5% tax
  const total = subtotal + tax

  const value = {
    cartItems,
    addToCart,
    removeFromCart,
    updateQuantity,
    updateGiftStatus,
    clearCart,
    subtotal,
    tax,
    total,
  }

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}
