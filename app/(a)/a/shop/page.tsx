"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Admin Shop Dashboard  (route: /a/shop)
//
// Purpose: landing surface for shop admins. Shows real, live data:
//   • Current Stock Status   ← GET /shop/view-current-stock-status/  (per-variant qty)
//   • Recent Orders table    ← GET /shop/orders-today | orders-this-week | orders-this-month/
//     wired to the Day / Week / Month toggle.
//
// Auth: every fetch sends `Authorization: Bearer <token>` from useAuth(). These are
// admin-only DRF endpoints (require_admin / role=="admin" on the backend).
//
// Connects to:
//   • backend afc_shop/views.py: view_current_stock_status, orders_today,
//     orders_this_week, orders_this_month  (response shapes mirrored in the
//     StockItem / SummaryOrder interfaces below).
//   • /a/shop/orders   (full order tracker: "View Orders" link + per-order drill-in)
//   • /a/shop/inventory (stock management: "Manage Inventory" link)
//
// NOTE on "Total Revenue" / "Subscriptions" cards: those stay as static 0 placeholders.
// The only revenue endpoint (get_total_revenue_generated) is COUPON-scoped (needs a
// coupon_id and returns one coupon's revenue), so it cannot back a global revenue
// figure. Wiring it here would show a wrong number. Left untouched, out of scope.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useState } from "react";
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
import { InfoTip } from "@/components/ui/info-tip";
import {
  IconCurrencyDollar,
  IconPackage,
  IconUsers,
} from "@tabler/icons-react";
import { TrendingUp, Eye, Loader2 } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import axios from "axios";
import { env } from "@/lib/env";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, formatDate, formatMoneyInput } from "@/lib/utils";
import { NairaIcon } from "@/components/NairaIcon";

// Shape of a row from /shop/view-current-stock-status/ (one per ProductVariant).
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

// Shape of a row from the orders-today / orders-this-week / orders-this-month
// endpoints (backend _serialize_order_summary). These are FLAT summaries: unlike
// view-all-orders, they do NOT carry a nested `items` array.
interface SummaryOrder {
  order_id: number;
  user_id: number | null;
  username: string | null;
  status: string;
  subtotal: string;
  discount_total: string;
  total: string;
  coupon_code: string | null;
  created_at: string;
}

// Map the Day/Week/Month toggle value → its backend endpoint + the card title.
const ORDER_RANGES = {
  day: { endpoint: "orders-today", title: "Orders Today" },
  week: { endpoint: "orders-this-week", title: "Orders This Week" },
  month: { endpoint: "orders-this-month", title: "Orders This Month" },
} as const;

type OrderRange = keyof typeof ORDER_RANGES;

export default function AdminShopPage() {
  const { token } = useAuth();

  // ── Stock status state ──
  const [stockStatus, setStockStatus] = useState<StockItem[]>([]);
  const [isStockLoading, setIsStockLoading] = useState(true);

  // ── Recent-orders state (driven by the Day/Week/Month toggle) ──
  const [orders, setOrders] = useState<SummaryOrder[]>([]);
  const [isOrdersLoading, setIsOrdersLoading] = useState(true);
  const [orderFilter, setOrderFilter] = useState<OrderRange>("week");

  // Fetch the per-variant inventory snapshot for the sidebar card.
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

  // Fetch the order list for the active range. Re-runs whenever the toggle flips.
  const fetchOrders = useCallback(
    async (range: OrderRange) => {
      try {
        setIsOrdersLoading(true);
        const response = await axios.get(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/shop/${ORDER_RANGES[range].endpoint}/`,
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        );
        setOrders(response.data.orders ?? []);
      } catch (error) {
        console.error("Error fetching orders:", error);
        setOrders([]);
      } finally {
        setIsOrdersLoading(false);
      }
    },
    [token],
  );

  // Initial load: stock snapshot (token-independent in the original, kept as-is).
  useEffect(() => {
    fetchStockStatus();
  }, []);

  // (Re)load orders on mount and every time the Day/Week/Month toggle changes,
  // but only once we actually have an auth token to send.
  useEffect(() => {
    if (token) fetchOrders(orderFilter);
  }, [token, orderFilter, fetchOrders]);

  const getStockBadgeStyles = (item: StockItem) => {
    if (!item.in_stock || item.stock_qty === 0) return "bg-red-500 text-white";
    if (item.stock_qty < 10) return "bg-yellow-500 text-black"; // Warning level
    return "bg-green-500 text-white";
  };

  // Status → badge variant, mirroring /a/shop/orders so colours stay consistent.
  const getStatusBadgeVariant = (status: string) => {
    switch (status.toLowerCase()) {
      case "paid":
      case "fulfilled":
        return "default"; // green/primary
      case "pending":
        return "secondary";
      case "declined":
      case "failed":
      case "cancelled":
      case "refunded":
        return "destructive";
      default:
        return "outline";
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <PageHeader
        back
        // Title is a ReactNode so the page-level ⓘ can sit right after it.
        title={
          <span className="inline-flex items-center">
            Shop Dashboard
            <InfoTip id="shop._page" className="ml-1.5" />
          </span>
        }
      />

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

        {/* Total Revenue (static placeholder, see file header note) */}
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

        {/* Subscriptions (static placeholder) */}
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
        {/* Recent Orders table: REAL data, wired to the Day/Week/Month toggle */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="flex flex-col lg:flex-row items-start lg:items-center justify-between">
              <div>
                {/* Title reflects the active range (Today / This Week / This Month). */}
                <CardTitle className="font-semibold text-sm">
                  {ORDER_RANGES[orderFilter].title}
                </CardTitle>
                <CardDescription className="text-xs mt-1">
                  Recent orders from your store
                </CardDescription>
              </div>
              <div className="flex items-center justify-between lg:justify-end w-full lg:w-auto gap-2">
                <Tabs
                  value={orderFilter}
                  onValueChange={(v) => setOrderFilter(v as OrderRange)}
                >
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
                    <TableHead>Order</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isOrdersLoading ? (
                    // Loading state: spinner spanning the table body.
                    <TableRow>
                      <TableCell colSpan={5} className="py-10 text-center">
                        <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />
                      </TableCell>
                    </TableRow>
                  ) : orders.length === 0 ? (
                    // Empty state for the selected range.
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="py-10 text-center text-sm text-muted-foreground"
                      >
                        No orders yet for this period.
                      </TableCell>
                    </TableRow>
                  ) : (
                    orders.map((order) => (
                      <TableRow key={order.order_id}>
                        <TableCell className="font-medium">
                          #{order.order_id}
                        </TableCell>
                        <TableCell className="capitalize text-muted-foreground">
                          {order.username ?? "Unknown"}
                        </TableCell>
                        <TableCell className="capitalize">
                          <Badge variant={getStatusBadgeVariant(order.status)}>
                            {order.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {formatDate(order.created_at)}
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {formatMoneyInput(order.total)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
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
              {/* Section ⓘ inline with the stock-status heading. */}
              <CardTitle className="flex items-center">
                Current Stock Status
                <InfoTip id="shop.stock_status._section" className="ml-1.5" />
              </CardTitle>
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
        </div>
      </div>
    </div>
  );
}
