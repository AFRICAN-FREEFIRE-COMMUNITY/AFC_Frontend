"use client";

// ─────────────────────────────────────────────────────────────────────────────
// WishlistClient
//
// Purpose:
//   The "Saved Items" storefront page: lists every product the signed-in user saved.
//   The heart toggle on ShopClient cards and the Save button on ProductDetailPage both
//   write to the same per-user list, so this page is where the user comes back to them.
//   Each row is a product card mirroring the shop grid, with a View link to the full
//   product and a Remove button that un-saves it.
//
// How it connects:
//   - Data: GET /shop/wishlist/ via getMyWishlist (lib/wishlist.ts) -> WishlistProduct[].
//   - Remove: toggleWishlist (lib/wishlist.ts) flips the product off and we drop it from
//     the local list so the card disappears without a refetch.
//   - Auth: needs the signed-in user's Bearer token (useAuth().token); the route wraps this
//     in <ProtectedRoute> (app/(user)/shop/saved/page.tsx) so anonymous users are bounced to
//     login before this renders.
//   - Card design mirrors ShopClient.tsx (same ProductMediaGallery cover, top-left category
//     badge, out-of-stock overlay, multi-currency price via the shared <Money/> chokepoint,
//     AFC Card/Badge/Button idiom). Copy comes from messages/en/shop.json -> "wishlist".
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Heart, Loader2, Trash2 } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { useAuth } from "@/contexts/AuthContext";
import {
  getMyWishlist,
  toggleWishlist,
  WishlistProduct,
} from "@/lib/wishlist";
import { ProductMediaGallery } from "./ProductMediaGallery";
// Multi-currency money chokepoint: shows the saved product's starting price in the
// viewer's display currency (CurrencyContext) instead of the old NGN-only formatter.
import { Money } from "@/components/Money";

export default function WishlistClient() {
  // Localized copy for the saved-items page (messages/en/shop.json -> "wishlist").
  const t = useTranslations("shop");
  const { token } = useAuth();
  const [products, setProducts] = useState<WishlistProduct[]>([]);
  const [loading, setLoading] = useState(true);
  // Which row currently has an in-flight Remove, so we disable only that button.
  const [removingId, setRemovingId] = useState<number | null>(null);

  // Load the saved list on mount. Per-user, so it waits for the token (the page is wrapped
  // in ProtectedRoute, so a token is expected by the time this renders).
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    const fetchWishlist = async () => {
      try {
        setLoading(true);
        const res = await getMyWishlist(token);
        if (!cancelled) setProducts(res.products);
      } catch (error) {
        console.error("Failed to fetch wishlist", error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchWishlist();
    return () => {
      cancelled = true;
    };
  }, [token]);

  // Remove a product from the saved list. toggleWishlist flips it off server-side; on
  // success we drop it from the local list so the card disappears without a refetch.
  const handleRemove = async (productId: number) => {
    setRemovingId(productId);
    try {
      await toggleWishlist(productId, token);
      setProducts((prev) => prev.filter((p) => p.id !== productId));
      toast.success(t("wishlist.removedToast"));
    } catch (error) {
      toast.error(t("wishlist.errorToast"));
    } finally {
      setRemovingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
        <p className="text-muted-foreground">{t("wishlist.loading")}</p>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        back
        title={t("wishlist.pageTitle")}
        description={t("wishlist.pageDescription")}
      />

      {products.length === 0 ? (
        // Empty state: a heart glyph + prompt + a way back into the shop.
        <div className="text-center py-12">
          <Heart className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-4">{t("wishlist.empty")}</h3>
          <Button asChild>
            <Link href="/shop">{t("wishlist.browseShop")}</Link>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {products.map((product) => {
            const isOutOfStock = !product.in_stock;
            return (
              <Card
                key={product.id}
                className="overflow-hidden gap-0 p-0 transition-shadow hover:shadow-lg"
              >
                <div className="relative">
                  {/* same cover approach as the shop grid: a single image frame. The saved
                      row carries one image (no media gallery), so media is left null and the
                      gallery falls back to the product image. */}
                  <ProductMediaGallery
                    media={null}
                    fallbackImage={product.image}
                    alt={product.name}
                    variant="card"
                  />
                  {/* category badge top-left, matching ShopClient */}
                  {product.category && (
                    <Badge
                      variant="outline"
                      className="absolute left-2 top-2 rounded-full px-2 py-0.5 text-xs capitalize bg-background/70 backdrop-blur-sm"
                    >
                      {product.category}
                    </Badge>
                  )}
                  {isOutOfStock && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                      <Badge variant="destructive" className="text-sm px-4 py-2">
                        {t("wishlist.outOfStock")}
                      </Badge>
                    </div>
                  )}
                </div>
                <CardContent className="p-4">
                  <CardTitle className="mb-1">{product.name}</CardTitle>
                  <p className="text-xl font-bold mb-4">
                    <span className="text-xs font-medium text-muted-foreground uppercase mr-1">
                      {t("wishlist.from")}
                    </span>
                    <Money amount={product.starting_price} />
                  </p>
                  {/* View opens the full product; Remove un-saves it (drops the card). */}
                  <div className="flex gap-2">
                    <Button asChild className="flex-1">
                      <Link href={`/shop/${product.id}`}>
                        {t("wishlist.view")}
                      </Link>
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => handleRemove(product.id)}
                      disabled={removingId === product.id}
                    >
                      {removingId === product.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                      {t("wishlist.remove")}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
