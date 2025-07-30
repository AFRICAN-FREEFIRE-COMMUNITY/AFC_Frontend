"use client";

import { useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import Link from "next/link";
import { Checkbox } from "@/components/ui/checkbox";
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
import { useToast } from "@/components/ui/use-toast";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { DatePickerWithRange } from "@/components/ui/date-picker-with-range";
import { addDays } from "date-fns";

export const Teams = () => {
	const [searchTerm, setSearchTerm] = useState("");
	const [filterTier, setFilterTier] = useState("all");
	const [banModalOpen, setBanModalOpen] = useState(false);
	const [selectedTeam, setSelectedTeam] = useState<any>(null);
	const [banDateRange, setBanDateRange] = useState({
		from: new Date(),
		to: addDays(new Date(), 7),
	});
	const [banReasons, setBanReasons] = useState<string[]>([]);
	const [teams, setTeams] = useState<any>([]); // Added state variable
	const { toast } = useToast();
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

	// Mock data for teams (moved to useState)
	useState<any>(() => {
		setTeams([
			{
				id: 1,
				name: "Team Alpha",
				tier: 1,
				members: 5,
				totalWins: 20,
				totalEarnings: "$50,000",
				isBanned: false,
				banReason: "",
			},
			{
				id: 2,
				name: "Omega Squad",
				tier: 2,
				members: 5,
				totalWins: 15,
				totalEarnings: "$30,000",
				isBanned: true,
				banReason: "Cheating",
			},
			{
				id: 3,
				name: "Phoenix Rising",
				tier: 1,
				members: 5,
				totalWins: 18,
				totalEarnings: "$45,000",
				isBanned: false,
				banReason: "",
			},
		]);
		// @ts-ignore
	}, []);

	const filteredTeams = teams.filter(
		(team: any) =>
			team.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
			(filterTier === "all" || team.tier === Number.parseInt(filterTier))
	);

	const handleBanTeam = async () => {
		try {
			// Simulate API call to ban the team
			await new Promise((resolve) => setTimeout(resolve, 1000));

			const updatedTeams = teams.map((team: any) => {
				if (team === selectedTeam) {
					return {
						...team,
						isBanned: true,
						banReason: banReasons
							.map(
								(id) =>
									availableBanReasons.find(
										(reason) => reason.id === id
									)?.label
							)
							.join(", "),
						banStartDate: banDateRange.from,
						banEndDate: banDateRange.to,
					};
				}
				return team;
			});
			setTeams(updatedTeams);

			toast({
				title: "Team Banned",
				description: `Successfully banned ${
					selectedTeam.name
				} from ${banDateRange.from.toLocaleDateString()} to ${banDateRange.to.toLocaleDateString()}.`,
			});
		} catch (error) {
			toast({
				title: "Error",
				description: "Failed to ban the team. Please try again.",
				variant: "destructive",
			});
		} finally {
			setBanModalOpen(false);
			setSelectedTeam(null);
			setBanDateRange({ from: new Date(), to: addDays(new Date(), 7) });
			setBanReasons([]);
		}
	};

	const handleUnbanTeam = async (teamId: any) => {
		try {
			// Simulate API call to unban team
			await new Promise((resolve) => setTimeout(resolve, 1000));

			const updatedTeams = teams.map((team: any) => {
				if (team.id === teamId) {
					return { ...team, isBanned: false, banReason: "" };
				}
				return team;
			});
			setTeams(updatedTeams);

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
		}
	};

	return (
		<div className="container mx-auto px-4 py-8">
			<h1 className="text-3xl font-bold mb-8">Team Management</h1>

			<div className="flex justify-between items-center mb-6">
				<div className="flex items-center space-x-4">
					<Input
						placeholder="Search teams..."
						value={searchTerm}
						onChange={(e) => setSearchTerm(e.target.value)}
						className="w-64"
					/>
					<Select value={filterTier} onValueChange={setFilterTier}>
						<SelectTrigger className="w-40">
							<SelectValue placeholder="Filter by tier" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All Tiers</SelectItem>
							<SelectItem value="1">Tier 1</SelectItem>
							<SelectItem value="2">Tier 2</SelectItem>
							<SelectItem value="3">Tier 3</SelectItem>
						</SelectContent>
					</Select>
				</div>
			</div>

			<Card>
				<CardHeader>
					<CardTitle>Teams</CardTitle>
				</CardHeader>
				<CardContent>
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Name</TableHead>
								<TableHead>Tier</TableHead>
								<TableHead>Members</TableHead>
								<TableHead>Total Wins</TableHead>
								<TableHead>Total Earnings</TableHead>
								<TableHead>Status</TableHead>
								<TableHead>Actions</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{filteredTeams.map((team: any) => (
								<TableRow key={team.id}>
									<TableCell>{team.name}</TableCell>
									<TableCell>{team.tier}</TableCell>
									<TableCell>{team.members}</TableCell>
									<TableCell>{team.totalWins}</TableCell>
									<TableCell>{team.totalEarnings}</TableCell>
									<TableCell>
										{team.isBanned ? (
											<Badge variant="destructive">
												Banned
											</Badge>
										) : (
											<Badge variant="secondary">
												Active
											</Badge>
										)}
									</TableCell>
									<TableCell>
										<div className="flex items-center space-x-2">
											<Button
												asChild
												variant="outline"
												size="sm"
												className="mr-2"
											>
												<Link
													href={`/admin/teams/${team.id}`}
												>
													View
												</Link>
											</Button>
											<AlertDialog
												open={banModalOpen}
												onOpenChange={setBanModalOpen}
											>
												<AlertDialogTrigger asChild>
													<Button
														variant={
															team.isBanned
																? "secondary"
																: "destructive"
														}
														onClick={() => {
															setSelectedTeam(
																team
															);
															setBanModalOpen(
																true
															);
														}}
													>
														{team.isBanned
															? "Unban"
															: "Ban"}
													</Button>
												</AlertDialogTrigger>
												<AlertDialogContent>
													<AlertDialogHeader>
														<AlertDialogTitle>
															{selectedTeam?.isBanned
																? "Unban Team"
																: "Ban Team"}
														</AlertDialogTitle>
														<AlertDialogDescription>
															{selectedTeam?.isBanned
																? `Are you sure you want to unban ${selectedTeam?.name}?`
																: `Are you sure you want to ban ${selectedTeam?.name}?`}
														</AlertDialogDescription>
													</AlertDialogHeader>
													{!selectedTeam?.isBanned && (
														<div className="space-y-4 px-4 py-2">
															<div>
																<Label>
																	Ban Duration
																</Label>
																<DatePickerWithRange
																	dateRange={
																		banDateRange
																	}
																	// @ts-ignore
																	setDateRange={
																		setBanDateRange
																	}
																/>
															</div>
															<div>
																<Label>
																	Reason(s)
																	for Ban
																</Label>
																<div className="space-y-2 mt-2">
																	{availableBanReasons.map(
																		(
																			reason
																		) => (
																			<div
																				key={
																					reason.id
																				}
																				className="flex items-start space-x-2"
																			>
																				<Checkbox
																					id={
																						reason.id
																					}
																					checked={banReasons.includes(
																						reason.id
																					)}
																					onCheckedChange={(
																						checked
																					) => {
																						setBanReasons(
																							(
																								prevReasons
																							) =>
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
																						htmlFor={
																							reason.id
																						}
																						className="font-medium"
																					>
																						{
																							reason.label
																						}
																					</Label>
																					<p className="text-sm text-muted-foreground">
																						{
																							reason.description
																						}
																					</p>
																				</div>
																			</div>
																		)
																	)}
																</div>
															</div>
														</div>
													)}
													<AlertDialogFooter>
														<AlertDialogCancel>
															Cancel
														</AlertDialogCancel>
														<AlertDialogAction
															onClick={
																selectedTeam?.isBanned
																	? () =>
																			handleUnbanTeam(
																				selectedTeam.id
																			)
																	: handleBanTeam
															}
														>
															{selectedTeam?.isBanned
																? "Unban"
																: "Ban"}
														</AlertDialogAction>
													</AlertDialogFooter>
												</AlertDialogContent>
											</AlertDialog>
										</div>
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</CardContent>
			</Card>
		</div>
	);
};
