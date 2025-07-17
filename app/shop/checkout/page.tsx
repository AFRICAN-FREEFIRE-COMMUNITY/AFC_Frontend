"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Layout from "@/components/Layout"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/components/ui/use-toast"
import { Trash2, ExternalLink, CreditCard, Building, Phone, ChevronRight, CheckCircle2 } from "lucide-react"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { useCart } from "@/contexts/CartContext"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"

const paymentMethods = [
  { id: "card", name: "Credit/Debit Card", icon: <CreditCard className="h-4 w-4" /> },
  { id: "bank", name: "Bank Transfer", icon: <Building className="h-4 w-4" /> },
  { id: "mobile", name: "Mobile Money", icon: <Phone className="h-4 w-4" /> },
]

export default function CheckoutPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [paymentMethod, setPaymentMethod] = useState("card")
  const [isClient, setIsClient] = useState(false)
  const [currentStep, setCurrentStep] = useState(1)
  const [formData, setFormData] = useState({
    email: "",
    firstName: "",
    lastName: "",
    phone: "",
    address: "",
    city: "",
    state: "",
    zipCode: "",
    cardNumber: "",
    cardName: "",
    expiryDate: "",
    cvv: "",
    saveInfo: false,
  })
  const [isProcessing, setIsProcessing] = useState(false)
  const [isComplete, setIsComplete] = useState(false)

  // Get cart data from context
  const { cartItems, removeFromCart, subtotal, tax, total, clearCart } = useCart()

  // Fix hydration issues by only rendering client-side
  useEffect(() => {
    setIsClient(true)
  }, [])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target
    setFormData({
      ...formData,
      [name]: type === "checkbox" ? checked : value,
    })
  }

  const handleRemoveItem = (id: number) => {
    removeFromCart(id)
    toast({
      title: "Item Removed",
      description: "Item has been removed from your cart.",
    })
  }

  const handleNextStep = () => {
    if (currentStep < 3) {
      setCurrentStep(currentStep + 1)
      window.scrollTo(0, 0)
    }
  }

  const handlePrevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
      window.scrollTo(0, 0)
    }
  }

  const handleCompleteOrder = () => {
    setIsProcessing(true)

    // Simulate processing time
    setTimeout(() => {
      setIsProcessing(false)
      setIsComplete(true)

      // Clear cart after successful order
      clearCart()

      toast({
        title: "Order Placed Successfully!",
        description: "Your order has been successfully placed. You will receive a confirmation email shortly.",
      })

      // Redirect after a delay
      setTimeout(() => {
        router.push("/shop")
      }, 3000)
    }, 2000)
  }

  // Don't render anything during SSR to prevent hydration mismatch
  if (!isClient) {
    return null
  }

  // If cart is empty, show message and redirect button
  if (cartItems.length === 0 && !isComplete) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-8">
          <Card className="max-w-md mx-auto">
            <CardHeader>
              <CardTitle>Your Cart is Empty</CardTitle>
              <CardDescription>Add some items to your cart before checking out.</CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center">
              <Button onClick={() => router.push("/shop")}>Browse Shop</Button>
            </CardContent>
          </Card>
        </div>
      </Layout>
    )
  }

  // If order is complete, show success message
  if (isComplete) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-8">
          <Card className="max-w-md mx-auto">
            <CardHeader className="text-center">
              <div className="flex justify-center mb-4">
                <CheckCircle2 className="h-16 w-16 text-primary" />
              </div>
              <CardTitle>Order Successful!</CardTitle>
              <CardDescription>Thank you for your purchase. Your order has been placed successfully.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-center">
                A confirmation email has been sent to {formData.email || "your email address"}.
              </p>
              <p className="text-center text-sm text-muted-foreground">
                You will be redirected to the shop in a few seconds...
              </p>
              <div className="flex justify-center mt-4">
                <Button onClick={() => router.push("/shop")}>Return to Shop</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-2">Checkout</h1>

        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-between max-w-2xl mx-auto">
            <div
              className={`flex flex-col items-center ${currentStep >= 1 ? "text-primary" : "text-muted-foreground"}`}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${currentStep >= 1 ? "border-primary bg-primary/10" : "border-muted"}`}
              >
                1
              </div>
              <span className="text-xs mt-1">Cart</span>
            </div>
            <div className={`flex-1 h-1 mx-2 ${currentStep >= 2 ? "bg-primary" : "bg-muted"}`}></div>
            <div
              className={`flex flex-col items-center ${currentStep >= 2 ? "text-primary" : "text-muted-foreground"}`}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${currentStep >= 2 ? "border-primary bg-primary/10" : "border-muted"}`}
              >
                2
              </div>
              <span className="text-xs mt-1">Details</span>
            </div>
            <div className={`flex-1 h-1 mx-2 ${currentStep >= 3 ? "bg-primary" : "bg-muted"}`}></div>
            <div
              className={`flex flex-col items-center ${currentStep >= 3 ? "text-primary" : "text-muted-foreground"}`}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${currentStep >= 3 ? "border-primary bg-primary/10" : "border-muted"}`}
              >
                3
              </div>
              <span className="text-xs mt-1">Payment</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            {/* Step 1: Review Cart */}
            {currentStep === 1 && (
              <Card>
                <CardHeader>
                  <CardTitle>Review Your Cart</CardTitle>
                  <CardDescription>Please review your items before proceeding</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {cartItems.map((item) => (
                      <div key={item.id} className="flex justify-between items-center p-4 border rounded-md">
                        <div>
                          <h3 className="font-medium">{item.name}</h3>
                          <p className="text-sm text-muted-foreground">Quantity: {item.quantity}</p>
                          {item.isGift && <p className="text-xs text-primary">Gift for: {item.giftEmail}</p>}
                        </div>
                        <div className="flex items-center gap-4">
                          <p className="font-medium">₦{(item.price * item.quantity).toLocaleString()}</p>
                          <Button variant="ghost" size="icon" onClick={() => handleRemoveItem(item.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-6 flex justify-end">
                    <Button onClick={handleNextStep} className="flex items-center gap-2">
                      Continue to Details <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Step 2: Customer Details */}
            {currentStep === 2 && (
              <Card>
                <CardHeader>
                  <CardTitle>Customer Details</CardTitle>
                  <CardDescription>Enter your contact and delivery information</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="email">Email Address</Label>
                      <Input
                        id="email"
                        name="email"
                        type="email"
                        placeholder="your@email.com"
                        value={formData.email}
                        onChange={handleInputChange}
                        required
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="firstName">First Name</Label>
                        <Input
                          id="firstName"
                          name="firstName"
                          placeholder="John"
                          value={formData.firstName}
                          onChange={handleInputChange}
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="lastName">Last Name</Label>
                        <Input
                          id="lastName"
                          name="lastName"
                          placeholder="Doe"
                          value={formData.lastName}
                          onChange={handleInputChange}
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="phone">Phone Number</Label>
                      <Input
                        id="phone"
                        name="phone"
                        placeholder="+234 800 123 4567"
                        value={formData.phone}
                        onChange={handleInputChange}
                        required
                      />
                    </div>

                    <div>
                      <Label htmlFor="address">Address</Label>
                      <Input
                        id="address"
                        name="address"
                        placeholder="123 Main Street"
                        value={formData.address}
                        onChange={handleInputChange}
                        required
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="city">City</Label>
                        <Input
                          id="city"
                          name="city"
                          placeholder="Lagos"
                          value={formData.city}
                          onChange={handleInputChange}
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="state">State</Label>
                        <Input
                          id="state"
                          name="state"
                          placeholder="Lagos State"
                          value={formData.state}
                          onChange={handleInputChange}
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="zipCode">Postal/Zip Code</Label>
                      <Input
                        id="zipCode"
                        name="zipCode"
                        placeholder="100001"
                        value={formData.zipCode}
                        onChange={handleInputChange}
                      />
                    </div>

                    <div className="flex items-center space-x-2 mt-4">
                      <input
                        type="checkbox"
                        id="saveInfo"
                        name="saveInfo"
                        checked={formData.saveInfo}
                        onChange={handleInputChange}
                        className="rounded border-gray-300"
                      />
                      <Label htmlFor="saveInfo">Save this information for next time</Label>
                    </div>
                  </div>

                  <div className="mt-6 flex justify-between">
                    <Button variant="outline" onClick={handlePrevStep}>
                      Back to Cart
                    </Button>
                    <Button onClick={handleNextStep} className="flex items-center gap-2">
                      Continue to Payment <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Step 3: Payment */}
            {currentStep === 3 && (
              <Card>
                <CardHeader>
                  <CardTitle>Payment Method</CardTitle>
                  <CardDescription>Choose your preferred payment method</CardDescription>
                </CardHeader>
                <CardContent>
                  <Tabs defaultValue="card" onValueChange={setPaymentMethod}>
                    <TabsList className="grid grid-cols-3 mb-4">
                      <TabsTrigger value="card" className="flex items-center gap-2">
                        <CreditCard className="h-4 w-4" /> Card
                      </TabsTrigger>
                      <TabsTrigger value="bank" className="flex items-center gap-2">
                        <Building className="h-4 w-4" /> Bank
                      </TabsTrigger>
                      <TabsTrigger value="mobile" className="flex items-center gap-2">
                        <Phone className="h-4 w-4" /> Mobile
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="card" className="space-y-4">
                      <div>
                        <Label htmlFor="cardNumber">Card Number</Label>
                        <Input
                          id="cardNumber"
                          name="cardNumber"
                          placeholder="1234 5678 9012 3456"
                          value={formData.cardNumber}
                          onChange={handleInputChange}
                          required
                        />
                      </div>

                      <div>
                        <Label htmlFor="cardName">Name on Card</Label>
                        <Input
                          id="cardName"
                          name="cardName"
                          placeholder="John Doe"
                          value={formData.cardName}
                          onChange={handleInputChange}
                          required
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="expiryDate">Expiry Date</Label>
                          <Input
                            id="expiryDate"
                            name="expiryDate"
                            placeholder="MM/YY"
                            value={formData.expiryDate}
                            onChange={handleInputChange}
                            required
                          />
                        </div>
                        <div>
                          <Label htmlFor="cvv">CVV</Label>
                          <Input
                            id="cvv"
                            name="cvv"
                            placeholder="123"
                            value={formData.cvv}
                            onChange={handleInputChange}
                            required
                          />
                        </div>
                      </div>
                    </TabsContent>

                    <TabsContent value="bank" className="space-y-4">
                      <div className="p-4 border rounded-md bg-muted/50">
                        <h3 className="font-medium mb-2">Bank Transfer Instructions</h3>
                        <p className="text-sm mb-4">Please transfer the total amount to the following bank account:</p>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Bank Name:</span>
                            <span className="font-medium">First Bank of Nigeria</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Account Name:</span>
                            <span className="font-medium">AFC Esports Ltd</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Account Number:</span>
                            <span className="font-medium">0123456789</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Reference:</span>
                            <span className="font-medium">ORDER-{Date.now().toString().slice(-6)}</span>
                          </div>
                        </div>
                        <p className="text-xs mt-4 text-muted-foreground">
                          Your order will be processed once payment is confirmed.
                        </p>
                      </div>
                    </TabsContent>

                    <TabsContent value="mobile" className="space-y-4">
                      <div className="p-4 border rounded-md bg-muted/50">
                        <h3 className="font-medium mb-2">Mobile Money Instructions</h3>
                        <p className="text-sm mb-4">
                          Please send the total amount to the following mobile money number:
                        </p>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Mobile Money Provider:</span>
                            <span className="font-medium">MTN MoMo</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Phone Number:</span>
                            <span className="font-medium">+234 800 123 4567</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Account Name:</span>
                            <span className="font-medium">AFC Esports</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Reference:</span>
                            <span className="font-medium">ORDER-{Date.now().toString().slice(-6)}</span>
                          </div>
                        </div>
                        <p className="text-xs mt-4 text-muted-foreground">
                          Your order will be processed once payment is confirmed.
                        </p>
                      </div>
                    </TabsContent>
                  </Tabs>

                  <div className="mt-6 flex justify-between">
                    <Button variant="outline" onClick={handlePrevStep}>
                      Back to Details
                    </Button>
                    <Button onClick={handleCompleteOrder} disabled={isProcessing} className="flex items-center gap-2">
                      {isProcessing ? "Processing..." : "Complete Order"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          <div>
            <Card className="sticky top-24">
              <CardHeader>
                <CardTitle>Order Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {cartItems.map((item) => (
                    <div key={item.id} className="flex justify-between text-sm">
                      <span>
                        {item.quantity} x {item.name}
                      </span>
                      <span>₦{(item.price * item.quantity).toLocaleString()}</span>
                    </div>
                  ))}

                  <Separator />

                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Subtotal</span>
                      <span>₦{subtotal.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Tax (5%)</span>
                      <span>₦{tax.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between font-bold pt-2 border-t">
                      <span>Total</span>
                      <span>₦{total.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="mt-4">
              <CardHeader>
                <CardTitle>How to Claim Your Diamonds</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <p className="text-sm">After completing your purchase, follow these steps to claim your diamonds:</p>
                  <ol className="list-decimal pl-5 space-y-2 text-sm">
                    <li>Visit the Free Fire official website</li>
                    <li>Log in with your Free Fire account</li>
                    <li>Navigate to the "Redeem Code" section</li>
                    <li>Enter the code that will be sent to your email after purchase</li>
                    <li>Confirm the redemption and the diamonds will be added to your account</li>
                  </ol>
                  <Button variant="outline" className="mt-2 flex items-center gap-2 text-sm w-full" asChild>
                    <a href="https://ff.garena.com/en/" target="_blank" rel="noopener noreferrer">
                      Visit Free Fire Website <ExternalLink className="h-4 w-4" />
                    </a>
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="mt-4">
              <CardHeader>
                <CardTitle>Need Help?</CardTitle>
              </CardHeader>
              <CardContent>
                <Accordion type="single" collapsible className="w-full">
                  <AccordionItem value="item-1">
                    <AccordionTrigger className="text-sm">
                      How long does it take to receive my diamonds?
                    </AccordionTrigger>
                    <AccordionContent className="text-sm">
                      After completing your purchase, you will receive a redemption code via email within 24 hours. Once
                      you redeem the code, the diamonds will be instantly added to your Free Fire account.
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="item-2">
                    <AccordionTrigger className="text-sm">What payment methods are accepted?</AccordionTrigger>
                    <AccordionContent className="text-sm">
                      We accept credit/debit cards, bank transfers, and mobile money payments. All transactions are
                      secure and encrypted.
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="item-3">
                    <AccordionTrigger className="text-sm">Can I get a refund?</AccordionTrigger>
                    <AccordionContent className="text-sm">
                      Refunds are available within 7 days of purchase if the redemption code has not been used. Contact
                      our support team to initiate the refund process.
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
                <div className="mt-4 text-center">
                  <a href="/contact" className="text-primary text-sm hover:underline">
                    Contact Support
                  </a>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  )
}
