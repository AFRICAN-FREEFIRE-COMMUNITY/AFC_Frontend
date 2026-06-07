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
import Link from "next/link";
import Image from "next/image";
import axios from "axios";
import { ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { NairaIcon } from "@/components/NairaIcon";
import { env } from "@/lib/env";

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
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

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
        if (active) setProducts([]);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Featured Shop Items</CardTitle>
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
            No products available yet. Check back soon.
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
                    <h3 className="font-semibold">{item.name || "Product"}</h3>
                    <p className="flex items-center gap-1 text-sm text-muted-foreground">
                      {price !== null ? (
                        <>
                          From <NairaIcon className="size-3" />
                          {price.toLocaleString()}
                        </>
                      ) : (
                        "View options"
                      )}
                    </p>
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/shop/${item.id}`}>
                      View <ExternalLink className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
        <Button asChild className="mt-4 w-full">
          <Link href="/shop">Visit Shop</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
