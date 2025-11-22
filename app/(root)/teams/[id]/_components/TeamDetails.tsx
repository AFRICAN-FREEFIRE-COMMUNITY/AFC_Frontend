"use client";

import { useState, useEffect, useTransition } from "react";
import { useParams, useRouter } from "next/navigation";
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Facebook,
  Twitter,
  Instagram,
  UserPlus,
  LinkIcon,
  Edit,
  Users,
  Youtube,
  Twitch,
  AlertTriangle,
  Search,
  LogOut,
} from "lucide-react";
import Link from "next/link";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { DatePickerWithRange } from "@/components/ui/date-picker-with-range";
import { addDays } from "date-fns";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import axios from "axios";
import { env } from "@/lib/env";
import { FullLoader, Loader } from "@/components/Loader";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { formatRole } from "@/lib/utils";

const FormSchema = z.object({
  new_owner_ign: z.string({
    required_error: "Please select a new owner.",
  }),
});

// Mock data for a team
const teamData = {
  id: "1",
  name: "Team Alpha",
  logo: "/team-alpha-logo.png",
  joinSetting: "request",
  isBanned: false,
  banReason: "",
  tier: 1,
  members: [
    {
      id: "1",
      name: "John Doe",
      inGameRole: "rusher",
      managementRole: "Team Owner",
    },
    {
      id: "2",
      name: "Jane Smith",
      inGameRole: "grenade",
      managementRole: "Team Captain",
    },
    { id: "3", name: "Bob Johnson", inGameRole: "sniper", managementRole: "" },
  ],
  stats: {
    totalKills: 1500,
    scrimWins: 30,
    tournamentWins: 5,
    tier1TournamentsPlayed: 3,
    tier2TournamentsPlayed: 5,
    tier3TournamentsPlayed: 10,
    scrimsPlayed: 50,
    tournamentsPlayed: 15,
    totalEarnings: 10000,
  },
  socialMediaLinks: [
    { platform: "facebook", link: "https://facebook.com/teamalpha" },
    { platform: "twitter", link: "https://twitter.com/teamalpha" },
    { platform: "instagram", link: "https://instagram.com/teamalpha" },
  ],
  performanceHistory: [
    { month: "Jan", kills: 200, wins: 3 },
    { month: "Feb", kills: 250, wins: 4 },
    { month: "Mar", kills: 300, wins: 5 },
    { month: "Apr", kills: 280, wins: 4 },
    { month: "May", kills: 350, wins: 6 },
    { month: "Jun", kills: 400, wins: 7 },
  ],
  joinRequests: [
    { id: "1", name: "Alice Johnson", uid: "123456" },
    { id: "2", name: "Bob Williams", uid: "234567" },
    { id: "3", name: "Charlie Brown", uid: "345678" },
  ],
  creatorId: "1",
  country: "Nigeria",
  creationDate: "2023-01-15",
};

