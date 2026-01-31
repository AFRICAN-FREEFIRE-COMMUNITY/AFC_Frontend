"use client";

import { useEffect, useState } from "react";
import { useCart } from "@/contexts/CartContext";
import { useAuth } from "@/contexts/AuthContext";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Minus,
  Plus,
  X,
  CreditCard,
  Loader2,
  ShoppingBasket,
} from "lucide-react";
import Link from "next/link";
import axios from "axios";
import { env } from "@/lib/env";
import { toast } from "sonner";
import { IconCreditCard, IconTrash } from "@tabler/icons-react";

export function CartSheet() {
  const { isCartOpen, setIsCartOpen, clearCart, fetchCartCount, items } =
    useCart();
  const { token } = useAuth();

  const [cartData, setCartData] = useState<any>(null);

  console.log(cartData);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch Cart from Backend
  const fetchCart = async () => {
    if (!token) return;
    try {
      setIsLoading(true);
      const res = await axios.get(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/shop/get-my-cart/`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      setCartData(res.data.cart);
    } catch (error) {
      console.error("Error fetching cart:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Refresh cart whenever the sheet is opened
  useEffect(() => {
    if (isCartOpen) {
      fetchCart();
    }
  }, [isCartOpen]);

  const handleUpdateQuantity = async (
    cartItemId: number,
    newQuantity: number,
  ) => {
    if (newQuantity < 1) return;

    try {
      await axios.post(
        // Ensure this matches backend (POST/PATCH/PUT)
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/shop/update-cart-item-quantity/`,
        {
          cart_item_id: cartItemId,
          quantity: newQuantity,
        },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      fetchCart();
    } catch (error) {
      toast.error("Failed to update quantity");
    }
  };

  // 2. Remove Item Function
  const handleRemoveItem = async (cartItemId: number) => {
    try {
      // Change .delete to .post
      await axios.post(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/shop/remove-from-cart/`,
        {
          cart_item_id: cartItemId,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      toast.success("Item removed");
      fetchCart();
    } catch (error) {
      console.error("Remove Error:", error);
      toast.error("Failed to remove item");
    }
  };

  const formatPrice = (price: string | number) => {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
      minimumFractionDigits: 0,
    }).format(Number(price));
  };

  return (
    <Sheet open={isCartOpen} onOpenChange={setIsCartOpen}>
      <SheetContent className="w-full sm:max-w-md flex flex-col p-0">
        <SheetHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div>
            <SheetTitle>Your Cart</SheetTitle>
            <p className="text-sm text-muted-foreground">
              {items.length} item{items.length !== 1 ? "s" : ""}
            </p>
          </div>

          {/* Clear All Button */}
          {items.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive hover:bg-destructive/10 gap-2"
              onClick={clearCart}
            >
              <IconTrash />
              Clear All
            </Button>
          )}
        </SheetHeader>
        <Separator />

        {isLoading && !cartData ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
            <div className="bg-muted rounded-full p-6 mb-4">
              <ShoppingBasket className="h-10 w-10 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground text-sm mb-4">
              Your cart is feeling a bit light!
            </p>
            <Button asChild onClick={() => setIsCartOpen(false)}>
              <Link href="/shop">Go to Shop</Link>
            </Button>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-auto py-1.5 px-4 space-y-4">
              {items.map((item: any) => (
                <div
                  key={item.cart_item_id}
                  className="flex flex-col gap-2 border-b pb-4 last:border-0"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-semibold text-sm leading-tight">
                        {item.product_name}
                      </h4>
                      <p className="text-xs text-primary font-medium">
                        {item.variant_title}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => handleRemoveItem(item.cart_item_id)}
                    >
                      <X />
                    </Button>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1 bg-muted rounded-md p-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() =>
                          handleUpdateQuantity(
                            item.cart_item_id,
                            item.quantity - 1,
                          )
                        }
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="w-8 text-center text-xs font-bold">
                        {item.quantity}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() =>
                          handleUpdateQuantity(
                            item.cart_item_id,
                            item.quantity + 1,
                          )
                        }
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground line-through">
                        {item.quantity > 1 && formatPrice(item.unit_price)}
                      </p>
                      <p className="font-bold text-sm">
                        {formatPrice(item.line_total)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-6 bg-muted/30 border-t space-y-4">
              <div className="space-y-2.5">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-medium">
                    {formatPrice(cartData?.subtotal || 0)}
                  </span>
                </div>
                <div className="flex justify-between text-sm font-bold">
                  <span>Estimated Total</span>
                  <span className="text-primary">
                    {formatPrice(cartData?.subtotal || 0)}
                  </span>
                </div>
              </div>

              <Button
                className="w-full"
                asChild
                onClick={() => setIsCartOpen(false)}
              >
                <Link href="/shop/checkout">
                  <IconCreditCard />
                  Proceed to Checkout
                </Link>
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
