// // "use client";

// // import { useState, useEffect } from "react";
// // import { useRouter } from "next/navigation";
// // import {
// // 	Table,
// // 	TableBody,
// // 	TableCell,
// // 	TableHead,
// // 	TableHeader,
// // 	TableRow,
// // } from "@/components/ui/table";
// // import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
// // import { Button } from "@/components/ui/button";
// // import Link from "next/link";
// // import { ArrowRight, ShoppingCart, History, Loader2, AlertCircle, Users, Trophy, FileText, TrendingUp } from "lucide-react";
// // import { useDashboardStats, useAdminHistory } from "@/hooks/useAdminApi";

// // export const Dashboard = () => {
// // 	const router = useRouter();
// // 	const [userRole, setUserRole] = useState("moderator"); // This should be fetched from an auth context in a real app

// // 	// Use API hooks
// // 	const { data: dashboardStats, loading: statsLoading, error: statsError } = useDashboardStats();
// // 	const { data: recentActivities, loading: activitiesLoading, error: activitiesError } = useAdminHistory({ limit: 5 });
// // 	return (
// // 		<div className="container mx-auto px-4 py-8">
// // 			<h1 className="text-3xl font-bold mb-8">Admin Dashboard</h1>

// // 			{/* Dashboard Stats */}
// // 			{statsLoading ? (
// // 				<div className="flex items-center justify-center py-8">
// // 					<Loader2 className="h-8 w-8 animate-spin" />
// // 					<span className="ml-2">Loading dashboard stats...</span>
// // 				</div>
// // 			) : statsError ? (
// // 				<div className="flex items-center justify-center py-8 text-red-500">
// // 					<AlertCircle className="h-8 w-8" />
// // 					<span className="ml-2">Error loading stats: {statsError}</span>
// // 				</div>
// // 			) : dashboardStats ? (
// // 				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
// // 					<Card>
// // 						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
// // 							<CardTitle className="text-sm font-medium">Total Teams</CardTitle>
// // 							<Users className="h-4 w-4 text-muted-foreground" />
// // 						</CardHeader>
// // 						<CardContent>
// // 							<div className="text-2xl font-bold">{dashboardStats.totalTeams}</div>
// // 							<p className="text-xs text-muted-foreground">
// // 								+{dashboardStats.newTeamsThisMonth} from last month
// // 							</p>
// // 						</CardContent>
// // 					</Card>
// // 					<Card>
// // 						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
// // 							<CardTitle className="text-sm font-medium">Active Events</CardTitle>
// // 							<Trophy className="h-4 w-4 text-muted-foreground" />
// // 						</CardHeader>
// // 						<CardContent>
// // 							<div className="text-2xl font-bold">{dashboardStats.activeEvents}</div>
// // 							<p className="text-xs text-muted-foreground">
// // 								{dashboardStats.upcomingEvents} upcoming
// // 							</p>
// // 						</CardContent>
// // 					</Card>
// // 					<Card>
// // 						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
// // 							<CardTitle className="text-sm font-medium">Total Players</CardTitle>
// // 							<Users className="h-4 w-4 text-muted-foreground" />
// // 						</CardHeader>
// // 						<CardContent>
// // 							<div className="text-2xl font-bold">{dashboardStats.totalPlayers}</div>
// // 							<p className="text-xs text-muted-foreground">
// // 								+{dashboardStats.newPlayersThisMonth} from last month
// // 							</p>
// // 						</CardContent>
// // 					</Card>
// // 					<Card>
// // 						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
// // 							<CardTitle className="text-sm font-medium">Revenue</CardTitle>
// // 							<TrendingUp className="h-4 w-4 text-muted-foreground" />
// // 						</CardHeader>
// // 						<CardContent>
// // 							<div className="text-2xl font-bold">${dashboardStats.totalRevenue}</div>
// // 							<p className="text-xs text-muted-foreground">
// // 								+{dashboardStats.revenueGrowth}% from last month
// // 							</p>
// // 						</CardContent>
// // 					</Card>
// // 				</div>
// // 			) : null}

