"use client";

import { useEffect, useState, useTransition } from "react";
import { useParams } from "next/navigation";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { PageHeader } from "@/components/PageHeader";
import {
  Copy,
  Check,
  CheckCircle,
  XCircle,
  RefreshCw,
  RotateCcw,
  Loader2,
  Mail,
  Phone,
  MapPin,
  User,
  Hash,
} from "lucide-react";
import axios from "axios";
import { toast } from "sonner"; // or your preferred toast library
import { env } from "@/lib/env";
import { useAuth } from "@/contexts/AuthContext";
import { IconCopy, IconMail, IconPhone, IconUser } from "@tabler/icons-react";
import { formatMoneyInput } from "@/lib/utils";
import { Loader } from "@/components/Loader";

// Define Types based on your API response
interface OrderItem {
  product_name: string;
  variant_title: string;
  quantity: number;
  unit_price: string;
  line_total: string;
}

interface OrderData {
  order_id: number;
  user_id: number;
  username: string;
  status: string;
  subtotal: string;
  total: string;
  tax: string;
  created_at: string;
  first_name: string;
  last_name: string;
  email: string;
  phone_number: string;
  address: string;
  city: string;
  state: string;
  transaction_id: string;
  items: OrderItem[];
}

export default function OrderDetailsPage() {
  const params = useParams();
  const { token } = useAuth();
  const orderId = params.id;
  const [order, setOrder] = useState<OrderData | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  const fetchOrderDetails = async () => {
    try {
      setLoading(true);
      const response = await axios.get(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/shop/get-order-details-for-admin/?order_id=${orderId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      setOrder(response.data.order);
    } catch (error) {
      console.error("Error fetching order:", error);
      toast.error("Failed to load order details");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (orderId) fetchOrderDetails();
  }, [orderId, token]);

  const handleMarkAsPaid = () => {
    startTransition(async () => {
      try {
        const res = await axios.post(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/shop/mark-order-as-paid/`,
          { order_id: order?.order_id },
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        );

        toast.success(res.data.message || "Order updated to paid!");
        fetchOrderDetails();
      } catch (error: any) {
        toast.error(
          error.response.data.message || "Oops! Failed to mark as paid",
        );
      }
    });
  };

  const formatPrice = (price: string | number) => {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
    }).format(Number(price));
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status.toLowerCase()) {
      case "paid":
        return "default";
      case "pending":
        return "secondary";
      case "cancelled":
        return "destructive";
      default:
        return "outline";
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Copied to clipboard");
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">Fetching order details...</p>
      </div>
    );
  }

  if (!order) return <div className="p-8 text-center">Order not found.</div>;

  return (
    <div className="space-y-6">
      <PageHeader
        title={
          <>
            <p className="flex items-center justify-start gap-2">
              Order #{order.order_id}
              <Badge variant={getStatusBadgeVariant(order.status)}>
                {order.status.toUpperCase()}
              </Badge>
            </p>
          </>
        }
        description={`Transaction reference: ${order.transaction_id || "N/A"}`}
        back
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-4">
          {/* Customer & Shipping Information */}
          <Card>
            <CardHeader className="border-b [.border-b]:pb-3">
              <CardTitle>Customer Information</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-1">
                  <IconUser className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">
                    {order.first_name} {order.last_name}
                  </span>
                  <span className="text-muted-foreground">
                    (@{order.username})
                  </span>
                </div>
                <div className="flex items-center hover:underline hover:text-primary gap-1">
                  <IconMail className="h-4 w-4 text-muted-foreground" />
                  <a href={`mailto:${order.email}`}>{order.email}</a>
                </div>
                <div className="flex hover:underline hover:text-primary items-center gap-1">
                  <IconPhone className="h-4 w-4 text-muted-foreground" />
                  <a href={`tel:${order.phone_number}`}>{order.phone_number}</a>
                </div>
                <div className="flex gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                  <span>
                    {order.address}, {order.city}, {order.state}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Items Table */}
          <Card className="gap-2">
            <CardHeader className="border-b [.border-b]:pb-3">
              <CardTitle>Order Items</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {order.items.map((item, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between py-2 border-b"
                  >
                    <div>
                      <p className="font-semibold text-sm">
                        {item.product_name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {item.variant_title}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-medium">x{item.quantity}</p>
                      <p className="font-bold text-sm text-primary">
                        ₦{formatMoneyInput(item.line_total)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-4 mt-4 pb-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>₦{formatMoneyInput(order.subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Tax</span>
                  <span>₦{formatMoneyInput(order.tax)}</span>
                </div>
              </div>
            </CardContent>
            <CardFooter className="border-t font-semibold text-base [.border-t]:pt-4 flex items-center justify-between">
              <span>Total</span>
              <span className="text-primary">
                ₦{formatMoneyInput(order.total)}
              </span>
            </CardFooter>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader className="border-b [.border-b]:pb-3">
              <CardTitle>Admin Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {order.status !== "paid" && (
                <Button
                  className="w-full justify-start"
                  disabled={pending}
                  variant="default"
                  onClick={handleMarkAsPaid}
                >
                  {pending ? (
                    <Loader text="Marking..." />
                  ) : (
                    <>
                      <CheckCircle />
                      Mark as Paid
                    </>
                  )}
                </Button>
              )}
              <Button
                className="w-full justify-start"
                variant="outline"
                onClick={() => copyToClipboard(order.email)}
              >
                <IconCopy />
                Copy Customer Email
              </Button>
              {/* <Button
                className="w-full justify-start"
                variant="destructive"
                onClick={() => toast.warning("Initiating refund...")}
                disabled={pending}
              >
                <RotateCcw />
                Cancel & Refund
              </Button> */}
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <div className="text-xs text-muted-foreground space-y-2">
                <div className="flex justify-between">
                  <span>Internal ID:</span>
                  <span className="">{order.order_id}</span>
                </div>
                <div className="flex justify-between">
                  <span>Created At:</span>
                  <span>{new Date(order.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
