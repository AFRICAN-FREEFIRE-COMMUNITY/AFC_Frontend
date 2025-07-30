"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
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
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";

// Mock function to fetch team data (modified to include banReason)
const fetchTeamData = async (id: string) => {
	// In a real app, this would be an API call
	await new Promise((resolve) => setTimeout(resolve, 1000)); // Simulate API delay
	return {
		id,
		name: "Team Alpha",
		tier: 1,
		members: [
			{ id: "1", name: "Player 1", role: "Captain" },
			{ id: "2", name: "Player 2", role: "Fragger" },
			{ id: "3", name: "Player 3", role: "Support" },
			{ id: "4", name: "Player 4", role: "Sniper" },
			{ id: "5", name: "Player 5", role: "Flex" },
		],
		totalWins: 20,
		totalLosses: 5,
		winRate: "80%",
		totalEarnings: "$50,000",
		tournamentPerformance: [
			{ name: "Summer Showdown 2023", placement: 1, earnings: "$20,000" },
			{ name: "Fall Classic 2023", placement: 3, earnings: "$10,000" },
			{ name: "Winter Cup 2023", placement: 2, earnings: "$15,000" },
		],
		recentMatches: [
			{ opponent: "Team Beta", result: "Win", score: "13-8" },
			{ opponent: "Team Gamma", result: "Win", score: "13-10" },
			{ opponent: "Team Delta", result: "Loss", score: "10-13" },
		],
		averageKills: 45,
		averagePlacement: 2.5,
		isBanned: false,
		banReason: "", // Added banReason
	};
};

