"use client";

import React, { useEffect, useState } from "react";
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
import { format } from "date-fns"; // Optional: for cleaner date formatting
import { IconShoppingBag } from "@tabler/icons-react";
import { formatDate, formatMoneyInput } from "@/lib/utils";
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

  const renderItemsSummary = (items: OrderItem[]) => {
    if (items.length === 0)
      return <span className="text-muted-foreground">No items</span>;

    const firstItem = items[0];
    const remainingItems = items.slice(1);

    return (
      <div className="flex items-center gap-2">
        <span className="truncate max-w-[150px]">
          {firstItem.product_name} (x{firstItem.quantity})
        </span>

        {items.length > 1 && (
          <TooltipProvider>
            <Tooltip delayDuration={300}>
              <TooltipTrigger asChild>
                <Badge
                  variant="secondary"
                  className="cursor-help text-[10px] px-1.5 py-0 hover:bg-secondary/80"
                >
                  +{items.length - 1} more
                </Badge>
              </TooltipTrigger>
              <TooltipContent side="right" className="p-3 bg-background border">
                <p className="text-xs font-semibold text-primary mb-2 border-b pb-1">
                  Additional Items:
                </p>
                <ul className="space-y-1">
                  {remainingItems.map((item, idx) => (
                    <li
                      key={idx}
                      className="text-xs text-muted-foreground flex justify-between gap-4"
                    >
                      <span>
                        {item.product_name} ({item.variant_title})
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

  const totalPages = Math.ceil(orders.length / ITEMS_PER_PAGE);
  const paginatedOrders = orders.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE,
  );

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Loading your orders...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        back
        title="My Orders"
        description="View and track your diamond purchases"
      />

      {orders.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <IconShoppingBag className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <CardTitle className="mb-2">No orders yet</CardTitle>
            <CardDescription className="text-muted-foreground mb-4">
              You haven&apos;t made any purchases yet.
            </CardDescription>
            <Button asChild>
              <Link href="/shop">Browse Shop</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="gap-1 bg-transparent">
          <CardHeader>
            <CardTitle>Order History</CardTitle>
          </CardHeader>
          <CardContent>
            <div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[100px]">ID</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
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
                      <TableCell>{formatDate(order.created_at)}</TableCell>
                      <TableCell className="capitalize">
                        <Badge variant={getStatusBadgeVariant(order.status)}>
                          {order.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/orders/${order.order_id}`}>
                            Details
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
                    Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1}–
                    {Math.min(currentPage * ITEMS_PER_PAGE, orders.length)} of{" "}
                    {orders.length}
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
