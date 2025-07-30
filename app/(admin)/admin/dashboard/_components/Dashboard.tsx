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
import { ArrowRight, ShoppingCart, History } from "lucide-react";

// Mock function to fetch recent activities
const fetchRecentActivities = async () => {
	// In a real app, this would be an API call
	return [
		{
			id: 1,
			user: "John Doe",
			action: "Updated tournament results",
			timestamp: "2023-07-01 14:30",
		},
		{
			id: 2,
			user: "Jane Smith",
			action: "Created new announcement",
			timestamp: "2023-07-01 13:15",
		},
		{
			id: 3,
			user: "Mike Johnson",
			action: "Banned player #12345",
			timestamp: "2023-07-01 11:45",
		},
	];
};

// Mock function to fetch shop items
const fetchShopItems = async () => {
	// In a real app, this would be an API call
	return [
		{ id: 1, name: "100 Diamonds", price: 1250, stock: 1000 },
		{ id: 2, name: "500 Diamonds", price: 6000, stock: 500 },
		{ id: 3, name: "1000 Diamonds", price: 11000, stock: 250 },
	];
};

export const Dashboard = () => {
	const router = useRouter();
	const [userRole, setUserRole] = useState("moderator"); // This should be fetched from an auth context in a real app
	const [recentActivities, setRecentActivities] = useState([]);
	const [shopItems, setShopItems] = useState([]);

	useEffect(() => {
		const loadData = async () => {
			const activities: any = await fetchRecentActivities();
			const items: any = await fetchShopItems();
			setRecentActivities(activities);
			setShopItems(items);
		};
		loadData();
	}, []);
	return (
		<div className="container mx-auto px-4 py-8">
			<h1 className="text-3xl font-bold mb-8">Admin Dashboard</h1>

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
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>User</TableHead>
								<TableHead>Action</TableHead>
								<TableHead>Timestamp</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{recentActivities.map((activity: any) => (
								<TableRow key={activity.id}>
									<TableCell>{activity.user}</TableCell>
									<TableCell>{activity.action}</TableCell>
									<TableCell>{activity.timestamp}</TableCell>
								</TableRow>
							))}
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
				</CardContent>
			</Card>
		</div>
	);
};