export function Team() {
	const params: any = useParams();
	const router = useRouter();
	const { toast } = useToast();
	const [teamData, setTeamData] = useState<any>(null);
	const [isLoading, setIsLoading] = useState<any>(true);
	const [banModalOpen, setBanModalOpen] = useState<any>(false);
	const [banDuration, setBanDuration] = useState<any>(7);
	const [banReasons, setBanReasons] = useState<string[]>([]);
	const availableBanReasons = [
		{
			id: "conduct",
			label: "Conduct/Toxic Behavior",
			description:
				"Repeated instances of abusive language, harassment, or unsportsmanlike conduct",
		},
		{
			id: "cheating",
			label: "Cheating",
			description:
				"Use of unauthorized software, exploits, or other forms of cheating",
		},
		{
			id: "collusion",
			label: "Collusion",
			description:
				"Cooperating with other teams or players to gain an unfair advantage",
		},
		{
			id: "account_sharing",
			label: "Account Sharing",
			description:
				"Multiple players using the same account or a player using someone else's account",
		},
		{
			id: "confidentiality",
			label: "Breach of Confidentiality",
			description:
				"Sharing confidential information about tournaments, scrims, or other teams",
		},
	];

	useEffect(() => {
		const loadTeamData = async () => {
			try {
				const data = await fetchTeamData(params.id);
				setTeamData(data);
			} catch (error) {
				console.error("Failed to load team data:", error);
			} finally {
				setIsLoading(false);
			}
		};

		loadTeamData();
	}, [params.id]);

	const handleBanTeam = async () => {
		try {
			// Simulate API call to ban the team
			await new Promise((resolve) => setTimeout(resolve, 1000));

			const banReasonString = banReasons
				.map(
					(id) =>
						availableBanReasons.find((reason) => reason.id === id)
							?.label
				)
				.join(", ");
			setTeamData((prevData: any) => ({
				...prevData,
				isBanned: true,
				banReason: banReasonString,
			})); // Update ban status and reason

			toast({
				title: "Team Banned",
				description: `Successfully banned ${teamData.name} for ${banDuration} days.`,
			});
		} catch (error) {
			toast({
				title: "Error",
				description: "Failed to ban the team. Please try again.",
				variant: "destructive",
			});
		} finally {
			setBanModalOpen(false);
			setBanDuration(7); // Reset ban duration
			setBanReasons([]); // Reset ban reasons
		}
	};

	const handleUnbanTeam = async () => {
		try {
			// Simulate API call to unban team
			await new Promise((resolve) => setTimeout(resolve, 1000));

			setTeamData((prevData: any) => ({
				...prevData,
				isBanned: false,
				banReason: "",
			}));

			toast({
				title: "Team Unbanned",
				description: "Successfully unbanned the team.",
			});
		} catch (error) {
			toast({
				title: "Error",
				description: "Failed to unban the team. Please try again.",
				variant: "destructive",
			});
		} finally {
			setBanModalOpen(false);
		}
	};

	if (isLoading) {
		return <AdminLayout>Loading team data...</AdminLayout>;
	}

	if (!teamData) {
		return <AdminLayout>Team not found</AdminLayout>;
	}

	return (
		<div className="container mx-auto px-4 py-8">
			<Button
				variant="outline"
				onClick={() => router.back()}
				className="mb-4"
			>
				<ArrowLeft className="mr-2 h-4 w-4" /> Back to Teams
			</Button>

			<div className="flex justify-between items-center mb-8">
				<h1 className="text-3xl font-bold">{teamData.name} Details</h1>
				<AlertDialog open={banModalOpen} onOpenChange={setBanModalOpen}>
					<AlertDialogTrigger asChild>
						<Button
							variant={
								teamData.isBanned ? "secondary" : "destructive"
							}
						>
							{teamData.isBanned ? "Unban" : "Ban"}
						</Button>
					</AlertDialogTrigger>
					<AlertDialogContent>
						<AlertDialogHeader>
							<AlertDialogTitle>
								{teamData.isBanned ? "Unban Team" : "Ban Team"}
							</AlertDialogTitle>
							<AlertDialogDescription>
								{teamData.isBanned
									? `Are you sure you want to unban ${teamData.name}?`
									: `Are you sure you want to ban ${teamData.name}?`}
							</AlertDialogDescription>
						</AlertDialogHeader>
						{!teamData.isBanned && (
							<div className="space-y-4 px-4 py-2">
								<div>
									<Label htmlFor="banDuration">
										Ban Duration (Days)
									</Label>
									<Input
										type="number"
										id="banDuration"
										value={banDuration}
										onChange={(e) =>
											setBanDuration(
												Number.parseInt(e.target.value)
											)
										}
										min={1}
										className="w-full"
									/>
								</div>
								<div>
									<Label>Reason(s) for Ban</Label>
									<div className="space-y-2 mt-2">
										{availableBanReasons.map((reason) => (
											<div
												key={reason.id}
												className="flex items-start space-x-2"
											>
												<Checkbox
													id={reason.id}
													checked={banReasons.includes(
														reason.id
													)}
													onCheckedChange={(
														checked
													) => {
														setBanReasons(
															(prevReasons) =>
																checked
																	? [
																			...prevReasons,
																			reason.id,
																	  ]
																	: prevReasons.filter(
																			(
																				r
																			) =>
																				r !==
																				reason.id
																	  )
														);
													}}
												/>
												<div>
													<Label
														htmlFor={reason.id}
														className="font-medium"
													>
														{reason.label}
													</Label>
													<p className="text-sm text-muted-foreground">
														{reason.description}
													</p>
												</div>
											</div>
										))}
									</div>
								</div>
							</div>
						)}
						<AlertDialogFooter>
							<AlertDialogCancel>Cancel</AlertDialogCancel>
							<AlertDialogAction
								onClick={
									teamData.isBanned
										? handleUnbanTeam
										: handleBanTeam
								}
							>
								{teamData.isBanned ? "Unban" : "Ban"}
							</AlertDialogAction>
						</AlertDialogFooter>
					</AlertDialogContent>
				</AlertDialog>
			</div>

			<div className="grid grid-cols-1 md:grid-cols-2 gap-8">
				<Card>
					<CardHeader>
						<CardTitle>Team Overview</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="space-y-2">
							<p>
								<strong>Tier:</strong> {teamData.tier}
							</p>
							<p>
								<strong>Total Wins:</strong>{" "}
								{teamData.totalWins}
							</p>
							<p>
								<strong>Total Losses:</strong>{" "}
								{teamData.totalLosses}
							</p>
							<p>
								<strong>Win Rate:</strong> {teamData.winRate}
							</p>
							<p>
								<strong>Total Earnings:</strong>{" "}
								{teamData.totalEarnings}
							</p>
							<p>
								<strong>Average Kills:</strong>{" "}
								{teamData.averageKills}
							</p>
							<p>
								<strong>Average Placement:</strong>{" "}
								{teamData.averagePlacement}
							</p>
							<div>
								<p>
									<strong>Status:</strong>
								</p>
								{teamData.isBanned ? (
									<Badge variant="destructive">Banned</Badge>
								) : (
									<Badge variant="secondary">Active</Badge>
								)}
							</div>
							{teamData.isBanned && (
								<p>
									<strong>Ban Reason:</strong>{" "}
									{teamData.banReason}
								</p>
							)}
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle>Team Members</CardTitle>
					</CardHeader>
					<CardContent>
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Name</TableHead>
									<TableHead>Role</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{teamData.members.map((member: any) => (
									<TableRow key={member.id}>
										<TableCell>{member.name}</TableCell>
										<TableCell>{member.role}</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle>Tournament Performance</CardTitle>
					</CardHeader>
					<CardContent>
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Tournament</TableHead>
									<TableHead>Placement</TableHead>
									<TableHead>Earnings</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{teamData.tournamentPerformance.map(
									(tournament: any, index: any) => (
										<TableRow key={index}>
											<TableCell>
												{tournament.name}
											</TableCell>
											<TableCell>
												{tournament.placement}
											</TableCell>
											<TableCell>
												{tournament.earnings}
											</TableCell>
										</TableRow>
									)
								)}
							</TableBody>
						</Table>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle>Recent Matches</CardTitle>
					</CardHeader>
					<CardContent>
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Opponent</TableHead>
									<TableHead>Result</TableHead>
									<TableHead>Score</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{teamData.recentMatches.map(
									(match: any, index: any) => (
										<TableRow key={index}>
											<TableCell>
												{match.opponent}
											</TableCell>
											<TableCell>
												{match.result}
											</TableCell>
											<TableCell>{match.score}</TableCell>
										</TableRow>
									)
								)}
							</TableBody>
						</Table>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
