"use client";

import React, { useState, useMemo, useEffect } from "react";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  Card,
  CardContent,
  CardDescription,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Search, ShoppingCart, Loader2, Package, Truck } from "lucide-react";
import Link from "next/link";
import axios from "axios";
import { env } from "@/lib/env";
import { matchesSearch } from "@/lib/search";
import { ITEMS_PER_PAGE } from "@/constants";
import { PageHeader } from "@/components/PageHeader";
import { useAuth } from "@/contexts/AuthContext";
import { IconDiamond } from "@tabler/icons-react";
import { formatMoneyInput } from "@/lib/utils";
import { ComingSoon } from "@/components/ComingSoon";
import {
  ProductMediaGallery,
  ProductMediaItem,
} from "./ProductMediaGallery";

// 1. Interfaces based on the API response (now generalised past diamonds).
interface Variant {
  id: number;
  sku: string;
  title: string;
  price: string;
  diamonds_amount: number;
  stock_qty: number;
  is_active: boolean;
  in_stock: boolean;
}

// Structured category attached to a product (or null for legacy diamond rows).
interface ProductCategory {
  id: number;
  name: string;
  slug: string;
  is_physical: boolean;
  is_active: boolean;
}

interface Product {
  id: number;
  name: string;
  type: string; // legacy slug string (back-compat with the category slug)
  category: ProductCategory | null;
  status: string;
  is_limited_stock: boolean;
  image: string | null;
  media: ProductMediaItem[]; // image + video gallery
  variants: Variant[];
}

// A category tab on the user shop. Sourced from the live backend categories,
// with an always-present "diamonds" entry so the digital topup tab never
// disappears even before any physical categories exist.
interface CategoryTab {
  value: string; // category slug (matches product.type)
  label: string;
  is_physical: boolean;
}

// The always-present "All" tab. BUGFIX (2026-06-10): a product with no category (e.g.
// an approved vendor product whose category/slug is null, like "Vendor Test Hoodie")
// matched NO category tab and was therefore invisible on the shop page, even though the
// homepage featured list (a flat list, no category filter) still showed it. This tab is
// the first option and is selected by default; it lists every active product regardless
// of category, so uncategorised products always have a home.
const ALL_TAB: CategoryTab = { value: "all", label: "All", is_physical: false };

