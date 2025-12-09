"use client";
import { ChartAreaInteractive } from "@/components/chart-area-interactive";
import { ComingSoon } from "@/components/ComingSoon";
import { FullLoader } from "@/components/Loader";
import { PageHeader } from "@/components/PageHeader";
import { SectionCards } from "@/components/section-cards";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { env } from "@/lib/env";
import { formatMoneyInput } from "@/lib/utils";
import {
  IconActivity,
  IconArticle,
  IconCalendar,
  IconDiamond,
  IconShoppingCart,
  IconStar,
  IconSwords,
  IconTrophy,
  IconUserPlus,
  IconUsers,
} from "@tabler/icons-react";
import axios from "axios";
import { ArrowRight, Shield, TrendingUp } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { Activity, useEffect, useState } from "react";
import { toast } from "sonner";

// Mock function to fetch website metrics
const fetchWebsiteMetrics = async () => {
  // In a real app, this would be an API call
  return {
    totalMembers: 15847,
    newMembersThisMonth: 1234,
    totalTeams: 3421,
    newTeamsThisMonth: 187,
    totalTournaments: 156,
    activeTournaments: 8,
    totalScrims: 2847,
    activeScrims: 23,
    totalNews: 89,
    publishedNews: 67,
    diamondBundlesSold: 5632,
    diamondBundlesRevenue: 847500,
    topSellingBundle: "1000 Diamonds",
    totalRevenue: 2450000,
  };
};

