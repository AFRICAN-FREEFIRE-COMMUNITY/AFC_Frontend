"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowRight, ShoppingCart, History, Loader2, AlertCircle, Users, Trophy, FileText, TrendingUp } from "lucide-react";
import { useDashboardStats, useAdminHistory } from "@/hooks/useAdminApi";

export const Dashboard = () => {
	const router = useRouter();
	const [userRole, setUserRole] = useState("moderator"); // This should be fetched from an auth context in a real app
	
	// Use API hooks
	const { data: dashboardStats, loading: statsLoading, error: statsError } = useDashboardStats();
	const { data: recentActivities, loading: activitiesLoading, error: activitiesError } = useAdminHistory({ limit: 5 });
	return (
		<div className="container mx-auto px-4 py-8">
			<h1 className="text-3xl font-bold mb-8">Admin Dashboard</h1>

			{/* Dashboard Stats */}
			{statsLoading ? (
				<div className="flex items-center justify-center py-8">
					<Loader2 className="h-8 w-8 animate-spin" />
					<span className="ml-2">Loading dashboard stats...</span>
				</div>
			) : statsError ? (
				<div className="flex items-center justify-center py-8 text-red-500">
					<AlertCircle className="h-8 w-8" />
					<span className="ml-2">Error loading stats: {statsError}</span>
				</div>
			) : dashboardStats ? (
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
					<Card>
						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
							<CardTitle className="text-sm font-medium">Total Teams</CardTitle>
							<Users className="h-4 w-4 text-muted-foreground" />
						</CardHeader>
						<CardContent>
							<div className="text-2xl font-bold">{dashboardStats.totalTeams}</div>
							<p className="text-xs text-muted-foreground">
								+{dashboardStats.newTeamsThisMonth} from last month
							</p>
						</CardContent>
					</Card>
					<Card>
						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
							<CardTitle className="text-sm font-medium">Active Events</CardTitle>
							<Trophy className="h-4 w-4 text-muted-foreground" />
						</CardHeader>
						<CardContent>
							<div className="text-2xl font-bold">{dashboardStats.activeEvents}</div>
							<p className="text-xs text-muted-foreground">
								{dashboardStats.upcomingEvents} upcoming
							</p>
						</CardContent>
					</Card>
					<Card>
						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
							<CardTitle className="text-sm font-medium">Total Players</CardTitle>
							<Users className="h-4 w-4 text-muted-foreground" />
						</CardHeader>
						<CardContent>
							<div className="text-2xl font-bold">{dashboardStats.totalPlayers}</div>
							<p className="text-xs text-muted-foreground">
								+{dashboardStats.newPlayersThisMonth} from last month
							</p>
						</CardContent>
					</Card>
					<Card>
						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
							<CardTitle className="text-sm font-medium">Revenue</CardTitle>
							<TrendingUp className="h-4 w-4 text-muted-foreground" />
						</CardHeader>
						<CardContent>
							<div className="text-2xl font-bold">${dashboardStats.totalRevenue}</div>
							<p className="text-xs text-muted-foreground">
								+{dashboardStats.revenueGrowth}% from last month
							</p>
						</CardContent>
					</Card>
				</div>
			) : null}

			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
				<Card>
					<CardHeader>
						<CardTitle>Tournament Management</CardTitle>
					</CardHeader>
					<CardContent>
						<Button asChild className="w-full mb-2">
							<Link href="/admin/tournaments/create">
								Create New Tournament
							</Link>
						</Button>
						<Button asChild className="w-full">
							<Link href="/admin/tournaments">
								View All Tournaments
							</Link>
						</Button>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle>Leaderboards</CardTitle>
					</CardHeader>
					<CardContent>
						<Button asChild className="w-full mb-2">
							<Link href="/admin/leaderboards/create">
								Create Leaderboard
							</Link>
						</Button>
						<Button asChild className="w-full">
							<Link href="/admin/leaderboards">
								Edit Leaderboards
							</Link>
						</Button>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle>News & Announcements</CardTitle>
					</CardHeader>
					<CardContent>
						<Button asChild className="w-full mb-2">
							<Link href="/admin/news/create">
								Create Announcement
							</Link>
						</Button>
						<Button asChild className="w-full">
							<Link href="/admin/news">Manage News</Link>
						</Button>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle>Team & Player Management</CardTitle>
					</CardHeader>
					<CardContent>
						<Button asChild className="w-full mb-2">
							<Link href="/admin/teams">Manage Teams</Link>
						</Button>
						<Button asChild className="w-full">
							<Link href="/admin/players">Manage Players</Link>
						</Button>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle>Rankings & Tiers</CardTitle>
					</CardHeader>
					<CardContent>
						<Button asChild className="w-full mb-2">
							<Link href="/admin/rankings">Manage Rankings</Link>
						</Button>
						<Button asChild className="w-full">
							<Link href="/admin/tiers">Manage Tiers</Link>
						</Button>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle>Match Results</CardTitle>
					</CardHeader>
					<CardContent>
						<Button asChild className="w-full">
							<Link href="/admin/match-results">
								Upload Match Results
							</Link>
						</Button>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle>Shop Management</CardTitle>
					</CardHeader>
					<CardContent>
						<Button asChild className="w-full">
							<Link href="/admin/shop">
								<ShoppingCart className="mr-2 h-4 w-4" />
								Manage Shop
							</Link>
						</Button>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle>Admin History</CardTitle>
					</CardHeader>
					<CardContent>
						<Button asChild className="w-full">
							<Link href="/admin/history">
								<History className="mr-2 h-4 w-4" />
								View Action History
							</Link>
						</Button>
					</CardContent>
				</Card>
			</div>

			<Card>
				<CardHeader>
					<CardTitle>Recent Activities</CardTitle>
				</CardHeader>
				<CardContent>
					{activitiesLoading ? (
						<div className="flex items-center justify-center py-8">
							<Loader2 className="h-8 w-8 animate-spin" />
							<span className="ml-2">Loading activities...</span>
						</div>
					) : activitiesError ? (
						<div className="flex items-center justify-center py-8 text-red-500">
							<AlertCircle className="h-8 w-8" />
							<span className="ml-2">Error loading activities: {activitiesError}</span>
						</div>
					) : (
						<>
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>User</TableHead>
										<TableHead>Action</TableHead>
										<TableHead>Timestamp</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{recentActivities && recentActivities.length > 0 ? (
										recentActivities.map((activity: any) => (
											<TableRow key={activity.id}>
												<TableCell>{activity.user?.username || activity.user?.name || 'Unknown'}</TableCell>
												<TableCell>{activity.action}</TableCell>
												<TableCell>
													{new Date(activity.timestamp || activity.createdAt).toLocaleString()}
												</TableCell>
											</TableRow>
										))
									) : (
										<TableRow>
											<TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
												No recent activities found
											</TableCell>
										</TableRow>
									)}
								</TableBody>
							</Table>
							<div className="mt-4 text-right">
								<Button asChild variant="outline">
									<Link href="/admin/history">
										View All Activities{" "}
										<ArrowRight className="ml-2 h-4 w-4" />
									</Link>
								</Button>
							</div>
						</>
					)}
				</CardContent>
			</Card>
		</div>
	);
};
