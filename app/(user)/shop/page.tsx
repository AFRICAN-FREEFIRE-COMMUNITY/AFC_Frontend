"use client";

import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Search, ShoppingCart, Diamond } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { DEFAULT_IMAGE } from "@/constants";
import { ComingSoon } from "@/components/ComingSoon";

// Mock data for shop products
const mockProducts = [
  {
    id: 1,
    name: "Small Diamond Pack",
    diamonds: 100,
    price: 1250,
    description: "Perfect for small purchases and beginners",
    image: DEFAULT_IMAGE,
    category: "diamonds",
    inStock: true,
  },
  {
    id: 2,
    name: "Medium Diamond Pack",
    diamonds: 310,
    price: 3750,
    description: "Great value for regular players",
    image: DEFAULT_IMAGE,
    category: "diamonds",
    inStock: true,
  },
  {
    id: 3,
    name: "Large Diamond Pack",
    diamonds: 520,
    price: 6200,
    description: "Ideal for active gamers",
    image: DEFAULT_IMAGE,
    category: "diamonds",
    inStock: true,
  },
  {
    id: 4,
    name: "Premium Diamond Pack",
    diamonds: 1060,
    price: 12500,
    description: "Best value for serious players",
    image: DEFAULT_IMAGE,
    category: "diamonds",
    inStock: true,
  },
  {
    id: 5,
    name: "Ultimate Diamond Pack",
    diamonds: 2180,
    price: 25000,
    description: "Maximum diamonds for dedicated gamers",
    image: DEFAULT_IMAGE,
    category: "diamonds",
    inStock: true,
  },
  {
    id: 6,
    name: "Starter Diamond Pack",
    diamonds: 50,
    price: 650,
    description: "Try before you buy",
    image: DEFAULT_IMAGE,
    category: "diamonds",
    inStock: false,
  },
  {
    id: 7,
    name: "Warrior Bundle",
    diamonds: 500,
    price: 8000,
    description: "Includes exclusive warrior skin",
    image: DEFAULT_IMAGE,
    category: "bundles",
    inStock: true,
  },
  {
    id: 8,
    name: "Elite Bundle",
    diamonds: 1000,
    price: 15000,
    description: "Premium bundle with exclusive items",
    image: DEFAULT_IMAGE,
    category: "bundles",
    inStock: true,
  },
  {
    id: 9,
    name: "Dragon Skin",
    diamonds: 0,
    price: 5000,
    description: "Exclusive dragon-themed weapon skin",
    image: DEFAULT_IMAGE,
    category: "skins",
    inStock: true,
  },
  {
    id: 10,
    name: "Phoenix Character",
    diamonds: 0,
    price: 12000,
    description: "Legendary phoenix character",
    image: DEFAULT_IMAGE,
    category: "characters",
    inStock: true,
  },
  {
    id: 11,
    name: "Victory Emote",
    diamonds: 0,
    price: 2500,
    description: "Celebrate your wins in style",
    image: DEFAULT_IMAGE,
    category: "other",
    inStock: true,
  },
];

const categories = [
  { value: "diamonds", label: "Diamonds" },
  { value: "bundles", label: "Bundles" },
  { value: "skins", label: "Skins" },
  { value: "characters", label: "Characters" },
  { value: "other", label: "Other" },
];

export default function ShopPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("diamonds");

  const filteredProducts = useMemo(() => {
    let filtered = mockProducts.filter(
      (product) => product.category === activeCategory
    );

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (product) =>
          product.name.toLowerCase().includes(query) ||
          product.description.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [activeCategory, searchQuery]);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
      minimumFractionDigits: 0,
    }).format(price);
  };

  return (
    <div className="relative">
      <ComingSoon />
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-6 gap-4">
        <h1 className="text-3xl font-bold text-primary">AFC Shop</h1>
        <Button asChild variant="outline">
          <Link href="/shop/cart">
            <ShoppingCart className="mr-2 h-4 w-4" />
            Cart
          </Link>
        </Button>
      </div>

      {/* Category Tabs */}
      <Tabs
        value={activeCategory}
        onValueChange={setActiveCategory}
        className="mb-6"
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

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        <Input
          type="search"
          placeholder={`Search ${activeCategory}...`}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 bg-background/50 backdrop-blur-sm"
        />
      </div>

      {/* Products Grid */}
      {filteredProducts.length === 0 ? (
        <div className="text-center py-12">
          <div className="max-w-md mx-auto">
            <Search className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No products found</h3>
            <p className="text-muted-foreground">
              Try adjusting your search or browse other categories
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProducts.map((product) => (
            <Card
              key={product.id}
              className={`overflow-hidden gap-0 p-0 transition-shadow hover:shadow-lg ${
                !product.inStock ? "opacity-75" : ""
              }`}
            >
              <div className="relative bg-muted">
                <Image
                  src={product.image}
                  alt={product.name}
                  height={1000}
                  width={1000}
                  className="object-cover aspect-video size-full"
                />
                {!product.inStock && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                    <Badge variant="destructive" className="text-sm px-4 py-2">
                      Out of Stock
                    </Badge>
                  </div>
                )}
              </div>
              <CardContent className="p-4">
                <h3 className="text-lg font-semibold mb-1">{product.name}</h3>
                {product.diamonds > 0 && (
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
                </p>
                <Button
                  asChild
                  className="w-full"
                  variant="outline"
                  disabled={!product.inStock}
                >
                  <Link href={`/shop/${product.id}`}>Buy Now</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