// // 			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
// // 				<Card>
// // 					<CardHeader>
// // 						<CardTitle>Tournament Management</CardTitle>
// // 					</CardHeader>
// // 					<CardContent>
// // 						<Button asChild className="w-full mb-2">
// // 							<Link href="/admin/tournaments/create">
// // 								Create New Tournament
// // 							</Link>
// // 						</Button>
// // 						<Button asChild className="w-full">
// // 							<Link href="/admin/tournaments">
// // 								View All Tournaments
// // 							</Link>
// // 						</Button>
// // 					</CardContent>
// // 				</Card>

// // 				<Card>
// // 					<CardHeader>
// // 						<CardTitle>Leaderboards</CardTitle>
// // 					</CardHeader>
// // 					<CardContent>
// // 						<Button asChild className="w-full mb-2">
// // 							<Link href="/admin/leaderboards/create">
// // 								Create Leaderboard
// // 							</Link>
// // 						</Button>
// // 						<Button asChild className="w-full">
// // 							<Link href="/admin/leaderboards">
// // 								Edit Leaderboards
// // 							</Link>
// // 						</Button>
// // 					</CardContent>
// // 				</Card>

// // 				<Card>
// // 					<CardHeader>
// // 						<CardTitle>News & Announcements</CardTitle>
// // 					</CardHeader>
// // 					<CardContent>
// // 						<Button asChild className="w-full mb-2">
// // 							<Link href="/admin/news/create">
// // 								Create Announcement
// // 							</Link>
// // 						</Button>
// // 						<Button asChild className="w-full">
// // 							<Link href="/admin/news">Manage News</Link>
// // 						</Button>
// // 					</CardContent>
// // 				</Card>

// // 				<Card>
// // 					<CardHeader>
// // 						<CardTitle>Team & Player Management</CardTitle>
// // 					</CardHeader>
// // 					<CardContent>
// // 						<Button asChild className="w-full mb-2">
// // 							<Link href="/admin/teams">Manage Teams</Link>
// // 						</Button>
// // 						<Button asChild className="w-full">
// // 							<Link href="/admin/players">Manage Players</Link>
// // 						</Button>
// // 					</CardContent>
// // 				</Card>

// // 				<Card>
// // 					<CardHeader>
// // 						<CardTitle>Rankings & Tiers</CardTitle>
// // 					</CardHeader>
// // 					<CardContent>
// // 						<Button asChild className="w-full mb-2">
// // 							<Link href="/admin/rankings">Manage Rankings</Link>
// // 						</Button>
// // 						<Button asChild className="w-full">
// // 							<Link href="/admin/tiers">Manage Tiers</Link>
// // 						</Button>
// // 					</CardContent>
// // 				</Card>

// // 				<Card>
// // 					<CardHeader>
// // 						<CardTitle>Match Results</CardTitle>
// // 					</CardHeader>
// // 					<CardContent>
// // 						<Button asChild className="w-full">
// // 							<Link href="/admin/match-results">
// // 								Upload Match Results
// // 							</Link>
// // 						</Button>
// // 					</CardContent>
// // 				</Card>

// // 				<Card>
// // 					<CardHeader>
// // 						<CardTitle>Shop Management</CardTitle>
// // 					</CardHeader>
// // 					<CardContent>
// // 						<Button asChild className="w-full">
// // 							<Link href="/admin/shop">
// // 								<ShoppingCart className="mr-2 h-4 w-4" />
// // 								Manage Shop
// // 							</Link>
// // 						</Button>
// // 					</CardContent>
// // 				</Card>

// // 				<Card>
// // 					<CardHeader>
// // 						<CardTitle>Admin History</CardTitle>
// // 					</CardHeader>
// // 					<CardContent>
// // 						<Button asChild className="w-full">
// // 							<Link href="/admin/history">
// // 								<History className="mr-2 h-4 w-4" />
// // 								View Action History
// // 							</Link>
// // 						</Button>
// // 					</CardContent>
// // 				</Card>
// // 			</div>

