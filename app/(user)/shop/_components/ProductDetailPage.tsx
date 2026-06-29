"use client";

import { useState, useMemo, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Minus,
  Plus,
  Loader2,
  AlertCircle,
  Truck,
  Zap,
  Heart,
} from "lucide-react";
import Link from "next/link";
import axios from "axios";
import { env } from "@/lib/env";
// Wishlist ("save for later") data layer: read this product's saved state on mount and
// toggle it from the Save / Saved button next to Add to Cart.
import { getMyWishlistIds, toggleWishlist } from "@/lib/wishlist";
import { useCart } from "@/contexts/CartContext";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { IconDiamond, IconShoppingCart } from "@tabler/icons-react";
import { Loader } from "@/components/Loader";
import { PageHeader } from "@/components/PageHeader";
import { formatMoneyInput } from "@/lib/utils";
import { ComingSoon } from "@/components/ComingSoon";
import { InfoTip } from "@/components/ui/info-tip";
import {
  ProductMediaGallery,
  ProductMediaItem,
} from "./ProductMediaGallery";

// Interfaces based on the API (now generalised past diamonds).
interface Variant {
  id: number;
  sku: string;
  title: string;
  price: string;
  diamonds_amount: number;
  stock_qty: number;
  is_active: boolean;
  in_stock: boolean;
  meta?: Record<string, any>; // free-form attributes (size/color/storage)
}

interface ProductCategory {
  id: number;
  name: string;
  slug: string;
  is_physical: boolean;
  is_active: boolean;
}

interface ProductData {
  id: number;
  name: string;
  type: string;
  category: ProductCategory | null;
  description: string;
  status: string;
  image: string | null;
  media: ProductMediaItem[]; // image + video gallery
  variants: Variant[];
}

