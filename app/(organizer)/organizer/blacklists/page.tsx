// ─────────────────────────────────────────────────────────────────────────────
// Organizer › Blacklists.
//
// The org's team-blacklist surface. An organizer can blacklist a team for a
// duration; while it is active the team AND the players who were on it at blacklist
// time cannot register for THAT organizer's events (the snapshot "follows the
// player" even after they leave the team). The affected party can ASK for a lift;
// this page is where the organizer reviews and decides those requests.
//
// FOUR parts on one page:
//   0. "Lookup" section (BLACKLIST VISIBILITY, owner ask 2026-06-12) - check whether
//      a team or player was blacklisted by OTHER organizations: how many times, by
//      whom, and when, over an optional date window. NO reasons are shown (the owner
//      privacy rule; the backend strips them for organizers). Team/Player toggle ->
//      TeamSearchSelect / UserSearchSelect + two optional date inputs
//      -> GET /organizers/blacklist-lookup/  (organizersApi.lookupBlacklists).
//   1. "Blacklist a team" dialog - TeamSearchSelect + duration (days) + reason
//      -> POST /organizers/blacklists/  (organizersApi.createBlacklist).
//   2. Active/all blacklists table - team, reason, dates, status, an EXPANDABLE
//      snapshot-roster row (mirrors the admin RegisteredTeamsTab expand pattern),
//      and a "Lift" confirm -> POST /organizers/blacklists/<id>/lift/
//      (organizersApi.liftBlacklist).
//   3. "Lift requests" section - pending team/player-scope requests with
//      Approve / Deny (a reason prompt) -> POST
//      /organizers/blacklists/lift-requests/<id>/decide/
//      (organizersApi.decideBlacklistLiftRequest).
//
// GATING: mirrors the rest of the portal. The gate here is
// membership.permissions.can_manage_registrations OR isOwner (the SAME permission
// the backend create/list/lift/decide endpoints require). A member without it gets
// a read-only lock notice and NO data is fetched. EXCEPTION: the Lookup section (0)
// renders for EVERY portal member because its backend gate is only "active member of
// any org" - cross-org visibility is deliberately open to all organizers.
//
// The selected org is read from OrganizerContext (the portal layout provides it);
// switching orgs re-mounts this subtree (keyed on slug), re-running the fetch for
// the newly-selected org. The numeric organization_id every call needs lives on the
// membership (membership.organization.organization_id).
//
// Design mirrors the sibling organizer pages (members / reviews): PageHeader, a
// single Card wrapping a compact Table, outline rounded-full badges (text-xs) per
// AFC constants, AlertDialog confirms, Dialog forms, sonner toasts on success/error.
// ─────────────────────────────────────────────────────────────────────────────

"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { TeamSearchSelect } from "@/components/ui/team-search-select";
import { UserSearchSelect, type PickedUser } from "@/components/ui/user-search-select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  IconBan,
  IconChevronDown,
  IconLoader2,
  IconLock,
  IconSearch,
  IconUser,
} from "@tabler/icons-react";
import { cn, formatDate } from "@/lib/utils";
import { organizersApi } from "@/lib/organizers";
import { useOrganizer } from "../_components/OrganizerContext";

// ── Types (mirror the _serialize_blacklist / _serialize_lift_request payloads) ──
// One snapshot player under a blacklist (OrganizerBlacklistPlayer). is_active=false
// once that player's individual lift has been approved.
interface BlacklistPlayer {
  id: number;
  user_id: number;
  username: string | null;
  is_active: boolean;
}

// One OrganizerBlacklist row, with its nested snapshot players.
interface Blacklist {
  id: number;
  organization_id: number;
  team_id: number;
  team_name: string | null;
  reason: string;
  status: "active" | "lifted" | "expired" | string;
  is_currently_active: boolean;
  start_date: string | null;
  end_date: string | null;
  created_by_username: string | null;
  created_at: string | null;
  players: BlacklistPlayer[];
}

