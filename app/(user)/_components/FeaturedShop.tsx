"use client";

// ─────────────────────────────────────────────────────────────────────────────
// FeaturedShop — the "Featured Shop Items" card on the user home page (/home).
//
// Replaces the old mock `shopItems` placeholder list + the <ComingSoon/> overlay
// (the shop is live now, so users must be able to reach it). It fetches REAL active
// products from the PUBLIC storefront endpoint and shows the first few as a teaser,
// each linking to its product page, plus a "Visit Shop" button.
//
// Data: GET /shop/view-active-products/  (public, active-only — same endpoint the
//       storefront ShopClient uses). No auth required.
// Renders into: app/(user)/home/page.tsx (the News + Shop row).
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import Image from "next/image";
import axios from "axios";
import { ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
// Money = the multi-currency chokepoint (components/Money.tsx): converts a stored NGN amount to the
// viewer's display currency (CurrencyContext) so the home teaser price matches the rest of the shop
// instead of being locked to Naira. Shop prices are stored in NGN, so from defaults to "NGN".
import { Money } from "@/components/Money";
import { env } from "@/lib/env";
// Live refresh (owner 2026-07-02): site-wide heartbeat - re-pulls the active-products
// teaser so new/retired shop items show up without a manual reload.
import { useLiveTick } from "@/hooks/useLiveTick";

interface Variant {
  price: string;
  is_active?: boolean;
}
interface Product {
  id: number;
  name: string;
  image: string | null;
  variants: Variant[];
}

// Lowest variant price across a product's variants (the "from" price on the card).
const startingPrice = (variants: Variant[]): number | null => {
  const prices = (variants ?? [])
    .map((v) => parseFloat(v.price))
    .filter((n) => !Number.isNaN(n));
  return prices.length ? Math.min(...prices) : null;
};

export function FeaturedShop() {
  // Strings for the home-page "Featured Shop" teaser (namespace == messages/en/home.json).
  const t = useTranslations("home");
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  // Live refresh (owner 2026-07-02): shared tick re-runs the product fetch below.
  const tick = useLiveTick();

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await axios.get(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/shop/view-active-products/`,
        );
        if (active) setProducts((res.data?.products ?? []).slice(0, 4));
      } catch {
        // Soft-fail: the home teaser just shows its empty state if the shop is unreachable.
        // Live refresh (owner 2026-07-02): only on the INITIAL load - a transient failure
        // during a background tick keeps the current list instead of blanking the teaser.
        if (active && tick === 0) setProducts([]);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
    // Live refresh (owner 2026-07-02): tick re-pulls in the background. `loading` is
    // only true on first mount, so re-runs never flash the skeleton.
  }, [tick]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("featuredShop.title")}</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <ul className="space-y-4">
            {[0, 1, 2].map((i) => (
              <li key={i} className="flex items-center gap-4">
                <Skeleton className="h-[50px] w-[50px] rounded" />
                <div className="flex-grow space-y-2">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
              </li>
            ))}
          </ul>
        ) : products.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {t("featuredShop.empty")}
          </p>
        ) : (
          <ul className="space-y-4">
            {products.map((item) => {
              const price = startingPrice(item.variants);
              return (
                <li
                  key={item.id}
                  className="flex items-center space-x-4 border-b pb-4 last:border-b-0 last:pb-0"
                >
                  <Image
                    src={item.image || "/placeholder.svg"}
                    alt={item.name}
                    width={50}
                    height={50}
                    className="rounded object-cover"
                  />
                  <div className="flex-grow">
                    <h3 className="font-semibold">
                      {item.name || t("featuredShop.productFallback")}
                    </h3>
                    <p className="flex items-center gap-1 text-sm text-muted-foreground">
                      {price !== null ? (
                        <>
                          {t("featuredShop.from")} <Money amount={price} />
                        </>
                      ) : (
                        t("featuredShop.viewOptions")
                      )}
                    </p>
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/shop/${item.id}`}>
                      {t("featuredShop.view")}{" "}
                      <ExternalLink className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
        <Button asChild className="mt-4 w-full">
          <Link href="/shop">{t("featuredShop.visitShop")}</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
