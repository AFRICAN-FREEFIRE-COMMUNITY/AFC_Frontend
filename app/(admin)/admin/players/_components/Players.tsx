"use client";

import { useState, useEffect } from "react";
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
import { Badge } from "@/components/ui/badge";
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
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { DatePickerWithRange } from "@/components/ui/date-picker-with-range";
import { addDays } from "date-fns";
import { Loader2, AlertCircle } from "lucide-react";
import { usePlayers, useApiMutation } from "@/hooks/useAdminApi";
import { playersApi } from "@/lib/api/admin";

export const Players = () => {
	const [searchTerm, setSearchTerm] = useState("");
	const [filterTeam, setFilterTeam] = useState("all");
	const [banModalOpen, setBanModalOpen] = useState(false);
	const [selectedPlayer, setSelectedPlayer] = useState<any>(null);
	const [banDateRange, setBanDateRange] = useState({
		from: new Date(),
		to: addDays(new Date(), 7),
	});
	const [banReasons, setBanReasons] = useState<string[]>([]);
	const { toast } = useToast();

	// Build filters object
	const filters = {
		...(searchTerm && { search: searchTerm }),
		...(filterTeam !== "all" && { team: filterTeam }),
	};

	// Use API hooks
	const { data: players, loading, error, refetch, pagination, changePage, updateParams } = usePlayers(filters);
	
	// Update filters when search/filter values change
	useEffect(() => {
		updateParams(filters);
	}, [searchTerm, filterTeam]);

	// Mutation hooks for ban/unban operations
	const banPlayerMutation = useApiMutation(
		({ id, reason }: { id: string; reason: string }) => playersApi.ban(id, reason),
		{
			onSuccess: () => {
				refetch();
				setBanModalOpen(false);
				setSelectedPlayer(null);
				setBanDateRange({ from: new Date(), to: addDays(new Date(), 7) });
				setBanReasons([]);
				toast({
					title: "Player Banned",
					description: `Successfully banned ${selectedPlayer?.name}.`,
				});
			},
			onError: (error: any) => {
				toast({
					title: "Error",
					description: "Failed to ban the player. Please try again.",
					variant: "destructive",
				});
			},
		}
	);

	const unbanPlayerMutation = useApiMutation(playersApi.unban, {
		onSuccess: () => {
			refetch();
			setBanModalOpen(false);
			setSelectedPlayer(null);
			toast({
				title: "Player Unbanned",
				description: "Successfully unbanned the player.",
			});
		},
		onError: (error: any) => {
			toast({
				title: "Error",
				description: "Failed to unban the player. Please try again.",
				variant: "destructive",
			});
		},
	});

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

	const handleBanPlayer = () => {
		if (selectedPlayer && banReasons.length > 0) {
			const reasonText = banReasons
				.map((id) => availableBanReasons.find((reason) => reason.id === id)?.label)
				.join(", ");
			
			banPlayerMutation.mutate({ 
				id: selectedPlayer.id, 
				reason: reasonText 
			});
		}
	};

	const handleUnbanPlayer = (playerId: string) => {
		unbanPlayerMutation.mutate(playerId);
	};

	return (
		<div className="container mx-auto px-4 py-8">
			<h1 className="text-3xl font-bold mb-8">Player Management</h1>

			<div className="flex justify-between items-center mb-6">
				<div className="flex items-center space-x-4">
					<Input
						placeholder="Search players..."
						value={searchTerm}
						onChange={(e) => setSearchTerm(e.target.value)}
						className="w-64"
					/>
					<Select value={filterTeam} onValueChange={setFilterTeam}>
						<SelectTrigger className="w-40">
							<SelectValue placeholder="Filter by team" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All Teams</SelectItem>
							{/* Replace with actual teams from your data */}
							<SelectItem value="Team Alpha">
								Team Alpha
							</SelectItem>
							<SelectItem value="Omega Squad">
								Omega Squad
							</SelectItem>
							<SelectItem value="Phoenix Rising">
								Phoenix Rising
							</SelectItem>
						</SelectContent>
					</Select>
				</div>
			</div>

			<Card>
				<CardHeader>
					<CardTitle>Players</CardTitle>
				</CardHeader>
				<CardContent>
					{loading ? (
						<div className="flex items-center justify-center py-8">
							<Loader2 className="h-8 w-8 animate-spin" />
							<span className="ml-2">Loading players...</span>
						</div>
					) : error ? (
						<div className="flex items-center justify-center py-8 text-red-500">
							<AlertCircle className="h-8 w-8 mr-2" />
							<span>Error loading players: {typeof error === 'string' ? error : 'An error occurred'}</span>
						</div>
					) : (
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Name</TableHead>
									<TableHead>Team</TableHead>
									<TableHead>Kills</TableHead>
									<TableHead>Wins</TableHead>
									<TableHead>MVPs</TableHead>
									<TableHead>Status</TableHead>
									<TableHead>Actions</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{players?.map((player: any) => (
									<TableRow key={player.id}>
										<TableCell>{player.name}</TableCell>
										<TableCell>{player.team}</TableCell>
										<TableCell>{player.kills}</TableCell>
										<TableCell>{player.wins}</TableCell>
										<TableCell>{player.mvps}</TableCell>
										<TableCell>
											{player.isBanned ? (
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
														href={`/admin/players/${player.id}`}
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
																player.isBanned
																	? "secondary"
																	: "destructive"
															}
															onClick={() => {
																setSelectedPlayer(
																	player
																);
																setBanModalOpen(
																	true
																);
															}}
														>
															{player.isBanned
																? "Unban"
																: "Ban"}
														</Button>
													</AlertDialogTrigger>
													<AlertDialogContent>
														<AlertDialogHeader>
															<AlertDialogTitle>
																{selectedPlayer?.isBanned
																	? "Unban Player"
																	: "Ban Player"}
															</AlertDialogTitle>
															<AlertDialogDescription>
																{selectedPlayer?.isBanned
																	? `Are you sure you want to unban ${selectedPlayer?.name}?`
																	: `Are you sure you want to ban ${selectedPlayer?.name}?`}
															</AlertDialogDescription>
														</AlertDialogHeader>
														{!selectedPlayer?.isBanned && (
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
																	selectedPlayer?.isBanned
																		? () =>
																				handleUnbanPlayer(
																					selectedPlayer.id
																				)
																		: handleBanPlayer
																}
															>
																{selectedPlayer?.isBanned
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
								{players?.length === 0 && (
									<TableRow>
										<TableCell colSpan={7} className="text-center py-8">
											No players found.
										</TableCell>
									</TableRow>
								)}
							</TableBody>
						</Table>
					)}
				</CardContent>
			</Card>
		</div>
	);
};
