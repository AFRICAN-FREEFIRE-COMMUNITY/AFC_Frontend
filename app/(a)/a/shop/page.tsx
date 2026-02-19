"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/PageHeader";
import {
  IconCurrencyDollar,
  IconPackage,
  IconBell,
  IconUsers,
} from "@tabler/icons-react";
import { TrendingUp, Eye } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import axios from "axios";
import { env } from "@/lib/env";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { ComingSoon } from "@/components/ComingSoon";
import { NairaIcon } from "@/components/NairaIcon";

interface StockItem {
  product_id: number;
  product_name: string;
  variant_id: number;
  sku: string;
  variant_title: string;
  is_limited_stock: boolean;
  stock_qty: number;
  in_stock: boolean;
  active: boolean;
}

// Mock data for orders
const mockOrders = [
  {
    id: 1,
    customer: "Liam Johnson",
    email: "liam@example.com",
    type: "Sale",
    status: "Fulfilled",
    date: "2023-07-23",
    amount: 250.0,
  },
  {
    id: 2,
    customer: "Olivia Smith",
    email: "olivia@example.com",
    type: "Refund",
    status: "Declined",
    date: "2023-07-24",
    amount: 150.0,
  },
  {
    id: 3,
    customer: "Noah Williams",
    email: "noah@example.com",
    type: "Subscription",
    status: "Fulfilled",
    date: "2023-07-25",
    amount: 350.0,
  },
  {
    id: 4,
    customer: "Emma Brown",
    email: "emma@example.com",
    type: "Sale",
    status: "Fulfilled",
    date: "2023-07-26",
    amount: 450.0,
  },
  {
    id: 5,
    customer: "Liam Johnson",
    email: "liam@example.com",
    type: "Sale",
    status: "Fulfilled",
    date: "2023-07-23",
    amount: 250.0,
  },
  {
    id: 6,
    customer: "Olivia Smith",
    email: "olivia@example.com",
    type: "Refund",
    status: "Declined",
    date: "2023-07-24",
    amount: 150.0,
  },
  {
    id: 7,
    customer: "Emma Brown",
    email: "emma@example.com",
    type: "Sale",
    status: "Fulfilled",
    date: "2023-07-26",
    amount: 450.0,
  },
];

// Mock stock data
const mockStockStatus = [
  { name: "100 Diamonds", stock: 1200 },
  { name: "500 Diamonds", stock: 800 },
  { name: "1000 Diamonds", stock: 500 },
  { name: "5000 Diamonds", stock: 150 },
  { name: "10000 Diamonds", stock: 50 },
];

// Mock notifications
const mockNotifications = [
  {
    id: 1,
    title: "New Order #12345",
    message: "A new order has been placed by John Doe.",
    type: "order",
  },
  {
    id: 2,
    title: "Low Stock Alert",
    message: "100 Diamonds product is running low.",
    type: "warning",
  },
  {
    id: 3,
    title: "Refund Processed",
    message: "Refund for Order #12340 has been completed.",
    type: "refund",
  },
];

