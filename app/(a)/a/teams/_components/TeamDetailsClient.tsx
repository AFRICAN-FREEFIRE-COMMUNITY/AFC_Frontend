"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { FullLoader } from "@/components/Loader";
import { BanModal } from "../../_components/BanModal";
import { SendMessageModal } from "../../_components/SendMessageModal";
import { PageHeader } from "@/components/PageHeader";
import { InfoTip } from "@/components/ui/info-tip";
import { NothingFound } from "@/components/NothingFound";
import { useAuth } from "@/contexts/AuthContext";
import { env } from "@/lib/env";
import {
  IconUserMinus,
  IconUserPlus,
  IconAlertTriangle,
} from "@tabler/icons-react";
import {
  ChevronLeft,
  ChevronRight,
  Crown,
  Shield,
  UserCog,
} from "lucide-react";

const API = env.NEXT_PUBLIC_BACKEND_API_URL;

const MANAGEMENT_ROLES = [
  { value: "member", label: "Member" },
  { value: "vice_captain", label: "Vice Captain" },
  { value: "team_captain", label: "Team Captain" },
  { value: "coach", label: "Coach" },
  { value: "manager", label: "Manager" },
  { value: "analyst", label: "Analyst" },
];

const TIER_OPTIONS = [
  { value: "1", label: "Tier 1" },
  { value: "2", label: "Tier 2" },
  { value: "3", label: "Tier 3" },
];

type TeamDetailsClientProps = {
  teamId: string;
  initialData?: any;
};

