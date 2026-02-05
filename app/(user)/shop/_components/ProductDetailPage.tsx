"use client";

import { useState, useMemo, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Minus, Plus, Diamond, Loader2, AlertCircle } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import axios from "axios";
import { env } from "@/lib/env";
import { DEFAULT_IMAGE } from "@/constants";
import { useCart } from "@/contexts/CartContext";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { IconDiamond, IconShoppingCart } from "@tabler/icons-react";
import { Loader } from "@/components/Loader";
import { PageHeader } from "@/components/PageHeader";
import { formatMoneyInput } from "@/lib/utils";
import { ComingSoon } from "@/components/ComingSoon";

// Interfaces based on your API
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

interface ProductData {
  id: number;
  name: string;
  type: string;
  description: string;
  status: string;
  variants: Variant[];
}

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { fetchCartCount } = useCart();
  const { token } = useAuth();

  const [product, setProduct] = useState<ProductData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedVariant, setSelectedVariant] = useState<Variant | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [quantity, setQuantity] = useState(1);

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

  const handleAddToCart = async (redirectToCart = false) => {
    if (!selectedVariant) return;

    try {
      setIsAdding(true);
      const response = await axios.post(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/shop/add-to-cart/`,
        {
          variant_id: selectedVariant.id,
          quantity: quantity,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        },
      );

      toast.success(`${product?.name} added to cart!`);

      await fetchCartCount();

      if (redirectToCart) {
        router.push("/shop/cart");
      }
    } catch (error: any) {
      const errorMsg = error.response?.data?.message || "Failed to add to cart";
      toast.error(errorMsg);
    } finally {
      setIsAdding(false);
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
        <h2 className="text-2xl font-bold">Product Not Found</h2>
        <Button asChild className="mt-4">
          <Link href="/shop">Back to Shop</Link>
        </Button>
      </div>
    );

  return (
    <div>
      {/* <ComingSoon /> */}
      <PageHeader back title={product.name} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left: Image Section */}
        <Card className="overflow-hidden p-0 border-none bg-transparent">
          <div className="relative aspect-square rounded-xl overflow-hidden bg-muted">
            <Image
              src={DEFAULT_IMAGE}
              alt={product.name}
              fill
              className="object-cover"
            />
          </div>
        </Card>

        {/* Right: Info Section */}
        <div className="space-y-4">
          <div>
            <Badge className="capitalize mb-1.5" variant="outline">
              {product.type}
            </Badge>
            <h1 className="text-3xl font-bold">{product.name}</h1>
            <p className="text-muted-foreground text-sm mt-2">
              {product.description}
            </p>
          </div>

          {/* Variant Selection */}
          <div className="space-y-2.5">
            <Label>Select Option</Label>
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
                    {variant.diamonds_amount > 0 && (
                      <div className="flex items-center text-sm text-primary">
                        <IconDiamond className="h-3 w-3 mr-1" />{" "}
                        {formatMoneyInput(variant.diamonds_amount)} Diamonds
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="font-bold">{formatPrice(variant.price)}</p>
                    {!variant.in_stock && (
                      <span className="text-xs text-destructive">
                        Out of Stock
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
                    <p className="text-sm text-muted-foreground">Subtotal</p>
                    <p className="text-2xl font-bold text-primary">
                      {formatPrice(
                        parseFloat(selectedVariant.price) * quantity,
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    className="flex-1"
                    onClick={() => handleAddToCart(false)}
                    disabled={isAdding || !selectedVariant.in_stock}
                  >
                    {isAdding ? (
                      <Loader text="Adding..." />
                    ) : (
                      <>
                        <IconShoppingCart />
                        Add to Cart
                      </>
                    )}
                  </Button>
                  <Button
                    variant="secondary"
                    className="flex-1"
                    onClick={() => {
                      handleAddToCart();
                      router.push("/shop/cart");
                    }}
                    // disabled={!selectedVariant.in_stock}
                    disabled
                  >
                    Buy Now
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
                This product is currently archived and may not be available for
                purchase.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
