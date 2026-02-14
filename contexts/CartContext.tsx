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
  cart_item_id: number;
  variant_id: string;
  variant_title?: string;
  name: string;
  line_total: string;
  unit_price: string;
  product_name: string;
  price: number;
  quantity: number;
  diamonds?: number;
  image?: string;
  coupon_code?: string;
  coupon_discount_type?: "percent" | "fixed";
  coupon_discount_value?: number;
  in_stock?: boolean;
}

interface CartContextType {
  items: CartItem[];
  addItem: (item: Omit<CartItem, "quantity">, quantity?: number) => void;
  removeItem: (id: number) => void;
  updateQuantity: (id: number, quantity: number) => void;
  getItemCount: () => number;
  getSubtotal: () => number;
  getOriginalSubtotal: () => number;
  getTax: () => number | string;
  getTotal: () => number | string;
  isCartOpen: boolean;
  setIsCartOpen: (open: boolean) => void;
  fetchCartCount: () => Promise<void>;
  fetchCart: () => Promise<void>;
  clearCart: () => Promise<void>;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const TAX_RATE = 0.075; // 7.5%

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

  const mapCartItems = useCallback(
    (rawItems: any[]): CartItem[] =>
      rawItems.map((item: any) => ({
        ...item,
        id: item.cart_item_id,
        cart_item_id: item.cart_item_id,
        coupon_code: item.coupon || "",
      })),
    [],
  );

  const enrichItemsWithCoupons = useCallback(
    async (cartItems: CartItem[]): Promise<CartItem[]> => {
      const itemsWithCoupons = cartItems.filter((item) => item.coupon_code);
      if (itemsWithCoupons.length === 0) return cartItems;

      // Get unique coupon codes
      const uniqueCoupons = [
        ...new Set(itemsWithCoupons.map((item) => item.coupon_code)),
      ];

      // Fetch details for each unique coupon
      const couponDetailsMap = new Map<
        string,
        { type: "percent" | "fixed"; value: number }
      >();

      await Promise.all(
        uniqueCoupons.map(async (code) => {
          try {
            const res = await axios.post(
              `${env.NEXT_PUBLIC_BACKEND_API_URL}/shop/get-coupon-details-with-code/`,
              { coupon_code: code },
              { headers: { Authorization: `Bearer ${token}` } },
            );
            const details = res.data.coupon_details;
            if (details.is_active) {
              couponDetailsMap.set(code!, {
                type: details.discount_type,
                value: parseFloat(details.discount_value),
              });
            }
          } catch (error) {
            console.error(
              `Failed to fetch coupon details for ${code}:`,
              error,
            );
          }
        }),
      );

      // Calculate discounted prices
      return cartItems.map((item) => {
        if (!item.coupon_code || !couponDetailsMap.has(item.coupon_code))
          return item;

        const coupon = couponDetailsMap.get(item.coupon_code)!;
        const originalTotal = Number(item.unit_price) * item.quantity;
        let discountedTotal: number;

        if (coupon.type === "percent") {
          discountedTotal = originalTotal * (1 - coupon.value / 100);
        } else {
          discountedTotal = Math.max(0, originalTotal - coupon.value);
        }

        return {
          ...item,
          line_total: discountedTotal.toFixed(2),
          coupon_discount_type: coupon.type,
          coupon_discount_value: coupon.value,
        };
      });
    },
    [token],
  );

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

  const fetchCart = useCallback(async () => {
    if (!token) return;
    try {
      const res = await axios.get(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/shop/get-my-cart/`,
        { headers: { Authorization: `Bearer ${token}` } },
      );

      setTotalItems(res.data.cart.total_items);
      const mappedItems = mapCartItems(res.data.cart.items || []);
      const enrichedItems = await enrichItemsWithCoupons(mappedItems);
      setItems(enrichedItems);
    } catch (error) {
      console.error("Error fetching cart", error);
    }
  }, [token, mapCartItems, enrichItemsWithCoupons]);

  // Update the useEffect to use the new fetchCart function
  useEffect(() => {
    fetchCart();
  }, [fetchCart]);

  const getSubtotal = useCallback(() => {
    return items.reduce(
      (total, item) => total + Number(item.line_total),
      0,
    );
  }, [items]);

  const getOriginalSubtotal = useCallback(() => {
    return items.reduce(
      (total, item) => total + Number(item.unit_price) * item.quantity,
      0,
    );
  }, [items]);

  const getTax = useCallback(() => {
    return (getSubtotal() * TAX_RATE).toFixed(2);
  }, [getSubtotal]);

  const getTotal = useCallback(() => {
    return (Number(getSubtotal()) + Number(getTax())).toFixed(2);
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
        fetchCart,
        getSubtotal,
        getOriginalSubtotal,
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
