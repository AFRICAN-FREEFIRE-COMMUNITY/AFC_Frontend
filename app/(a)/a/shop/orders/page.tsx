"use client";

import { useState } from "react";
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
import { Search, Download, MoreHorizontal, Eye } from "lucide-react";
import Link from "next/link";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

// Mock orders data
const mockOrders = [
  {
    id: "ORD-001",
    customer: {
      name: "John Doe",
      email: "john.doe@example.com",
    },
    product: "100 Diamonds",
    status: "Pending",
    date: "2024-01-15",
    amount: 1312.5,
  },
  {
    id: "ORD-002",
    customer: {
      name: "Jane Smith",
      email: "jane.smith@example.com",
    },
    product: "500 Diamonds",
    status: "Fulfilled",
    date: "2024-01-14",
    amount: 6562.5,
  },
  {
    id: "ORD-003",
    customer: {
      name: "Mike Johnson",
      email: "mike.j@example.com",
    },
    product: "1000 Diamonds",
    status: "Fulfilled",
    date: "2024-01-13",
    amount: 13125,
  },
  {
    id: "ORD-004",
    customer: {
      name: "Sarah Williams",
      email: "sarah.w@example.com",
    },
    product: "100 Diamonds",
    status: "Declined",
    date: "2024-01-12",
    amount: 1312.5,
  },
  {
    id: "ORD-005",
    customer: {
      name: "Chris Brown",
      email: "chris.b@example.com",
    },
    product: "2000 Diamonds",
    status: "Pending",
    date: "2024-01-11",
    amount: 26250,
  },
  {
    id: "ORD-006",
    customer: {
      name: "Emma Davis",
      email: "emma.d@example.com",
    },
    product: "500 Diamonds",
    status: "Fulfilled",
    date: "2024-01-10",
    amount: 6562.5,
  },
];

export default function AdminOrdersPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("all");

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

  const filteredOrders = mockOrders.filter((order) => {
    const matchesSearch =
      order.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.customer.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.product.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesTab =
      activeTab === "all" ||
      order.status.toLowerCase() === activeTab.toLowerCase();

    return matchesSearch && matchesTab;
  });

  const orderCounts = {
    all: mockOrders.length,
    pending: mockOrders.filter((o) => o.status.toLowerCase() === "pending")
      .length,
    fulfilled: mockOrders.filter((o) => o.status.toLowerCase() === "fulfilled")
      .length,
    declined: mockOrders.filter((o) => o.status.toLowerCase() === "declined")
      .length,
  };

  return (
    <div>
      <PageHeader
        title="Orders"
        description="Manage and track all shop orders"
      />

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <CardTitle>All Orders</CardTitle>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search orders..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 w-full md:w-[250px]"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
            <ScrollArea>
              <TabsList className="w-full">
                <TabsTrigger value="all">All ({orderCounts.all})</TabsTrigger>
                <TabsTrigger value="pending">
                  Pending ({orderCounts.pending})
                </TabsTrigger>
                <TabsTrigger value="fulfilled">
                  Fulfilled ({orderCounts.fulfilled})
                </TabsTrigger>
                <TabsTrigger value="declined">
                  Declined ({orderCounts.declined})
                </TabsTrigger>
              </TabsList>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </Tabs>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order ID</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredOrders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    <p className="text-muted-foreground">No orders found</p>
                  </TableCell>
                </TableRow>
              ) : (
                filteredOrders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-mono font-medium">
                      {order.id}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{order.customer.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {order.customer.email}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>{order.product}</TableCell>
                    <TableCell>
                      <Badge variant={getStatusBadgeVariant(order.status)}>
                        {order.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{order.date}</TableCell>
                    <TableCell className="font-medium">
                      {formatPrice(order.amount)}
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
                            <Link href={`/a/shop/orders/${order.id}`}>
                              <Eye className="h-4 w-4 mr-2" />
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
        </CardContent>
      </Card>
    </div>
  );
}