// // 			<Card>
// // 				<CardHeader>
// // 					<CardTitle>Recent Activities</CardTitle>
// // 				</CardHeader>
// // 				<CardContent>
// // 					{activitiesLoading ? (
// // 						<div className="flex items-center justify-center py-8">
// // 							<Loader2 className="h-8 w-8 animate-spin" />
// // 							<span className="ml-2">Loading activities...</span>
// // 						</div>
// // 					) : activitiesError ? (
// // 						<div className="flex items-center justify-center py-8 text-red-500">
// // 							<AlertCircle className="h-8 w-8" />
// // 							<span className="ml-2">Error loading activities: {activitiesError}</span>
// // 						</div>
// // 					) : (
// // 						<>
// // 							<Table>
// // 								<TableHeader>
// // 									<TableRow>
// // 										<TableHead>User</TableHead>
// // 										<TableHead>Action</TableHead>
// // 										<TableHead>Timestamp</TableHead>
// // 									</TableRow>
// // 								</TableHeader>
// // 								<TableBody>
// // 									{recentActivities && recentActivities.length > 0 ? (
// // 										recentActivities.map((activity: any) => (
// // 											<TableRow key={activity.id}>
// // 												<TableCell>{activity.user?.username || activity.user?.name || 'Unknown'}</TableCell>
// // 												<TableCell>{activity.action}</TableCell>
// // 												<TableCell>
// // 													{new Date(activity.timestamp || activity.createdAt).toLocaleString()}
// // 												</TableCell>
// // 											</TableRow>
// // 										))
// // 									) : (
// // 										<TableRow>
// // 											<TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
// // 												No recent activities found
// // 											</TableCell>
// // 										</TableRow>
// // 									)}
// // 								</TableBody>
// // 							</Table>
// // 							<div className="mt-4 text-right">
// // 								<Button asChild variant="outline">
// // 									<Link href="/admin/history">
// // 										View All Activities{" "}
// // 										<ArrowRight className="ml-2 h-4 w-4" />
// // 									</Link>
// // 								</Button>
// // 							</div>
// // 						</>
// // 					)}
// // 				</CardContent>
// // 			</Card>
// // 		</div>
// // 	);
// // };
// "use client";

// import { useState, useEffect } from "react";
// import { useRouter } from "next/navigation";
// import {
//   Table,
//   TableBody,
//   TableCell,
//   TableHead,
//   TableHeader,
//   TableRow,
// } from "@/components/ui/table";
// import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
// import { Button } from "@/components/ui/button";
// import Link from "next/link";
// import {
//   ArrowRight,
//   ShoppingCart,
//   History,
//   Loader2,
//   AlertCircle,
//   Users,
//   Trophy,
//   FileText,
//   TrendingUp,
// } from "lucide-react";
// import { useDashboardStats, useAdminHistory } from "@/hooks/useAdminApi";

// export const Dashboard = () => {
//   const statsLoading = false;
//   const statsError = false;
//   const dashboardStats: any = null;

//   const activitiesLoading = false;
//   const activitiesError = false;
//   const recentActivities: any = null;

//   return (
//     <div className="container mx-auto px-4 py-8">
//       <h1 className="text-3xl font-bold mb-8">Admin Dashboard</h1>
//       {/* Dashboard Stats */}
//       {statsLoading ? (
//         <div className="flex items-center justify-center py-8">
//           <Loader2 className="h-8 w-8 animate-spin" />
//           <span className="ml-2">Loading dashboard stats...</span>
//         </div>
//       ) : statsError ? (
//         <div className="flex items-center justify-center py-8 text-red-500">
//           <AlertCircle className="h-8 w-8" />
//           <span className="ml-2">Error loading stats: {statsError}</span>
//         </div>
//       ) : dashboardStats ? (
//         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
//           <Card>
//             <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
//               <CardTitle className="text-sm font-medium">Total Teams</CardTitle>
//               <Users className="h-4 w-4 text-muted-foreground" />
//             </CardHeader>
//             <CardContent>
//               <div className="text-2xl font-bold">
//                 {dashboardStats.totalTeams}
//               </div>
//               <p className="text-xs text-muted-foreground">
//                 +{dashboardStats.newTeamsThisMonth} from last month
//               </p>
//             </CardContent>
//           </Card>
//           <Card>
//             <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
//               <CardTitle className="text-sm font-medium">
//                 Active Events
//               </CardTitle>
//               <Trophy className="h-4 w-4 text-muted-foreground" />
//             </CardHeader>
//             <CardContent>
//               <div className="text-2xl font-bold">
//                 {dashboardStats.activeEvents}
//               </div>
//               <p className="text-xs text-muted-foreground">
//                 {dashboardStats.upcomingEvents} upcoming
//               </p>
//             </CardContent>
//           </Card>
//           <Card>
//             <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
//               <CardTitle className="text-sm font-medium">
//                 Total Players
//               </CardTitle>
//               <Users className="h-4 w-4 text-muted-foreground" />
//             </CardHeader>
//             <CardContent>
//               <div className="text-2xl font-bold">
//                 {dashboardStats.totalPlayers}
//               </div>
//               <p className="text-xs text-muted-foreground">
//                 +{dashboardStats.newPlayersThisMonth} from last month
//               </p>
//             </CardContent>
//           </Card>
//           <Card>
//             <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
//               <CardTitle className="text-sm font-medium">Revenue</CardTitle>
//               <TrendingUp className="h-4 w-4 text-muted-foreground" />
//             </CardHeader>
//             <CardContent>
//               <div className="text-2xl font-bold">
//                 ${dashboardStats.totalRevenue}
//               </div>
//               <p className="text-xs text-muted-foreground">
//                 +{dashboardStats.revenueGrowth}% from last month
//               </p>
//             </CardContent>
//           </Card>
//         </div>
//       ) : null}

