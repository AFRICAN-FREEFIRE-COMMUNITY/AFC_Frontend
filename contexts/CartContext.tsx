"use client";

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from "react";
import { useAuth } from "./AuthContext";
import axios from "axios";
import { env } from "@/lib/env";
import { toast } from "sonner";

export interface CartItem {
  id: number;
  name: string;
  price: number;
  quantity: number;
  diamonds?: number;
  image?: string;
}

interface CartContextType {
  items: CartItem[];
  addItem: (item: Omit<CartItem, "quantity">, quantity?: number) => void;
  removeItem: (id: number) => void;
  updateQuantity: (id: number, quantity: number) => void;
  getItemCount: () => number;
  getSubtotal: () => number;
  getTax: () => number;
  getTotal: () => number;
  isCartOpen: boolean;
  setIsCartOpen: (open: boolean) => void;
  fetchCartCount: () => Promise<void>; // Add this to the interface
  clearCart: () => Promise<void>;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const TAX_RATE = 0.05; // 5%

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [isCartOpen, setIsCartOpen] = useState(false);

  const { token } = useAuth();

  const clearCart = useCallback(async () => {
    if (!token) return;
    try {
      await axios.post(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/shop/clear-cart/`,
        {}, // Empty body for POST
        { headers: { Authorization: `Bearer ${token}` } },
      );

      // Reset local states
      setItems([]);
      setTotalItems(0);
      toast.success("Cart cleared");
    } catch (error) {
      console.error("Error clearing cart:", error);
      toast.error("Failed to clear cart");
    }
  }, [token]);

  const fetchCartCount = useCallback(async () => {
    if (!token) {
      setTotalItems(0);
      return;
    }
    try {
      const res = await axios.get(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/shop/get-my-cart/`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setTotalItems(res.data.cart.total_items);
      // Optional: Update items state here too if you want the sheet to stay synced
      setItems(res.data.cart.items);
    } catch (error) {
      console.error("Error fetching count", error);
    }
  }, [token]);

  useEffect(() => {
    fetchCartCount();
  }, [fetchCartCount]);

  const addItem = useCallback(
    (item: Omit<CartItem, "quantity">, quantity: number = 1) => {
      setItems((prevItems) => {
        const existingItem = prevItems.find((i) => i.id === item.id);
        if (existingItem) {
          return prevItems.map((i) =>
            i.id === item.id ? { ...i, quantity: i.quantity + quantity } : i,
          );
        }
        return [...prevItems, { ...item, quantity }];
      });
      setIsCartOpen(true);
    },
    [],
  );

  const removeItem = useCallback((id: number) => {
    setItems((prevItems) => prevItems.filter((item) => item.id !== id));
  }, []);

  const updateQuantity = useCallback((id: number, quantity: number) => {
    if (quantity <= 0) {
      setItems((prevItems) => prevItems.filter((item) => item.id !== id));
    } else {
      setItems((prevItems) =>
        prevItems.map((item) =>
          item.id === id ? { ...item, quantity } : item,
        ),
      );
    }
  }, []);

  const getItemCount = () => totalItems;

  // const getItemCount = useCallback(() => {
  //   return items.reduce((total, item) => total + item.quantity, 0);
  // }, [items]);

  const getSubtotal = useCallback(() => {
    return items.reduce((total, item) => total + item.price * item.quantity, 0);
  }, [items]);

  const getTax = useCallback(() => {
    return getSubtotal() * TAX_RATE;
  }, [getSubtotal]);

  const getTotal = useCallback(() => {
    return getSubtotal() + getTax();
  }, [getSubtotal, getTax]);

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        getItemCount,
        fetchCartCount,
        getSubtotal,
        getTax,
        getTotal,
        isCartOpen,
        setIsCartOpen,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}
