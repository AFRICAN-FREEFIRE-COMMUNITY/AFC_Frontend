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
// Shared-chrome strings live in messages/en/common.json under "common".
import { useTranslations } from "next-intl";
// Multi-currency money chokepoint: renders cart line/subtotal amounts (stored in NGN)
// in the viewer's display currency (CurrencyContext). formatPrice is kept only for the
// two coupon/"you save" strings that interpolate money INTO a translated sentence.
import { Money } from "@/components/Money";
import { useCurrency } from "@/contexts/CurrencyContext";
import { displayMoney } from "@/lib/money";

export function CartSheet() {
  const t = useTranslations("common");
  const { rates, currency } = useCurrency();
  const {
    isCartOpen,
    setIsCartOpen,
    clearCart,
    fetchCart,
    items,
    getSubtotal,
    getOriginalSubtotal,
  } = useCart();
  const { token } = useAuth();

  const [isLoading, setIsLoading] = useState(false);

  // Refresh cart whenever the sheet is opened
  useEffect(() => {
    if (isCartOpen) {
      setIsLoading(true);
      fetchCart().finally(() => setIsLoading(false));
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
      toast.error(t("cart.updateFailed"));
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
      toast.success(t("cart.removed"));
      fetchCart();
    } catch (error) {
      console.error("Remove Error:", error);
      toast.error(t("cart.removeFailed"));
    }
  };

  // Currency-aware string formatter for money interpolated INTO translated sentences (coupon
  // discount / "you save"), where <Money/> (a component) can't be used. Converts the stored NGN
  // amount to the viewer's display currency. Owner 2026-06-30 multi-currency.
  const formatPrice = (price: string | number) =>
    displayMoney(Number(price) || 0, "NGN", currency, rates);

  return (
    <Sheet open={isCartOpen} onOpenChange={setIsCartOpen}>
      <SheetContent className="w-full sm:max-w-md flex flex-col p-0">
        <SheetHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div>
            <SheetTitle>{t("cart.title")}</SheetTitle>
            <p className="text-sm text-muted-foreground">
              {t("cart.itemCount", { count: items.length })}
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
              {t("cart.clearAll")}
            </Button>
          )}
        </SheetHeader>
        <Separator />

        {isLoading && items.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
            <div className="bg-muted rounded-full p-6 mb-4">
              <ShoppingBasket className="h-10 w-10 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground text-sm mb-4">
              {t("cart.empty")}
            </p>
            <Button asChild onClick={() => setIsCartOpen(false)}>
              <Link href="/shop">{t("cart.goToShop")}</Link>
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
                      {item.coupon_code && (
                        <p className="text-xs text-green-500 font-medium mt-0.5">
                          {t("cart.couponLabel", { code: item.coupon_code })}
                          {item.coupon_discount_type === "percent"
                            ? t("cart.couponPercentOff", {
                                value: item.coupon_discount_value,
                              })
                            : item.coupon_discount_value
                              ? t("cart.couponFixedOff", {
                                  value: formatPrice(
                                    item.coupon_discount_value,
                                  ),
                                })
                              : ""}
                        </p>
                      )}
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
                      {(item.coupon_code ||
                        item.quantity > 1) &&
                        Number(item.line_total) <
                          Number(item.unit_price) * item.quantity && (
                          <p className="text-xs text-muted-foreground line-through">
                            <Money
                              amount={Number(item.unit_price) * item.quantity}
                            />
                          </p>
                        )}
                      <p className="font-bold text-sm">
                        <Money amount={item.line_total} />
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-6 bg-muted/30 border-t space-y-4">
              {getOriginalSubtotal() > getSubtotal() && (
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">
                    {t("cart.original")}
                  </span>
                  <span className="text-muted-foreground line-through">
                    <Money amount={getOriginalSubtotal()} />
                  </span>
                </div>
              )}
              <div className="flex justify-between text-sm font-bold">
                <span>{t("cart.estimatedTotal")}</span>
                <span className="text-primary">
                  <Money amount={getSubtotal()} />
                </span>
              </div>
              {getOriginalSubtotal() > getSubtotal() && (
                <p className="text-xs text-green-500 font-medium">
                  {t("cart.youSave", {
                    amount: formatPrice(
                      getOriginalSubtotal() - getSubtotal(),
                    ),
                  })}
                </p>
              )}

              <Button
                className="w-full"
                asChild
                onClick={() => setIsCartOpen(false)}
              >
                <Link href="/shop/cart">
                  <IconCreditCard />
                  {t("cart.proceedToCheckout")}
                </Link>
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