export default function ShopClient() {
  const { token } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<CategoryTab[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  // Default to the "All" tab so the storefront shows everything (including
  // uncategorised products) on first load.
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);

  // 2. Fetch products + live categories in parallel.
  useEffect(() => {
    const fetchShop = async () => {
      try {
        setLoading(true);

        // Storefront is PUBLIC: both endpoints are auth-free so anonymous visitors can
        // browse. (Products previously used the admin-only /view-all-products/, which 403'd
        // for non-admins and 401'd for anonymous -> "No products found" for everyone but admins.)
        const [productsRes, categoriesRes] = await Promise.all([
          axios.get(
            `${env.NEXT_PUBLIC_BACKEND_API_URL}/shop/view-active-products/`,
          ),
          axios.get(
            `${env.NEXT_PUBLIC_BACKEND_API_URL}/shop/view-active-categories/`,
          ),
        ]);

        // Only active products are shown on the storefront.
        const activeProducts: Product[] = productsRes.data.products.filter(
          (p: Product) => p.status === "active",
        );
        setProducts(activeProducts);

        // Build the category tab list from the live categories. Fall back to a
        // single Diamonds tab if the admin has not created any categories yet,
        // so the shop is never tab-less.
        const liveCats: CategoryTab[] = (
          categoriesRes.data.categories || []
        ).map((c: ProductCategory) => ({
          value: c.slug,
          label: c.name,
          is_physical: c.is_physical,
        }));

        const liveTabs: CategoryTab[] =
          liveCats.length > 0
            ? liveCats
            : [{ value: "diamonds", label: "Diamonds", is_physical: false }];

        // Prepend the "All" tab so it is always the first option (and the default).
        const tabs: CategoryTab[] = [ALL_TAB, ...liveTabs];

        setCategories(tabs);
        // Default to "All" (the first tab) so uncategorised products are visible too;
        // keep any tab the user already picked.
        setActiveCategory((prev) => prev || tabs[0]?.value || "all");
      } catch (error) {
        console.error("Failed to fetch shop", error);
      } finally {
        setLoading(false);
      }
    };
    fetchShop();
    // No auth dependency: the storefront endpoints are public, so fetch once on mount
    // (works for anonymous and logged-in users alike).
  }, []);

  // Helper: the active category's metadata (label + whether it ships).
  const activeCategoryMeta = useMemo(
    () => categories.find((c) => c.value === activeCategory),
    [categories, activeCategory],
  );

  const filteredProducts = useMemo(() => {
    // "all" shows every active product regardless of category (so uncategorised
    // products like a vendor product with a null category are visible); any other tab
    // filters to that category slug as before.
    let filtered =
      activeCategory === "all"
        ? products
        : products.filter((product) => product.type === activeCategory);

    if (searchQuery.trim()) {
      // Use the shared matchesSearch helper (lib/search.ts) so the product-name search
      // is punctuation, accent, and fancy-font insensitive (a product named "V-E" is found
      // by typing "ve"), matching every other "Search ..." box on the site. An empty query
      // already short-circuits above, so this only runs when the user has typed something.
      filtered = filtered.filter((product) =>
        matchesSearch(product.name, searchQuery),
      );
    }
    return filtered;
  }, [activeCategory, searchQuery, products]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, activeCategory]);

  const totalPages = Math.ceil(filteredProducts.length / ITEMS_PER_PAGE);
  const paginatedProducts = filteredProducts.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE,
  );

  const formatPrice = (price: string | number) => {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
      minimumFractionDigits: 0,
    }).format(Number(price));
  };

  // Helper to get the display price (lowest variant price)
  const getStartingPrice = (variants: Variant[]) => {
    if (!variants.length) return "0";
    const prices = variants.map((v) => parseFloat(v.price));
    return Math.min(...prices).toString();
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
        <p className="text-muted-foreground">Loading Shop...</p>
      </div>
    );
  }

  return (
    <div>
      {/* <ComingSoon /> */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-2 gap-4">
        <PageHeader title="AFC Shop" back />
        <Button asChild variant="outline">
          <Link href="/shop/cart">
            <ShoppingCart className="mr-2 h-4 w-4" />
            Cart
          </Link>
        </Button>
      </div>

      <Tabs
        value={activeCategory}
        onValueChange={setActiveCategory}
        className="mb-4"
      >
        <TabsList className="w-full justify-start overflow-x-auto">
          {categories.map((category) => (
            <TabsTrigger
              key={category.value}
              value={category.value}
              className="flex-shrink-0"
            >
              {category.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        <Input
          type="search"
          placeholder={`Search ${
            activeCategoryMeta?.label.toLowerCase() || "products"
          }...`}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 bg-background/50 backdrop-blur-sm"
        />
      </div>

      {filteredProducts.length === 0 ? (
        <div className="text-center py-12">
          <Search className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No products found</h3>
        </div>
      ) : (
        <>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {paginatedProducts.map((product) => {
            const startingPrice = getStartingPrice(product.variants);
            const totalDiamonds = product.variants[0]?.diamonds_amount;
            const isOutOfStock = product.variants.every((v) => !v.in_stock);

            // Physical vs digital: drives the secondary line + category badge.
            // Diamonds (digital) show the diamond amount; physical goods show a
            // "ships to you" hint and an option count instead.
            const isPhysical =
              product.category?.is_physical ?? product.type !== "diamonds";
            const categoryLabel = product.category?.name || product.type;
            const optionCount = product.variants.length;

            return (
              <Card
                key={product.id}
                className={`overflow-hidden gap-0 p-0 transition-shadow hover:shadow-lg`}
              >
                <div className="relative">
                  {/* generalised media: single cover frame (image OR video) */}
                  <ProductMediaGallery
                    media={product.media}
                    fallbackImage={product.image}
                    alt={product.name}
                    variant="card"
                  />
                  {/* category badge top-left so physical goods read clearly */}
                  <Badge
                    variant="outline"
                    className="absolute left-2 top-2 rounded-full px-2 py-0.5 text-xs capitalize bg-background/70 backdrop-blur-sm"
                  >
                    {categoryLabel}
                  </Badge>
                  {isOutOfStock && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                      <Badge
                        variant="destructive"
                        className="text-sm px-4 py-2"
                      >
                        Out of Stock
                      </Badge>
                    </div>
                  )}
                </div>
                <CardContent className="p-4">
                  <CardTitle className="mb-1">{product.name}</CardTitle>

                  {/* secondary line: diamonds for topups, ship hint for goods */}
                  {!isPhysical && totalDiamonds > 0 ? (
                    <div className="flex items-center gap-1 text-primary mb-2 text-sm">
                      {formatMoneyInput(totalDiamonds)}
                      <IconDiamond className="h-4 w-4" />
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 text-muted-foreground mb-2 text-sm">
                      {isPhysical ? (
                        <>
                          <Truck className="h-3.5 w-3.5" />
                          {optionCount} option{optionCount > 1 ? "s" : ""},
                          ships to you
                        </>
                      ) : (
                        <>
                          <Package className="h-3.5 w-3.5" />
                          {optionCount} option{optionCount > 1 ? "s" : ""}
                        </>
                      )}
                    </div>
                  )}

                  <p className="text-xl font-bold mb-4">
                    <span className="text-xs font-medium text-muted-foreground uppercase mr-1">
                      from
                    </span>
                    {formatPrice(startingPrice)}
                  </p>
                  <Button asChild className="w-full">
                    <Link href={`/shop/${product.id}`}>
                      {isOutOfStock ? "View" : "Buy Now"}
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-6">
            <p className="hidden md:block text-sm text-muted-foreground">
              Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1}-
              {Math.min(currentPage * ITEMS_PER_PAGE, filteredProducts.length)}{" "}
              of {filteredProducts.length}
            </p>
            <Pagination className="w-full md:w-auto mx-0">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    className={
                      currentPage === 1
                        ? "pointer-events-none opacity-50"
                        : "cursor-pointer"
                    }
                  />
                </PaginationItem>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(
                    (page) =>
                      page === 1 ||
                      page === totalPages ||
                      Math.abs(page - currentPage) <= 1,
                  )
                  .map((page, idx, arr) => (
                    <React.Fragment key={page}>
                      {idx > 0 && arr[idx - 1] !== page - 1 && (
                        <PaginationItem>
                          <PaginationEllipsis />
                        </PaginationItem>
                      )}
                      <PaginationItem>
                        <PaginationLink
                          isActive={currentPage === page}
                          onClick={() => setCurrentPage(page)}
                          className="cursor-pointer"
                        >
                          {page}
                        </PaginationLink>
                      </PaginationItem>
                    </React.Fragment>
                  ))}
                <PaginationItem>
                  <PaginationNext
                    onClick={() =>
                      setCurrentPage((p) => Math.min(totalPages, p + 1))
                    }
                    className={
                      currentPage === totalPages
                        ? "pointer-events-none opacity-50"
                        : "cursor-pointer"
                    }
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        )}
        </>
      )}
    </div>
  );
}