// ── Lookup types (mirror the blacklist_lookup payload in views_blacklist_lookup.py) ──
// One cross-org lookup entry. NOTE: no `reason` field here on purpose - the backend only
// includes it for platform admins, and this organizer surface never renders it (owner rule).
interface LookupEntry {
  id: number;
  organization_name: string | null;
  organization_slug: string | null;
  team_id: number | null;
  team_name: string | null;
  start_date: string | null;
  end_date: string | null;
  status: "active" | "expired" | "lifted" | string;
}

// The full lookup response: who was looked up, the applied window, the counts the result
// headline shows ("Blacklisted N times (M active)"), and the per-blacklist entries.
interface LookupResult {
  target: {
    type: "team" | "player";
    team_id?: number;
    team_name?: string;
    user_id?: number;
    username?: string;
  };
  window: { start: string | null; end: string | null };
  total_count: number;
  active_count: number;
  entries: LookupEntry[];
  has_more: boolean;
}

// One BlacklistLiftRequest row (team or player scope) with a little blacklist context.
interface LiftRequest {
  id: number;
  blacklist_id: number;
  team_id: number | null;
  team_name: string | null;
  scope: "team" | "player";
  target_user_id: number | null;
  target_username: string | null;
  requested_by_username: string | null;
  reason: string;
  status: "pending" | "approved" | "denied" | string;
  decided_by_username: string | null;
  decided_at: string | null;
  created_at: string | null;
}

// ── Status badge ────────────────────────────────────────────────────────────
// Outline rounded-full badge (text-xs) per AFC constants: green while active, muted
// once lifted/expired so the table reads at a glance.
function StatusBadge({ status }: { status: string }) {
  const isActive = status === "active";
  return (
    <Badge
      variant="outline"
      className={cn(
        "rounded-full px-2 py-0.5 text-xs capitalize",
        isActive
          ? "border-green-500 text-green-600"
          : "border-muted-foreground/40 text-muted-foreground",
      )}
    >
      {status}
    </Badge>
  );
}

