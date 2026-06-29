"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
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
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Separator } from "@/components/ui/separator";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
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
import { useAuthModal } from "@/components/AuthModal";
import {
  ShopCustomerDetailsSchema,
  ShopCustomerDetailsSchemaType,
} from "@/lib/zodSchemas";
import { InfoTip } from "@/components/ui/info-tip";
// Saved delivery info: the checkout "saved address" picker + "save my info" toggle
// read/write the per-user delivery profiles via this typed client (lib client mirrors
// lib/marketplaceAdmin.ts). The manage surface lives at /profile/addresses.
import {
  listDeliveryProfiles,
  type DeliveryProfile,
} from "@/lib/deliveryProfiles";

// Checkout step ids. The visible labels are localized at render time via
// t("cart.steps.<labelKey>") (messages/en/shop.json) so the wizard reads in the
// active locale; only the stable numeric id + translation key live here.
const steps = [
  { id: 1, labelKey: "cart" },
  { id: 2, labelKey: "details" },
  { id: 3, labelKey: "review" },
];

// FAQ ids only. Question + answer copy lives in messages/en/shop.json under
// cart.faqs.<id>.{question,answer} and is rendered via t() below.
const faqs = [{ id: "delivery" }, { id: "payment" }, { id: "refund" }];

export default function CartDetails() {
  // Localized copy for the cart + checkout flow (messages/en/shop.json -> "cart").
  const t = useTranslations("shop");
  const router = useRouter();
  // Stripe redirects the buyer back to /shop/cart?stripe=success&session_id=...&order_id=...
  // (see backend afc_shop/stripe_checkout.py success_url). We read those params on mount below
  // to confirm the payment via /shop/stripe-verify/.
  const searchParams = useSearchParams();
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
  const { openAuthModal } = useAuthModal();

  // Which gateway the buyer pays with at checkout. Paystack stays the default so the existing
  // flow is unchanged; "stripe" routes to the new /shop/stripe-buy-now/ endpoint.
  const [paymentProvider, setPaymentProvider] = useState<"paystack" | "stripe">(
    "paystack",
  );

  const requireAuth = (action: () => void) => {
    if (!token) {
      openAuthModal({ defaultTab: "login", onSuccess: action });
      return;
    }
    action();
  };

  const [currentStep, setCurrentStep] = useState(1);
  const [isProcessing, setIsProcessing] = useState(false);

  // Store customer details when form is submitted
  const [customerDetails, setCustomerDetails] =
    useState<ShopCustomerDetailsSchemaType | null>(null);

  // ── Stripe cancelled return ────────────────────────────────────────────────────────────────
  // If the buyer abandons Stripe Checkout, Stripe redirects back to /shop/cart?stripe=cancelled
  // (see backend cancel_url). We just toast so they know nothing was charged and the cart is intact.
  // A SUCCESSFUL Stripe return goes to /orders/success instead, where OrderSuccess.tsx verifies it
  // (the same page that already verifies Paystack), so there is nothing to do here for success.
  const stripeNotifiedRef = useRef(false);
  useEffect(() => {
    if (stripeNotifiedRef.current) return;
    if (searchParams.get("stripe") === "cancelled") {
      stripeNotifiedRef.current = true;
      toast.error(t("cart.toast.stripeCancelled"));
    }
  }, [searchParams]);

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

  // ── Saved delivery info (delivery profiles) ───────────────────────────────────
  // The buyer's reusable saved addresses (GET /shop/delivery-profiles/, via
  // lib/deliveryProfiles). When any exist we show a picker above the details form
  // that prefills the form from a chosen address. The manage surface is
  // /profile/addresses (app/(user)/profile/_components/SavedAddresses.tsx).
  const [savedProfiles, setSavedProfiles] = useState<DeliveryProfile[]>([]);
  // The picker's selected value: a profile id (as a string) or "new" for a fresh
  // address. Drives both the RadioGroup and the saved_profile_id sent at checkout.
  const [selectedProfileId, setSelectedProfileId] = useState<string>("new");
  // "Save my info for next time" toggle + its optional label (e.g. "Home"). When
  // checked, handleCompleteOrder asks the backend to persist a new delivery profile.
  const [saveInfo, setSaveInfo] = useState(false);
  const [deliveryLabel, setDeliveryLabel] = useState("");

  // Map a saved profile onto the react-hook-form field names, and the empty form.
  const emptyDetails: ShopCustomerDetailsSchemaType = {
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    state: "",
    postalCode: "",
  };
  const profileToDetails = (
    p: DeliveryProfile,
  ): ShopCustomerDetailsSchemaType => ({
    firstName: p.first_name || "",
    lastName: p.last_name || "",
    email: p.email || "",
    phone: p.phone_number || "",
    address: p.address || "",
    city: p.city || "",
    state: p.state || "",
    postalCode: p.postcode || "",
  });
  // True when the submitted form still matches the chosen saved profile (i.e. the
  // buyer picked a saved address and did NOT edit it into a new one). Only then do we
  // reference it with saved_profile_id at checkout.
  const detailsMatchProfile = (
    p: DeliveryProfile,
    d: ShopCustomerDetailsSchemaType,
  ) =>
    p.first_name === d.firstName &&
    p.last_name === d.lastName &&
    p.email === d.email &&
    p.phone_number === d.phone &&
    p.address === d.address &&
    p.city === d.city &&
    p.state === d.state &&
    (p.postcode || "") === (d.postalCode || "");

  // Picker change: prefill the form from the chosen saved address, or clear it for a
  // brand-new address. Selecting a saved address also un-checks "save my info" (it is
  // already saved); choosing "new" leaves the toggle to the buyer.
  const handleSelectProfile = (value: string) => {
    setSelectedProfileId(value);
    if (value === "new") {
      form.reset(emptyDetails);
      return;
    }
    const chosen = savedProfiles.find((p) => String(p.id) === value);
    if (chosen) {
      form.reset(profileToDetails(chosen));
      setSaveInfo(false);
    }
  };

  // On mount (and whenever the session token resolves), load the buyer's saved
  // addresses and preselect the default (the list comes back default-first). A
  // failure is non-blocking: the manual form still works, we just toast.
  useEffect(() => {
    if (!token) return;
    let active = true;
    listDeliveryProfiles(token)
      .then((profiles) => {
        if (!active) return;
        setSavedProfiles(profiles);
        const def = profiles.find((p) => p.is_default) ?? profiles[0];
        if (def) {
          setSelectedProfileId(String(def.id));
          form.reset(profileToDetails(def));
        }
      })
      .catch(() => {
        if (active) toast.error(t("savedDelivery.loadFailedToast"));
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

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
      toast.error(t("cart.toast.detailsMissing"));
      return;
    }

    if (items.length === 0) {
      toast.error(t("cart.toast.cartEmpty"));
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
      const orderData: Record<string, any> = {
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

      // ── Saved delivery info (additive; both /shop/buy-now/ and the Stripe twin
      //    already accept these extra keys, ignoring them when absent) ──
      // 1) "Save my info for next time" → persist a new delivery profile, with the
      //    optional label the buyer typed.
      if (saveInfo) {
        orderData.save_delivery_info = true;
        if (deliveryLabel.trim()) orderData.delivery_label = deliveryLabel.trim();
      }
      // 2) A saved address was picked AND left unchanged → reference it by id so the
      //    backend reuses it instead of treating this as a new address. If the buyer
      //    edited it into a different address, we omit the id (it is effectively new).
      if (selectedProfileId !== "new") {
        const chosen = savedProfiles.find(
          (p) => String(p.id) === selectedProfileId,
        );
        if (chosen && detailsMatchProfile(chosen, customerDetails)) {
          orderData.saved_profile_id = chosen.id;
        }
      }

      // Route to the chosen provider's checkout endpoint. Both accept the same body shape; the
      // Stripe path returns checkout_url (redirect), the Paystack path returns authorization_url
      // (opened in a new tab, the original behaviour, kept unchanged).
      const endpoint =
        paymentProvider === "stripe"
          ? `${env.NEXT_PUBLIC_BACKEND_API_URL}/shop/stripe-buy-now/`
          : `${env.NEXT_PUBLIC_BACKEND_API_URL}/shop/buy-now/`;

      const response = await axios.post(endpoint, orderData, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (paymentProvider === "stripe") {
        // Stripe: redirect the buyer to the hosted Checkout page. The cart is cleared only after
        // a confirmed payment (the success-return effect above), so a cancelled payment keeps the
        // cart intact.
        const { checkout_url } = response.data;
        if (!checkout_url) {
          toast.error(t("cart.toast.stripeStartFailed"));
          return;
        }
        window.location.href = checkout_url;
        return;
      }

      // Paystack (unchanged): open the hosted page in a new tab, clear the cart, toast success.
      const { authorization_url } = response.data;

      window.open(authorization_url);

      toast.success(t("cart.toast.orderPlaced"));
      clearCart();
    } catch (error) {
      console.error("Order error:", error);

      if (axios.isAxiosError(error)) {
        const errorMessage =
          error.response?.data?.message ||
          error.response?.data?.detail ||
          t("cart.toast.orderFailed");
        toast.error(errorMessage);
      } else {
        toast.error(t("cart.toast.orderFailed"));
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
              {t(`cart.steps.${step.labelKey}`)}
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
        <CardTitle>{t("cart.review.title")}</CardTitle>
        <p className="text-sm text-muted-foreground">
          {t("cart.review.subtitle")}
        </p>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground mb-4">
              {t("cart.review.empty")}
            </p>
            <Button asChild>
              <Link href="/shop">{t("cart.review.continueShopping")}</Link>
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
                    {t("cart.review.qty", { quantity: item.quantity })}
                  </p>
                  {item.coupon_code && (
                    <p className="text-xs text-green-500 font-medium mt-0.5">
                      {t("cart.review.coupon", { code: item.coupon_code })}
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
                <Link href="/shop">{t("cart.review.backToShop")}</Link>
              </Button>
              <Button
                onClick={() => requireAuth(handleNextStep)}
                disabled={items.length === 0}
              >
                {t("cart.review.continueToDetails")}
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
        <CardTitle className="flex items-center gap-1">
          {t("cart.details.title")}
          <InfoTip id="shop.diamonds.customer_details._section" />
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          {t("cart.details.subtitle")}
        </p>
      </CardHeader>
      <CardContent>
        {/* ── Saved address picker ──────────────────────────────────────────────
            Shown only when the buyer has saved addresses (delivery profiles). Picking
            one prefills the form below; "Use a new address" clears it. The default is
            preselected on load. Mirrors the payment-method RadioGroup styling used on
            the review step so the two pickers read as one designer's work. */}
        {savedProfiles.length > 0 && (
          <div className="mb-6">
            <h3 className="font-medium text-sm mb-3">
              {t("savedDelivery.useSaved")}
            </h3>
            <RadioGroup
              value={selectedProfileId}
              onValueChange={handleSelectProfile}
              className="grid gap-3"
            >
              {savedProfiles.map((p) => (
                <Label
                  key={p.id}
                  htmlFor={`saved_${p.id}`}
                  className={`flex cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors ${
                    selectedProfileId === String(p.id)
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-muted/50"
                  }`}
                >
                  <RadioGroupItem
                    value={String(p.id)}
                    id={`saved_${p.id}`}
                    className="mt-0.5"
                  />
                  <div className="space-y-0.5">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                      {/* Commas, never dashes (AFC copy rule). */}
                      {p.first_name} {p.last_name}, {p.address}, {p.city}
                      {p.is_default && (
                        <Badge
                          variant="outline"
                          className="rounded-full px-2 py-0.5 text-xs"
                        >
                          {t("savedDelivery.defaultBadge")}
                        </Badge>
                      )}
                    </p>
                  </div>
                </Label>
              ))}
              {/* Final option: enter a brand-new address (clears the form). */}
              <Label
                htmlFor="saved_new"
                className={`flex cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors ${
                  selectedProfileId === "new"
                    ? "border-primary bg-primary/5"
                    : "border-border hover:bg-muted/50"
                }`}
              >
                <RadioGroupItem value="new" id="saved_new" className="mt-0.5" />
                <p className="text-sm font-medium">
                  {t("savedDelivery.newAddress")}
                </p>
              </Label>
            </RadioGroup>
          </div>
        )}
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("cart.details.firstName")}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={t("cart.details.firstNamePlaceholder")}
                        {...field}
                      />
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
                    <FormLabel>{t("cart.details.lastName")}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={t("cart.details.lastNamePlaceholder")}
                        {...field}
                      />
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
                  <FormLabel>{t("cart.details.email")}</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder={t("cart.details.emailPlaceholder")}
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
                  <FormLabel>{t("cart.details.phone")}</FormLabel>
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
                  <FormLabel>{t("cart.details.address")}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t("cart.details.addressPlaceholder")}
                      {...field}
                    />
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
                    <FormLabel>{t("cart.details.city")}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={t("cart.details.cityPlaceholder")}
                        {...field}
                      />
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
                    <FormLabel>{t("cart.details.state")}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={t("cart.details.statePlaceholder")}
                        {...field}
                      />
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
                  <FormLabel>{t("cart.details.postalCode")}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t("cart.details.postalCodePlaceholder")}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* ── Save my info for next time ──────────────────────────────────────
                Opt-in: persist these details as a delivery profile on order so the
                buyer can reuse them. The label Input only appears once checked. This
                is plain component state (not part of the react-hook-form schema); it
                is read in handleCompleteOrder. */}
            <div className="rounded-md border p-3 space-y-3">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="save_delivery_info"
                  checked={saveInfo}
                  onCheckedChange={(checked) => setSaveInfo(checked === true)}
                />
                <Label
                  htmlFor="save_delivery_info"
                  className="cursor-pointer text-sm font-normal"
                >
                  {t("savedDelivery.saveInfo")}
                </Label>
              </div>
              {saveInfo && (
                <Input
                  value={deliveryLabel}
                  onChange={(e) => setDeliveryLabel(e.target.value)}
                  placeholder={t("savedDelivery.labelPlaceholder")}
                />
              )}
            </div>

            <div className="flex justify-between">
              <Button
                type="button"
                variant="outline"
                onClick={handlePreviousStep}
              >
                {t("cart.details.backToCart")}
              </Button>
              <Button type="submit">{t("cart.details.continueToReview")}</Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );

  const renderReviewStep = () => (
    <Card>
      <CardHeader>
        <CardTitle>{t("cart.reviewOrder.title")}</CardTitle>
        <p className="text-sm text-muted-foreground">
          {t("cart.reviewOrder.subtitle")}
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Order Items */}
        <div>
          <h3 className="font-medium text-sm mb-3">
            {t("cart.reviewOrder.orderItems")}
          </h3>
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
                    {t("cart.reviewOrder.quantity", {
                      quantity: item.quantity,
                    })}
                  </p>
                  {item.coupon_code && (
                    <p className="text-xs text-green-500 font-medium mt-0.5">
                      {t("cart.reviewOrder.coupon", { code: item.coupon_code })}
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
          <h3 className="font-medium text-sm mb-3">
            {t("cart.reviewOrder.deliveryInfo")}
          </h3>
          <div className="space-y-2.5 text-sm">
            <div className="text-muted-foreground">
              {t("cart.reviewOrder.name")}{" "}
              <span className="font-medium text-black dark:text-white">
                {customerDetails?.firstName} {customerDetails?.lastName}
              </span>
            </div>
            <div className="text-muted-foreground">
              {t("cart.reviewOrder.email")}{" "}
              <span className="font-medium text-black dark:text-white">
                {customerDetails?.email}
              </span>
            </div>
            <div className="text-muted-foreground">
              {t("cart.reviewOrder.phone")}{" "}
              <span className="font-medium text-black dark:text-white">
                {customerDetails?.phone}
              </span>
            </div>
            <div className="text-muted-foreground">
              {t("cart.reviewOrder.address")}{" "}
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
          <h3 className="font-medium text-sm mb-3">
            {t("cart.reviewOrder.orderSummary")}
          </h3>
          <div className="space-y-3 text-sm">
            {getOriginalSubtotal() > getSubtotal() && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  {t("cart.reviewOrder.originalSubtotal")}
                </span>
                <span className="line-through text-muted-foreground">
                  ₦{formatMoneyInput(getOriginalSubtotal())}
                </span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                {t("cart.reviewOrder.subtotal")}
              </span>
              <span>₦{formatMoneyInput(getSubtotal())}</span>
            </div>
            {getOriginalSubtotal() > getSubtotal() && (
              <div className="flex justify-between text-green-500">
                <span>{t("cart.reviewOrder.discount")}</span>
                <span>
                  -₦
                  {formatMoneyInput(getOriginalSubtotal() - getSubtotal())}
                </span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                {t("cart.reviewOrder.tax")}
                <InfoTip id="shop.checkout.tax" className="ml-1" />:
              </span>
              <span>₦{formatMoneyInput(getTax())}</span>
            </div>
            <Separator className="my-2" />
            <div className="flex justify-between font-bold text-base">
              <span>
                {t("cart.reviewOrder.total")}
                <InfoTip id="shop.checkout.total" className="ml-1" />:
              </span>
              <span>₦{formatMoneyInput(getTotal())}</span>
            </div>
          </div>
        </div>

        <Separator />

        {/* Payment method picker. Paystack is the default (NGN card, bank, USSD, mobile money).
            Stripe is the second option (international cards, charged in your local currency).
            Selecting Stripe routes checkout to /shop/stripe-buy-now/ on submit. */}
        <div>
          <h3 className="font-medium text-sm mb-3">
            {t("cart.reviewOrder.paymentMethod")}
          </h3>
          <RadioGroup
            value={paymentProvider}
            onValueChange={(value) =>
              setPaymentProvider(value as "paystack" | "stripe")
            }
            className="grid gap-3"
          >
            <Label
              htmlFor="provider_paystack"
              className={`flex cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors ${
                paymentProvider === "paystack"
                  ? "border-primary bg-primary/5"
                  : "border-border hover:bg-muted/50"
              }`}
            >
              <RadioGroupItem
                value="paystack"
                id="provider_paystack"
                className="mt-0.5"
              />
              <div className="space-y-0.5">
                <p className="text-sm font-medium">
                  {t("cart.reviewOrder.paystack")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t("cart.reviewOrder.paystackDesc")}
                </p>
              </div>
            </Label>
            <Label
              htmlFor="provider_stripe"
              className={`flex cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors ${
                paymentProvider === "stripe"
                  ? "border-primary bg-primary/5"
                  : "border-border hover:bg-muted/50"
              }`}
            >
              <RadioGroupItem
                value="stripe"
                id="provider_stripe"
                className="mt-0.5"
              />
              <div className="space-y-0.5">
                <p className="text-sm font-medium">
                  {t("cart.reviewOrder.stripe")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t("cart.reviewOrder.stripeDesc")}
                </p>
              </div>
            </Label>
          </RadioGroup>
        </div>

        <Separator />

        <div className="flex justify-between">
          <Button variant="outline" onClick={handlePreviousStep}>
            {t("cart.reviewOrder.backToDetails")}
          </Button>
          <div className="flex items-center gap-1">
            <Button
              onClick={handleCompleteOrder}
              disabled={isProcessing || !customerDetails}
            >
              {isProcessing
                ? t("cart.reviewOrder.processing")
                : paymentProvider === "stripe"
                  ? t("cart.reviewOrder.payWithStripe")
                  : t("cart.reviewOrder.payNow")}
            </Button>
            <InfoTip id="shop.checkout.pay_now" />
          </div>
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
              <CardTitle>{t("cart.summary.title")}</CardTitle>
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
                        {t("cart.summary.coupon", { code: item.coupon_code })}
                      </p>
                    )}
                  </div>
                ))}
                <Separator className="my-2" />
                {getOriginalSubtotal() > getSubtotal() && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      {t("cart.summary.originalSubtotal")}
                    </span>
                    <span className="line-through text-muted-foreground">
                      ₦{formatMoneyInput(getOriginalSubtotal())}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span>{t("cart.summary.subtotal")}</span>
                  <span>₦{formatMoneyInput(getSubtotal())}</span>
                </div>
                {getOriginalSubtotal() > getSubtotal() && (
                  <div className="flex justify-between text-sm text-green-500">
                    <span>{t("cart.summary.discount")}</span>
                    <span>
                      -₦
                      {formatMoneyInput(getOriginalSubtotal() - getSubtotal())}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span>{t("cart.summary.tax")}</span>
                  <span>₦{formatMoneyInput(getTax())}</span>
                </div>
              </div>
              <Separator className="my-2" />
              <div className="flex justify-between font-bold">
                <span>{t("cart.summary.total")}</span>
                <span>₦{formatMoneyInput(getTotal())}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-1">
                {t("cart.claim.title")}
                <InfoTip id="shop.diamonds.claim._section" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                {t("cart.claim.intro")}
              </p>
              <ol className="text-sm space-y-2 list-decimal list-inside text-muted-foreground">
                <li>{t("cart.claim.step1")}</li>
                <li>{t("cart.claim.step2")}</li>
                <li>{t("cart.claim.step3")}</li>
                <li>{t("cart.claim.step4")}</li>
                <li>{t("cart.claim.step5")}</li>
              </ol>
              <Button variant="outline" className="w-full mt-4" asChild>
                <a
                  href="https://reward.ff.garena.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {t("cart.claim.visitFreeFire")}
                  <ExternalLink className="ml-2 h-4 w-4" />
                </a>
              </Button>
            </CardContent>
          </Card>

          {/* FAQ */}
          <Card>
            <CardHeader>
              <CardTitle>{t("cart.faqTitle")}</CardTitle>
            </CardHeader>
            <CardContent>
              <Accordion type="single" collapsible className="w-full">
                {faqs.map((faq) => (
                  <AccordionItem key={faq.id} value={faq.id}>
                    <AccordionTrigger className="text-sm text-left">
                      {t(`cart.faqs.${faq.id}.question`)}
                    </AccordionTrigger>
                    <AccordionContent className="text-sm text-muted-foreground">
                      {t(`cart.faqs.${faq.id}.answer`)}
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