export default function ProductDetailPage() {
  // Localized copy for the product detail page (messages/en/shop.json -> "detail").
  const t = useTranslations("shop");
  const params = useParams();
  const router = useRouter();
  const { fetchCartCount } = useCart();
  const { token } = useAuth();

  const [product, setProduct] = useState<ProductData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedVariant, setSelectedVariant] = useState<Variant | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [quantity, setQuantity] = useState(1);
  // Wishlist: whether THIS product is in the signed-in user's saved list (drives the
  // Save / Saved button), plus an in-flight flag to disable it during a toggle.
  const [isSaved, setIsSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // ... existing state
  const [couponCode, setCouponCode] = useState("");
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);
  const [appliedCoupon, setAppliedCoupon] = useState<{
    code: string;
    type: "percent" | "fixed";
    value: number;
  } | null>(null);

  const handleApplyCoupon = async () => {
    if (!couponCode) return;

    try {
      setIsApplyingCoupon(true);
      const res = await axios.post(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/shop/get-coupon-details-with-code/`,
        { coupon_code: couponCode },
        {
          headers: { Authorization: `Bearer ${token}` }, // Added token if required
        },
      );

      const details = res.data.coupon_details;

      if (details.is_active) {
        setAppliedCoupon({
          code: details.code,
          type: details.discount_type,
          value: parseFloat(details.discount_value),
        });
        toast.success(t("detail.coupon.successApplied"));
      } else {
        toast.error(t("detail.coupon.inactive"));
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || t("detail.coupon.invalid"));
      setAppliedCoupon(null);
    } finally {
      setIsApplyingCoupon(false);
    }
  };

  // Calculate final price based on coupon
  const finalSubtotal = useMemo(() => {
    const base = parseFloat(selectedVariant?.price || "0") * quantity;
    if (!appliedCoupon) return base;

    if (appliedCoupon.type === "percent") {
      return base * (1 - appliedCoupon.value / 100);
    } else {
      return Math.max(0, base - appliedCoupon.value);
    }
  }, [selectedVariant, quantity, appliedCoupon]);

  // 1. Fetch Product Details
  useEffect(() => {
    const fetchDetails = async () => {
      try {
        setLoading(true);
        const res = await axios.get(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/shop/view-product-details/?product_id=${params.id}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );
        const data = res.data.product;
        setProduct(data);

        // Auto-select the first active variant
        const firstAvailable = data.variants.find((v: Variant) => v.is_active);
        if (firstAvailable) setSelectedVariant(firstAvailable);
      } catch (error) {
        console.error("Error fetching product:", error);
      } finally {
        setLoading(false);
      }
    };
    if (params.id) fetchDetails();
  }, [params.id]);

  // Seed the saved state for this product so the Save / Saved button renders correctly on
  // mount. Wishlist is per-user, so only check when signed in (anonymous users see "Save",
  // and clicking nudges them to log in). Non-fatal on failure.
  useEffect(() => {
    if (!token || !params.id) {
      setIsSaved(false);
      return;
    }
    let cancelled = false;
    getMyWishlistIds(token)
      .then((res) => {
        if (!cancelled) setIsSaved(res.product_ids.includes(Number(params.id)));
      })
      .catch((err) => {
        console.error("Failed to load wishlist state", err);
      });
    return () => {
      cancelled = true;
    };
  }, [token, params.id]);

  const handleAddToCart = async (redirectToCart = false) => {
    if (!selectedVariant) return;

    try {
      setIsAdding(true);
      const response = await axios.post(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/shop/add-to-cart/`,
        {
          variant_id: selectedVariant.id,
          quantity: quantity,
          coupon_code: couponCode,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        },
      );

      toast.success(t("detail.toast.addedToCart", { name: product?.name ?? "" }));

      await fetchCartCount();

      if (redirectToCart) {
        router.push("/shop/cart");
      }
    } catch (error: any) {
      const errorMsg =
        error.response?.data?.message || t("detail.toast.addFailed");
      toast.error(errorMsg);
    } finally {
      setIsAdding(false);
    }
  };

  // Toggle this product in/out of the saved list. Optimistic: flip the local state, call
  // the backend (toggleWishlist), revert + toast on failure. Anonymous users have no token,
  // so we nudge them to log in instead of calling the API. Mirrors the heart on the shop cards.
  const handleToggleSave = async () => {
    if (!token) {
      toast.info(t("wishlist.loginToSave"));
      return;
    }
    if (!product) return;
    const wasSaved = isSaved;
    setIsSaved(!wasSaved); // optimistic flip
    setIsSaving(true);
    try {
      const res = await toggleWishlist(product.id, token);
      toast.success(
        res.saved ? t("wishlist.savedToast") : t("wishlist.removedToast"),
      );
    } catch (error) {
      setIsSaved(wasSaved); // revert on failure
      toast.error(t("wishlist.errorToast"));
    } finally {
      setIsSaving(false);
    }
  };

  const formatPrice = (price: string | number) => {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
      minimumFractionDigits: 0,
    }).format(Number(price));
  };

  const handleQuantityChange = (delta: number) => {
    setQuantity((prev) => Math.max(1, Math.min(99, prev + delta)));
  };

  if (loading)
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );

  if (!product)
    return (
      <div className="text-center py-10">
        <h2 className="text-2xl font-bold">{t("detail.notFoundTitle")}</h2>
        <Button asChild className="mt-4">
          <Link href="/shop">{t("detail.backToShop")}</Link>
        </Button>
      </div>
    );

  // Physical vs digital: physical goods ship + surface meta attributes
  // (size/color/storage); digital topups (diamonds) deliver to the game UID.
  const isPhysical =
    product.category?.is_physical ?? product.type !== "diamonds";

  // Render a variant's secondary line: diamond amount for topups, or its meta
  // attribute chips (size: M, color: Black, ...) for physical goods.
  const variantMetaLine = (variant: Variant) => {
    if (!isPhysical && variant.diamonds_amount > 0) {
      return (
        <div className="flex items-center text-sm text-primary">
          <IconDiamond className="h-3 w-3 mr-1" />{" "}
          {t("detail.diamonds", {
            amount: formatMoneyInput(variant.diamonds_amount),
          })}
        </div>
      );
    }
    const meta = variant.meta || {};
    const entries = Object.entries(meta);
    if (entries.length === 0) return null;
    return (
      <div className="text-xs text-muted-foreground">
        {entries.map(([k, v]) => `${k}: ${v}`).join("  ·  ")}
      </div>
    );
  };

  return (
    <div>
      {/* <ComingSoon /> */}
      <PageHeader back title={product.name} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left: Media gallery (images + videos at fixed dimensions). Falls back
            to the product image, then DEFAULT_IMAGE, for legacy diamond rows. */}
        <Card className="overflow-hidden p-0 border-none bg-transparent">
          <ProductMediaGallery
            media={product.media}
            fallbackImage={product.image}
            alt={product.name}
            variant="detail"
          />
        </Card>

        {/* Right: Info Section */}
        <div className="space-y-4">
          <div>
            <Badge
              className="capitalize mb-1.5 rounded-full px-2 py-0.5 text-xs"
              variant="outline"
            >
              {product.category?.name || product.type}
            </Badge>
            <h1 className="text-3xl font-bold">{product.name}</h1>
            <p className="text-muted-foreground text-sm mt-2">
              {product.description}
            </p>

            {/* delivery hint: physical goods ship, digital topups go to the UID */}
            {isPhysical ? (
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground mt-2">
                <Truck className="h-3.5 w-3.5" />
                {t("detail.physicalHint")}
              </p>
            ) : (
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground mt-2">
                <Zap className="h-3.5 w-3.5" />
                {t("detail.digitalHint")}
              </p>
            )}
          </div>

          {/* Variant Selection */}
          <div className="space-y-2.5">
            <Label>{t("detail.selectOption")}</Label>
            <div className="grid grid-cols-1 gap-3">
              {product.variants.map((variant) => (
                <button
                  key={variant.id}
                  disabled={!variant.in_stock || !variant.is_active}
                  onClick={() => setSelectedVariant(variant)}
                  className={`flex items-center justify-between p-3 rounded-lg border-2 transition-all ${
                    selectedVariant?.id === variant.id
                      ? "border-primary bg-primary/5"
                      : "border-muted hover:border-primary/50"
                  } ${(!variant.in_stock || !variant.is_active) && "opacity-50 cursor-not-allowed"}`}
                >
                  <div className="text-left">
                    <p className="font-semibold text-sm">{variant.title}</p>
                    {variantMetaLine(variant)}
                  </div>
                  <div className="text-right">
                    <p className="font-bold">{formatPrice(variant.price)}</p>
                    {!variant.in_stock && (
                      <span className="text-xs text-destructive">
                        {t("detail.outOfStock")}
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Quantity and Actions */}
          {selectedVariant && (
            <Card className="bg-muted/30">
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handleQuantityChange(-1)}
                      disabled={quantity <= 1}
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    <span className="text-lg font-bold w-8 text-center">
                      {quantity}
                    </span>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handleQuantityChange(1)}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">
                      {t("detail.subtotal")}
                    </p>
                    {appliedCoupon && (
                      <p className="text-xs text-muted-foreground line-through">
                        {formatPrice(
                          parseFloat(selectedVariant.price) * quantity,
                        )}
                      </p>
                    )}
                    <p className="text-2xl font-bold text-primary">
                      {formatPrice(finalSubtotal)}
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label
                    htmlFor="coupon"
                    className="text-xs uppercase text-muted-foreground"
                  >
                    {t("detail.promoLabel")}
                    <InfoTip id="shop.checkout.coupon" className="ml-1" />
                  </Label>
                  <div className="flex gap-1">
                    <Input
                      id="coupon"
                      placeholder={t("detail.promoPlaceholder")}
                      value={couponCode}
                      onChange={(e) =>
                        setCouponCode(e.target.value.toUpperCase())
                      }
                      className="uppercase h-12"
                    />
                    <Button
                      variant="outline"
                      onClick={handleApplyCoupon}
                      disabled={isApplyingCoupon || !couponCode}
                    >
                      {isApplyingCoupon ? (
                        <Loader text={t("detail.applying")} />
                      ) : (
                        t("detail.apply")
                      )}
                    </Button>
                  </div>
                  {appliedCoupon && (
                    <p className="text-xs text-green-500 font-medium flex items-center gap-1">
                      ✓{" "}
                      {appliedCoupon.type === "percent"
                        ? t("detail.couponAppliedPercent", {
                            code: appliedCoupon.code,
                            value: appliedCoupon.value,
                          })
                        : t("detail.couponAppliedFixed", {
                            code: appliedCoupon.code,
                            value: formatPrice(appliedCoupon.value),
                          })}
                    </p>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button
                    className="flex-1"
                    onClick={() => handleAddToCart(false)}
                    disabled={isAdding || !selectedVariant.in_stock}
                  >
                    {isAdding ? (
                      <Loader text={t("detail.adding")} />
                    ) : (
                      <>
                        <IconShoppingCart />
                        {t("detail.addToCart")}
                      </>
                    )}
                  </Button>
                  {/* Save / Saved toggle: mirrors the heart on the shop cards. outline Button +
                      Heart icon; a filled green heart means this product is in the saved list.
                      Writes to the same per-user wishlist via toggleWishlist. */}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleToggleSave}
                    disabled={isSaving}
                    aria-label={isSaved ? t("wishlist.saved") : t("wishlist.save")}
                  >
                    <Heart
                      className={`h-4 w-4 ${
                        isSaved ? "fill-primary text-primary" : ""
                      }`}
                    />
                    {isSaved ? t("wishlist.saved") : t("wishlist.save")}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Status Alert */}
          {product.status === "archived" && (
            <div className="flex items-center gap-2 p-4 bg-yellow-500/10 border border-yellow-500/50 rounded-lg text-yellow-600">
              <AlertCircle className="h-5 w-5" />
              <p className="text-sm font-medium">
                {t("detail.archivedNotice")}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
