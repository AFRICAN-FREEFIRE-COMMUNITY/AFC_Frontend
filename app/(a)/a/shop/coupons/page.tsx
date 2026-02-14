"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
  IconTicket,
  IconReceipt,
  IconCurrencyDollar,
  IconTrendingUp,
  IconCalendar,
} from "@tabler/icons-react";
import Link from "next/link";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import axios from "axios";
import { env } from "@/lib/env";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Loader } from "@/components/Loader";

interface Coupon {
  id: number;
  code: string;
  discount_type: "percent" | "fixed";
  discount_value: string;
  active: boolean;
  start_at: string;
  end_at: string;
  min_order_amount: string;
  max_uses: number;
  used_count: number;
  is_valid_now: boolean;
}

// Mock data — replace with real endpoints later
const mockMonthlyTrends = [
  { month: "Jan 2024", redemptions: 45, savings: 1250.0 },
  { month: "Feb 2024", redemptions: 52, savings: 1480.0 },
  { month: "Mar 2024", redemptions: 38, savings: 980.0 },
  { month: "Apr 2024", redemptions: 67, savings: 1890.0 },
  { month: "May 2024", redemptions: 73, savings: 2140.0 },
  { month: "Jun 2024", redemptions: 89, savings: 2680.0 },
];

const mockRecentActivity = [
  {
    id: 1,
    user: "john_doe",
    coupon: "FREEDIAMONDS10",
    orderAmount: 20.0,
    savings: 2.0,
    dateTime: "2024-01-15 14:30",
  },
  {
    id: 2,
    user: "jane_smith",
    coupon: "SAVE20",
    orderAmount: 100.0,
    savings: 20.0,
    dateTime: "2024-01-15 13:45",
  },
  {
    id: 3,
    user: "mike_wilson",
    coupon: "NEWUSER15",
    orderAmount: 80.0,
    savings: 12.0,
    dateTime: "2024-01-15 12:20",
  },
  {
    id: 4,
    user: "sarah_jones",
    coupon: "WEEKEND25",
    orderAmount: 60.0,
    savings: 15.0,
    dateTime: "2024-01-15 11:15",
  },
  {
    id: 5,
    user: "alex_brown",
    coupon: "BULK50",
    orderAmount: 200.0,
    savings: 50.0,
    dateTime: "2024-01-15 10:30",
  },
];

// Mock stats for endpoints not yet available
const mockStats = {
  totalSavings: 15420.5,
  conversionRate: 24.8,
  redemptionsChange: "+12%",
};

export default function CouponMetricsPage() {
  const { token } = useAuth();
  const [activeTab, setActiveTab] = useState("performance");
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  useEffect(() => {
    const fetchCoupons = async () => {
      if (!token) return;
      try {
        setIsLoading(true);
        const res = await axios.get(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/shop/view-all-coupons/`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        setCoupons(res.data.coupons || []);
      } catch (error: any) {
        toast.error(
          error.response?.data?.message || "Failed to fetch coupons",
        );
      } finally {
        setIsLoading(false);
      }
    };

    fetchCoupons();
  }, [token]);

  const totalCoupons = coupons.length;
  const activeCoupons = coupons.filter((c) => c.active).length;
  const totalRedemptions = coupons.reduce((sum, c) => sum + c.used_count, 0);

  // Sort coupons by used_count descending for the performance tab
  const sortedCoupons = [...coupons].sort(
    (a, b) => b.used_count - a.used_count,
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader text="Loading coupon metrics..." />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader back title="Coupon Metrics" />

      {/* Stats Cards */}
      <div className="grid gap-2 grid-cols-1 md:grid-cols-2 2xl:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Coupons</CardTitle>
            <IconTicket className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCoupons}</div>
            <p className="text-xs text-muted-foreground">
              {activeCoupons} active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Redemptions
            </CardTitle>
            <IconReceipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalRedemptions}</div>
            <p className="text-xs text-green-600">
              {mockStats.redemptionsChange} from last month
            </p>
          </CardContent>
        </Card>

        {/* Mock */}
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

        {/* Mock */}
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
              Average across all coupons
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs Content */}
      <Card>
        <CardContent className="w-full">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <ScrollArea>
              <TabsList className="w-full">
                <TabsTrigger value="performance">Performance</TabsTrigger>
                <TabsTrigger value="trends">Trends</TabsTrigger>
                <TabsTrigger value="activity">Recent Activity</TabsTrigger>
              </TabsList>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>

            {/* Performance — Real data */}
            <TabsContent value="performance" className="mt-6">
              <div className="mb-4">
                <h3 className="text-lg font-semibold">All Coupons</h3>
                <p className="text-sm text-muted-foreground">
                  Coupons ranked by usage. Click a coupon to view details.
                </p>
              </div>
              {coupons.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No coupons found
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Coupon Code</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Discount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Uses</TableHead>
                      <TableHead>Usage</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedCoupons.map((coupon) => {
                      const usagePercent =
                        coupon.max_uses > 0
                          ? (coupon.used_count / coupon.max_uses) * 100
                          : 0;

                      return (
                        <TableRow key={coupon.id} className="cursor-pointer">
                          <TableCell>
                            <Link
                              href={`/a/shop/coupons/${coupon.id}`}
                              className="font-mono font-medium text-primary hover:underline"
                            >
                              {coupon.code}
                            </Link>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {coupon.discount_type === "percent"
                                ? "Percentage"
                                : "Fixed Amount"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {coupon.discount_type === "percent"
                              ? `${parseFloat(coupon.discount_value)}%`
                              : formatCurrency(
                                  parseFloat(coupon.discount_value),
                                )}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={coupon.active ? "default" : "secondary"}
                            >
                              {coupon.active ? "Active" : "Inactive"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {coupon.used_count} / {coupon.max_uses}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Progress
                                value={usagePercent}
                                className="w-16 h-2"
                              />
                              <span className="text-sm">
                                {usagePercent.toFixed(0)}%
                              </span>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </TabsContent>

            {/* Trends — Mock */}
            <TabsContent value="trends" className="mt-6">
              <div className="mb-4">
                <h3 className="text-lg font-semibold">Monthly Trends</h3>
                <p className="text-sm text-muted-foreground">
                  Coupon redemptions and savings over the last 6 months
                </p>
              </div>
              <div className="space-y-4">
                {mockMonthlyTrends.map((trend) => (
                  <div
                    key={trend.month}
                    className="flex items-center justify-between p-4 bg-muted/50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <IconCalendar className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{trend.month}</span>
                    </div>
                    <div className="flex items-center gap-8">
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">
                          Redemptions
                        </p>
                        <p className="font-semibold">{trend.redemptions}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">Savings</p>
                        <p className="font-semibold">
                          {formatCurrency(trend.savings)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>

            {/* Activity — Mock */}
            <TabsContent value="activity" className="mt-6">
              <div className="mb-4">
                <h3 className="text-lg font-semibold">
                  Recent Coupon Activity
                </h3>
                <p className="text-sm text-muted-foreground">
                  Latest coupon redemptions and usage
                </p>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Coupon Used</TableHead>
                    <TableHead>Order Amount</TableHead>
                    <TableHead>Savings</TableHead>
                    <TableHead>Date & Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mockRecentActivity.map((activity) => (
                    <TableRow key={activity.id}>
                      <TableCell className="font-medium">
                        {activity.user}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="font-mono">
                          {activity.coupon}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {formatCurrency(activity.orderAmount)}
                      </TableCell>
                      <TableCell className="text-green-600">
                        -{formatCurrency(activity.savings)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {activity.dateTime}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
