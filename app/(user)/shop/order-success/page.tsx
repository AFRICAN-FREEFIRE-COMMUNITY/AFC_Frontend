"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { ComingSoon } from "@/components/ComingSoon";

export default function OrderSuccessPage() {
  const router = useRouter();
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          router.push("/shop/orders");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [router]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center relative">
      <ComingSoon />
      <Card className="max-w-md w-full">
        <CardContent className="pt-10 pb-8 text-center">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <CheckCircle2 className="h-10 w-10 text-primary" />
            </div>
          </div>

          <h1 className="text-2xl font-bold text-primary mb-2">
            Order Successful!
          </h1>

          <p className="text-muted-foreground mb-2">
            Thank you for your purchase. Your order has been placed
            successfully.
          </p>

          <p className="text-sm font-medium mb-6">
            A confirmation email has been sent to your email address.
          </p>

          <p className="text-sm text-muted-foreground mb-6">
            You will be redirected to your orders page in a few seconds...
          </p>

          <Button asChild className="w-full">
            <Link href="/shop/orders">View My Orders</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
