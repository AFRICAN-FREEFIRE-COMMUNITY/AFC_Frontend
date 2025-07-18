"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import Layout from "@/components/Layout";
import { PageHeader } from "@/components/PageHeader";
import { Trophy, Users, Calendar, BarChart2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/contexts/AuthContext";
import { HomeBoxes } from "./_components/HomeBoxes";

// Mock data for news items
const newsItems = [
	{
		id: 1,
		title: "New Tournament Series Announced",
		excerpt:
			"AFC is proud to announce the launch of the 'African Freefire Masters' tournament series, starting next month.",
		date: "2023-07-01",
	},
	{
		id: 2,
		title: "Team Rankings Updated",
		excerpt:
			"The latest team rankings have been released. Check out the Leaderboards to see where your team stands!",
		date: "2023-06-28",
	},
	{
		id: 3,
		title: "Shop Update: New Skins Available",
		excerpt:
			"Exciting new character and weapon skins are now available in the shop. Limited time offer!",
		date: "2023-06-25",
	},
];

// Mock data for shop items
const shopItems = [
	{
		id: 1,
		name: "Golden Dragon AK",
		price: 1000,
		image: "/placeholder.svg?height=100&width=100",
	},
	{
		id: 2,
		name: "Ninja Outfit",
		price: 800,
		image: "/placeholder.svg?height=100&width=100",
	},
	{
		id: 3,
		name: "Legendary Emote: Victory Dance",
		price: 500,
		image: "/placeholder.svg?height=100&width=100",
	},
];

export default function HomePage() {
	const [activeTab, setActiveTab] = useState("rankings");

	return (
		<Layout>
			<div className="container mx-auto px-4">
				<PageHeader
					title="Welcome to AFC DATABASE"
					description="Your hub for African Freefire community stats and events"
				/>

				<HomeBoxes />

				<div className="grid gap-8 md:grid-cols-2 mb-8">
					<Card>
						<CardHeader>
							<CardTitle>Latest News & Updates</CardTitle>
						</CardHeader>
						<CardContent>
							<ul className="space-y-4">
								{newsItems.map((item) => (
									<li
										key={item.id}
										className="border-b pb-4 last:border-b-0 last:pb-0"
									>
										<h3 className="font-semibold">
											{item.title}
										</h3>
										<p className="text-sm text-muted-foreground mb-1">
											{item.excerpt}
										</p>
										<span className="text-xs text-muted-foreground">
											{item.date}
										</span>
									</li>
								))}
							</ul>
							<Button asChild className="mt-4 w-full">
								<Link href="/news">View All News</Link>
							</Button>
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<CardTitle>Featured Shop Items</CardTitle>
						</CardHeader>
						<CardContent>
							<ul className="space-y-4">
								{shopItems.map((item) => (
									<li
										key={item.id}
										className="flex items-center space-x-4 border-b pb-4 last:border-b-0 last:pb-0"
									>
										<Image
											src={
												item.image || "/placeholder.svg"
											}
											alt={item.name}
											width={50}
											height={50}
											className="rounded"
										/>
										<div className="flex-grow">
											<h3 className="font-semibold">
												{item.name}
											</h3>
											<p className="text-sm text-muted-foreground">
												{item.price} Diamonds
											</p>
										</div>
										<Button
											variant="outline"
											size="sm"
											asChild
										>
											<Link href={`/shop/${item.id}`}>
												View{" "}
												<ExternalLink className="ml-2 h-4 w-4" />
											</Link>
										</Button>
									</li>
								))}
							</ul>
							<Button asChild className="mt-4 w-full">
								<Link href="/shop">Visit Shop</Link>
							</Button>
						</CardContent>
					</Card>
				</div>

				<Card>
					<CardHeader>
						<CardTitle>Rankings and Tiers</CardTitle>
					</CardHeader>
					<CardContent>
						<Tabs value={activeTab} onValueChange={setActiveTab}>
							<TabsList>
								<TabsTrigger value="rankings">
									Rankings
								</TabsTrigger>
								<TabsTrigger value="tiers">Tiers</TabsTrigger>
							</TabsList>
							<TabsContent value="rankings">
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead>Rank</TableHead>
											<TableHead>Team</TableHead>
											<TableHead>Points</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										<TableRow>
											<TableCell>1</TableCell>
											<TableCell>Team Alpha</TableCell>
											<TableCell>1000</TableCell>
										</TableRow>
										<TableRow>
											<TableCell>2</TableCell>
											<TableCell>Omega Force</TableCell>
											<TableCell>950</TableCell>
										</TableRow>
										<TableRow>
											<TableCell>3</TableCell>
											<TableCell>Team Gamma</TableCell>
											<TableCell>900</TableCell>
										</TableRow>
									</TableBody>
								</Table>
							</TabsContent>
							<TabsContent value="tiers">
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead>Tier</TableHead>
											<TableHead>Team</TableHead>
											<TableHead>Points</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										<TableRow>
											<TableCell>Tier 1</TableCell>
											<TableCell>Team Alpha</TableCell>
											<TableCell>75</TableCell>
										</TableRow>
										<TableRow>
											<TableCell>Tier 1</TableCell>
											<TableCell>Omega Force</TableCell>
											<TableCell>72</TableCell>
										</TableRow>
										<TableRow>
											<TableCell>Tier 2</TableCell>
											<TableCell>Team Gamma</TableCell>
											<TableCell>68</TableCell>
										</TableRow>
									</TableBody>
								</Table>
							</TabsContent>
						</Tabs>
					</CardContent>
				</Card>
			</div>
		</Layout>
	);
}
