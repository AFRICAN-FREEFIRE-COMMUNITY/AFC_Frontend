"use client";

import { use, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
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
  IconReceipt,
  IconCurrencyDollar,
  IconTrendingUp,
  IconCalendar,
} from "@tabler/icons-react";
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import axios from "axios";
import { env } from "@/lib/env";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Loader } from "@/components/Loader";
import { formatDate } from "@/lib/utils";

type Params = Promise<{ id: string }>;

interface CouponDetails {
  id: number;
  code: string;
  discount_type: "percent" | "fixed";
  discount_value: string;
  max_uses: number;
  used_count: number;
  min_order_amount: string;
  expiry_date: string;
  is_active: boolean;
  description: string;
}

// Mock data — replace with real endpoints later
const mockUsageOverTime = [
  { week: "2024-01-01", uses: 5, savings: 95.0 },
  { week: "2024-01-07", uses: 12, savings: 225.0 },
  { week: "2024-01-14", uses: 18, savings: 340.0 },
  { week: "2024-01-21", uses: 25, savings: 475.0 },
  { week: "2024-01-28", uses: 31, savings: 620.0 },
  { week: "2024-02-04", uses: 38, savings: 785.0 },
  { week: "2024-02-11", uses: 45, savings: 950.0 },
];

const mockRecentRedemptions = [
  {
    id: 1,
    user: "john_doe",
    orderAmount: 75.0,
    savings: 7.5,
    dateTime: "2024-01-15 14:30",
  },
  {
    id: 2,
    user: "jane_smith",
    orderAmount: 120.0,
    savings: 12.0,
    dateTime: "2024-01-15 13:45",
  },
  {
    id: 3,
    user: "mike_wilson",
    orderAmount: 95.0,
    savings: 9.5,
    dateTime: "2024-01-15 12:20",
  },
  {
    id: 4,
    user: "sarah_jones",
    orderAmount: 65.0,
    savings: 6.5,
    dateTime: "2024-01-15 11:15",
  },
  {
    id: 5,
    user: "alex_brown",
    orderAmount: 110.0,
    savings: 11.0,
    dateTime: "2024-01-15 10:30",
  },
];

const mockStats = {
  totalSavings: 2840.0,
  conversionRate: 28.4,
  revenueGenerated: 12130.0,
  avgOrderValue: 85.5,
};

