"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { PageHeader } from "@/components/PageHeader";
import {
  ArrowLeft,
  Copy,
  Check,
  CheckCircle,
  XCircle,
  RefreshCw,
  RotateCcw,
} from "lucide-react";
import Link from "next/link";

// Mock order data - in production this would be fetched based on ID
const mockOrderDetails: Record<
  string,
  {
    id: string;
    customer: {
      name: string;
      email: string;
      phone: string;
      address: string;
    };
    product: {
      name: string;
      quantity: number;
      price: number;
    };
    payment: {
      method: string;
      transactionId: string;
    };
    diamondCode: string;
    status: string;
    date: string;
    amount: number;
  }
> = {
  "ORD-001": {
    id: "ORD-001",
    customer: {
      name: "John Doe",
      email: "john.doe@example.com",
      phone: "+234 801 234 5678",
      address: "123 Main Street, Lagos, Nigeria",
    },
    product: {
      name: "100 Diamonds",
      quantity: 1,
      price: 1312.5,
    },
    payment: {
      method: "Bank Transfer",
      transactionId: "TXN-ABC123456",
    },
    diamondCode: "DIAMOND-XYZ-123-ABC-789",
    status: "Pending",
    date: "2024-01-15",
    amount: 1312.5,
  },
  "ORD-002": {
    id: "ORD-002",
    customer: {
      name: "Jane Smith",
      email: "jane.smith@example.com",
      phone: "+234 802 345 6789",
      address: "456 Oak Avenue, Abuja, Nigeria",
    },
    product: {
      name: "500 Diamonds",
      quantity: 1,
      price: 6562.5,
    },
    payment: {
      method: "Card",
      transactionId: "TXN-DEF456789",
    },
    diamondCode: "DIAMOND-ABC-456-DEF-012",
    status: "Fulfilled",
    date: "2024-01-14",
    amount: 6562.5,
  },
  "ORD-003": {
    id: "ORD-003",
    customer: {
      name: "Mike Johnson",
      email: "mike.j@example.com",
      phone: "+234 803 456 7890",
      address: "789 Pine Road, Port Harcourt, Nigeria",
    },
    product: {
      name: "1000 Diamonds",
      quantity: 1,
      price: 13125,
    },
    payment: {
      method: "Mobile Money",
      transactionId: "TXN-GHI789012",
    },
    diamondCode: "DIAMOND-GHI-789-JKL-345",
    status: "Fulfilled",
    date: "2024-01-13",
    amount: 13125,
  },
  "ORD-004": {
    id: "ORD-004",
    customer: {
      name: "Sarah Williams",
      email: "sarah.w@example.com",
      phone: "+234 804 567 8901",
      address: "321 Elm Street, Kano, Nigeria",
    },
    product: {
      name: "100 Diamonds",
      quantity: 1,
      price: 1312.5,
    },
    payment: {
      method: "Bank Transfer",
      transactionId: "TXN-JKL012345",
    },
    diamondCode: "DIAMOND-MNO-012-PQR-678",
    status: "Declined",
    date: "2024-01-12",
    amount: 1312.5,
  },
  "ORD-005": {
    id: "ORD-005",
    customer: {
      name: "Chris Brown",
      email: "chris.b@example.com",
      phone: "+234 805 678 9012",
      address: "654 Cedar Lane, Ibadan, Nigeria",
    },
    product: {
      name: "2000 Diamonds",
      quantity: 1,
      price: 26250,
    },
    payment: {
      method: "Card",
      transactionId: "TXN-MNO345678",
    },
    diamondCode: "DIAMOND-STU-345-VWX-901",
    status: "Pending",
    date: "2024-01-11",
    amount: 26250,
  },
  "ORD-006": {
    id: "ORD-006",
    customer: {
      name: "Emma Davis",
      email: "emma.d@example.com",
      phone: "+234 806 789 0123",
      address: "987 Maple Drive, Enugu, Nigeria",
    },
    product: {
      name: "500 Diamonds",
      quantity: 1,
      price: 6562.5,
    },
    payment: {
      method: "Mobile Money",
      transactionId: "TXN-PQR678901",
    },
    diamondCode: "DIAMOND-YZA-678-BCD-234",
    status: "Fulfilled",
    date: "2024-01-10",
    amount: 6562.5,
  },
};

