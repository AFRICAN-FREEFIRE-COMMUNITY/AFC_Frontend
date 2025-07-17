"use client"

import { useState } from "react"
import Layout from "@/components/Layout"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Search } from "lucide-react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"

const diamondBundles = [
  {
    id: 1,
    amount: 100,
    name: "Small Diamond Pack",
    description: "Perfect for small purchases and beginners",
    price: 1250,
    stock: 50,
    image: "/placeholder.svg?height=200&width=200",
  },
  {
    id: 2,
    amount: 310,
    name: "Medium Diamond Pack",
    description: "Great value for regular players",
    price: 3750,
    stock: 30,
    image: "/placeholder.svg?height=200&width=200",
  },
  {
    id: 3,
    amount: 520,
    name: "Large Diamond Pack",
    description: "Ideal for active gamers",
    price: 6200,
    stock: 20,
    image: "/placeholder.svg?height=200&width=200",
  },
  {
    id: 4,
    amount: 1060,
    name: "XL Diamond Pack",
    description: "Best value for serious players",
    price: 12100,
    stock: 10,
    image: "/placeholder.svg?height=200&width=200",
  },
  {
    id: 5,
    amount: 2180,
    name: "Premium Diamond Pack",
    description: "For the dedicated Free Fire enthusiast",
    price: 24600,
    stock: 5,
    image: "/placeholder.svg?height=200&width=200",
  },
  {
    id: 6,
    amount: 5600,
    name: "Ultimate Diamond Pack",
    description: "The ultimate diamond collection for pros",
    price: 60500,
    stock: 0,
    image: "/placeholder.svg?height=200&width=200",
  },
]

export default function ShopPage() {
  const [searchTerm, setSearchTerm] = useState("")

  const filteredBundles = diamondBundles.filter(
    (bundle) =>
      bundle.amount.toString().includes(searchTerm) ||
      bundle.price.toString().includes(searchTerm) ||
      bundle.name.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">Free Fire Diamond Shop</h1>

        <div className="mb-6">
          <div className="relative">
            <Input
              type="text"
              placeholder="Search diamonds..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredBundles.map((bundle) => (
            <Card key={bundle.id} className="hover:shadow-lg transition-shadow overflow-hidden">
              <div className="relative">
                <img
                  src={bundle.image || "/placeholder.svg"}
                  alt={`${bundle.name} - ${bundle.amount} Diamonds`}
                  className="w-full h-48 object-cover"
                />
                {bundle.stock === 0 && (
                  <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                    <Badge variant="destructive" className="text-lg px-4 py-2">
                      Out of Stock
                    </Badge>
                  </div>
                )}
              </div>
              <CardHeader>
                <CardTitle>{bundle.name}</CardTitle>
                <CardDescription className="flex items-center mt-1">
                  <span className="text-lg font-semibold mr-1">{bundle.amount}</span>
                  <span className="text-yellow-500">💎</span>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-3">{bundle.description}</p>
                <p className="text-2xl font-bold mb-2">₦{bundle.price.toLocaleString()}</p>
                {bundle.stock > 0 && bundle.stock <= 10 && (
                  <p className="text-amber-600 text-sm">Only {bundle.stock} left in stock!</p>
                )}
              </CardContent>
              <CardFooter>
                <Button asChild className="w-full" disabled={bundle.stock === 0}>
                  <Link href={`/shop/${bundle.id}`}>{bundle.stock === 0 ? "Out of Stock" : "Buy Now"}</Link>
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>
    </Layout>
  )
}