export const TeamDetails = ({ id }: { id: string }) => {
  const params = useParams();
  const router = useRouter();
  const [team, setTeam] = useState(teamData);
  const [inviteLink, setInviteLink] = useState("");
  const [dateRange, setDateRange] = useState({
    from: addDays(new Date(), -30),
    to: new Date(),
  });
  const [eventFilter, setEventFilter] = useState("all");
  const [selectedEvent, setSelectedEvent] = useState("");
  const [isTeamCreator, setIsTeamCreator] = useState(false);
  const [hasFullAccess, setHasFullAccess] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [newMemberSearch, setNewMemberSearch] = useState("");

  const [pending, startTransition] = useTransition();
  const [pendingRequest, startRequestTransition] = useTransition();
  const [pendingApproveRequest, startApproveRequestTransition] =
    useTransition();
  const [pendingDenyRequest, startDenyRequestTransition] = useTransition();
  const [pendingInvite, startInviteTransition] = useTransition();
  const [pendingDisbanded, startDisbandTransition] = useTransition();
  const [pendingTransfer, startTransferTransition] = useTransition();
  const [pendingExit, startExitTransition] = useTransition();
  const [teamDetails, setTeamDetails] = useState<any>();
  const [joinRequests, setJoinRequests] = useState<any>();

  const { user, token } = useAuth();
  const isAdmin = user?.role === "admin";

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
  });

  useEffect(() => {
    if (!id) return; // Don't run if id is not available yet

    startTransition(async () => {
      try {
        const decodedId = decodeURIComponent(id);
        const res = await axios.post(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/team/get-team-details/`,
          { team_name: decodedId }
        );
        const requestResponse = await axios.post(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/team/view-join-requests-for-a-team/`,
          { team_id: res.data.team.team_id }
        );
        setTeamDetails(res.data.team);
        setIsTeamCreator(res.data.team.team_creator === user?.in_game_name);

        // Determine who has full access to team controls
        const teamOwner = res.data.team.team_owner;
        const teamCreator = res.data.team.team_creator;

        // If there's a team_owner, only the team_owner has full access
        // If there's no team_owner (null), the team_creator has full access
        if (teamOwner) {
          setHasFullAccess(teamOwner === user?.in_game_name);
        } else {
          setHasFullAccess(teamCreator === user?.in_game_name);
        }

        setJoinRequests(requestResponse.data.join_requests);
      } catch (error: any) {
        toast.error(error.response.data.message);
      }
    });
  }, [id]);

  // inside your component after you fetch teamDetails
  const isMember = teamDetails?.members?.some(
    (member: any) => member.username === user?.in_game_name
  );

  const handleJoinTeam = () => {
    startRequestTransition(async () => {
      try {
        const res = await axios.post(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/team/send-join-request/`,
          { team_id: teamDetails.team_id, message: "" },
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        toast.success(res.data.message);
      } catch (error: any) {
        toast.error(error.response.data.message);
      }
    });
  };

  const [pendingGenerateLink, startGenerateLinkTransition] = useTransition();

  const handleGenerateInviteLink = () => {
    startGenerateLinkTransition(async () => {
      try {
        const response = await axios.post(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/team/generate-invite-link/`,
          { team_id: teamDetails.team_id },
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        setInviteLink(response.data.invite_link);
        toast.success("Invite link generated successfully!");
      } catch (error: any) {
        toast.error(
          error?.response?.data?.message || "Failed to generate invite link"
        );
      }
    });
  };

  const handleCopyInviteLink = () => {
    navigator.clipboard.writeText(inviteLink);
    toast.success("Invite link copied to your clipboard. ");
  };

  const handleApproveJoinRequest = (requestId: string) => {
    // In a real app, you would make an API call to approve the request
    startApproveRequestTransition(async () => {
      try {
        const res = await axios.post(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/team/review-join-request/`,
          { request_id: requestId, decision: "approved" },
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        toast.success(res.data.message);
        router.refresh();
      } catch (error: any) {
        error;
        toast.error(error.response.data.message);
      }
    });

    // toast({
    //   title: "Join request approved",
    //   description: "The player has been added to your team.",
    // });
  };

  const handleDenyJoinRequest = (requestId: string) => {
    // In a real app, you would make an API call to approve the request
    startDenyRequestTransition(async () => {
      try {
        const res = await axios.post(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/team/review-join-request/`,
          { request_id: requestId, decision: "denied" },
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        toast.success(res.data.message);
        router.refresh();
      } catch (error: any) {
        toast.error(error.response.data.message);
      }
    });
  };

  const handleAddNewMember = () => {
    if (!newMemberSearch)
      return toast.error("Please enter UID or in-game-name or email");
    if (team.members.length >= 6) {
      toast.error("Team is full");
    }

    startInviteTransition(async () => {
      try {
        const res = await axios.post(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/team/invite-member/`,
          {
            team_id: teamDetails.team_id,
            invitee_email_or_ign: newMemberSearch,
          },
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        toast.success(res.data.message);
        setNewMemberSearch("");
      } catch (error: any) {
        toast.error(error.response.data.message);
      }
    });
  };

  const handleBanStatusChange = async (newBanStatus: boolean) => {
    try {
      // Simulating an API call to update the ban status
      await new Promise((resolve) => setTimeout(resolve, 1000));

      setTeam((prevTeam) => ({
        ...prevTeam,
        isBanned: newBanStatus,
        banReason: newBanStatus
          ? prevTeam.banReason || "Violation of community guidelines"
          : "",
      }));

      // toast({
      //   title: newBanStatus ? "Team banned" : "Team unbanned",
      //   description: newBanStatus
      //     ? "The team has been banned and restricted from certain activities."
      //     : "The team's ban has been lifted.",
      // });
    } catch (error) {
      // toast({
      //   title: "Error",
      //   description:
      //     "An error occurred while updating the team's ban status. Please try again.",
      //   variant: "destructive",
      // });
    }
  };

  const handleDisbandTeam = async () => {
    startDisbandTransition(async () => {
      try {
        const response = await axios.post(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/team/disband-team/`,
          { team_id: teamDetails.team_id },
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
        if (response.statusText === "OK") {
          toast.success(response.data.message);
          router.push("/teams");
        } else {
          toast.error("Oops! An error occurred");
        }
      } catch (error: any) {
        toast.error(error?.response?.data?.message);
      }
    });
  };

  const handleExitTeam = async () => {
    startExitTransition(async () => {
      try {
        const response = await axios.post(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/team/exit-team/`,
          {},
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
        toast.success(
          response.data.message || "You have left the team successfully"
        );
        router.push("/teams");
      } catch (error: any) {
        toast.error(error?.response?.data?.message || "Failed to exit team");
      }
    });
  };

  function onSubmit(data: z.infer<typeof FormSchema>) {
    startTransferTransition(async () => {
      try {
        const response = await axios.post(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/team/transfer-ownership/`,
          { new_owner_ign: data.new_owner_ign },
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (response.statusText === "OK") {
          toast.success(
            response.data.message || "Ownership transferred successfully!"
          );
          router.push("/teams");
        } else {
          toast.error("Oops! An error occurred");
        }
      } catch (error: any) {
        toast.error(
          error?.response?.data?.message || "Failed to transfer ownership"
        );
      }
    });
  }

  if (pending) return <FullLoader text="details" />;

  if (teamDetails)
    return (
      <div className="container mx-auto px-4 py-8">
        <Button variant={"outline"} className="mb-4" asChild>
          <Link href="/teams">Go back</Link>
        </Button>
        <Card className={team.isBanned ? "border-red-500" : ""}>
          <CardHeader>
            <div className="flex flex-col md:flex-row items-start gap-4 md:gap-0 md:items-center justify-between">
              <div className="flex items-center space-x-4">
                <Avatar className="w-20 h-20">
                  <AvatarImage
                    src={teamDetails?.team_logo}
                    alt={teamDetails?.team_name}
                    className="object-cover"
                  />
                  <AvatarFallback>{teamDetails?.team_name[0]}</AvatarFallback>
                </Avatar>
                <div>
                  <CardTitle className="text-xl md:text-3xl">
                    {teamDetails?.team_name}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    Country: {teamDetails?.country}
                  </p>
                  {teamDetails?.is_banned && (
                    <Badge variant="destructive" className="mt-2">
                      BANNED
                    </Badge>
                  )}
                </div>
              </div>
              <div className="space-x-2 w-full md:w-auto">
                {!hasFullAccess && !teamDetails?.is_banned && !isMember && (
                  <Button
                    className="w-full md:w-auto"
                    disabled={pendingRequest}
                    onClick={handleJoinTeam}
                  >
                    {pendingRequest ? (
                      <Loader text="Sending..." />
                    ) : (
                      <>
                        <UserPlus className="mr-2 h-4 w-4" />
                        Request to Join
                      </>
                    )}
                  </Button>
                )}
                {hasFullAccess && !teamDetails?.is_banned && (
                  <>
                    <Button asChild>
                      <Link href={`/teams/${teamDetails?.team_name}/edit`}>
                        <Edit className="mr-2 h-4 w-4" />
                        Edit Team
                      </Link>
                    </Button>
                    <Button asChild>
                      <Link href={`/teams/${teamDetails?.team_name}/roster`}>
                        <Users className="mr-2 h-4 w-4" />
                        Manage Roster
                      </Link>
                    </Button>
                  </>
                )}
                {!hasFullAccess && isMember && !teamDetails?.is_banned && (
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button
                        variant="destructive"
                        className="w-full md:w-auto"
                      >
                        <LogOut className="mr-2 h-4 w-4" />
                        Exit Team
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Exit Team</DialogTitle>
                        <DialogDescription>
                          Are you sure you want to leave{" "}
                          {teamDetails?.team_name}? This action cannot be
                          undone.
                        </DialogDescription>
                      </DialogHeader>
                      <DialogFooter>
                        <DialogClose asChild>
                          <Button variant="outline">Cancel</Button>
                        </DialogClose>
                        <Button
                          variant="destructive"
                          onClick={handleExitTeam}
                          disabled={pendingExit}
                        >
                          {pendingExit ? (
                            <Loader text="Leaving..." />
                          ) : (
                            "Yes, Exit Team"
                          )}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {teamDetails?.is_banned && (
              <Alert variant="destructive" className="mb-6">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>This team is currently banned</AlertTitle>
                <AlertDescription>
                  Reason: {teamDetails?.ban_reason}
                  <br />
                  Team members are restricted from certain activities, including
                  leaving the team, registering for tournaments, or changing
                  in-game names.
                </AlertDescription>
              </Alert>
            )}

            <Tabs defaultValue="overview" className="mt-6">
              <TabsList>
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="members">Members</TabsTrigger>
                <TabsTrigger value="statistics">Statistics</TabsTrigger>
                <TabsTrigger value="social">Social Media</TabsTrigger>
                {hasFullAccess && (
                  <TabsTrigger value="requests">Join Requests</TabsTrigger>
                )}
              </TabsList>

              <TabsContent value="overview">
                <Card>
                  <CardHeader>
                    <CardTitle>Team Overview</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <h3 className="font-semibold text-sm md:text-base">
                          Country
                        </h3>
                        <p className="text-lg md:text-2xl">
                          {teamDetails?.country}
                        </p>
                      </div>
                      <div>
                        <h3 className="font-semibold text-sm md:text-base">
                          Total Kills
                        </h3>
                        <p className="text-lg md:text-2xl">
                          {teamDetails?.stats?.total_kills
                            ? teamDetails?.stats?.total_kills
                            : 0}
                        </p>
                      </div>
                      <div>
                        <h3 className="font-semibold text-sm md:text-base">
                          Total Wins
                        </h3>
                        <p className="text-lg md:text-2xl">
                          {teamDetails?.stats?.scrim_wins &&
                          teamDetails?.stats?.tournament_wins
                            ? teamDetails?.stats?.scrim_wins +
                              teamDetails?.stats?.tournament_wins
                            : 0}
                        </p>
                      </div>
                      <div>
                        <h3 className="font-semibold text-sm md:text-base">
                          Tier
                        </h3>
                        <p className="text-lg md:text-2xl">
                          {teamDetails?.team_tier}
                        </p>
                      </div>
                      <div>
                        <h3 className="font-semibold text-sm md:text-base">
                          Tournaments Played
                        </h3>
                        <p className="text-lg md:text-2xl">
                          {teamDetails?.stats?.tournaments_played
                            ? teamDetails?.stats?.tournaments_played
                            : 0}
                        </p>
                      </div>
                      <div>
                        <h3 className="font-semibold text-sm md:text-base">
                          Scrims Played
                        </h3>
                        <p className="text-lg md:text-2xl">
                          {teamDetails?.stats?.scrims_played
                            ? teamDetails?.stats?.scrims_played
                            : 0}
                        </p>
                      </div>
                      <div>
                        <h3 className="font-semibold text-sm md:text-base">
                          Creation Date
                        </h3>
                        <p className="text-lg md:text-2xl">
                          {new Date(
                            teamDetails?.creation_date
                          ).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="members">
                <Card>
                  <CardHeader>
                    <CardTitle>Team Members</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="truncate">Name</TableHead>
                          <TableHead className="truncate">
                            In-game Role
                          </TableHead>
                          <TableHead className="truncate">
                            Management Role
                          </TableHead>
                          <TableHead className="truncate">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {teamDetails?.members?.map(
                          (member: any, index: string) => (
                            <TableRow key={index}>
                              <TableCell>{member.username}</TableCell>
                              <TableCell>
                                {formatRole(member.in_game_role) || (
                                  <span className="italic">Not selected</span>
                                )}
                              </TableCell>
                              <TableCell>
                                {formatRole(member.management_role)}
                              </TableCell>
                              <TableCell>
                                <Button variant="outline" asChild>
                                  <Link href={`/players/${member.username}`}>
                                    View Profile
                                  </Link>
                                </Button>
                              </TableCell>
                            </TableRow>
                          )
                        )}
                      </TableBody>
                      {teamDetails?.members === undefined && (
                        <p className="italic text-sm text-center py-4 w-full">
                          There are no members yet
                        </p>
                      )}
                    </Table>
                    {hasFullAccess && teamDetails?.members?.length < 6 && (
                      <div className="mt-4">
                        <h4 className="text-lg font-semibold mb-2">
                          Add New Member
                        </h4>
                        <div className="flex space-x-2">
                          <Input
                            placeholder="Invite by email"
                            value={newMemberSearch}
                            onChange={(e) => setNewMemberSearch(e.target.value)}
                          />
                          <Button onClick={handleAddNewMember}>
                            {pendingInvite ? (
                              <Loader text=" " />
                            ) : (
                              <>
                                <Search className="mr-2 h-4 w-4" />
                                Invite
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="statistics">
                <Card>
                  <CardHeader>
                    <CardTitle>Team Statistics</CardTitle>
                  </CardHeader>
                  <CardContent className="relative overflow-hidden">
                    {/* Blur Overlay */}
                    <div className="absolute inset-0 backdrop-blur-sm bg-background/50 z-10 flex items-center justify-center">
                      <span className="text-sm font-medium text-muted-foreground">
                        Coming Soon
                      </span>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <Label>Date Range</Label>
                        <DatePickerWithRange
                          dateRange={dateRange}
                          //   @ts-ignore
                          setDateRange={setDateRange}
                        />
                      </div>
                      <div>
                        <Label>Event Type</Label>
                        <Select
                          value={eventFilter}
                          onValueChange={setEventFilter}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select event type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Events</SelectItem>
                            <SelectItem value="scrims">Scrims</SelectItem>
                            <SelectItem value="tournaments">
                              Tournaments
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {eventFilter !== "all" && (
                        <div>
                          <Label>
                            {eventFilter === "scrims" ? "Scrim" : "Tournament"}{" "}
                            Name
                          </Label>
                          <Select
                            value={selectedEvent}
                            onValueChange={setSelectedEvent}
                          >
                            <SelectTrigger>
                              <SelectValue
                                placeholder={`Select ${
                                  eventFilter === "scrims"
                                    ? "scrim"
                                    : "tournament"
                                }`}
                              />
                            </SelectTrigger>
                            <SelectContent>
                              {/* Populate this with actual event names */}
                              <SelectItem value="event1">Event 1</SelectItem>
                              <SelectItem value="event2">Event 2</SelectItem>
                              <SelectItem value="event3">Event 3</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <h3 className="font-semibold text-sm md:text-base">
                            Scrim Wins
                          </h3>
                          <p className="text-lg md:text-2xl">
                            {teamDetails?.stats?.scrim_wins
                              ? teamDetails?.stats?.scrim_wins
                              : 0}
                          </p>
                        </div>
                        <div>
                          <h3 className="font-semibold text-sm md:text-base">
                            Tournament Wins
                          </h3>
                          <p className="text-lg md:text-2xl">
                            {teamDetails?.stats?.tournament_wins
                              ? teamDetails?.stats?.tournament_wins
                              : 0}
                          </p>
                        </div>
                        <div>
                          <h3 className="font-semibold text-sm md:text-base">
                            Tier 1 Tournaments
                          </h3>
                          <p className="text-lg md:text-2xl">
                            {teamDetails?.stats?.tier1_tournaments_played
                              ? teamDetails?.stats?.tier1_tournaments_played
                              : 0}
                          </p>
                        </div>
                        <div>
                          <h3 className="font-semibold text-sm md:text-base">
                            Tier 2 Tournaments
                          </h3>
                          <p className="text-lg md:text-2xl">
                            {teamDetails?.stats?.tier2_tournaments_played
                              ? teamDetails?.stats?.tier2_tournaments_played
                              : 0}
                          </p>
                        </div>
                        <div>
                          <h3 className="font-semibold text-sm md:text-base">
                            Tier 3 Tournaments
                          </h3>
                          <p className="text-lg md:text-2xl">
                            {teamDetails?.stats?.tier3_tournaments_played
                              ? teamDetails?.stats?.tier3_tournaments_played
                              : 0}
                          </p>
                        </div>
                        <div>
                          <h3 className="font-semibold text-sm md:text-base">
                            Total Earnings
                          </h3>
                          <p className="text-lg md:text-2xl">
                            $
                            {teamDetails?.stats?.total_earnings
                              ? teamDetails?.stats?.total_earnings
                              : 0}
                          </p>
                        </div>
                      </div>
                      <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={teamDetails?.performance_history}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="month" />
                            <YAxis yAxisId="left" />
                            <YAxis yAxisId="right" orientation="right" />
                            <Tooltip />
                            <Legend />
                            <Line
                              yAxisId="left"
                              type="monotone"
                              dataKey="kills"
                              stroke="#8884d8"
                            />
                            <Line
                              yAxisId="right"
                              type="monotone"
                              dataKey="wins"
                              stroke="#82ca9d"
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="social">
                <Card>
                  <CardHeader>
                    <CardTitle>Social Media</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {teamDetails?.social_media_links?.map(
                        (link: any, index: any) => (
                          <Link
                            key={index}
                            href={link.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center space-x-2 text-muted-foreground hover:text-primary"
                          >
                            {link.platform === "facebook" && (
                              <Facebook className="h-5 w-5" />
                            )}
                            {link.platform === "twitter" && (
                              <Twitter className="h-5 w-5" />
                            )}
                            {link.platform === "instagram" && (
                              <Instagram className="h-5 w-5" />
                            )}
                            {link.platform === "youtube" && (
                              <Youtube className="h-5 w-5" />
                            )}
                            {link.platform === "twitch" && (
                              <Twitch className="h-5 w-5" />
                            )}
                            <span>
                              {link.platform.charAt(0).toUpperCase() +
                                link.platform.slice(1)}
                            </span>
                          </Link>
                        )
                      )}
                      {teamDetails?.social_media_links === undefined && (
                        <p className="text-sm text-center italic">
                          No social media links
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {hasFullAccess && (
                <TabsContent value="requests">
                  <Card>
                    <CardHeader>
                      <CardTitle>Join Requests</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {joinRequests?.length === 0 ? (
                        <p>No pending join requests.</p>
                      ) : (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="truncate">Name</TableHead>
                              <TableHead className="truncate">UID</TableHead>
                              <TableHead className="truncate">
                                Actions
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {joinRequests?.map((request: any) => (
                              <TableRow key={request.request_id}>
                                <TableCell>{request.requester}</TableCell>
                                <TableCell>{request.uid}</TableCell>
                                <TableCell>
                                  <div className="space-x-2">
                                    <Button
                                      disabled={
                                        pendingApproveRequest ||
                                        pendingDenyRequest
                                      }
                                      onClick={() =>
                                        handleApproveJoinRequest(
                                          request.request_id
                                        )
                                      }
                                    >
                                      {pendingApproveRequest ? (
                                        <Loader text="Approving..." />
                                      ) : (
                                        "Approve"
                                      )}
                                    </Button>
                                    <Button
                                      variant="outline"
                                      disabled={
                                        pendingApproveRequest ||
                                        pendingDenyRequest
                                      }
                                      onClick={() =>
                                        handleDenyJoinRequest(
                                          request.request_id
                                        )
                                      }
                                    >
                                      {pendingDenyRequest ? (
                                        <Loader text="Denying..." />
                                      ) : (
                                        "Deny"
                                      )}
                                    </Button>
                                    <Button variant="outline" asChild>
                                      <Link
                                        href={`/players/${request.requester}`}
                                      >
                                        View Profile
                                      </Link>
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              )}
            </Tabs>

            {hasFullAccess && !teamDetails?.isBanned && (
              <Card className="mt-6">
                <CardHeader>
                  <CardTitle>Team Owner Controls</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <Button
                        onClick={handleGenerateInviteLink}
                        disabled={pendingGenerateLink}
                      >
                        {pendingGenerateLink ? (
                          <Loader text="Generating..." />
                        ) : (
                          "Generate Invite Link"
                        )}
                      </Button>
                      {inviteLink && (
                        <div className="mt-2 flex items-center space-x-2">
                          <Input value={inviteLink} readOnly />
                          <Button onClick={handleCopyInviteLink}>
                            <LinkIcon className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="destructive">Disband Team</Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Disband Team</DialogTitle>
                          <DialogDescription>
                            Are you sure you want to disband this team? This
                            action cannot be undone.
                          </DialogDescription>
                        </DialogHeader>
                        <DialogFooter>
                          <Button variant="outline" onClick={() => {}}>
                            Cancel
                          </Button>
                          <Button
                            variant="destructive"
                            onClick={handleDisbandTeam}
                            disabled={pendingDisbanded}
                          >
                            {pendingDisbanded ? (
                              <Loader text="Disbanding..." />
                            ) : (
                              "Disband"
                            )}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button>Transfer Ownership</Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Transfer Team Ownership</DialogTitle>
                          <DialogDescription>
                            Select a team member to transfer ownership to.
                          </DialogDescription>
                        </DialogHeader>
                        <Form {...form}>
                          <form
                            onSubmit={form.handleSubmit(onSubmit)}
                            className="space-y-6"
                          >
                            <FormField
                              control={form.control}
                              name="new_owner_ign"
                              render={({ field }) => (
                                <FormItem>
                                  <Select
                                    onValueChange={field.onChange}
                                    defaultValue={field.value}
                                  >
                                    <FormControl>
                                      <SelectTrigger>
                                        <SelectValue placeholder="Select new owner" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      {teamDetails?.members
                                        ?.filter(
                                          (member: any) =>
                                            member.username !==
                                            user?.in_game_name
                                        )
                                        ?.map((member: any) => (
                                          <SelectItem
                                            key={member.id}
                                            value={member.username}
                                          >
                                            {member.username}
                                          </SelectItem>
                                        ))}
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <DialogFooter className="flex gap-4">
                              <DialogClose asChild>
                                <Button variant="outline" type="button">
                                  Cancel
                                </Button>
                              </DialogClose>
                              <Button type="submit" disabled={pendingTransfer}>
                                {pendingTransfer ? (
                                  <Loader text="Transferring..." />
                                ) : (
                                  "Transfer"
                                )}
                              </Button>
                            </DialogFooter>
                          </form>
                        </Form>
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardContent>
              </Card>
            )}
            {isAdmin && (
              <Card className="mt-6">
                <CardHeader>
                  <CardTitle>Admin Controls</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center space-x-2">
                      <Switch
                        checked={teamDetails?.isBanned}
                        onCheckedChange={handleBanStatusChange}
                        id="team-ban-toggle"
                      />
                      <Label htmlFor="team-ban-toggle">
                        {teamDetails?.isBanned ? "Unban Team" : "Ban Team"}
                      </Label>
                    </div>
                    {teamDetails?.isBanned && (
                      <div>
                        <Label htmlFor="ban-reason">Ban Reason</Label>
                        <Input
                          id="ban-reason"
                          value={teamDetails?.banReason}
                          onChange={(e) =>
                            setTeam((prev) => ({
                              ...prev,
                              banReason: e.target.value,
                            }))
                          }
                          placeholder="Enter reason for ban"
                        />
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </CardContent>
        </Card>
      </div>
    );
};
