"use client";

import { useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Minus, Plus } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { DEFAULT_IMAGE } from "@/constants";
import { useCart } from "@/contexts/CartContext";

// Mock data for shop products (same as shop page)
const mockProducts = [
  {
    id: 1,
    name: "Small Diamond Pack",
    diamonds: 100,
    price: 1250,
    description: "Perfect for small purchases and beginners",
    fullDescription:
      "Get 100 diamonds to use in-game for purchases and upgrades.",
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
    fullDescription:
      "Get 310 diamonds to use in-game for purchases and upgrades. Best value for regular players!",
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
    fullDescription:
      "Get 520 diamonds to use in-game for purchases and upgrades. Perfect for active gamers who want more value!",
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
    fullDescription:
      "Get 1060 diamonds to use in-game for purchases and upgrades. The best value pack for serious players!",
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
    fullDescription:
      "Get 2180 diamonds to use in-game for purchases and upgrades. Maximum value for dedicated gamers!",
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
    fullDescription:
      "Get 50 diamonds to try out the in-game store. Perfect for first-time buyers!",
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
    fullDescription:
      "Get 500 diamonds plus an exclusive warrior skin! Limited time bundle.",
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
    fullDescription:
      "Get 1000 diamonds plus exclusive elite items including skins, emotes, and more!",
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
    fullDescription:
      "Transform your weapons with this exclusive dragon-themed skin. Show off your style in battle!",
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
    fullDescription:
      "Unlock the legendary Phoenix character with unique abilities and stunning visuals!",
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
    fullDescription:
      "Show off after every victory with this exclusive celebration emote!",
    image: DEFAULT_IMAGE,
    category: "other",
    inStock: true,
  },
];

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const productId = Number(params.id);
  const { addItem } = useCart();

  const [quantity, setQuantity] = useState(1);
  const [couponCode, setCouponCode] = useState("");
  const [sendAsGift, setSendAsGift] = useState(false);

  const product = useMemo(() => {
    return mockProducts.find((p) => p.id === productId);
  }, [productId]);

  if (!product) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold mb-4">Product Not Found</h2>
        <p className="text-muted-foreground mb-4">
          The product you&apos;re looking for doesn&apos;t exist.
        </p>
        <Button asChild>
          <Link href="/shop">Back to Shop</Link>
        </Button>
      </div>
    );
  }

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
      minimumFractionDigits: 0,
    }).format(price);
  };

  const totalPrice = product.price * quantity;

  const handleQuantityChange = (delta: number) => {
    const newQuantity = quantity + delta;
    if (newQuantity >= 1 && newQuantity <= 99) {
      setQuantity(newQuantity);
    }
  };

  const handleAddToCart = () => {
    if (!product) return;
    addItem(
      {
        id: product.id,
        name: product.diamonds > 0 ? `${product.diamonds} Diamonds` : product.name,
        price: product.price,
        diamonds: product.diamonds,
        image: product.image,
      },
      quantity
    );
  };

  const handleBuyNow = () => {
    if (!product) return;
    addItem(
      {
        id: product.id,
        name: product.diamonds > 0 ? `${product.diamonds} Diamonds` : product.name,
        price: product.price,
        diamonds: product.diamonds,
        image: product.image,
      },
      quantity
    );
    router.push("/shop/checkout");
  };

  const getCategoryTitle = (category: string) => {
    switch (category) {
      case "diamonds":
        return "Diamond Bundle";
      case "bundles":
        return "Bundle";
      case "skins":
        return "Skin";
      case "characters":
        return "Character";
      default:
        return "Item";
    }
  };

  return (
    <div>
      <h1 className="text-3xl font-bold text-primary mb-6">
        {getCategoryTitle(product.category)}
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Product Image */}
        <div>
          <Card className="overflow-hidden gap-0 p-0">
            <div className="relative aspect-[4/3] bg-muted">
              <Image
                src={product.image}
                alt={product.name}
                height={1000}
                width={1000}
                className="object-cover aspect-video size-full"
              />
            </div>
          </Card>
        </div>

        {/* Product Details */}
        <div className="space-y-6">
          <Card>
            <CardContent className="px-6">
              <h2 className="text-2xl font-bold mb-2">
                {product.diamonds > 0
                  ? `${product.diamonds} Diamonds`
                  : product.name}
              </h2>
              <p className="text-muted-foreground mb-4">
                {product.fullDescription}
              </p>
              <p className="text-2xl font-bold mb-6">
                {formatPrice(product.price)}
              </p>

              {/* Quantity Selector */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => handleQuantityChange(-1)}
                    disabled={quantity <= 1}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <span className="w-12 text-center font-medium">
                    {quantity}
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => handleQuantityChange(1)}
                    disabled={quantity >= 99}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <div className="text-right">
                  <span className="text-sm text-muted-foreground">Total: </span>
                  <span className="font-bold">{formatPrice(totalPrice)}</span>
                </div>
              </div>

              {/* Coupon Code */}
              <div className="mb-4">
                <Label htmlFor="coupon" className="text-sm font-medium">
                  Coupon Code
                </Label>
                <Input
                  id="coupon"
                  placeholder="Enter coupon code"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value)}
                  className="mt-1"
                />
              </div>

              {/* Send as Gift */}
              <div className="flex items-center space-x-2 mb-6">
                <Checkbox
                  id="gift"
                  checked={sendAsGift}
                  onCheckedChange={(checked) =>
                    setSendAsGift(checked as boolean)
                  }
                />
                <Label htmlFor="gift" className="text-sm cursor-pointer">
                  Send as a gift
                </Label>
              </div>
            </CardContent>
          </Card>

          {/* Purchase Options */}
          <Card>
            <CardContent className="px-6">
              <h3 className="text-lg font-semibold mb-4">Purchase Options</h3>
              <div className="space-y-3">
                <Button
                  className="w-full"
                  onClick={handleAddToCart}
                  disabled={!product.inStock}
                >
                  Add to Cart
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleBuyNow}
                  disabled={!product.inStock}
                >
                  Buy Now
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
