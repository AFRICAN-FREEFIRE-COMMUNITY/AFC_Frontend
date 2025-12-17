"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  ArrowRight,
  Trash2,
  ExternalLink,
  Check,
  CreditCard,
  Building2,
  Smartphone,
} from "lucide-react";
import Link from "next/link";
import { useCart } from "@/contexts/CartContext";
import { ComingSoon } from "@/components/ComingSoon";

const steps = [
  { id: 1, name: "Cart", label: "Cart" },
  { id: 2, name: "Details", label: "Details" },
  { id: 3, name: "Payment", label: "Payment" },
];

const faqs = [
  {
    id: "delivery",
    question: "How long does it take to receive my diamonds?",
    answer:
      "After completing your purchase, you will receive your redemption code via email within 5-10 minutes. In rare cases, it may take up to 24 hours during high traffic periods.",
  },
  {
    id: "payment",
    question: "What payment methods are accepted?",
    answer:
      "We accept various payment methods including bank transfers, card payments, and mobile money. All payments are processed securely through our payment partners.",
  },
  {
    id: "refund",
    question: "Can I get a refund?",
    answer:
      "Refunds are available within 24 hours of purchase if the redemption code has not been used. Please contact our support team for assistance with refund requests.",
  },
];

export default function CheckoutPage() {
  const router = useRouter();
  const { items, removeItem, getSubtotal, getTax, getTotal, clearCart } =
    useCart();

  const [currentStep, setCurrentStep] = useState(1);
  const [paymentMethod, setPaymentMethod] = useState("card");
  const [saveInfo, setSaveInfo] = useState(false);
  const [orderReference] = useState(
    `ORDER-${Math.floor(100000 + Math.random() * 900000)}`
  );

  // Form state for details step
  const [customerDetails, setCustomerDetails] = useState({
    email: "",
    firstName: "",
    lastName: "",
    phone: "",
    address: "",
    city: "",
    state: "",
    postalCode: "",
  });

  // Card payment state
  const [cardDetails, setCardDetails] = useState({
    cardNumber: "",
    nameOnCard: "",
    expiry: "",
    cvv: "",
  });

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
      minimumFractionDigits: 0,
    }).format(price);
  };

  const handleNextStep = () => {
    if (currentStep < 3) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePreviousStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleCompleteOrder = () => {
    clearCart();
    router.push("/shop/order-success");
  };

  const renderStepIndicator = () => (
    <div className="flex items-center justify-center mb-8">
      {steps.map((step, index) => (
        <div key={step.id} className="flex items-center">
          <div className="flex flex-col items-center">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium border-2 ${
                currentStep >= step.id
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-muted-foreground border-muted"
              }`}
            >
              {currentStep > step.id ? <Check className="h-4 w-4" /> : step.id}
            </div>
            <span
              className={`text-xs mt-1 ${
                currentStep >= step.id
                  ? "text-primary"
                  : "text-muted-foreground"
              }`}
            >
              {step.label}
            </span>
          </div>
          {index < steps.length - 1 && (
            <div
              className={`w-24 h-0.5 mx-2 ${
                currentStep > step.id ? "bg-primary" : "bg-muted"
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );

  const renderCartStep = () => (
    <Card>
      <CardHeader>
        <CardTitle>Review Your Cart</CardTitle>
        <p className="text-sm text-muted-foreground">
          Please review your items before proceeding
        </p>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground mb-4">Your cart is empty</p>
            <Button asChild>
              <Link href="/shop">Continue Shopping</Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-4 bg-muted/50 rounded-lg"
              >
                <div>
                  <h4 className="font-medium">{item.name}</h4>
                  <p className="text-sm text-muted-foreground">
                    Quantity: {item.quantity}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <span className="font-medium">
                    {formatPrice(item.price * item.quantity)}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeItem(item.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
            <div className="flex justify-between pt-4">
              <Button variant="outline" asChild>
                <Link href="/shop">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Shop
                </Link>
              </Button>
              <Button onClick={handleNextStep} disabled={items.length === 0}>
                Continue to Details
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );

  const renderDetailsStep = () => (
    <Card>
      <CardHeader>
        <CardTitle>Customer Details</CardTitle>
        <p className="text-sm text-muted-foreground">
          Enter your contact and delivery information
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <Label htmlFor="email">Email Address</Label>
            <Input
              id="email"
              type="email"
              placeholder="your@email.com"
              value={customerDetails.email}
              onChange={(e) =>
                setCustomerDetails({
                  ...customerDetails,
                  email: e.target.value,
                })
              }
              className="mt-1"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="firstName">First Name</Label>
              <Input
                id="firstName"
                placeholder="John"
                value={customerDetails.firstName}
                onChange={(e) =>
                  setCustomerDetails({
                    ...customerDetails,
                    firstName: e.target.value,
                  })
                }
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="lastName">Last Name</Label>
              <Input
                id="lastName"
                placeholder="Doe"
                value={customerDetails.lastName}
                onChange={(e) =>
                  setCustomerDetails({
                    ...customerDetails,
                    lastName: e.target.value,
                  })
                }
                className="mt-1"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="phone">Phone Number</Label>
            <Input
              id="phone"
              placeholder="+234 800 123 4567"
              value={customerDetails.phone}
              onChange={(e) =>
                setCustomerDetails({
                  ...customerDetails,
                  phone: e.target.value,
                })
              }
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="address">Address</Label>
            <Input
              id="address"
              placeholder="123 Main Street"
              value={customerDetails.address}
              onChange={(e) =>
                setCustomerDetails({
                  ...customerDetails,
                  address: e.target.value,
                })
              }
              className="mt-1"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                placeholder="Lagos"
                value={customerDetails.city}
                onChange={(e) =>
                  setCustomerDetails({
                    ...customerDetails,
                    city: e.target.value,
                  })
                }
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="state">State</Label>
              <Input
                id="state"
                placeholder="Lagos State"
                value={customerDetails.state}
                onChange={(e) =>
                  setCustomerDetails({
                    ...customerDetails,
                    state: e.target.value,
                  })
                }
                className="mt-1"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="postalCode">Postal/Zip Code</Label>
            <Input
              id="postalCode"
              placeholder="100001"
              value={customerDetails.postalCode}
              onChange={(e) =>
                setCustomerDetails({
                  ...customerDetails,
                  postalCode: e.target.value,
                })
              }
              className="mt-1"
            />
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="saveInfo"
              checked={saveInfo}
              onCheckedChange={(checked) => setSaveInfo(checked as boolean)}
            />
            <Label htmlFor="saveInfo" className="text-sm cursor-pointer">
              Save this information for next time
            </Label>
          </div>

          <div className="flex justify-between pt-4">
            <Button variant="outline" onClick={handlePreviousStep}>
              Back to Cart
            </Button>
            <Button onClick={handleNextStep}>
              Continue to Payment
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const renderPaymentStep = () => (
    <Card>
      <CardHeader>
        <CardTitle>Payment Method</CardTitle>
        <p className="text-sm text-muted-foreground">
          Choose your preferred payment method
        </p>
      </CardHeader>
      <CardContent>
        <Tabs value={paymentMethod} onValueChange={setPaymentMethod}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="card" className="flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              Card
            </TabsTrigger>
            <TabsTrigger value="bank" className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Bank
            </TabsTrigger>
            <TabsTrigger value="mobile" className="flex items-center gap-2">
              <Smartphone className="h-4 w-4" />
              Mobile
            </TabsTrigger>
          </TabsList>

          <TabsContent value="card" className="mt-6 space-y-4">
            <div>
              <Label htmlFor="cardNumber">Card Number</Label>
              <Input
                id="cardNumber"
                placeholder="1234 5678 9012 3456"
                value={cardDetails.cardNumber}
                onChange={(e) =>
                  setCardDetails({ ...cardDetails, cardNumber: e.target.value })
                }
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="nameOnCard">Name on Card</Label>
              <Input
                id="nameOnCard"
                placeholder="John Doe"
                value={cardDetails.nameOnCard}
                onChange={(e) =>
                  setCardDetails({ ...cardDetails, nameOnCard: e.target.value })
                }
                className="mt-1"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="expiry">Expiry Date</Label>
                <Input
                  id="expiry"
                  placeholder="MM/YY"
                  value={cardDetails.expiry}
                  onChange={(e) =>
                    setCardDetails({ ...cardDetails, expiry: e.target.value })
                  }
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="cvv">CVV</Label>
                <Input
                  id="cvv"
                  placeholder="123"
                  value={cardDetails.cvv}
                  onChange={(e) =>
                    setCardDetails({ ...cardDetails, cvv: e.target.value })
                  }
                  className="mt-1"
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="bank" className="mt-6">
            <div className="p-4 bg-muted/50 rounded-lg space-y-3">
              <h4 className="font-semibold">Bank Transfer Instructions</h4>
              <p className="text-sm text-muted-foreground">
                Please transfer the total amount to the following bank account:
              </p>
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
                  <span className="font-medium">{orderReference}</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-4">
                Your order will be processed once payment is confirmed.
              </p>
            </div>
          </TabsContent>

          <TabsContent value="mobile" className="mt-6">
            <div className="p-4 bg-muted/50 rounded-lg space-y-3">
              <h4 className="font-semibold">Mobile Money Instructions</h4>
              <p className="text-sm text-muted-foreground">
                Please send the total amount to the following mobile money
                number:
              </p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    Mobile Money Provider:
                  </span>
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
                  <span className="font-medium">{orderReference}</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-4">
                Your order will be processed once payment is confirmed.
              </p>
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex justify-between pt-6">
          <Button variant="outline" onClick={handlePreviousStep}>
            Back to Details
          </Button>
          <Button onClick={handleCompleteOrder}>Complete Order</Button>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="relative">
      <ComingSoon />
      <h1 className="text-3xl font-bold mb-6">Checkout</h1>

      {renderStepIndicator()}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2">
          {currentStep === 1 && renderCartStep()}
          {currentStep === 2 && renderDetailsStep()}
          {currentStep === 3 && renderPaymentStep()}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Order Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Order Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {items.map((item) => (
                  <div key={item.id} className="flex justify-between text-sm">
                    <span>
                      {item.quantity} × {item.name}
                    </span>
                    <span>{formatPrice(item.price * item.quantity)}</span>
                  </div>
                ))}
                <Separator className="my-2" />
                <div className="flex justify-between text-sm">
                  <span>Subtotal</span>
                  <span>{formatPrice(getSubtotal())}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Tax (5%)</span>
                  <span>{formatPrice(getTax())}</span>
                </div>
                <Separator className="my-2" />
                <div className="flex justify-between font-bold">
                  <span>Total</span>
                  <span>{formatPrice(getTotal())}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* How to Claim */}
          <Card>
            <CardHeader>
              <CardTitle>How to Claim Your Diamonds</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                After completing your purchase, follow these steps to claim your
                diamonds:
              </p>
              <ol className="text-sm space-y-2 list-decimal list-inside text-muted-foreground">
                <li>Visit the Free Fire official website</li>
                <li>Log in with your Free Fire account</li>
                <li>Navigate to the &quot;Redeem Code&quot; section</li>
                <li>
                  Enter the code that will be sent to your email after purchase
                </li>
                <li>
                  Confirm the redemption and the diamonds will be added to your
                  account
                </li>
              </ol>
              <Button variant="outline" className="w-full mt-4" asChild>
                <a
                  href="https://reward.ff.garena.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Visit Free Fire Website
                  <ExternalLink className="ml-2 h-4 w-4" />
                </a>
              </Button>
            </CardContent>
          </Card>

          {/* FAQ */}
          <Card>
            <CardHeader>
              <CardTitle>Need Help?</CardTitle>
            </CardHeader>
            <CardContent>
              <Accordion type="single" collapsible className="w-full">
                {faqs.map((faq) => (
                  <AccordionItem key={faq.id} value={faq.id}>
                    <AccordionTrigger className="text-sm text-left">
                      {faq.question}
                    </AccordionTrigger>
                    <AccordionContent className="text-sm text-muted-foreground">
                      {faq.answer}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
