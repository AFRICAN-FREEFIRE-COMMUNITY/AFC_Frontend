"use client";

import { useState, useMemo, useEffect } from "react";
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
import { Search, ShoppingCart, Diamond, Loader2 } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import axios from "axios";
import { env } from "@/lib/env";
import { DEFAULT_IMAGE } from "@/constants";
import { PageHeader } from "@/components/PageHeader";
import { useAuth } from "@/contexts/AuthContext";
import { IconDiamond } from "@tabler/icons-react";
import { formatMoneyInput } from "@/lib/utils";
import { ComingSoon } from "@/components/ComingSoon";

// 1. Updated Interfaces based on your API response
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

interface Product {
  id: number;
  name: string;
  type: string;
  status: string;
  is_limited_stock: boolean;
  variants: Variant[];
}

const categories = [
  { value: "diamonds", label: "Diamonds" },
  { value: "bundles", label: "Bundles" },
  { value: "skins", label: "Skins" },
  { value: "characters", label: "Characters" },
  { value: "other", label: "Other" },
];

export default function ShopPage() {
  const { token } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("diamonds");

  // 2. Fetch real data
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setLoading(true);
        const res = await axios.get(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/shop/view-all-products/`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );
        // Filter out archived products for the user shop side
        const activeProducts = res.data.products.filter(
          (p: Product) => p.status === "active",
        );
        setProducts(activeProducts);
      } catch (error) {
        console.error("Failed to fetch products", error);
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
  }, []);

  const filteredProducts = useMemo(() => {
    let filtered = products.filter(
      (product) => product.type === activeCategory,
    );

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((product) =>
        product.name.toLowerCase().includes(query),
      );
    }
    return filtered;
  }, [activeCategory, searchQuery, products]);

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
    <div className="relative">
      <ComingSoon />
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
          placeholder={`Search ${activeCategory}...`}
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProducts.map((product) => {
            const startingPrice = getStartingPrice(product.variants);
            const totalDiamonds = product.variants[0]?.diamonds_amount;
            const isOutOfStock = product.variants.every((v) => !v.in_stock);

            return (
              <Card
                key={product.id}
                className={`overflow-hidden gap-0 p-0 transition-shadow hover:shadow-lg`}
              >
                <div className="relative bg-muted">
                  <Image
                    src={product.image || DEFAULT_IMAGE}
                    alt={product.name}
                    height={1000}
                    width={1000}
                    className="object-cover aspect-video size-full"
                  />
                  {!isOutOfStock && (
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
                  {product.type === "diamonds" && totalDiamonds > 0 && (
                    <div className="flex items-center gap-1 text-primary mb-2 text-sm">
                      {formatMoneyInput(totalDiamonds)}
                      <IconDiamond className="h-4 w-4" />
                    </div>
                  )}
                  <p className="text-xl font-bold mb-4">
                    {formatPrice(startingPrice)}
                  </p>
                  {/* {product.diamonds > 0 && (
                  <div className="flex items-center gap-1 text-primary mb-2">
                    <span>{product.diamonds}</span>
                    <Diamond className="h-4 w-4" />
                  </div>
                )}
                <p className="text-sm text-muted-foreground mb-3">
                  {product.description}
                </p>
                <p className="text-xl font-bold mb-4">
                  {formatPrice(product.price)}
                </p> */}
                  <Button asChild className="w-full">
                    <Link href={`/shop/${product.id}`}>Buy Now</Link>
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
