"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Separator } from "@/components/ui/separator";
import { Trash2, ExternalLink, Check } from "lucide-react";
import * as RPNInput from "react-phone-number-input";
import {
  CountrySelect,
  FlagComponent,
  PhoneInput,
} from "@/components/PhoneNumberInput";
import Link from "next/link";
import { useCart } from "@/contexts/CartContext";
import axios from "axios";
import { env } from "@/lib/env";
import { toast } from "sonner";
import Image from "next/image";
import { DEFAULT_IMAGE } from "@/constants";
import { formatMoneyInput } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import {
  ShopCustomerDetailsSchema,
  ShopCustomerDetailsSchemaType,
} from "@/lib/zodSchemas";

const steps = [
  { id: 1, name: "Cart", label: "Cart" },
  { id: 2, name: "Details", label: "Details" },
  { id: 3, name: "Review", label: "Review & Pay" },
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

export default function CartDetails() {
  const router = useRouter();
  const {
    items,
    removeItem,
    getSubtotal,
    getOriginalSubtotal,
    getTax,
    getTotal,
    clearCart,
  } = useCart();
  const { token } = useAuth();

  const [currentStep, setCurrentStep] = useState(1);
  const [isProcessing, setIsProcessing] = useState(false);

  // Store customer details when form is submitted
  const [customerDetails, setCustomerDetails] =
    useState<ShopCustomerDetailsSchemaType | null>(null);

  const form = useForm<ShopCustomerDetailsSchemaType>({
    resolver: zodResolver(ShopCustomerDetailsSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      address: "",
      city: "",
      state: "",
      postalCode: "",
    },
  });

  const onSubmit = (data: ShopCustomerDetailsSchemaType) => {
    setCustomerDetails(data);
    handleNextStep();
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

  const handleCompleteOrder = async () => {
    if (!customerDetails) {
      toast.error("Customer details are missing");
      return;
    }

    if (items.length === 0) {
      toast.error("Your cart is empty");
      return;
    }

    setIsProcessing(true);

    try {
      const formattedItems = items.map((item) => ({
        variant_id: item.variant_id,
        quantity: item.quantity,
        coupon_code: item.coupon_code || "",
      }));

      // Prepare the order data according to API format
      const orderData = {
        items: formattedItems,
        first_name: customerDetails.firstName,
        last_name: customerDetails.lastName,
        email: customerDetails.email,
        phone_number: customerDetails.phone,
        address: customerDetails.address,
        city: customerDetails.city,
        state: customerDetails.state,
        postcode: customerDetails.postalCode,
      };

      // Make API call
      const response = await axios.post(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/shop/buy-now/`,
        orderData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        },
      );

      const { authorization_url } = response.data;

      window.open(authorization_url);

      toast.success("Order placed successfully!");
      clearCart();
    } catch (error) {
      console.error("Order error:", error);

      if (axios.isAxiosError(error)) {
        const errorMessage =
          error.response?.data?.message ||
          error.response?.data?.detail ||
          "Failed to process order. Please try again.";
        toast.error(errorMessage);
      } else {
        toast.error("Failed to process order. Please try again.");
      }
    } finally {
      setIsProcessing(false);
    }
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
                className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg"
              >
                <div className="relative h-16 w-16 rounded-md overflow-hidden bg-background border">
                  <Image
                    src={item.image || DEFAULT_IMAGE}
                    alt={item.product_name}
                    fill
                    className="object-cover"
                  />
                </div>

                <div className="flex-1">
                  <h4 className="font-medium">{item.product_name}</h4>
                  <p className="text-sm text-muted-foreground">
                    Qty: {item.quantity}
                  </p>
                  {item.coupon_code && (
                    <p className="text-xs text-green-500 font-medium mt-0.5">
                      Coupon: {item.coupon_code}
                    </p>
                  )}
                </div>

                <div className="text-right">
                  {item.coupon_code &&
                    Number(item.line_total) <
                      Number(item.unit_price) * item.quantity && (
                      <p className="text-xs text-muted-foreground line-through">
                        ₦
                        {formatMoneyInput(
                          Number(item.unit_price) * item.quantity,
                        )}
                      </p>
                    )}
                  <p className="font-bold">
                    ₦{formatMoneyInput(item.line_total)}
                  </p>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive"
                    onClick={() => removeItem(item.id)}
                  >
                    <Trash2 />
                  </Button>
                </div>
              </div>
            ))}
            <div className="flex justify-between">
              <Button variant="outline" asChild>
                <Link href="/shop">Back to Shop</Link>
              </Button>
              <Button onClick={handleNextStep} disabled={items.length === 0}>
                Continue to Details
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
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>First Name</FormLabel>
                    <FormControl>
                      <Input placeholder="John" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="lastName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Last Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Doe" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email Address</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="john@example.com"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone</FormLabel>
                  <FormControl>
                    <RPNInput.default
                      className="flex rounded-md shadow-xs"
                      international
                      flagComponent={FlagComponent}
                      countrySelectComponent={CountrySelect}
                      inputComponent={PhoneInput}
                      placeholder="+2348012345679"
                      value={field.value}
                      onChange={(value) => field.onChange(value)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Street Address</FormLabel>
                  <FormControl>
                    <Input placeholder="123 Luxury Lane" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="city"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>City</FormLabel>
                    <FormControl>
                      <Input placeholder="Lagos" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="state"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>State</FormLabel>
                    <FormControl>
                      <Input placeholder="Lagos State" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="postalCode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Postal Code</FormLabel>
                  <FormControl>
                    <Input placeholder="100001" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-between">
              <Button
                type="button"
                variant="outline"
                onClick={handlePreviousStep}
              >
                Back to Cart
              </Button>
              <Button type="submit">Continue to Review</Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );

  const renderReviewStep = () => (
    <Card>
      <CardHeader>
        <CardTitle>Review Your Order</CardTitle>
        <p className="text-sm text-muted-foreground">
          Please review your order details before completing your purchase
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Order Items */}
        <div>
          <h3 className="font-medium text-sm mb-3">Order Items</h3>
          <div className="space-y-2">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-4 p-3 bg-muted/50 rounded-lg"
              >
                <div className="relative h-12 w-12 rounded-md overflow-hidden bg-background border">
                  <Image
                    src={item.image || DEFAULT_IMAGE}
                    alt={item.product_name}
                    fill
                    className="object-cover"
                  />
                </div>
                <div className="flex-1">
                  <h4 className="font-medium text-sm">{item.product_name}</h4>
                  <p className="text-xs text-muted-foreground">
                    Quantity: {item.quantity}
                  </p>
                  {item.coupon_code && (
                    <p className="text-xs text-green-500 font-medium mt-0.5">
                      Coupon: {item.coupon_code}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  {item.coupon_code &&
                    Number(item.line_total) <
                      Number(item.unit_price) * item.quantity && (
                      <p className="text-xs text-muted-foreground line-through">
                        ₦
                        {formatMoneyInput(
                          Number(item.unit_price) * item.quantity,
                        )}
                      </p>
                    )}
                  <p className="font-semibold">
                    ₦{formatMoneyInput(item.line_total)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <Separator />

        {/* Customer Details */}
        <div>
          <h3 className="font-medium text-sm mb-3">Delivery Information</h3>
          <div className="space-y-2.5 text-sm">
            <div className="text-muted-foreground">
              Name:{" "}
              <span className="font-medium text-black dark:text-white">
                {customerDetails?.firstName} {customerDetails?.lastName}
              </span>
            </div>
            <div className="text-muted-foreground">
              Email:{" "}
              <span className="font-medium text-black dark:text-white">
                {customerDetails?.email}
              </span>
            </div>
            <div className="text-muted-foreground">
              Phone:{" "}
              <span className="font-medium text-black dark:text-white">
                {customerDetails?.phone}
              </span>
            </div>
            <div className="text-muted-foreground">
              Address:{" "}
              <span className="font-medium text-black dark:text-white">
                {customerDetails?.address}, {customerDetails?.city},{" "}
                {customerDetails?.state} {customerDetails?.postalCode}
              </span>
            </div>
          </div>
        </div>

        <Separator />

        {/* Order Summary */}
        <div>
          <h3 className="font-medium text-sm mb-3">Order Summary</h3>
          <div className="space-y-3 text-sm">
            {getOriginalSubtotal() > getSubtotal() && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  Original Subtotal:
                </span>
                <span className="line-through text-muted-foreground">
                  ₦{formatMoneyInput(getOriginalSubtotal())}
                </span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal:</span>
              <span>₦{formatMoneyInput(getSubtotal())}</span>
            </div>
            {getOriginalSubtotal() > getSubtotal() && (
              <div className="flex justify-between text-green-500">
                <span>Discount:</span>
                <span>
                  -₦
                  {formatMoneyInput(getOriginalSubtotal() - getSubtotal())}
                </span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tax (7.5%):</span>
              <span>₦{formatMoneyInput(getTax())}</span>
            </div>
            <Separator className="my-2" />
            <div className="flex justify-between font-bold text-base">
              <span>Total:</span>
              <span>₦{formatMoneyInput(getTotal())}</span>
            </div>
          </div>
        </div>

        <Separator />

        <div className="flex justify-between">
          <Button variant="outline" onClick={handlePreviousStep}>
            Back to Details
          </Button>
          <Button
            onClick={handleCompleteOrder}
            disabled={isProcessing || !customerDetails}
          >
            {isProcessing ? "Processing..." : "Pay Now"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div>
      {renderStepIndicator()}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2">
          {currentStep === 1 && renderCartStep()}
          {currentStep === 2 && renderDetailsStep()}
          {currentStep === 3 && renderReviewStep()}
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
                  <div key={item.id} className="text-sm">
                    <div className="flex justify-between">
                      <span>
                        {item.quantity} × {item.product_name}
                      </span>
                      <div className="text-right">
                        {item.coupon_code &&
                          Number(item.line_total) <
                            Number(item.unit_price) * item.quantity && (
                            <span className="text-xs text-muted-foreground line-through mr-1">
                              ₦
                              {formatMoneyInput(
                                Number(item.unit_price) * item.quantity,
                              )}
                            </span>
                          )}
                        <span>₦{formatMoneyInput(item.line_total)}</span>
                      </div>
                    </div>
                    {item.coupon_code && (
                      <p className="text-xs text-green-500">
                        Coupon: {item.coupon_code}
                      </p>
                    )}
                  </div>
                ))}
                <Separator className="my-2" />
                {getOriginalSubtotal() > getSubtotal() && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      Original Subtotal
                    </span>
                    <span className="line-through text-muted-foreground">
                      ₦{formatMoneyInput(getOriginalSubtotal())}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span>Subtotal</span>
                  <span>₦{formatMoneyInput(getSubtotal())}</span>
                </div>
                {getOriginalSubtotal() > getSubtotal() && (
                  <div className="flex justify-between text-sm text-green-500">
                    <span>Discount</span>
                    <span>
                      -₦
                      {formatMoneyInput(
                        getOriginalSubtotal() - getSubtotal(),
                      )}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span>Tax (7.5%)</span>
                  <span>₦{formatMoneyInput(getTax())}</span>
                </div>
              </div>
              <Separator className="my-2" />
              <div className="flex justify-between font-bold">
                <span>Total</span>
                <span>₦{formatMoneyInput(getTotal())}</span>
              </div>
            </CardContent>
          </Card>

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
