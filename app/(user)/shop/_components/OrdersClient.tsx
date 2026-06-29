"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { ITEMS_PER_PAGE } from "@/constants";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ShoppingBag, Loader2 } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import axios from "axios";
import { env } from "@/lib/env";
import { useAuth } from "@/contexts/AuthContext";
import { IconShoppingBag } from "@tabler/icons-react";
import { formatMoneyInput } from "@/lib/utils";
// i18n time: render the order date in the VIEWER's own timezone + language instead
// of the old formatDate() helper (which built the string from the local-process
// clock = UTC at SSR and a hardcoded month name). LocalTime is hydration-safe.
import { LocalTime } from "@/components/LocalTime";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export interface OrderItem {
  product_name: string;
  variant_title: string;
  quantity: number;
  unit_price: string;
  line_total: string;
  // Product thumbnail (added by backend get_my_orders 2026-06-29) so the order row shows
  // the picture of what was bought, not just the name. Null for products with no image.
  product_image: string | null;
}

interface Order {
  order_id: number;
  status: string;
  subtotal: string;
  total: string;
  created_at: string;
  items: OrderItem[];
}

export default function OrdersClient() {
  // Localized copy for the orders list (messages/en/shop.json -> "orders").
  const t = useTranslations("shop");
  const { token } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const response = await axios.get(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/shop/get-my-orders/`,
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        );
        setOrders(response.data.orders);
      } catch (error) {
        console.error("Failed to fetch orders:", error);
      } finally {
        setIsLoading(false);
      }
    };

    if (token) {
      fetchOrders();
    }
  }, [token]);

  const formatPrice = (price: string | number) => {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
      minimumFractionDigits: 0,
    }).format(Number(price));
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status.toLowerCase()) {
      case "paid":
      case "completed":
        return "default"; // Green/Primary
      case "pending":
        return "secondary"; // Gray/Orange
      case "cancelled":
      case "failed":
        return "destructive"; // Red
      default:
        return "outline";
    }
  };

  // A small product thumbnail for an order item. Falls back to a bag glyph when the product
  // has no image (product_image is null). Plain <img> (not next/image) to avoid remote-domain
  // config for backend-served media, matching the lightweight thumbnail use here.
  const ItemThumb = ({ item, size = "h-9 w-9" }: { item: OrderItem; size?: string }) =>
    item.product_image ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={item.product_image}
        alt={item.product_name}
        className={`${size} shrink-0 rounded-md border object-cover`}
      />
    ) : (
      <div
        className={`${size} shrink-0 flex items-center justify-center rounded-md border bg-muted`}
      >
        <ShoppingBag className="h-4 w-4 text-muted-foreground" />
      </div>
    );

  const renderItemsSummary = (items: OrderItem[]) => {
    if (items.length === 0)
      return (
        <span className="text-muted-foreground">{t("orders.noItems")}</span>
      );

    const firstItem = items[0];
    const remainingItems = items.slice(1);

    return (
      <div className="flex items-center gap-2">
        {/* picture + name + variant/qty of the first item (picked up from get_my_orders) */}
        <ItemThumb item={firstItem} />
        <div className="min-w-0">
          <p className="truncate max-w-[180px] font-medium">
            {firstItem.product_name}
          </p>
          <p className="truncate max-w-[180px] text-xs text-muted-foreground">
            {firstItem.variant_title
              ? t("orders.itemVariantQty", {
                  variant: firstItem.variant_title,
                  quantity: firstItem.quantity,
                })
              : t("orders.itemQty", { quantity: firstItem.quantity })}
          </p>
        </div>

        {items.length > 1 && (
          <TooltipProvider>
            <Tooltip delayDuration={300}>
              <TooltipTrigger asChild>
                <Badge
                  variant="secondary"
                  className="cursor-help text-[10px] px-1.5 py-0 hover:bg-secondary/80"
                >
                  {t("orders.moreItems", { count: items.length - 1 })}
                </Badge>
              </TooltipTrigger>
              <TooltipContent side="right" className="p-3 bg-background border">
                <p className="text-xs font-semibold text-primary mb-2 border-b pb-1">
                  {t("orders.additionalItems")}
                </p>
                <ul className="space-y-2">
                  {remainingItems.map((item, idx) => (
                    <li
                      key={idx}
                      className="text-xs text-muted-foreground flex items-center justify-between gap-4"
                    >
                      <span className="flex items-center gap-2">
                        <ItemThumb item={item} size="h-7 w-7" />
                        <span>
                          {item.product_name}
                          {item.variant_title ? ` (${item.variant_title})` : ""}
                        </span>
                      </span>
                      <span className="font-medium text-foreground text-right">
                        x{item.quantity}
                      </span>
                    </li>
                  ))}
                </ul>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
    );
  };

  // Total spent across PAID/COMPLETED orders (owner request 2026-06-29). Computed on the
  // full orders array (the endpoint returns every order; the table paginates client-side),
  // so the figure reflects all paid orders, not just the current page.
  const { totalSpent, paidCount } = useMemo(() => {
    const paid = orders.filter((o) =>
      ["paid", "completed"].includes(o.status.toLowerCase()),
    );
    return {
      totalSpent: paid.reduce((sum, o) => sum + Number(o.total || 0), 0),
      paidCount: paid.length,
    };
  }, [orders]);

  const totalPages = Math.ceil(orders.length / ITEMS_PER_PAGE);
  const paginatedOrders = orders.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE,
  );

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">{t("orders.loading")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        back
        title={t("orders.pageTitle")}
        description={t("orders.pageDescription")}
      />

      {/* Total spent across paid orders — a quick at-a-glance figure above the history. */}
      {paidCount > 0 && (
        <div className="inline-flex flex-col rounded-md border bg-card px-4 py-3 shadow-sm">
          <span className="text-xs font-medium uppercase text-muted-foreground">
            {t("orders.totalSpent")}
          </span>
          <span className="text-2xl font-bold text-primary">
            ₦{formatMoneyInput(totalSpent)}
          </span>
          <span className="text-xs text-muted-foreground">
            {t("orders.acrossPaidOrders", { count: paidCount })}
          </span>
        </div>
      )}

      {orders.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <IconShoppingBag className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <CardTitle className="mb-2">{t("orders.emptyTitle")}</CardTitle>
            <CardDescription className="text-muted-foreground mb-4">
              {t("orders.emptyDescription")}
            </CardDescription>
            <Button asChild>
              <Link href="/shop">{t("orders.browseShop")}</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="gap-1 bg-transparent">
          <CardHeader>
            <CardTitle>{t("orders.historyTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[100px]">
                      {t("orders.table.id")}
                    </TableHead>
                    <TableHead>{t("orders.table.items")}</TableHead>
                    <TableHead>{t("orders.table.total")}</TableHead>
                    <TableHead>{t("orders.table.date")}</TableHead>
                    <TableHead>{t("orders.table.status")}</TableHead>
                    <TableHead className="text-right">
                      {t("orders.table.action")}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedOrders.map((order) => (
                    <TableRow key={order.order_id}>
                      <TableCell className="font-medium">
                        #{order.order_id}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {renderItemsSummary(order.items)}
                      </TableCell>
                      <TableCell className="font-semibold">
                        ₦{formatMoneyInput(order.total)}
                      </TableCell>
                      <TableCell>
                        <LocalTime value={order.created_at} mode="date" />
                      </TableCell>
                      <TableCell className="capitalize">
                        <Badge variant={getStatusBadgeVariant(order.status)}>
                          {order.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/orders/${order.order_id}`}>
                            {t("orders.table.details")}
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="hidden md:block text-sm text-muted-foreground">
                    {t("orders.showingRange", {
                      start: (currentPage - 1) * ITEMS_PER_PAGE + 1,
                      end: Math.min(currentPage * ITEMS_PER_PAGE, orders.length),
                      total: orders.length,
                    })}
                  </p>
                  <Pagination className="w-full md:w-auto mx-0">
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious
                          onClick={() =>
                            setCurrentPage((p) => Math.max(1, p - 1))
                          }
                          className={
                            currentPage === 1
                              ? "pointer-events-none opacity-50"
                              : "cursor-pointer"
                          }
                        />
                      </PaginationItem>
                      {Array.from({ length: totalPages }, (_, i) => i + 1)
                        .filter(
                          (page) =>
                            page === 1 ||
                            page === totalPages ||
                            Math.abs(page - currentPage) <= 1,
                        )
                        .map((page, idx, arr) => (
                          <React.Fragment key={page}>
                            {idx > 0 && arr[idx - 1] !== page - 1 && (
                              <PaginationItem>
                                <PaginationEllipsis />
                              </PaginationItem>
                            )}
                            <PaginationItem>
                              <PaginationLink
                                isActive={currentPage === page}
                                onClick={() => setCurrentPage(page)}
                                className="cursor-pointer"
                              >
                                {page}
                              </PaginationLink>
                            </PaginationItem>
                          </React.Fragment>
                        ))}
                      <PaginationItem>
                        <PaginationNext
                          onClick={() =>
                            setCurrentPage((p) => Math.min(totalPages, p + 1))
                          }
                          className={
                            currentPage === totalPages
                              ? "pointer-events-none opacity-50"
                              : "cursor-pointer"
                          }
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