//       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
//         <Card>
//           <CardHeader>
//             <CardTitle>Tournament Management</CardTitle>
//           </CardHeader>
//           <CardContent>
//             <Button asChild className="w-full mb-2">
//               <Link href="/admin/tournaments/create">
//                 Create New Tournament
//               </Link>
//             </Button>
//             <Button asChild className="w-full">
//               <Link href="/admin/tournaments">View All Tournaments</Link>
//             </Button>
//           </CardContent>
//         </Card>

//         <Card>
//           <CardHeader>
//             <CardTitle>Leaderboards</CardTitle>
//           </CardHeader>
//           <CardContent>
//             <Button asChild className="w-full mb-2">
//               <Link href="/admin/leaderboards/create">Create Leaderboard</Link>
//             </Button>
//             <Button asChild className="w-full">
//               <Link href="/admin/leaderboards">Edit Leaderboards</Link>
//             </Button>
//           </CardContent>
//         </Card>

//         <Card>
//           <CardHeader>
//             <CardTitle>News & Announcements</CardTitle>
//           </CardHeader>
//           <CardContent>
//             <Button asChild className="w-full mb-2">
//               <Link href="/admin/news/create">Create Announcement</Link>
//             </Button>
//             <Button asChild className="w-full">
//               <Link href="/admin/news">Manage News</Link>
//             </Button>
//           </CardContent>
//         </Card>

//         <Card>
//           <CardHeader>
//             <CardTitle>Team & Player Management</CardTitle>
//           </CardHeader>
//           <CardContent>
//             <Button asChild className="w-full mb-2">
//               <Link href="/admin/teams">Manage Teams</Link>
//             </Button>
//             <Button asChild className="w-full">
//               <Link href="/admin/players">Manage Players</Link>
//             </Button>
//           </CardContent>
//         </Card>

//         <Card>
//           <CardHeader>
//             <CardTitle>Rankings & Tiers</CardTitle>
//           </CardHeader>
//           <CardContent>
//             <Button asChild className="w-full mb-2">
//               <Link href="/admin/rankings">Manage Rankings</Link>
//             </Button>
//             <Button asChild className="w-full">
//               <Link href="/admin/tiers">Manage Tiers</Link>
//             </Button>
//           </CardContent>
//         </Card>

//         <Card>
//           <CardHeader>
//             <CardTitle>Match Results</CardTitle>
//           </CardHeader>
//           <CardContent>
//             <Button asChild className="w-full">
//               <Link href="/admin/match-results">Upload Match Results</Link>
//             </Button>
//           </CardContent>
//         </Card>

//         <Card>
//           <CardHeader>
//             <CardTitle>Shop Management</CardTitle>
//           </CardHeader>
//           <CardContent>
//             <Button asChild className="w-full">
//               <Link href="/admin/shop">
//                 <ShoppingCart className="mr-2 h-4 w-4" />
//                 Manage Shop
//               </Link>
//             </Button>
//           </CardContent>
//         </Card>