export default function CouponStatisticsPage({ params }: { params: Params }) {
  const { id } = use(params);
  const { token } = useAuth();

  const [couponDetails, setCouponDetails] = useState<CouponDetails | null>(
    null,
  );
  const [totalUses, setTotalUses] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  useEffect(() => {
    const fetchData = async () => {
      if (!id || !token) return;

      try {
        setIsLoading(true);
        const decodedId = decodeURIComponent(id);

        const [detailsRes, usesRes] = await Promise.all([
          axios.post(
            `${env.NEXT_PUBLIC_BACKEND_API_URL}/shop/get-coupon-details/`,
            { coupon_id: decodedId },
            { headers: { Authorization: `Bearer ${token}` } },
          ),
          axios.post(
            `${env.NEXT_PUBLIC_BACKEND_API_URL}/shop/get-total-coupon-uses/`,
            { coupon_id: decodedId },
            { headers: { Authorization: `Bearer ${token}` } },
          ),
        ]);

        setCouponDetails(detailsRes.data.coupon_details);
        setTotalUses(usesRes.data.total_uses);
      } catch (error: any) {
        toast.error(
          error.response?.data?.message || "Failed to fetch coupon data",
        );
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [id, token]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader text="Loading coupon statistics..." />
      </div>
    );
  }

  if (!couponDetails) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <p className="text-muted-foreground">Coupon not found</p>
        <Button asChild>
          <Link href="/a/shop/inventory">Back to Inventory</Link>
        </Button>
      </div>
    );
  }

  const usesPercentage =
    couponDetails.max_uses > 0 ? (totalUses / couponDetails.max_uses) * 100 : 0;

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <PageHeader back title={`Coupon Statistics: ${couponDetails.code}`} />
        <Button className="w-full md:w-auto" asChild>
          <Link href={`/a/shop/coupons/${id}/edit`}>Edit Coupon</Link>
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-2 grid-cols-1 md:grid-cols-2 2xl:grid-cols-4">
        {/* Total Uses — Real data */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Uses</CardTitle>
            <IconReceipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalUses}</div>
            <p className="text-xs text-muted-foreground">
              of {couponDetails.max_uses} maximum
            </p>
            <Progress value={usesPercentage} className="mt-2 h-2" />
          </CardContent>
        </Card>

        {/* Total Savings — Mock */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Savings</CardTitle>
            <IconCurrencyDollar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(mockStats.totalSavings)}
            </div>
            <p className="text-xs text-muted-foreground">
              Customer savings generated
            </p>
          </CardContent>
        </Card>

        {/* Conversion Rate — Mock */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Conversion Rate
            </CardTitle>
            <IconTrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {mockStats.conversionRate}%
            </div>
            <p className="text-xs text-muted-foreground">
              Users who completed purchase
            </p>
          </CardContent>
        </Card>

        {/* Revenue Generated — Mock */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Revenue Generated
            </CardTitle>
            <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(mockStats.revenueGenerated)}
            </div>
            <p className="text-xs text-muted-foreground">
              Total revenue from coupon orders
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Coupon Details + Usage Over Time */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div>
          {/* Coupon Details */}
          <Card>
            <CardHeader>
              <CardTitle>Coupon Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Status</span>
                  <Badge
                    variant={couponDetails.is_active ? "default" : "secondary"}
                  >
                    {couponDetails.is_active ? "Active" : "Inactive"}
                  </Badge>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Discount</span>
                  <span className="font-medium">
                    {couponDetails.discount_type === "percent"
                      ? `${parseFloat(couponDetails.discount_value)}%`
                      : formatCurrency(
                          parseFloat(couponDetails.discount_value),
                        )}
                  </span>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Type</span>
                  <span className="font-medium">
                    {couponDetails.discount_type === "percent"
                      ? "Percentage"
                      : "Fixed Amount"}
                  </span>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Min. Order</span>
                  <span className="font-medium">
                    {formatCurrency(parseFloat(couponDetails.min_order_amount))}
                  </span>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Created</span>
                  <span className="font-medium">—</span>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Expires</span>
                  <span className="font-medium">
                    {couponDetails.expiry_date
                      ? formatDate(couponDetails.expiry_date)
                      : "N/A"}
                  </span>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">
                    Avg. Order Value
                  </span>
                  <span className="font-medium">
                    {formatCurrency(mockStats.avgOrderValue)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        <div>
          {/* Usage Over Time — Mock */}
          <Card>
            <CardHeader>
              <CardTitle>Usage Over Time</CardTitle>
              <p className="text-sm text-muted-foreground">
                Weekly usage and savings generated
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {mockUsageOverTime.map((entry) => (
                  <div
                    key={entry.week}
                    className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <IconCalendar className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium text-sm">{entry.week}</span>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">Uses</p>
                        <p className="font-semibold text-sm">{entry.uses}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">Savings</p>
                        <p className="font-semibold text-sm text-green-500">
                          {formatCurrency(entry.savings)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Recent Redemptions — Mock */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Redemptions</CardTitle>
          <p className="text-sm text-muted-foreground">
            Latest uses of this coupon
          </p>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Order Amount</TableHead>
                <TableHead>Savings</TableHead>
                <TableHead>Date & Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockRecentRedemptions.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="font-medium">{entry.user}</TableCell>
                  <TableCell>{formatCurrency(entry.orderAmount)}</TableCell>
                  <TableCell className="text-green-500">
                    -{formatCurrency(entry.savings)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {entry.dateTime}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
