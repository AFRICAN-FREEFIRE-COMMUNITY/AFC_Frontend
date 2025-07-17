"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Layout from "@/components/Layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/components/ui/use-toast"
import { Minus, Plus } from "lucide-react"
import { useCart } from "@/contexts/CartContext"

// Mock data - in a real app, this would come from your API
const bundle = {
  id: 1,
  name: "100 Diamonds",
  description: "Get 100 diamonds to use in-game for purchases and upgrades.",
  price: 1250,
  image: "/placeholder.svg?height=300&width=300",
}

export default function ShopItemPage() {
  const router = useRouter()
  const { toast } = useToast()
  const { addToCart } = useCart()
  const [isClient, setIsClient] = useState(false)

  const [quantity, setQuantity] = useState(1)
  const [isGift, setIsGift] = useState(false)
  const [giftEmail, setGiftEmail] = useState("")
  const [couponCode, setCouponCode] = useState("")

  // Fix hydration issues by only rendering client-side
  useEffect(() => {
    setIsClient(true)
  }, [])

  const increaseQuantity = () => {
    setQuantity((prev) => prev + 1)
  }

  const decreaseQuantity = () => {
    if (quantity > 1) {
      setQuantity((prev) => prev - 1)
    }
  }

  const handleAddToCart = () => {
    try {
      addToCart({
        id: bundle.id,
        name: bundle.name,
        price: bundle.price,
        quantity: quantity,
        isGift: isGift,
        giftEmail: isGift ? giftEmail : undefined,
      })

      toast({
        title: "Added to Cart",
        description: `${quantity} ${bundle.name} added to your cart.`,
      })
    } catch (error) {
      console.error("Error adding to cart:", error)
      toast({
        title: "Error",
        description: "There was a problem adding this item to your cart.",
        variant: "destructive",
      })
    }
  }

  const handleBuyNow = () => {
    try {
      // First add to cart
      addToCart({
        id: bundle.id,
        name: bundle.name,
        price: bundle.price,
        quantity,
        isGift,
        giftEmail: isGift ? giftEmail : undefined,
      })

      toast({
        title: "Processing",
        description: "Taking you to checkout...",
      })

      // Use setTimeout to ensure the cart is updated before navigation
      setTimeout(() => {
        router.push("/shop/checkout")
      }, 100)
    } catch (error) {
      console.error("Error processing buy now:", error)
      toast({
        title: "Error",
        description: "There was a problem processing your request.",
        variant: "destructive",
      })
    }
  }

  // Don't render anything during SSR to prevent hydration mismatch
  if (!isClient) {
    return null
  }

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">Diamond Bundle</h1>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <Card>
              <CardContent className="p-6">
                <img src={bundle.image || "/placeholder.svg"} alt={bundle.name} className="w-full h-auto rounded-lg" />
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>{bundle.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">{bundle.description}</p>
                <div className="flex items-center justify-between mb-6">
                  <p className="text-2xl font-bold">₦{bundle.price.toLocaleString()}</p>
                  <div className="flex items-center space-x-2">
                    <Button variant="outline" size="icon" onClick={decreaseQuantity} disabled={quantity <= 1}>
                      <Minus className="h-4 w-4" />
                    </Button>
                    <span className="w-8 text-center">{quantity}</span>
                    <Button variant="outline" size="icon" onClick={increaseQuantity}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <p className="text-right text-sm mb-4">Total: ₦{(bundle.price * quantity).toLocaleString()}</p>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="coupon">Coupon Code</Label>
                    <Input
                      id="coupon"
                      value={couponCode}
                      onChange={(e) => setCouponCode(e.target.value)}
                      placeholder="Enter coupon code"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="gift"
                        checked={isGift}
                        onChange={(e) => setIsGift(e.target.checked)}
                        className="rounded border-gray-300"
                      />
                      <Label htmlFor="gift">Send as a gift</Label>
                    </div>

                    {isGift && (
                      <div>
                        <Label htmlFor="giftEmail">Recipient's Email</Label>
                        <Input
                          id="giftEmail"
                          type="email"
                          value={giftEmail}
                          onChange={(e) => setGiftEmail(e.target.value)}
                          placeholder="Enter recipient's email"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Purchase Options</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col space-y-4">
                  <Button onClick={handleAddToCart}>Add to Cart</Button>
                  <Button variant="outline" onClick={handleBuyNow} className="relative">
                    Buy Now
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  )
}