//         <Card>
//           <CardHeader>
//             <CardTitle>Admin History</CardTitle>
//           </CardHeader>
//           <CardContent>
//             <Button asChild className="w-full">
//               <Link href="/admin/history">
//                 <History className="mr-2 h-4 w-4" />
//                 View Action History
//               </Link>
//             </Button>
//           </CardContent>
//         </Card>
//       </div>
//       <Card>
//         <CardHeader>
//           <CardTitle>Recent Activities</CardTitle>
//         </CardHeader>
//         <CardContent>
//           {activitiesLoading ? (
//             <div className="flex items-center justify-center py-8">
//               <Loader2 className="h-8 w-8 animate-spin" />
//               <span className="ml-2">Loading activities...</span>
//             </div>
//           ) : activitiesError ? (
//             <div className="flex items-center justify-center py-8 text-red-500">
//               <AlertCircle className="h-8 w-8" />
//               <span className="ml-2">
//                 Error loading activities: {activitiesError}
//               </span>
//             </div>
//           ) : (
//             <>
//               <Table>
//                 <TableHeader>
//                   <TableRow>
//                     <TableHead>User</TableHead>
//                     <TableHead>Action</TableHead>
//                     <TableHead>Timestamp</TableHead>
//                   </TableRow>
//                 </TableHeader>
//                 <TableBody>
//                   {recentActivities && recentActivities.length > 0 ? (
//                     recentActivities.map((activity: any) => (
//                       <TableRow key={activity.id}>
//                         <TableCell>
//                           {activity.user?.username ||
//                             activity.user?.name ||
//                             "Unknown"}
//                         </TableCell>
//                         <TableCell>{activity.action}</TableCell>
//                         <TableCell>
//                           {new Date(
//                             activity.timestamp || activity.createdAt
//                           ).toLocaleString()}
//                         </TableCell>
//                       </TableRow>
//                     ))
//                   ) : (
//                     <TableRow>
//                       <TableCell
//                         colSpan={3}
//                         className="text-center py-8 text-muted-foreground"
//                       >
//                         No recent activities found
//                       </TableCell>
//                     </TableRow>
//                   )}
//                 </TableBody>
//               </Table>
//               <div className="mt-4 text-right">
//                 <Button asChild variant="outline">
//                   <Link href="/admin/history">
//                     View All Activities <ArrowRight className="ml-2 h-4 w-4" />
//                   </Link>
//                 </Button>
//               </div>
//             </>
//           )}
//         </CardContent>
//       </Card>
//     </div>
//   );
// };

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import AdminLayout from "@/components/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import Link from "next/link";
import {
  ArrowRight,
  Users,
  UserPlus,
  Shield,
  Trophy,
  Swords,
  Newspaper,
  ShoppingCart,
  Diamond,
  TrendingUp,
  Calendar,
  Star,
  Activity,
} from "lucide-react";

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

