"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  IconArrowLeft,
  IconCalendar,
  IconHash,
  IconCreditCard,
  IconLoader2,
  IconReceipt2,
} from "@tabler/icons-react";
import Link from "next/link";
import axios from "axios";
import { env } from "@/lib/env";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { PageHeader } from "@/components/PageHeader";
import { formatDate, formatMoneyInput } from "@/lib/utils";

export default function OrderDetailsPage() {
  const { id } = useParams();
  const { token } = useAuth();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOrderDetails = async () => {
      try {
        const response = await axios.get(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/shop/get-order-details/?order_id=${id}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        setOrder(response.data.order);
      } catch (error) {
        console.error("Error fetching order:", error);
      } finally {
        setLoading(false);
      }
    };

    if (token && id) fetchOrderDetails();
  }, [id, token]);

  const formatPrice = (price: string | number) => {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
    }).format(Number(price));
  };

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <IconLoader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="text-center py-20">
        <h2 className="text-xl font-bold">Order not found</h2>
        <Button asChild variant="link">
          <Link href="/dashboard/orders">Back to orders</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        back
        title={"Order Details"}
        description={"Manage and view your transaction history"}
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Main Content */}
        <div className="md:col-span-2 space-y-4">
          <Card>
            <CardHeader className="border-b [.border-b]:pb-4">
              <CardTitle className="flex items-center gap-1">
                <IconReceipt2 className="h-5 w-5 text-primary" />
                Items Purchased
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {order.items.map((item: any, idx: number) => (
                <div
                  key={idx}
                  className="flex justify-between items-start group"
                >
                  <div className="space-y-1">
                    <p className="font-medium text-sm">{item.product_name}</p>
                    <p className="text-xs text-muted-foreground">
                      Variant: {item.variant_title} | Qty: {item.quantity}
                    </p>
                  </div>
                  <p className="font-semibold text-sm">
                    ₦{formatMoneyInput(item.line_total)}
                  </p>
                </div>
              ))}

              <Separator className="my-4" />

              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal</span>
                  <span>₦{formatMoneyInput(order.subtotal)}</span>
                </div>
                <Separator className="my-4" />
                <div className="flex justify-between text-muted-foreground">
                  <span>Tax</span>
                  <span>₦{formatMoneyInput(order.tax)}</span>
                </div>
                <Separator className="my-4" />
                <div className="flex justify-between font-semibold text-base">
                  <span>Total Amount</span>
                  <span className="text-primary">
                    {formatPrice(order.total)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {order.status === "paid" && (
            <div className="bg-green-50 dark:bg-green-950 border border-green-100 dark:border-green-900 p-4 rounded-lg flex items-start gap-3">
              <div className="h-8 w-8 bg-green-500 rounded-full flex items-center justify-center shrink-0">
                <IconReceipt2 className="text-white h-5 w-5" />
              </div>
              <div>
                <p className="font-bold text-base text-green-900 dark:text-white">
                  Payment Verified
                </p>
                <p className="text-xs text-green-700 dark:text-green-100">
                  Your diamonds have been dispatched. Please check your
                  registered email for the redemption codes.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar Info */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Order Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <IconHash className="h-4 w-4 text-muted-foreground" />
                <div className="text-sm">
                  <p className="text-muted-foreground leading-none text-xs">
                    Order ID
                  </p>
                  <p className="font-medium mt-1">#{order.order_id}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <IconCalendar className="h-4 w-4 text-muted-foreground" />
                <div className="text-sm">
                  <p className="text-muted-foreground leading-none text-xs">
                    Date
                  </p>
                  <p className="font-medium mt-1">
                    {formatDate(order.created_at)}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <IconCreditCard className="h-4 w-4 text-muted-foreground" />
                <div className="text-sm">
                  <p className="text-muted-foreground leading-none text-xs">
                    Status
                  </p>
                  <Badge
                    className="mt-1"
                    variant={order.status === "paid" ? "default" : "secondary"}
                  >
                    {order.status.toUpperCase()}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          <Button
            variant="outline"
            className="w-full"
            onClick={() => window.print()}
          >
            Print Receipt
          </Button>
        </div>
      </div>
    </div>
  );
}