export default function AdminShopPage() {
  const { token } = useAuth();
  const [stockStatus, setStockStatus] = useState<StockItem[]>([]);
  const [isStockLoading, setIsStockLoading] = useState(true);
  const [orderFilter, setOrderFilter] = useState("week");

  const fetchStockStatus = async () => {
    try {
      setIsStockLoading(true);
      const response = await axios.get(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/shop/view-current-stock-status/`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      setStockStatus(response.data.stock);
    } catch (error) {
      console.error("Error fetching stock:", error);
    } finally {
      setIsStockLoading(false);
    }
  };

  useEffect(() => {
    fetchStockStatus();
  }, []);

  const getStockBadgeStyles = (item: StockItem) => {
    if (!item.in_stock || item.stock_qty === 0) return "bg-red-500 text-white";
    if (item.stock_qty < 10) return "bg-yellow-500 text-black"; // Warning level
    return "bg-green-500 text-white";
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status.toLowerCase()) {
      case "fulfilled":
        return "default";
      case "declined":
        return "destructive";
      case "pending":
        return "secondary";
      default:
        return "outline";
    }
  };

  const getStockBadgeColor = (stock: number) => {
    if (stock >= 500) return "bg-green-500";
    if (stock >= 100) return "bg-yellow-500";
    return "bg-red-500";
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  return (
    <div className="flex flex-col gap-2">
      <PageHeader back title="Shop Dashboard" />

      {/* Top Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
        {/* Your Orders Card */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Your Orders</CardTitle>
            <p className="text-sm text-muted-foreground">
              Introducing our new dashboard for a more streamlined order
              management.
            </p>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline">
              <Link href="/a/shop/orders">Go to Order Tracker</Link>
            </Button>
          </CardContent>
        </Card>

        {/* Total Revenue */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <IconCurrencyDollar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              <NairaIcon />0
            </div>
            <div className="flex items-center justify-start gap-1 text-sm text-green-600">
              <TrendingUp className="h-3 w-3" />
              +0% from last month
            </div>
          </CardContent>
        </Card>

        {/* Subscriptions */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Subscriptions</CardTitle>
            <IconUsers className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <div className="flex items-center gap-1 text-sm text-green-600">
              <TrendingUp className="h-3 w-3" />
              +0% from last month
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-2">
        {/* Orders Table */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="flex flex-col lg:flex-row items-start lg:items-center justify-between">
              <div>
                <CardTitle className="font-semibold text-sm">
                  Orders This Week
                </CardTitle>
                <CardDescription className="text-xs mt-1">
                  Recent orders from your store
                </CardDescription>
              </div>
              <div className="flex items-center justify-between lg:justify-end w-full lg:w-auto gap-2">
                <Tabs value={orderFilter} onValueChange={setOrderFilter}>
                  <TabsList>
                    <TabsTrigger value="day">Day</TabsTrigger>
                    <TabsTrigger value="week">Week</TabsTrigger>
                    <TabsTrigger value="month">Month</TabsTrigger>
                  </TabsList>
                </Tabs>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/a/shop/orders">
                    <Eye className="mr-2 h-4 w-4" />
                    View Orders
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="relative">
                  <ComingSoon />
                  {mockOrders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{order.customer}</div>
                          <div className="text-sm text-muted-foreground">
                            {order.email}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{order.type}</TableCell>
                      <TableCell>
                        <Badge variant={getStatusBadgeVariant(order.status)}>
                          {order.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{order.date}</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(order.amount)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar Cards */}
        <div className="space-y-2">
          {/* Current Stock Status */}
          <Card>
            <CardHeader>
              <CardTitle>Current Stock Status</CardTitle>
              <CardDescription>
                Overview of your virtual diamond inventory.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {isStockLoading ? (
                  // Loading Skeletons
                  [1, 2, 5].map((i) => (
                    <div key={i} className="flex justify-between items-center">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-5 w-16" />
                    </div>
                  ))
                ) : stockStatus.length === 0 ? (
                  <p className="text-xs text-center text-muted-foreground">
                    No stock data available.
                  </p>
                ) : (
                  stockStatus.slice(0, 6).map((item) => (
                    <div
                      key={`${item.product_id}-${item.variant_id}`}
                      className="flex items-center justify-between gap-2"
                    >
                      <div className="flex flex-col">
                        <span className="text-sm font-medium truncate max-w-[120px]">
                          {item.product_name}
                        </span>
                        <span className="text-xs text-muted-foreground uppercase">
                          {item.sku}
                        </span>
                      </div>
                      <Badge className={cn(getStockBadgeStyles(item))}>
                        {item.stock_qty}{" "}
                        {item.is_limited_stock ? "Left" : "Units"}
                      </Badge>
                    </div>
                  ))
                )}
              </div>

              <Button variant="outline" className="w-full mt-4" asChild>
                <Link href="/a/shop/inventory">
                  <IconPackage className="mr-2 h-4 w-4" />
                  Manage Inventory
                </Link>
              </Button>
            </CardContent>
          </Card>
          {/* <Card>
            <CardHeader>
              <CardTitle>Current Stock Status</CardTitle>
              <p className="text-sm text-muted-foreground">
                Overview of your virtual diamond inventory.
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {mockStockStatus.map((item) => (
                  <div
                    key={item.name}
                    className="flex items-center justify-between"
                  >
                    <span className="text-sm">{item.name}</span>
                    <Badge
                      className={`${getStockBadgeColor(item.stock)} text-white`}
                    >
                      In Stock: {item.stock}
                    </Badge>
                  </div>
                ))}
              </div>
              <Button variant="outline" className="w-full mt-4" asChild>
                <Link href="/a/shop/inventory">
                  <IconPackage className="mr-2 h-4 w-4" />
                  Manage Inventory
                </Link>
              </Button>
            </CardContent>
          </Card> */}

          {/* Notifications */}
          <Card>
            <CardHeader>
              <CardTitle>Notifications</CardTitle>
              <CardDescription>Recent activities and alerts.</CardDescription>
            </CardHeader>
            <CardContent className="relative">
              <ComingSoon />
              <div className="space-y-4">
                {mockNotifications.map((notification) => (
                  <div key={notification.id} className="flex gap-3">
                    <IconBell className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium">
                        {notification.title}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {notification.message}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