const page = () => {
  const router = useRouter();
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);

  const [totalUsers, setTotalUsers] = useState<number>(0);
  const [totalTeams, setTotalTeams] = useState<number>(0);
  const [totalNews, setTotalNews] = useState<number>(0);

  const recentActivities = [
    {
      id: 1,
      user: "John Doe",
      action: "Updated tournament results for AFC Championship",
      timestamp: "2023-07-01 14:30",
    },
    {
      id: 2,
      user: "Jane Smith",
      action: "Created new announcement about Season 2",
      timestamp: "2023-07-01 13:15",
    },
    {
      id: 3,
      user: "Mike Johnson",
      action: "Banned player #12345 for cheating",
      timestamp: "2023-07-01 11:45",
    },
    {
      id: 4,
      user: "Sarah Wilson",
      action: "Added new diamond bundle to shop",
      timestamp: "2023-07-01 10:20",
    },
    {
      id: 5,
      user: "Alex Brown",
      action: "Approved team registration for Team Phoenix",
      timestamp: "2023-07-01 09:15",
    },
  ];

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const users = await axios(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/auth/get-total-number-of-users/`
        );
        const teams = await axios(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/team/get-all-teams/`
        );
        const news = await axios(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/auth/get-all-news/`
        );

        setTotalUsers(users?.data?.total_users);
        setTotalTeams(teams?.data?.teams.length);
        setTotalNews(news.data.news?.length);
      } catch (error) {
        setTotalUsers(0);
        setTotalTeams(0);
        toast.error("Oops! An error occurred");
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, []);

  if (loading) {
    return <FullLoader />;
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <PageHeader title="Admin dashboard" />
        {/* Main Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-4 gap-2 mb-4">
          {/* Members Metrics */}
          <Card className="hover:shadow-lg transition-shadow gap-1">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Members
              </CardTitle>
              <IconUsers className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatMoneyInput(totalUsers)}
              </div>
              <div className="flex items-center gap-2 mt-2">
                <div className="flex items-center gap-1 text-sm text-green-600">
                  <TrendingUp className="h-3 w-3" />+ 10 this month
                </div>
              </div>
              {/* <Button asChild className="w-full mt-3">
                <Link href="/a/players">
                  <IconUserPlus className="mr-2 h-4 w-4" />
                  Manage Members
                </Link>
              </Button> */}
            </CardContent>
          </Card>

          {/* Teams Metrics */}
          <Card className="hover:shadow-lg transition-shadow gap-1">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Teams</CardTitle>
              <Shield className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatMoneyInput(totalTeams)}
              </div>
              <div className="flex items-center gap-2 mt-2">
                <div className="flex items-center gap-1 text-sm text-green-600">
                  <TrendingUp className="h-3 w-3" />+ 10 this month
                </div>
              </div>
              {/* <Button asChild className="w-full mt-3">
                <Link href="/a/teams">
                  <Shield className="mr-2 h-4 w-4" />
                  Manage Teams
                </Link>
              </Button> */}
            </CardContent>
          </Card>

          {/* Tournaments Metrics */}
          <Card className="hover:shadow-lg transition-shadow gap-1">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Tournaments</CardTitle>
              <IconTrophy className="h-4 w-4 text-yellow-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0</div>
              <div className="flex items-center gap-2 mt-2">
                <div className="flex items-center gap-1 text-sm text-blue-600">
                  <IconCalendar className="h-3 w-3" />0 active
                </div>
              </div>
              {/* <Button asChild className="w-full mt-3">
                <Link href="/a/events">
                  <IconTrophy className="mr-2 h-4 w-4" />
                  Manage Tournaments
                </Link>
              </Button> */}
            </CardContent>
          </Card>

          {/* Scrims Metrics */}
          <Card className="hover:shadow-lg transition-shadow gap-1">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Scrims</CardTitle>
              <IconSwords className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0</div>
              <div className="flex items-center gap-2 mt-2">
                <div className="flex items-center gap-1 text-sm text-orange-600">
                  <IconActivity className="h-3 w-3" />0 active
                </div>
              </div>
              {/* <Button asChild className="w-full mt-3">
                <Link href="/a/events">
                  <IconSwords className="mr-2 h-4 w-4" />
                  Manage Scrims
                </Link>
              </Button> */}
            </CardContent>
          </Card>
        </div>

        {/* Secondary Metrics Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-2 mb-4">
          {/* News Metrics */}
          <Card className="hover:shadow-lg transition-shadow gap-1">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                News & Announcements
              </CardTitle>
              <IconArticle className="h-4 w-4 text-indigo-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalNews}</div>
              <div className="text-sm text-muted-foreground mt-1">
                0 published
              </div>
              <Button asChild className="w-full mt-3">
                <Link href="/a/news">
                  <IconArticle className="mr-2 h-4 w-4" />
                  Manage News
                </Link>
              </Button>
            </CardContent>
          </Card>

          {/* Shop Metrics */}
          <Card className="hover:shadow-lg transition-shadow gap-1">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Diamond Bundles
              </CardTitle>
              <IconDiamond className="h-4 w-4 text-cyan-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0</div>
              <div className="text-sm text-muted-foreground mt-1">Top: 0</div>
              <Button asChild className="w-full mt-3">
                <Link href="/a/shop">
                  <IconShoppingCart className="mr-2 h-4 w-4" />
                  Manage Shop
                </Link>
              </Button>
            </CardContent>
          </Card>

          {/* Revenue Metrics */}
          <Card className="hover:shadow-lg transition-shadow gap-1">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Revenue
              </CardTitle>
              <IconStar className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">₦0</div>
              <div className="text-sm text-muted-foreground mt-1">
                ₦0 from diamonds
              </div>
              <Button asChild className="w-full mt-3">
                <Link href="/a/shop/orders">
                  <TrendingUp className="mr-2 h-4 w-4" />
                  View Orders
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2 mb-4">
          <Button disabled className="h-auto p-4">
            {/* <Link
              href="/a/leaderboards/create"
              className="flex flex-col items-center gap-2"
            > */}
            <IconTrophy className="h-6 w-6" />
            <span>Create Leaderboard</span>
            {/* </Link> */}
          </Button>

          <Button
            asChild
            variant="outline"
            className="h-auto p-4 bg-transparent"
          >
            <Link
              href="/a/news/create"
              className="flex flex-col items-center gap-2"
            >
              <IconArticle className="h-6 w-6" />
              <span>Create News</span>
            </Link>
          </Button>

          <Button
            disabled
            variant="outline"
            className="h-auto p-4 bg-transparent"
          >
            {/* <Link
              href="/a/events/create"
              className="flex flex-col items-center gap-2"
            > */}
            <IconCalendar className="h-6 w-6" />
            <span>Create Event</span>
            {/* </Link> */}
          </Button>

          <Button
            disabled
            variant="outline"
            className="h-auto p-4 bg-transparent"
          >
            {/* <Link
              href="/a/rankings"
              className="flex flex-col items-center gap-2"
            > */}
            <IconStar className="h-6 w-6" />
            <span>Manage Rankings</span>
            {/* </Link> */}
          </Button>
        </div>

        {/* Recent Activities */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <IconActivity className="h-5 w-5" />
              Recent Admin Activities
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Admin User</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Timestamp</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="relative">
                <ComingSoon />
                {recentActivities.map((activity: any) => (
                  <TableRow key={activity.id}>
                    <TableCell className="font-medium">
                      {activity.user}
                    </TableCell>
                    <TableCell>{activity.action}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {activity.timestamp}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {/* <div className="mt-4 text-right">
              <Button asChild variant="outline">
                <Link href="/a/history">
                  View All Activities <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div> */}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default page;