export function TeamDetailsClient({ teamId, initialData }: TeamDetailsClientProps) {
  const { token, isAdminByRoleOrRoles } = useAuth();
  const [teamDetails, setTeamDetails] = useState<any>(initialData || null);
  const [loading, setLoading] = useState(!initialData);

  // remove member
  const [removeTarget, setRemoveTarget] = useState<any | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);

  // add member
  const [addOpen, setAddOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<any | null>(null);
  const [selectedRole, setSelectedRole] = useState("member");
  const [isAdding, setIsAdding] = useState(false);

  // change tier
  const [tierValue, setTierValue] = useState("");
  const [tierConfirmOpen, setTierConfirmOpen] = useState(false);
  const [isSavingTier, setIsSavingTier] = useState(false);

  // transfer ownership
  const [transferTarget, setTransferTarget] = useState("");
  const [transferConfirmOpen, setTransferConfirmOpen] = useState(false);
  const [isTransferring, setIsTransferring] = useState(false);

  // event history
  const [eventHistory, setEventHistory] = useState<any[]>([]);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyTotalPages, setHistoryTotalPages] = useState(1);
  const [historyLoading, setHistoryLoading] = useState(false);
  const PAGE_SIZE = 10;

  const authHeader = { Authorization: `Bearer ${token}` };

  // ── fetch team details ──────────────────────────────────────────────────────

  const fetchTeamDetails = useCallback(async () => {
    if (!teamId) return;
    setLoading(true);
    try {
      const res = await fetch(`${API}/team/get-team-details/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify({ team_name: decodeURIComponent(teamId) }),
      });
      if (!res.ok) throw new Error("Failed to fetch team details");
      const data = await res.json();
      setTeamDetails(data.team);
      setTierValue(data.team.team_tier ?? "");
    } catch (err: any) {
      toast.error(err.message || "Failed to load team details");
    } finally {
      setLoading(false);
    }
  }, [teamId, token]);

  // ── fetch event history ────────────────────────────────────────────────────

  const fetchEventHistory = useCallback(
    async (page: number) => {
      if (!teamDetails?.team_id) return;
      setHistoryLoading(true);
      try {
        const res = await fetch(
          `${API}/team/admin-get-team-event-history/?team_id=${teamDetails.team_id}&page=${page}&page_size=${PAGE_SIZE}`,
          { headers: authHeader },
        );
        if (!res.ok) throw new Error();
        const data = await res.json();
        setEventHistory(data.results ?? []);
        setHistoryTotal(data.total ?? 0);
        setHistoryTotalPages(data.total_pages ?? 1);
        setHistoryPage(page);
      } catch {
        toast.error("Failed to load event history");
      } finally {
        setHistoryLoading(false);
      }
    },
    [teamDetails?.team_id, token],
  );

  useEffect(() => {
    if (!initialData && teamId && token) fetchTeamDetails();
  }, [teamId, token, initialData, fetchTeamDetails]);

  useEffect(() => {
    if (teamDetails?.team_id) fetchEventHistory(1);
  }, [teamDetails?.team_id]);

  // ── player search debounce ─────────────────────────────────────────────────

  useEffect(() => {
    if (searchQuery.length < 2) { setSearchResults([]); return; }
    const t = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const res = await fetch(
          `${API}/team/admin-search-players/?q=${encodeURIComponent(searchQuery)}`,
          { headers: authHeader },
        );
        const data = await res.json();
        setSearchResults(data.players || []);
      } catch { toast.error("Failed to search players"); }
      finally { setSearchLoading(false); }
    }, 400);
    return () => clearTimeout(t);
  }, [searchQuery, token]);

  // ── handlers ───────────────────────────────────────────────────────────────

  const handleRemove = async () => {
    if (!removeTarget) return;
    setIsRemoving(true);
    try {
      const res = await fetch(`${API}/team/admin-remove-member/`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader },
        body: JSON.stringify({ team_id: teamDetails.team_id, member_id: removeTarget.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      toast.success(data.message);
      setRemoveTarget(null);
      fetchTeamDetails();
    } catch (err: any) { toast.error(err.message); }
    finally { setIsRemoving(false); }
  };

  const handleAdd = async () => {
    if (!selectedPlayer) return;
    setIsAdding(true);
    try {
      const memberCount = teamDetails.total_members ?? teamDetails.members?.length ?? 0;
      const body: Record<string, any> = {
        team_id: teamDetails.team_id,
        player_id: selectedPlayer.user_id,
        management_role: selectedRole,
      };
      if (selectedPlayer.current_team) body.force_move = true;
      if (memberCount >= 8) body.override_limit = true;
      const res = await fetch(`${API}/team/admin-add-member/`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      toast.success(data.message);
      closeAddDialog();
      fetchTeamDetails();
    } catch (err: any) { toast.error(err.message); }
    finally { setIsAdding(false); }
  };

  const handleChangeTier = async () => {
    setIsSavingTier(true);
    try {
      const res = await fetch(`${API}/team/admin-change-team-tier/`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader },
        body: JSON.stringify({ team_id: teamDetails.team_id, tier: tierValue }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      toast.success(data.message);
      setTierConfirmOpen(false);
      fetchTeamDetails();
    } catch (err: any) { toast.error(err.message); }
    finally { setIsSavingTier(false); }
  };

  const handleTransferOwnership = async () => {
    setIsTransferring(true);
    try {
      const res = await fetch(`${API}/team/admin-transfer-team-ownership/`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader },
        body: JSON.stringify({ team_id: teamDetails.team_id, new_owner_id: transferTarget }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      toast.success(data.message);
      setTransferConfirmOpen(false);
      setTransferTarget("");
      fetchTeamDetails();
    } catch (err: any) { toast.error(err.message); }
    finally { setIsTransferring(false); }
  };

  const closeAddDialog = () => {
    setAddOpen(false);
    setSearchQuery("");
    setSearchResults([]);
    setSelectedPlayer(null);
    setSelectedRole("member");
  };

  // ── helpers ────────────────────────────────────────────────────────────────

  const fmtDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "-";

  const statusBadgeVariant = (s: string): "default" | "destructive" | "secondary" | "outline" => {
    if (s === "active") return "default";
    if (s === "disqualified") return "destructive";
    if (s === "withdrawn" || s === "left") return "outline";
    return "secondary";
  };

  const eventStatusVariant = (s: string): "default" | "destructive" | "secondary" | "outline" => {
    if (s === "ongoing") return "default";
    if (s === "cancelled") return "destructive";
    if (s === "completed") return "outline";
    return "secondary";
  };

  // ── render ─────────────────────────────────────────────────────────────────

  if (loading) return <FullLoader />;
  if (!teamDetails) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold mb-4">Team Not Found</h1>
        <p className="text-muted-foreground">The team you&apos;re looking for doesn&apos;t exist or has been removed.</p>
      </div>
    );
  }

  const memberCount = teamDetails.total_members ?? teamDetails.members?.length ?? 0;
  const isTeamFull = memberCount >= 8;
  const nonOwnerMembers = (teamDetails.members ?? []).filter(
    (m: any) => m.username !== teamDetails.team_owner,
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <PageHeader
          // Title is a ReactNode so the page-level ⓘ can sit right after it.
          title={
            <span className="inline-flex items-center">
              {teamDetails.team_name} Details
              <InfoTip id="teams.detail._page" className="ml-1.5" />
            </span>
          }
          back
        />
        <div className="flex items-center gap-2">
          <SendMessageModal
            targetType="team"
            targetId={teamDetails.team_id}
            targetName={teamDetails.team_name}
          />
          <BanModal
            is_banned={teamDetails.is_banned}
            teamName={teamDetails.team_name}
            team_id={teamDetails.team_id}
            onSuccess={fetchTeamDetails}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* ── Team Overview ──────────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle>Team Overview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm font-medium">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tier</span>
              <span>Tier {teamDetails.team_tier}</span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-muted-foreground">Country</span>
              <span>{teamDetails.country || "-"}</span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-muted-foreground">Owner</span>
              <span className="flex items-center gap-1">
                <Crown className="h-3.5 w-3.5 text-yellow-500" />
                {teamDetails.team_owner}
              </span>
            </div>
            {teamDetails.team_captain && (
              <>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Captain</span>
                  <span className="flex items-center gap-1">
                    <Shield className="h-3.5 w-3.5 text-blue-500" />
                    {teamDetails.team_captain}
                  </span>
                </div>
              </>
            )}
            <Separator />
            <div className="flex justify-between">
              <span className="text-muted-foreground">Created by</span>
              <span>{teamDetails.team_creator}</span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-muted-foreground">Created</span>
              <span>{fmtDate(teamDetails.creation_date)}</span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Earnings</span>
              <span>${teamDetails.total_earnings || 0}</span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-muted-foreground">Status</span>
              {teamDetails.is_banned ? (
                <Badge variant="destructive">Banned</Badge>
              ) : (
                <Badge variant="secondary">Active</Badge>
              )}
            </div>

            {/* Ban details */}
            {teamDetails.is_banned && teamDetails.ban_info && (
              <>
                <Separator />
                <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 space-y-1.5 text-xs">
                  <p><span className="text-muted-foreground">Reason: </span>{teamDetails.ban_info.reason || "No reason provided"}</p>
                  <p><span className="text-muted-foreground">Banned by: </span>{teamDetails.ban_info.banned_by}</p>
                  <p><span className="text-muted-foreground">Ban started: </span>{fmtDate(teamDetails.ban_info.ban_start_date)}</p>
                  <p><span className="text-muted-foreground">Expires: </span>{fmtDate(teamDetails.ban_info.ban_end_date)}</p>
                </div>
              </>
            )}

            <Separator />
            <div className="grid grid-cols-2 gap-2 pt-1">
              {[
                ["Wins", teamDetails.total_wins ?? 0],
                ["Losses", teamDetails.total_losses ?? 0],
                ["Win Rate", `${teamDetails.win_rate ?? 0}%`],
                ["Avg Kills", teamDetails.average_kills ?? 0],
                ["Avg Placement", teamDetails.average_placement ?? 0],
                ["Members", memberCount],
              ].map(([label, val]) => (
                <div key={String(label)} className="rounded-md bg-muted/50 p-2 text-center">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="font-semibold text-base">{val}</p>
                </div>
              ))}
            </div>

            {teamDetails.team_description && (
              <>
                <Separator />
                <p className="text-xs text-muted-foreground italic">{teamDetails.team_description}</p>
              </>
            )}
          </CardContent>
        </Card>

        {/* ── Team Members ───────────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              {/* Section ⓘ inline with the members heading. */}
              <CardTitle className="flex items-center">
                Team Members ({memberCount})
                <InfoTip id="teams.detail.members._section" className="ml-1.5" />
              </CardTitle>
              {isAdminByRoleOrRoles && (
                // ⓘ sits beside the add-member action (sibling of the button).
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="outline" onClick={() => setAddOpen(true)}>
                    <IconUserPlus className="size-4 mr-1.5" /> Add Member
                  </Button>
                  <InfoTip id="teams.detail.add_member" />
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {teamDetails?.members?.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Player</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Discord</TableHead>
                    {isAdminByRoleOrRoles && (
                      // Column-header ⓘ explains the per-row remove action (avoids one ⓘ per row).
                      <TableHead className="w-10">
                        <InfoTip id="teams.detail.remove_member" />
                      </TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teamDetails.members.map((member: any) => {
                    const isOwner = member.username === teamDetails.team_owner;
                    const isCaptain = member.username === teamDetails.team_captain;
                    return (
                      <TableRow key={member.id || member.username}>
                        <TableCell>
                          <span>{member.username}</span>
                          {isOwner && (
                            <Badge variant="outline" className="ml-1.5 text-xs gap-1">
                              <Crown className="h-2.5 w-2.5" /> Owner
                            </Badge>
                          )}
                          {isCaptain && !isOwner && (
                            <Badge variant="outline" className="ml-1.5 text-xs gap-1">
                              <Shield className="h-2.5 w-2.5" /> Captain
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="capitalize text-xs">
                          {member.management_role?.replace("_", " ") || "Member"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {member.discord_id ? (
                            <span className="font-mono">{member.discord_id}</span>
                          ) : (
                            <span className="italic">Not linked</span>
                          )}
                        </TableCell>
                        {isAdminByRoleOrRoles && (
                          <TableCell>
                            {!isOwner && (
                              <Button
                                size="icon"
                                variant="ghost"
                                className="size-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => setRemoveTarget(member)}
                              >
                                <IconUserMinus className="size-4" />
                              </Button>
                            )}
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            ) : (
              <NothingFound text="No team members yet" />
            )}
          </CardContent>
        </Card>

        {/* ── Tournament Performance ─────────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle>Tournament Performance</CardTitle>
            <CardDescription>Per-event stats across all tournaments and scrims.</CardDescription>
          </CardHeader>
          <CardContent>
            {teamDetails?.tournament_performance?.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Event</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Pts</TableHead>
                    <TableHead className="text-right">Matches</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teamDetails.tournament_performance.map((tp: any, i: number) => (
                    <TableRow key={tp.event_id ?? i}>
                      <TableCell className="font-medium max-w-[120px] truncate">
                        {tp.name}
                        {tp.best_placement && (
                          <span className="text-xs text-muted-foreground block">
                            Best: #{tp.best_placement}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize text-xs">
                          {tp.competition_type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusBadgeVariant(tp.team_status)} className="capitalize text-xs">
                          {tp.team_status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">{tp.total_points}</TableCell>
                      <TableCell className="text-right text-sm">{tp.matches_played}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <NothingFound text="No tournament history yet" />
            )}
          </CardContent>
        </Card>

        {/* ── Recent Match Stats ────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Match Stats</CardTitle>
            <CardDescription>Last 10 matches across all events.</CardDescription>
          </CardHeader>
          <CardContent>
            {teamDetails?.recent_matches?.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Event / Map</TableHead>
                    <TableHead className="text-center">Place</TableHead>
                    <TableHead className="text-center">Kills</TableHead>
                    <TableHead className="text-right">Pts</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teamDetails.recent_matches.map((m: any, i: number) => (
                    <TableRow key={i}>
                      <TableCell>
                        <p className="font-medium text-xs truncate max-w-[130px]">{m.event_name}</p>
                        <p className="text-xs text-muted-foreground">
                          #{m.match_number} · {m.match_map}
                        </p>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant={m.placement === 1 ? "default" : m.placement <= 3 ? "secondary" : "outline"}
                          className="text-xs"
                        >
                          #{m.placement}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center text-sm">{m.kills}</TableCell>
                      <TableCell className="text-right font-mono text-sm">{m.total_points}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <NothingFound text="No match data yet" />
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Event Registration History (full width, paginated) ─────────────── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Event Registration History</CardTitle>
              <CardDescription>All events this team has registered for ({historyTotal} total).</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {historyLoading ? (
            <div className="flex justify-center py-8"><Spinner className="size-6" /></div>
          ) : eventHistory.length > 0 ? (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Event</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Event Status</TableHead>
                    <TableHead>Team Status</TableHead>
                    <TableHead>Registered</TableHead>
                    <TableHead>Waitlisted</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {eventHistory.map((ev: any, i: number) => (
                    <TableRow key={ev.event_id ?? i}>
                      <TableCell className="font-medium">{ev.event_name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize text-xs">
                          {ev.competition_type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={eventStatusVariant(ev.event_status)} className="capitalize text-xs">
                          {ev.event_status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusBadgeVariant(ev.team_status)} className="capitalize text-xs">
                          {ev.team_status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {fmtDate(ev.registration_date)}
                      </TableCell>
                      <TableCell>
                        {ev.is_waitlisted ? (
                          <Badge variant="secondary" className="text-xs">Yes</Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">No</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              <div className="flex items-center justify-between mt-4 text-sm text-muted-foreground">
                <span>
                  Page {historyPage} of {historyTotalPages} · {historyTotal} events
                </span>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => fetchEventHistory(historyPage - 1)}
                    disabled={historyPage <= 1 || historyLoading}
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" /> Prev
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => fetchEventHistory(historyPage + 1)}
                    disabled={historyPage >= historyTotalPages || historyLoading}
                  >
                    Next <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <NothingFound text="No event registrations found" />
          )}
        </CardContent>
      </Card>

      {/* ── Admin Actions (admin only) ─────────────────────────────────────── */}
      {isAdminByRoleOrRoles && (
        <Card>
          <CardHeader>
            {/* Section ⓘ inline with the Admin Actions heading. */}
            <CardTitle className="flex items-center gap-2">
              <UserCog className="h-5 w-5" /> Admin Actions
              <InfoTip id="teams.detail.actions._section" />
            </CardTitle>
            <CardDescription>Administrative controls for this team.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Change Tier */}
            <div className="space-y-2">
              {/* Field ⓘ nested in the Label - the InfoTip's stopPropagation guard keeps the click off the field. */}
              <Label className="text-sm font-medium">
                Change Team Tier
                <InfoTip id="teams.detail.change_tier" className="ml-1" />
              </Label>
              <p className="text-xs text-muted-foreground">
                Current tier: <span className="font-semibold">Tier {teamDetails.team_tier}</span>. Manually override the tier assigned by the ranking system.
              </p>
              <div className="flex gap-2">
                <Select value={tierValue} onValueChange={setTierValue}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Select tier" />
                  </SelectTrigger>
                  <SelectContent>
                    {TIER_OPTIONS.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  onClick={() => setTierConfirmOpen(true)}
                  disabled={!tierValue || tierValue === teamDetails.team_tier}
                >
                  Save Tier
                </Button>
              </div>
            </div>

            <Separator />

            {/* Transfer Ownership */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                Transfer Ownership
                <InfoTip id="teams.detail.transfer_ownership" className="ml-1" />
              </Label>
              <p className="text-xs text-muted-foreground">
                Transfer ownership from <span className="font-semibold">{teamDetails.team_owner}</span> to another team member.
              </p>
              {nonOwnerMembers.length > 0 ? (
                <div className="flex gap-2">
                  <Select value={transferTarget} onValueChange={setTransferTarget}>
                    <SelectTrigger className="flex-1 max-w-xs">
                      <SelectValue placeholder="Select new owner" />
                    </SelectTrigger>
                    <SelectContent>
                      {nonOwnerMembers.map((m: any) => (
                        <SelectItem key={m.id} value={String(m.id)}>
                          {m.username}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => setTransferConfirmOpen(true)}
                    disabled={!transferTarget}
                  >
                    Transfer
                  </Button>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic">No other members to transfer to.</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Remove Member Confirmation ────────────────────────────────────── */}
      <AlertDialog open={!!removeTarget} onOpenChange={(o) => !o && setRemoveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Member</AlertDialogTitle>
            <AlertDialogDescription>
              Remove <strong>{removeTarget?.username}</strong> from <strong>{teamDetails.team_name}</strong>?
              They will be notified and can be re-added at any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRemoving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemove}
              disabled={isRemoving}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isRemoving ? "Removing..." : "Remove Member"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Confirm Change Tier ───────────────────────────────────────────── */}
      <AlertDialog open={tierConfirmOpen} onOpenChange={setTierConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Change Team Tier?</AlertDialogTitle>
            <AlertDialogDescription>
              This will move <strong>{teamDetails.team_name}</strong> from{" "}
              <strong>Tier {teamDetails.team_tier}</strong> to <strong>Tier {tierValue}</strong>.
              The team owner will be notified.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSavingTier}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleChangeTier} disabled={isSavingTier}>
              {isSavingTier ? "Saving..." : "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Confirm Transfer Ownership ────────────────────────────────────── */}
      <AlertDialog open={transferConfirmOpen} onOpenChange={setTransferConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Transfer Ownership?</AlertDialogTitle>
            <AlertDialogDescription>
              Transfer ownership of <strong>{teamDetails.team_name}</strong> to{" "}
              <strong>
                {nonOwnerMembers.find((m: any) => String(m.id) === transferTarget)?.username ?? "selected player"}
              </strong>
              ?<br />
              <strong>{teamDetails.team_owner}</strong> will become a regular member. This cannot be undone without another transfer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isTransferring}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleTransferOwnership}
              disabled={isTransferring}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isTransferring ? "Transferring..." : "Yes, Transfer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Add Member Dialog ─────────────────────────────────────────────── */}
      <Dialog open={addOpen} onOpenChange={(o) => !o && closeAddDialog()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Member to {teamDetails.team_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {isTeamFull && (
              <div className="flex items-start gap-2 rounded-md border border-yellow-500/40 bg-yellow-500/10 p-3 text-sm text-yellow-700 dark:text-yellow-400">
                <IconAlertTriangle className="mt-0.5 size-4 shrink-0" />
                <span>
                  Team has <strong>{memberCount} members</strong>, exceeding the 8-member limit. Adding will override this cap.
                </span>
              </div>
            )}

            {!selectedPlayer ? (
              <div className="space-y-2">
                <p className="text-sm font-medium">Search Player</p>
                <Input
                  placeholder="Search by username or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchLoading && <div className="flex justify-center py-2"><Spinner className="size-5" /></div>}
                {!searchLoading && searchResults.length > 0 && (
                  <div className="max-h-48 overflow-y-auto rounded-md border divide-y">
                    {searchResults.map((player) => (
                      <button
                        key={player.user_id}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-muted transition-colors"
                        onClick={() => { setSelectedPlayer(player); setSearchQuery(""); setSearchResults([]); }}
                      >
                        <p className="font-medium">{player.username}</p>
                        <p className="text-xs text-muted-foreground">{player.email}</p>
                        {player.current_team && (
                          <p className="text-xs text-yellow-600 dark:text-yellow-400">
                            On team: {player.current_team.team_name}
                          </p>
                        )}
                      </button>
                    ))}
                  </div>
                )}
                {!searchLoading && searchQuery.length >= 2 && searchResults.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-2">No players found.</p>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-sm font-medium">Selected Player</p>
                <div className="rounded-md border p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">{selectedPlayer.username}</p>
                      <p className="text-xs text-muted-foreground">{selectedPlayer.email}</p>
                    </div>
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setSelectedPlayer(null)}>
                      Change
                    </Button>
                  </div>
                  {selectedPlayer.current_team && (
                    <div className="flex items-start gap-2 rounded-md border border-yellow-500/40 bg-yellow-500/10 px-2 py-1.5 text-xs text-yellow-700 dark:text-yellow-400">
                      <IconAlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                      <span>
                        Currently on <strong>{selectedPlayer.current_team.team_name}</strong>. Confirming will remove them from that team first.
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <p className="text-sm font-medium">Management Role</p>
              <Select value={selectedRole} onValueChange={setSelectedRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MANAGEMENT_ROLES.map((r) => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeAddDialog} disabled={isAdding}>Cancel</Button>
            <Button onClick={handleAdd} disabled={!selectedPlayer || isAdding}>
              {isAdding ? "Adding..." : "Add Member"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