export default function OrderDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params.id as string;
  const [copied, setCopied] = useState(false);
  const [orderStatus, setOrderStatus] = useState<string | null>(null);

  const order = mockOrderDetails[orderId];

  // Use updated status or original
  const currentStatus = orderStatus || order?.status;

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
      minimumFractionDigits: 0,
    }).format(price);
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status.toLowerCase()) {
      case "fulfilled":
        return "default";
      case "pending":
        return "secondary";
      case "declined":
        return "destructive";
      default:
        return "outline";
    }
  };

  const copyToClipboard = () => {
    if (order?.diamondCode) {
      navigator.clipboard.writeText(order.diamondCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleMarkFulfilled = () => {
    setOrderStatus("Fulfilled");
    // In production, this would make an API call
  };

  const handleMarkDeclined = () => {
    setOrderStatus("Declined");
    // In production, this would make an API call
  };

  const handleResendCode = () => {
    // In production, this would make an API call to resend the diamond code
    alert("Diamond code resent to customer email!");
  };

  const handleInitiateRefund = () => {
    // In production, this would initiate the refund process
    alert("Refund initiated!");
  };

  if (!order) {
    return (
      <div>
        <PageHeader back title="Order Not Found" description="" />
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground mb-4">
              The order you&apos;re looking for doesn&apos;t exist.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <PageHeader
          title={`Order ${order.id}`}
          description={`Order placed on ${order.date}`}
          back
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Order Information */}
          <Card>
            <CardHeader>
              <CardTitle>Order Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Customer Name</p>
                  <p className="font-medium">{order.customer.name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p className="font-medium">{order.customer.email}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Date</p>
                  <p className="font-medium">{order.date}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <Badge variant={getStatusBadgeVariant(currentStatus)}>
                    {currentStatus}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Amount</p>
                  <p className="font-medium text-lg">
                    {formatPrice(order.amount)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Phone</p>
                  <p className="font-medium">{order.customer.phone}</p>
                </div>
              </div>
              <Separator />
              <div>
                <p className="text-sm text-muted-foreground">Address</p>
                <p className="font-medium">{order.customer.address}</p>
              </div>
            </CardContent>
          </Card>

          {/* Product Details */}
          <Card>
            <CardHeader>
              <CardTitle>Product Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Product</p>
                  <p className="font-medium">{order.product.name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Quantity</p>
                  <p className="font-medium">{order.product.quantity}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">
                    Payment Method
                  </p>
                  <p className="font-medium">{order.payment.method}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">
                    Transaction ID
                  </p>
                  <p className="font-mono font-medium">
                    {order.payment.transactionId}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Diamond Code Delivery */}
          <Card>
            <CardHeader>
              <CardTitle>Diamond Code Delivery</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3 p-4 bg-muted rounded-lg">
                <code className="flex-1 font-mono text-sm">
                  {order.diamondCode}
                </code>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={copyToClipboard}
                  className="shrink-0"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                This code has been sent to the customer&apos;s email address.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar - Order Actions */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Order Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                className="w-full justify-start"
                variant={
                  currentStatus === "Fulfilled" ? "secondary" : "default"
                }
                onClick={handleMarkFulfilled}
                disabled={currentStatus === "Fulfilled"}
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Mark as Fulfilled
              </Button>
              <Button
                className="w-full justify-start"
                variant="outline"
                onClick={handleMarkDeclined}
                disabled={currentStatus === "Declined"}
              >
                <XCircle className="h-4 w-4 mr-2" />
                Mark as Declined
              </Button>
              <Separator />
              <Button
                className="w-full justify-start"
                variant="outline"
                onClick={handleResendCode}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Resend Diamond Code
              </Button>
              <Button
                className="w-full justify-start"
                variant="destructive"
                onClick={handleInitiateRefund}
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Initiate Refund
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