// ── Lift-request status badge (pending = amber, approved = green, denied = muted) ──
function RequestStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: "border-amber-500 text-amber-600",
    approved: "border-green-500 text-green-600",
    denied: "border-red-500 text-red-600",
  };
  return (
    <Badge
      variant="outline"
      className={cn(
        "rounded-full px-2 py-0.5 text-xs capitalize",
        map[status] ?? "border-muted-foreground/40 text-muted-foreground",
      )}
    >
      {status}
    </Badge>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────
export default function OrganizerBlacklistsPage() {
  const { membership, isOwner } = useOrganizer();

  // The same gate the backend enforces on every blacklist endpoint.
  const canManage = membership.permissions.can_manage_registrations || isOwner;
  // The numeric id every blacklist call needs (lives on the selected membership).
  const organizationId = membership.organization.organization_id;

  // ── Data state ──
  const [blacklists, setBlacklists] = useState<Blacklist[]>([]);
  const [liftRequests, setLiftRequests] = useState<LiftRequest[]>([]);
  const [loading, setLoading] = useState(true);

  // Which blacklist rows are expanded to show their snapshot players (keyed by id).
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const toggleExpand = (id: number) =>
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

  // ── Create-dialog state ──
  // Today as an ISO "YYYY-MM-DD" string: the default start date and the `min` floor on both
  // date inputs (you cannot blacklist starting in the past). Computed once on first render.
  const today = new Date().toISOString().slice(0, 10);
  const [createOpen, setCreateOpen] = useState(false);
  const [pickedTeamId, setPickedTeamId] = useState<number | null>(null);
  // The blacklist window as a calendar range. Start defaults to today; end is left empty until
  // the organizer picks it. Both are ISO "YYYY-MM-DD" strings (what <input type="date"> emits).
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState("");
  const [createReason, setCreateReason] = useState("");
  const [creating, setCreating] = useState(false);

  // Range is valid only when both dates are set AND end is strictly after start. Drives the
  // Submit-disabled state + the inline helper line below the date inputs.
  const isRangeValid = !!startDate && !!endDate && endDate > startDate;

  // Per-row busy flags so a single Lift / Decide click only disables its own button.
  const [liftingId, setLiftingId] = useState<number | null>(null);
  const [decidingId, setDecidingId] = useState<number | null>(null);

  // ── Load this org's blacklists + its incoming lift requests. ──
  // Gated members skip the fetch entirely (they only see the lock notice).
  const load = useCallback(async () => {
    if (!canManage) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      // Two independent fetches; both gated server-side on can_manage_registrations.
      // (Fetch ALL blacklists so lifted/expired stay visible as history; the lift
      // requests we only care about while pending.)
      const [blRes, lrRes] = await Promise.all([
        organizersApi.listBlacklists({ organization_id: organizationId, limit: 100 }),
        organizersApi.listBlacklistLiftRequests({
          organization_id: organizationId,
          status: "pending",
          limit: 100,
        }),
      ]);
      setBlacklists(blRes?.results ?? []);
      setLiftRequests(lrRes?.results ?? []);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to load blacklists.");
    } finally {
      setLoading(false);
    }
  }, [canManage, organizationId]);

  useEffect(() => {
    load();
  }, [load]);

  // ── 1. Create a blacklist. POST /organizers/blacklists/ ──
  const handleCreate = async () => {
    if (!pickedTeamId) {
      toast.error("Pick a team to blacklist.");
      return;
    }
    // Guard the date range (the Submit button is already disabled while invalid, but a stray
    // call should never send a bad window to the backend).
    if (!isRangeValid) {
      toast.error("Pick a start and end date, with the end date after the start.");
      return;
    }
    setCreating(true);
    try {
      // Send the calendar range as ISO "YYYY-MM-DD" strings (the new backend contract).
      const res = await organizersApi.createBlacklist({
        organization_id: organizationId,
        team_id: pickedTeamId,
        start_date: startDate,
        end_date: endDate,
        reason: createReason.trim(),
      });
      toast.success(res?.message || "Team blacklisted.");
      // Reset the form, close the dialog, and refresh the table.
      setPickedTeamId(null);
      setStartDate(today);
      setEndDate("");
      setCreateReason("");
      setCreateOpen(false);
      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to blacklist the team.");
    } finally {
      setCreating(false);
    }
  };

  // ── 2. Lift a blacklist early. POST /organizers/blacklists/<id>/lift/ ──
  const handleLift = async (id: number) => {
    setLiftingId(id);
    try {
      const res = await organizersApi.liftBlacklist(id);
      toast.success(res?.message || "Blacklist lifted.");
      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to lift the blacklist.");
    } finally {
      setLiftingId(null);
    }
  };

  // ── 3. Decide a lift request. POST /organizers/blacklists/lift-requests/<id>/decide/ ──
  // A short reason is collected inline in the Approve/Deny dialog and sent as the
  // decision note (the backend appends it to the request's reason).
  const handleDecide = async (
    id: number,
    decision: "approve" | "deny",
    reason: string,
  ) => {
    setDecidingId(id);
    try {
      const res = await organizersApi.decideBlacklistLiftRequest(id, {
        decision,
        reason: reason.trim(),
      });
      toast.success(res?.message || `Lift request ${decision}d.`);
      // A decided request leaves the pending list; a team-scope approve also lifts
      // the blacklist, so refresh both tables.
      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to decide the request.");
    } finally {
      setDecidingId(null);
    }
  };

  // ── Non-permitted member: read-only lock notice (mirrors Reviews / Metrics). ──
  // The LOOKUP section still renders: its backend gate is "active member of any org",
  // not can_manage_registrations, so every portal member may check other orgs' blacklists.
  if (!canManage) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeader
          title="Blacklists"
          description="Block teams from registering for your events."
        />
        <BlacklistLookupSection />
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <IconLock className="size-8 text-muted-foreground" />
            <p className="max-w-sm text-sm text-muted-foreground">
              You don&apos;t have permission to manage this organization&apos;s
              blacklists.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-24 text-sm text-muted-foreground">
        <IconLoader2 className="size-4 animate-spin" />
        Loading blacklists...
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Header + "Blacklist a team" action. */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <PageHeader
          title="Blacklists"
          description="Block a team (and the players on it) from registering for your events."
        />
        {/* ── 1. Create dialog: TeamSearchSelect + duration + reason. ── */}
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="gap-1.5 self-start sm:self-auto">
              <IconBan className="size-4" />
              Blacklist a team
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Blacklist a team</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-4 py-2">
              {/* Team picker (search-as-you-type existing teams). Emits the numeric team_id. */}
              <div className="flex flex-col gap-2">
                <Label>Team</Label>
                <TeamSearchSelect
                  value={pickedTeamId}
                  onChange={(id) => setPickedTeamId(id)}
                  placeholder="Search a team to blacklist..."
                />
              </div>
              {/* Calendar date RANGE (replaces the old duration-in-days input). Two native
                  date pickers; both floored at today (min={today}) so the window cannot start
                  in the past, and the end picker is additionally floored at the chosen start.
                  Values are ISO "YYYY-MM-DD", sent straight to the backend as start_date/end_date. */}
              <div className="flex flex-col gap-3 sm:flex-row">
                <div className="flex flex-1 flex-col gap-2">
                  <Label htmlFor="bl-start">Start date</Label>
                  <Input
                    id="bl-start"
                    type="date"
                    min={today}
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div className="flex flex-1 flex-col gap-2">
                  <Label htmlFor="bl-end">End date</Label>
                  <Input
                    id="bl-end"
                    type="date"
                    // End cannot be before the start (or today, if start is somehow empty).
                    min={startDate || today}
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              </div>
              {/* Inline validity hint: only shown once both dates are set but the range is
                  backwards, so the organizer sees why Submit is disabled. */}
              {startDate && endDate && !isRangeValid && (
                <p className="text-xs text-destructive">
                  The end date must be after the start date.
                </p>
              )}
              {/* Reason (optional, shown to the affected party on their request surface). */}
              <div className="flex flex-col gap-2">
                <Label htmlFor="bl-reason">Reason</Label>
                <Textarea
                  id="bl-reason"
                  value={createReason}
                  onChange={(e) => setCreateReason(e.target.value)}
                  placeholder="Why is this team being blacklisted?"
                  rows={3}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                The team and every player currently on its roster will be blocked
                from registering for your events for the selected date range. The
                block follows each player even if they later leave the team.
              </p>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setCreateOpen(false)}
                disabled={creating}
              >
                Cancel
              </Button>
              {/* Submit is disabled while creating OR the date range is invalid. */}
              <Button onClick={handleCreate} disabled={creating || !isRangeValid}>
                {creating ? (
                  <span className="flex items-center gap-1.5">
                    <IconLoader2 className="size-4 animate-spin" />
                    Blacklisting...
                  </span>
                ) : (
                  "Blacklist team"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* ── 0. Cross-org Lookup (blacklist visibility, owner ask 2026-06-12). ── */}
      <BlacklistLookupSection />

      {/* ── 2. Blacklists table (expandable snapshot roster + Lift action). ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Blacklisted teams ({blacklists.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {blacklists.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
              <IconBan className="size-6 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                You haven&apos;t blacklisted any teams yet.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-foreground">Team</TableHead>
                    <TableHead className="text-foreground">Reason</TableHead>
                    <TableHead className="text-foreground">Start</TableHead>
                    <TableHead className="text-foreground">End</TableHead>
                    <TableHead className="text-foreground">Status</TableHead>
                    <TableHead className="text-right text-foreground"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {blacklists.map((bl) => {
                    const isOpen = !!expanded[bl.id];
                    const canLift = bl.status === "active";
                    return (
                      <Fragment key={bl.id}>
                        <TableRow>
                          {/* Team name doubles as the expand toggle for the snapshot roster. */}
                          <TableCell className="text-xs font-medium">
                            <button
                              type="button"
                              onClick={() => toggleExpand(bl.id)}
                              className="flex items-center gap-1.5 text-left transition-colors hover:text-primary"
                              aria-expanded={isOpen}
                            >
                              <IconChevronDown
                                size={16}
                                className={cn(
                                  "shrink-0 text-muted-foreground transition-transform",
                                  isOpen && "rotate-180",
                                )}
                              />
                              <span>{bl.team_name ?? `Team #${bl.team_id}`}</span>
                              <Badge
                                variant="outline"
                                className="ml-1 rounded-full px-2 py-0.5 text-[10px]"
                              >
                                {bl.players.length} player
                                {bl.players.length === 1 ? "" : "s"}
                              </Badge>
                            </button>
                          </TableCell>
                          <TableCell className="max-w-[16rem] truncate text-xs text-muted-foreground">
                            {bl.reason || "-"}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {bl.start_date ? formatDate(bl.start_date) : "-"}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {bl.end_date ? formatDate(bl.end_date) : "-"}
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={bl.status} />
                          </TableCell>
                          <TableCell className="text-right">
                            {/* Lift confirm: only offered while the blacklist is active. */}
                            {canLift && (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-8"
                                    disabled={liftingId === bl.id}
                                  >
                                    {liftingId === bl.id ? (
                                      <IconLoader2 className="size-4 animate-spin" />
                                    ) : (
                                      "Lift"
                                    )}
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>
                                      Lift this blacklist?
                                    </AlertDialogTitle>
                                    <AlertDialogDescription>
                                      {bl.team_name ?? "This team"} and everyone on
                                      its snapshot will be able to register for your
                                      events again immediately. This cannot be undone.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => handleLift(bl.id)}
                                    >
                                      Lift blacklist
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            )}
                          </TableCell>
                        </TableRow>

                        {/* Expanded snapshot roster: who is blocked under this blacklist. */}
                        {isOpen && (
                          <TableRow className="bg-muted/30 hover:bg-muted/30">
                            <TableCell colSpan={6} className="p-0">
                              {bl.players.length === 0 ? (
                                <p className="px-6 py-3 text-xs text-muted-foreground">
                                  No players were snapshotted on this blacklist.
                                </p>
                              ) : (
                                <div className="divide-y divide-border/50 px-6 py-2">
                                  {bl.players.map((p) => (
                                    <div
                                      key={p.id}
                                      className="flex items-center gap-2 py-1.5 text-xs"
                                    >
                                      <IconUser
                                        size={14}
                                        className="shrink-0 text-muted-foreground"
                                      />
                                      <span className="font-medium">
                                        {p.username ?? `User #${p.user_id}`}
                                      </span>
                                      {/* A retired (individually-lifted) player reads "Lifted". */}
                                      <Badge
                                        variant="outline"
                                        className={cn(
                                          "ml-auto rounded-full px-2 py-0.5 text-[10px]",
                                          p.is_active
                                            ? "border-red-500 text-red-600"
                                            : "border-muted-foreground/40 text-muted-foreground",
                                        )}
                                      >
                                        {p.is_active ? "Blocked" : "Lifted"}
                                      </Badge>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </TableCell>
                          </TableRow>
                        )}
                      </Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── 3. Lift requests (pending) with Approve / Deny. ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Lift requests ({liftRequests.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {liftRequests.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No pending lift requests.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {liftRequests.map((req) => (
                <div
                  key={req.id}
                  className="flex flex-col gap-3 rounded-md border p-3 sm:flex-row sm:items-start sm:justify-between"
                >
                  <div className="flex flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium">
                        {req.team_name ?? `Team #${req.team_id}`}
                      </span>
                      {/* Scope badge: a whole-team lift vs one player. */}
                      <Badge
                        variant="outline"
                        className="rounded-full px-2 py-0.5 text-xs capitalize"
                      >
                        {req.scope === "team"
                          ? "Whole team"
                          : `Player: ${req.target_username ?? `#${req.target_user_id}`}`}
                      </Badge>
                      <RequestStatusBadge status={req.status} />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Requested by{" "}
                      <span className="text-foreground">
                        {req.requested_by_username ?? "Unknown"}
                      </span>
                      {req.created_at ? ` on ${formatDate(req.created_at)}` : ""}
                    </p>
                    {req.reason && (
                      <p className="mt-1 whitespace-pre-wrap text-xs text-foreground">
                        {req.reason}
                      </p>
                    )}
                  </div>

                  {/* Approve / Deny each open a small dialog to capture a decision note. */}
                  <div className="flex shrink-0 items-center gap-2">
                    <DecideButton
                      label="Deny"
                      variant="outline"
                      destructive
                      busy={decidingId === req.id}
                      onConfirm={(reason) => handleDecide(req.id, "deny", reason)}
                    />
                    <DecideButton
                      label="Approve"
                      variant="default"
                      busy={decidingId === req.id}
                      onConfirm={(reason) => handleDecide(req.id, "approve", reason)}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── DecideButton ──────────────────────────────────────────────────────────────
// A small Approve/Deny button that opens a Dialog to collect an optional decision
// note, then calls onConfirm(reason). Kept local to this page because it only ever
// wraps decideBlacklistLiftRequest. `destructive` tints the trigger for "Deny".
function DecideButton({
  label,
  variant,
  destructive,
  busy,
  onConfirm,
}: {
  label: string;
  variant: "default" | "outline";
  destructive?: boolean;
  busy?: boolean;
  onConfirm: (reason: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant={variant}
          size="sm"
          className={cn(
            "h-8",
            destructive &&
              "text-destructive hover:bg-destructive hover:text-destructive-foreground",
          )}
          disabled={busy}
        >
          {busy ? <IconLoader2 className="size-4 animate-spin" /> : label}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{label} lift request</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-2 py-2">
          <Label htmlFor={`decide-reason-${label}`}>Note (optional)</Label>
          <Textarea
            id={`decide-reason-${label}`}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Add a short note for the requester."
            rows={3}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            variant={destructive ? "destructive" : "default"}
            onClick={() => {
              setOpen(false);
              onConfirm(reason);
              setReason("");
            }}
          >
            {label}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── BlacklistLookupSection ────────────────────────────────────────────────────
// BLACKLIST VISIBILITY (owner ask 2026-06-12): "other organizers can see if a team
// or player was blacklisted by other orgs and how many times ... in any time frame
// they decide to check."
//
// A self-contained lookup card: a Team/Player pill toggle (shadcn Tabs, per AFC
// constants), the matching typeahead (TeamSearchSelect emits the numeric team_id;
// UserSearchSelect emits the username but hands back the full PickedUser, whose
// user_id is what the API wants), two OPTIONAL date inputs (empty = all time), and
// a Search button -> GET /organizers/blacklist-lookup/ (organizersApi.lookupBlacklists).
//
// The result reads "Blacklisted N times (M active)" plus a compact entries table:
// organization, dates, status badge. NO reasons - the backend strips them for
// organizers (the owner privacy rule), and this surface never asks for them.
//
// Rendered TWICE by the page: at the top of the managing view, and above the lock
// notice for members WITHOUT can_manage_registrations - the backend gate for this
// call is just "active member of any org", so every portal member can use it.
function BlacklistLookupSection() {
  // Which kind of target is being looked up. Switching modes clears the picked
  // target AND the previous result so stale answers never sit under a new picker.
  const [mode, setMode] = useState<"team" | "player">("team");

  // Team mode: the picked numeric team_id (what the API takes).
  const [teamId, setTeamId] = useState<number | null>(null);
  // Player mode: UserSearchSelect's value is the USERNAME, but the API keys off the
  // numeric user_id - so we keep both (username drives the picker UI, id the call).
  const [pickedUsername, setPickedUsername] = useState<string | null>(null);
  const [pickedUserId, setPickedUserId] = useState<number | null>(null);

  // Optional date window (ISO "YYYY-MM-DD" from the native date inputs). Both empty
  // = all time, mirroring the backend's open-ended-window default.
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [searching, setSearching] = useState(false);
  const [result, setResult] = useState<LookupResult | null>(null);

  // A target must be picked before Search enables (the API 400s without one).
  const hasTarget = mode === "team" ? teamId != null : pickedUserId != null;

  const switchMode = (next: "team" | "player") => {
    setMode(next);
    setTeamId(null);
    setPickedUsername(null);
    setPickedUserId(null);
    setResult(null);
  };

  // ── Run the lookup. GET /organizers/blacklist-lookup/ ──
  const handleSearch = async () => {
    if (!hasTarget || searching) return;
    setSearching(true);
    try {
      const res: LookupResult = await organizersApi.lookupBlacklists({
        ...(mode === "team"
          ? { team_id: teamId as number }
          : { user_id: pickedUserId as number }),
        // Only send the bounds the user actually set (empty string = omit = open).
        ...(startDate ? { start: startDate } : {}),
        ...(endDate ? { end: endDate } : {}),
        limit: 100,
      });
      setResult(res);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Lookup failed.");
    } finally {
      setSearching(false);
    }
  };

  // The headline name for the result card (team name or username, echoed by the API).
  const targetLabel =
    result?.target.type === "team"
      ? result.target.team_name ?? `Team #${result.target.team_id}`
      : result?.target.username ?? `User #${result?.target.user_id}`;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Blacklist lookup</CardTitle>
        <p className="text-xs text-muted-foreground">
          Check whether a team or player has been blacklisted by other
          organizations: how many times, by whom, and when. Reasons stay private
          to the blacklisting organization.
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {/* Target type toggle: pill-segment Tabs per AFC constants. */}
        <Tabs value={mode} onValueChange={(v) => switchMode(v as "team" | "player")}>
          <TabsList>
            <TabsTrigger value="team">Team</TabsTrigger>
            <TabsTrigger value="player">Player</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Picker + date window + Search, on one row on desktop. */}
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
          {/* The target typeahead (team_id or user_id, depending on mode). */}
          <div className="flex flex-1 flex-col gap-2">
            <Label>{mode === "team" ? "Team" : "Player"}</Label>
            {mode === "team" ? (
              <TeamSearchSelect
                value={teamId}
                onChange={(id) => setTeamId(id)}
                placeholder="Search a team to look up..."
              />
            ) : (
              <UserSearchSelect
                value={pickedUsername}
                onChange={(username: string | null, user?: PickedUser) => {
                  setPickedUsername(username);
                  // user is only present on a pick; clearing hands back null.
                  setPickedUserId(user?.user_id ?? null);
                }}
                placeholder="Search a player to look up..."
              />
            )}
          </div>
          {/* Optional window: any time frame the organizer decides to check. */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="lookup-start">From (optional)</Label>
            <Input
              id="lookup-start"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="lookup-end">To (optional)</Label>
            <Input
              id="lookup-end"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
          <Button
            className="gap-1.5"
            onClick={handleSearch}
            disabled={!hasTarget || searching}
          >
            {searching ? (
              <IconLoader2 className="size-4 animate-spin" />
            ) : (
              <IconSearch className="size-4" />
            )}
            Search
          </Button>
        </div>

        {/* ── Result: headline counts + the per-blacklist entries table. ── */}
        {result && (
          <div className="flex flex-col gap-3 rounded-md border p-4">
            {/* Headline: "Blacklisted N times (M active)" for the looked-up target. */}
            <p className="text-sm">
              <span className="font-medium">{targetLabel}</span>{" "}
              {result.total_count === 0 ? (
                <span className="text-muted-foreground">
                  has not been blacklisted
                  {result.window.start || result.window.end
                    ? " in the selected time frame."
                    : "."}
                </span>
              ) : (
                <>
                  <span className="text-muted-foreground">blacklisted</span>{" "}
                  <span className="font-semibold text-primary">
                    {result.total_count} time{result.total_count === 1 ? "" : "s"}
                  </span>{" "}
                  <span className="text-muted-foreground">
                    ({result.active_count} active)
                  </span>
                </>
              )}
            </p>

            {result.entries.length > 0 && (
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-foreground">Organization</TableHead>
                      {/* Player lookups show WHICH team the player was snapshotted on. */}
                      {result.target.type === "player" && (
                        <TableHead className="text-foreground">Team</TableHead>
                      )}
                      <TableHead className="text-foreground">Start</TableHead>
                      <TableHead className="text-foreground">End</TableHead>
                      <TableHead className="text-foreground">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.entries.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell className="text-xs font-medium">
                          {entry.organization_name ?? "-"}
                        </TableCell>
                        {result.target.type === "player" && (
                          <TableCell className="text-xs text-muted-foreground">
                            {entry.team_name ?? "-"}
                          </TableCell>
                        )}
                        <TableCell className="text-xs text-muted-foreground">
                          {entry.start_date ? formatDate(entry.start_date) : "-"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {entry.end_date ? formatDate(entry.end_date) : "-"}
                        </TableCell>
                        <TableCell>
                          {/* Same active-green / muted badge the blacklists table uses. */}
                          <StatusBadge status={entry.status} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