// Mock function to fetch recent activities
const fetchRecentActivities = async () => {
  // In a real app, this would be an API call
  return [
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
};

export function Dashboard() {
  const router = useRouter();
  const [metrics, setMetrics] = useState(null);
  const [recentActivities, setRecentActivities] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const websiteMetrics = await fetchWebsiteMetrics();
        const activities = await fetchRecentActivities();
        setMetrics(websiteMetrics);
        setRecentActivities(activities);
      } catch (error) {
        console.error("Error loading dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  if (loading) {
    return (
      <AdminLayout>
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center h-64">
            <div className="text-lg">Loading dashboard metrics...</div>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Activity className="h-4 w-4" />
          <span>Last updated: {new Date().toLocaleString()}</span>
        </div>
      </div>

      {/* Main Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* Members Metrics */}
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Members</CardTitle>
            <Users className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics?.totalMembers?.toLocaleString()}
            </div>
            <div className="flex items-center gap-2 mt-2">
              <div className="flex items-center gap-1 text-sm text-green-600">
                <TrendingUp className="h-3 w-3" />+
                {metrics?.newMembersThisMonth} this month
              </div>
            </div>
            <Button asChild className="w-full mt-3" size="sm">
              <Link href="/admin/players">
                <UserPlus className="mr-2 h-4 w-4" />
                Manage Members
              </Link>
            </Button>
          </CardContent>
        </Card>

        {/* Teams Metrics */}
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Teams</CardTitle>
            <Shield className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics?.totalTeams?.toLocaleString()}
            </div>
            <div className="flex items-center gap-2 mt-2">
              <div className="flex items-center gap-1 text-sm text-green-600">
                <TrendingUp className="h-3 w-3" />+{metrics?.newTeamsThisMonth}{" "}
                this month
              </div>
            </div>
            <Button asChild className="w-full mt-3" size="sm">
              <Link href="/admin/teams">
                <Shield className="mr-2 h-4 w-4" />
                Manage Teams
              </Link>
            </Button>
          </CardContent>
        </Card>

        {/* Tournaments Metrics */}
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tournaments</CardTitle>
            <Trophy className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics?.totalTournaments}
            </div>
            <div className="flex items-center gap-2 mt-2">
              <div className="flex items-center gap-1 text-sm text-blue-600">
                <Calendar className="h-3 w-3" />
                {metrics?.activeTournaments} active
              </div>
            </div>
            <Button asChild className="w-full mt-3" size="sm">
              <Link href="/admin/events">
                <Trophy className="mr-2 h-4 w-4" />
                Manage Tournaments
              </Link>
            </Button>
          </CardContent>
        </Card>

        {/* Scrims Metrics */}
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Scrims</CardTitle>
            <Swords className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics?.totalScrims?.toLocaleString()}
            </div>
            <div className="flex items-center gap-2 mt-2">
              <div className="flex items-center gap-1 text-sm text-orange-600">
                <Activity className="h-3 w-3" />
                {metrics?.activeScrims} active
              </div>
            </div>
            <Button asChild className="w-full mt-3" size="sm">
              <Link href="/admin/events">
                <Swords className="mr-2 h-4 w-4" />
                Manage Scrims
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Secondary Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {/* News Metrics */}
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              News & Announcements
            </CardTitle>
            <Newspaper className="h-4 w-4 text-indigo-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.totalNews}</div>
            <div className="text-sm text-muted-foreground mt-1">
              {metrics?.publishedNews} published
            </div>
            <Button asChild className="w-full mt-3" size="sm">
              <Link href="/admin/news">
                <Newspaper className="mr-2 h-4 w-4" />
                Manage News
              </Link>
            </Button>
          </CardContent>
        </Card>

        {/* Shop Metrics */}
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Diamond Bundles
            </CardTitle>
            <Diamond className="h-4 w-4 text-cyan-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics?.diamondBundlesSold?.toLocaleString()}
            </div>
            <div className="text-sm text-muted-foreground mt-1">
              Top: {metrics?.topSellingBundle}
            </div>
            <Button asChild className="w-full mt-3" size="sm">
              <Link href="/admin/shop">
                <ShoppingCart className="mr-2 h-4 w-4" />
                Manage Shop
              </Link>
            </Button>
          </CardContent>
        </Card>

        {/* Revenue Metrics */}
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <Star className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ₦{metrics?.totalRevenue?.toLocaleString()}
            </div>
            <div className="text-sm text-muted-foreground mt-1">
              ₦{metrics?.diamondBundlesRevenue?.toLocaleString()} from diamonds
            </div>
            <Button asChild className="w-full mt-3" size="sm">
              <Link href="/admin/shop/orders">
                <TrendingUp className="mr-2 h-4 w-4" />
                View Orders
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Button asChild className="h-auto p-4">
          <Link
            href="/admin/leaderboards/create"
            className="flex flex-col items-center gap-2"
          >
            <Trophy className="h-6 w-6" />
            <span>Create Leaderboard</span>
          </Link>
        </Button>

        <Button asChild variant="outline" className="h-auto p-4 bg-transparent">
          <Link
            href="/admin/news/create"
            className="flex flex-col items-center gap-2"
          >
            <Newspaper className="h-6 w-6" />
            <span>Create News</span>
          </Link>
        </Button>

        <Button asChild variant="outline" className="h-auto p-4 bg-transparent">
          <Link
            href="/admin/events/create"
            className="flex flex-col items-center gap-2"
          >
            <Calendar className="h-6 w-6" />
            <span>Create Event</span>
          </Link>
        </Button>

        <Button asChild variant="outline" className="h-auto p-4 bg-transparent">
          <Link
            href="/admin/rankings"
            className="flex flex-col items-center gap-2"
          >
            <Star className="h-6 w-6" />
            <span>Manage Rankings</span>
          </Link>
        </Button>
      </div>

      {/* Recent Activities */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
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
            <TableBody>
              {recentActivities.map((activity) => (
                <TableRow key={activity.id}>
                  <TableCell className="font-medium">{activity.user}</TableCell>
                  <TableCell>{activity.action}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {activity.timestamp}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="mt-4 text-right">
            <Button asChild variant="outline">
              <Link href="/admin/history">
                View All Activities <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
