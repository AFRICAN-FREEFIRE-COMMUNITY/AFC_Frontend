"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

// Mock coupon metrics
const couponMetrics = {
  totalCoupons: 15,
  activeCoupons: 8,
  totalRedemptions: 342,
  redemptionsChange: "+12%",
  totalSavings: 15420.5,
  conversionRate: 24.8,
};

// Mock top performing coupons
const topPerformingCoupons = [
  {
    id: 1,
    code: "FREEDIAMONDS10",
    type: "Percentage",
    discount: "10%",
    uses: 156,
    redemptions: 142,
    conversionRate: 91,
    totalSavings: 2840.0,
  },
  {
    id: 2,
    code: "SAVE20",
    type: "Fixed Amount",
    discount: "$20",
    uses: 89,
    redemptions: 67,
    conversionRate: 75.3,
    totalSavings: 1340.0,
  },
  {
    id: 3,
    code: "NEWUSER15",
    type: "Percentage",
    discount: "15%",
    uses: 234,
    redemptions: 198,
    conversionRate: 84.6,
    totalSavings: 5940.0,
  },
  {
    id: 4,
    code: "BULK50",
    type: "Fixed Amount",
    discount: "$50",
    uses: 45,
    redemptions: 32,
    conversionRate: 71.1,
    totalSavings: 1600.0,
  },
  {
    id: 5,
    code: "WEEKEND25",
    type: "Percentage",
    discount: "25%",
    uses: 78,
    redemptions: 61,
    conversionRate: 78.2,
    totalSavings: 3050.0,
  },
];

// Mock monthly trends
const monthlyTrends = [
  { month: "Jan 2024", redemptions: 45, savings: 1250.0 },
  { month: "Feb 2024", redemptions: 52, savings: 1480.0 },
  { month: "Mar 2024", redemptions: 38, savings: 980.0 },
  { month: "Apr 2024", redemptions: 67, savings: 1890.0 },
  { month: "May 2024", redemptions: 73, savings: 2140.0 },
  { month: "Jun 2024", redemptions: 89, savings: 2680.0 },
];

// Mock recent activity
const recentActivity = [
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

export default function CouponMetricsPage() {
  const [activeTab, setActiveTab] = useState("performance");

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  return (
    <div className="flex flex-col gap-4">
      <PageHeader back title="Coupon Metrics" />

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Coupons</CardTitle>
            <IconTicket className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {couponMetrics.totalCoupons}
            </div>
            <p className="text-xs text-muted-foreground">
              {couponMetrics.activeCoupons} active
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
            <div className="text-2xl font-bold">
              {couponMetrics.totalRedemptions}
            </div>
            <p className="text-xs text-green-600">
              {couponMetrics.redemptionsChange} from last month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Savings</CardTitle>
            <IconCurrencyDollar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(couponMetrics.totalSavings)}
            </div>
            <p className="text-xs text-muted-foreground">
              Customer savings generated
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Conversion Rate
            </CardTitle>
            <IconTrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {couponMetrics.conversionRate}%
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

            <TabsContent value="performance" className="mt-6">
              <div className="mb-4">
                <h3 className="text-lg font-semibold">
                  Top Performing Coupons
                </h3>
                <p className="text-sm text-muted-foreground">
                  Coupons ranked by redemption rate and total savings generated
                </p>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Coupon Code</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Discount</TableHead>
                    <TableHead>Uses</TableHead>
                    <TableHead>Redemptions</TableHead>
                    <TableHead>Conversion Rate</TableHead>
                    <TableHead>Total Savings</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topPerformingCoupons.map((coupon) => (
                    <TableRow key={coupon.id}>
                      <TableCell className="font-mono font-medium">
                        {coupon.code}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{coupon.type}</Badge>
                      </TableCell>
                      <TableCell>{coupon.discount}</TableCell>
                      <TableCell>{coupon.uses}</TableCell>
                      <TableCell>{coupon.redemptions}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress
                            value={coupon.conversionRate}
                            className="w-16 h-2"
                          />
                          <span className="text-sm">
                            {coupon.conversionRate}%
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {formatCurrency(coupon.totalSavings)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TabsContent>

            <TabsContent value="trends" className="mt-6">
              <div className="mb-4">
                <h3 className="text-lg font-semibold">Monthly Trends</h3>
                <p className="text-sm text-muted-foreground">
                  Coupon redemptions and savings over the last 6 months
                </p>
              </div>
              <div className="space-y-4">
                {monthlyTrends.map((trend) => (
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
                  {recentActivity.map((activity) => (
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
