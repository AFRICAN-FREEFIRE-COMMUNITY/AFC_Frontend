"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import axios from "axios";
import { env } from "@/lib/env";
import { useAuth } from "@/contexts/AuthContext";
import Link from "next/link";
import {
  IconCircleCheck,
  IconLoader2,
  IconX,
  IconRefresh,
} from "@tabler/icons-react";
import { toast } from "sonner";
import { InfoTip } from "@/components/ui/info-tip";

export default function OrderSuccess() {
  const searchParams = useSearchParams();
  const { token } = useAuth();

  const [status, setStatus] = useState<"loading" | "success" | "error">(
    "loading",
  );
  const [orderDetails, setOrderDetails] = useState<any>(null);
  const [isRetrying, setIsRetrying] = useState(false);

  // Paystack returns ?reference=...  Stripe returns ?stripe=success&session_id=...&order_id=...
  // This one page verifies whichever provider sent the buyer here.
  const reference = searchParams.get("reference");
  const isStripe = searchParams.get("stripe") === "success";
  const stripeSessionId = searchParams.get("session_id");
  const stripeOrderId = searchParams.get("order_id");
  // Either provider gives us "something" to verify; used to gate the loading state + polling.
  const hasPaymentRef = Boolean(reference) || (isStripe && Boolean(stripeSessionId || stripeOrderId));

  // Ref to track polling to prevent memory leaks
  const pollingInterval = useRef<NodeJS.Timeout | null>(null);

  const verifyPayment = useCallback(async () => {
    // Stripe path: hit /shop/stripe-verify/ with the session/order id (no reference, no token
    // required, mirroring the unauthenticated verify endpoint). Otherwise fall through to Paystack.
    if (isStripe) {
      if (!stripeSessionId && !stripeOrderId) return;
      setIsRetrying(true);
      try {
        const response = await axios.post(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/shop/stripe-verify/`,
          { session_id: stripeSessionId, order_id: stripeOrderId },
          { headers: { "Content-Type": "application/json" } },
        );
        if (response.data?.status === "paid") {
          // Shape the details like the Paystack response so the success card renders the same.
          setOrderDetails({ order_id: stripeOrderId });
          setStatus("success");
          if (pollingInterval.current) clearInterval(pollingInterval.current);
          toast.success("Payment verified!");
        }
      } catch (error: any) {
        console.error("Stripe verification attempt failed", error);
        if (status !== "success") setStatus("error");
        toast.error(
          error.response?.data?.message || "Verification failed. Try again.",
        );
      } finally {
        setIsRetrying(false);
      }
      return;
    }

    if (!reference || !token) return;

    setIsRetrying(true);

    try {
      const response = await axios.post(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/shop/verify-paystack-payment/`,
        { reference: reference },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        },
      );

      // Check for success status from your API
      if (response.status === 200 || response.status === 201) {
        setOrderDetails(response.data);
        setStatus("success");
        // Stop polling once successful
        if (pollingInterval.current) clearInterval(pollingInterval.current);
        toast.success("Payment verified!");
      }
    } catch (error: any) {
      console.error("Verification attempt failed", error);
      // We only set status to error if we aren't already successful
      // and it's either a manual check or the first check
      if (status !== "success") setStatus("error");

      // if (isManual) {
      toast.error(
        error.response?.data?.message || "Verification failed. Try again.",
      );
      // }
    } finally {
      setIsRetrying(false);
    }
  }, [reference, token, status, isStripe, stripeSessionId, stripeOrderId]);

  // Handle Polling and Initial Load
  useEffect(() => {
    // Stripe verify does not need a token (the session id is the proof); Paystack still does.
    if (hasPaymentRef && (isStripe || token)) {
      // Initial check
      verifyPayment();

      // Set up polling every 30 seconds
      pollingInterval.current = setInterval(() => {
        if (status !== "success") {
          verifyPayment();
        }
      }, 30000);
    }

    return () => {
      if (pollingInterval.current) clearInterval(pollingInterval.current);
    };
  }, [token, hasPaymentRef, isStripe, verifyPayment, status]);

  // Loading state (First attempt)
  if (status === "loading") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <IconLoader2 className="h-12 w-12 animate-spin text-primary" />
        <div className="space-y-2 text-center">
          <h2 className="text-lg font-semibold">Verifying your payment...</h2>
          <p className="text-muted-foreground text-sm">
            Please do not refresh the page.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container max-w-xl">
      <Card className="shadow-lg">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            {status === "success" ? (
              <IconCircleCheck className="h-16 w-16 text-green-500" />
            ) : (
              <IconX className="h-16 w-16 text-destructive" />
            )}
          </div>
          <CardTitle className="text-2xl font-bold flex items-center justify-center gap-1">
            {status === "success"
              ? "Payment Successful!"
              : "Pending Verification"}
            <InfoTip id="shop.diamonds.order_status" />
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-4 text-center">
          {status === "success" ? (
            <>
              <CardDescription className="text-base">
                Your order has been confirmed. Your diamonds are being
                delivered!
              </CardDescription>
              <div className="bg-muted p-4 rounded-md text-left w-full space-y-2 border">
                {/* Paystack carries a reference; Stripe carries a session id. Show whichever exists. */}
                {(reference || stripeSessionId) && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      {reference ? "Reference:" : "Session:"}
                    </span>
                    <span className="font-mono text-xs">
                      {reference || stripeSessionId}
                    </span>
                  </div>
                )}
                {orderDetails?.order_id && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Order ID:</span>
                    <span className="font-semibold">
                      #{orderDetails.order_id}
                    </span>
                  </div>
                )}
              </div>
              <p className="text-xs text-amber-700 bg-amber-50 rounded-md p-3 border border-amber-200">
                Redemption codes are sent to your email. This usually takes 5-10
                minutes.
              </p>
            </>
          ) : (
            <>
              <CardDescription>
                We haven't received confirmation for{" "}
                {reference ? "reference" : "session"}: <br />
                <span className="font-mono text-foreground font-bold">
                  {reference || stripeSessionId || stripeOrderId}
                </span>
              </CardDescription>
              <div className="text-sm bg-muted p-3 rounded-md border">
                The system is automatically retrying every 30 seconds. You can
                also click <strong>Retry Now</strong> if you have been debited.
              </div>
            </>
          )}
        </CardContent>

        <CardFooter className="flex flex-col gap-2">
          {status === "success" ? (
            <div className="flex flex-col sm:flex-row gap-3 w-full">
              <Button asChild variant="outline" className="flex-1">
                <Link href="/shop">Continue Shopping</Link>
              </Button>
              <Button asChild className="flex-1">
                <Link href="/orders">View Orders</Link>
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-3 w-full">
              <div className="flex flex-col sm:flex-row gap-3 w-full">
                <Button
                  onClick={() => verifyPayment()}
                  disabled={isRetrying}
                  className="flex-1"
                >
                  {isRetrying ? (
                    <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <IconRefresh className="mr-2 h-4 w-4" />
                  )}
                  Retry Now
                </Button>
                <Button asChild variant="outline" className="flex-1">
                  <Link href="/contact">Contact Support</Link>
                </Button>
              </div>
              <Button asChild variant="ghost" className="text-muted-foreground">
                <Link href="/shop">Back to Shop</Link>
              </Button>
            </div>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
