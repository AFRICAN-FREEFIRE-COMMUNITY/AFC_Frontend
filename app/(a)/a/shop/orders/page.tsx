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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PageHeader } from "@/components/PageHeader";
import { Search, MoreHorizontal, Eye, Loader2 } from "lucide-react";
import Link from "next/link";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import axios from "axios";
import { env } from "@/lib/env";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { formatDate, formatMoneyInput } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { IconEye } from "@tabler/icons-react";
import { ITEMS_PER_PAGE } from "@/constants";

export default function page() {
  const { token } = useAuth();
  const [orders, setOrders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    const fetchAllOrders = async () => {
      try {
        const response = await axios.get(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/shop/view-all-orders/`,
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        );
        setOrders(response.data.orders);
      } catch (error) {
        console.error("Error fetching admin orders:", error);
      } finally {
        setIsLoading(false);
      }
    };

    if (token) fetchAllOrders();
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
        return "default"; // Greenish
      case "pending":
        return "secondary"; // Gray/Yellow
      case "declined":
      case "failed":
        return "destructive"; // Red
      default:
        return "outline";
    }
  };

  const filteredOrders = orders.filter((order) => {
    const firstProduct = order.items[0]?.product || "";
    const matchesSearch =
      order.order_id.toString().includes(searchQuery) ||
      order.username.toString().includes(searchQuery) ||
      firstProduct.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.user_id.toString().includes(searchQuery);

    const matchesTab =
      activeTab === "all" ||
      order.status.toLowerCase() === activeTab.toLowerCase();

    return matchesSearch && matchesTab;
  });

  const totalPages = Math.ceil(filteredOrders.length / ITEMS_PER_PAGE);
  const paginatedOrders = filteredOrders.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE,
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, activeTab]);

  const orderCounts = {
    all: orders.length,
    pending: orders.filter((o) => o.status.toLowerCase() === "pending").length,
    paid: orders.filter((o) => o.status.toLowerCase() === "paid").length,
  };

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const renderItemsSummary = (items: any[]) => {
    if (items.length === 0)
      return <span className="text-muted-foreground">No items</span>;

    const firstItem = items[0];
    const remainingItems = items.slice(1);

    return (
      <div className="flex items-center gap-2">
        <span className="truncate max-w-[150px]">{firstItem.product}</span>

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
                        {item.product} ({item.variant})
                      </span>
                      <span className="font-medium text-foreground text-right">
                        x{item.qty}
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

  return (
    <div className="space-y-4">
      <PageHeader
        back
        title="Admin Orders"
        description="Manage and track all shop orders across the platform"
      />

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search ID or Product..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9 w-full"
        />
      </div>
      <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
        <ScrollArea>
          <TabsList className="w-full">
            <TabsTrigger value="all">All ({orderCounts.all})</TabsTrigger>
            <TabsTrigger value="pending">
              Pending ({orderCounts.pending})
            </TabsTrigger>
            <TabsTrigger value="paid">Paid ({orderCounts.paid})</TabsTrigger>
          </TabsList>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </Tabs>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Items</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Total</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedOrders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-10">
                  No orders found matching your filters.
                </TableCell>
              </TableRow>
            ) : (
              paginatedOrders.map((order) => (
                <TableRow key={order.order_id}>
                  <TableCell>#{order.order_id}</TableCell>
                  <TableCell className="text-muted-foreground capitalize">
                    {order.username}
                  </TableCell>
                  <TableCell>{renderItemsSummary(order.items)}</TableCell>
                  <TableCell className="capitalize">
                    <Badge variant={getStatusBadgeVariant(order.status)}>
                      {order.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDate(order.created_at)}
                  </TableCell>
                  <TableCell className="font-semibold">
                    {formatMoneyInput(order.total)}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`/a/shop/orders/${order.order_id}`}>
                            <IconEye />
                            View Details
                          </Link>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="hidden md:block text-sm text-muted-foreground">
            Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1}–
            {Math.min(currentPage * ITEMS_PER_PAGE, filteredOrders.length)} of{" "}
            {filteredOrders.length}
          </p>
          <Pagination className="w-full md:w-auto mx-0">
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
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
  );
}
