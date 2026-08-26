"use client";

import { Fragment, useState, useEffect, useCallback, useMemo } from "react";
import axios from "axios";
import { toast } from "sonner";
// i18n: the search-box placeholder lives in the "events" namespace (messages/en/events.json),
// resolved for the active locale by useTranslations. The rest of this admin/organizer edit
// surface is plain English; only the new user-typed search placeholder is internationalized
// (the one new user-facing string this feature adds).
import { useTranslations } from "next-intl";
import { env } from "@/lib/env";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { IconAlertTriangle, IconLoader2 } from "@tabler/icons-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { InfoTip } from "@/components/ui/info-tip";
// Letter Avatars (feature #7): the shared broadcast composer. Passing it letterAssignments switches
// it to its built-in "Broadcast assignments" mode (POSTs /auth/broadcast-letter-assignments/), so it
// renders its own trigger button here in the card header. See SendNotificationModal.tsx.
import { SendNotificationModal } from "../../../_components/SendNotificationModal";
// Shared advisory-watchlist badge + client (components/WatchTag.tsx, lib/watchlist.ts). On load we
// ask watchlistApi.tags once which of the visible team_ids / member player_ids are actively watched,
// then render <WatchTag> next to those names so staff see the flag right on the registered roster.
import { WatchTag } from "@/components/WatchTag";
import { watchlistApi } from "@/lib/watchlist";
// Team country flag shown beside every registered team name (owner 2026-07-03). The team's
// auto-derived country rides on each tournament_teams[] row as team_country (get_event_details,
// afc_tournament_and_scrims/views.py). CountryFlag renders nothing when it's blank/unresolvable.
import { CountryFlag } from "@/lib/countryFlag";
import { IconChevronDown, IconUser, IconSearch } from "@tabler/icons-react";
import { DisqualifyModal } from "../../../_components/DisqualifyModal";
import { RemoveTeamModal } from "../../../_components/RemoveTeamModal";
import { ReactivateModal } from "../../../_components/ReactivateModal";
import { AddTeamsModal } from "../../../_components/AddTeamsModal";
// Invite teams to the event instead of force-adding them (owner backlog item 34). The card owns
// its own fetches (/events/team-invitations/...) and renders below the registered roster on BOTH
// the admin and organizer event-edit pages, since they share this tab.
import { EventTeamInvitesCard } from "../../../_components/EventTeamInvitesCard";
// Admin roster corrector: lets staff fix a registered team's event lineup (even after
// registration closes) by POSTing /events/edit-roster/. Reopens the team for sponsor
// re-approval when the roster changes. See EditRosterModal.tsx for the full contract.
// Requirement waivers (owner 2026-08-26): the admin control for excusing ONE team from named
// event requirements, on the record. See components/events/WaiverDialog.tsx and lib/waivers.ts.
import { WaiverDialog } from "@/components/events/WaiverDialog";
import { LocalTime } from "@/components/LocalTime";
import { listWaivers, revokeWaiver, type Waiver } from "@/lib/waivers";
import { EditRosterModal } from "../../../_components/EditRosterModal";

// The 26 letter-avatar options (A-Z) for the per-team Assign Select (feature #7). Built once at
// module scope so each render reuses the same array.
const LETTERS_A_Z = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i));

// A single player on a registered team's roster (from get_event_details
// tournament_teams[].members). username is the in-game name; uid + full_name give full
// identity; status is the per-member roster snapshot status.
interface TeamMember {
  player_id: number;
  username: string;
  uid?: string | null;
  full_name?: string | null;
  status?: string;
}

interface RegisteredTeamsTabProps {
  eventDetails: {
    event_id: number;
    event_name: string;
    participant_type: string;
    // Whether the event requires sponsor IDs. Threaded from the parent edit page's
    // eventDetails (get_event_details exposes is_sponsored; see edit/types.tsx). The
    // EditRosterModal needs it to collect per-player sponsor IDs on a sponsored event.
    is_sponsored?: boolean;
    // Letter Avatars (feature #7, owner 2026-06-29): the event's registration threshold (0 = off),
    // echoed by get_event_details. Drives whether the per-team letter-assignment UI is shown (also
    // shown if any team already has an assigned_letter). The per-team assigned_letter rides on each
    // tournament_teams[] entry; the live available_letters come from /events/event-team-letters/.
    min_letter_avatars?: number;
    registered_competitors: Array<{
      player_id: number;
      username: string;
      uid?: string | null;
      full_name?: string | null;
      status: string;
      is_waitlisted?: boolean;
    }>;
    tournament_teams: any[];
  };
  updateCompetitorStatus: (playerId: number, newStatus: string) => void;
  // In-place refresh (owner 2026-06-13 "no manual refresh"): the edit page passes its
  // fetchEventDetails here so the Add-Teams + Edit-Roster modals can re-pull + re-render
  // the registered roster instead of forcing a window.location.reload().
  onRefresh?: () => void;
}

export default function RegisteredTeamsTab({
  eventDetails,
  updateCompetitorStatus,
  onRefresh,
}: RegisteredTeamsTabProps) {
  // Which registered teams are expanded to show their player roster. Keyed by
  // tournament_team_id (falls back to team_id) so each team toggles independently.
  // Lets an admin see the PLAYERS inside each registered team, not just the team name
  // (owner request 2026-06-09); the players come from team.members on get_event_details.
  const [expandedTeams, setExpandedTeams] = useState<Record<number, boolean>>({});


  const toggleTeam = (key: number) =>
    setExpandedTeams((prev) => ({ ...prev, [key]: !prev[key] }));

  // ── Search filter (owner 2026-06-29) ──
  // Client-side, case-insensitive substring filter over the ALREADY-loaded registered list (no
  // refetch): filters teams by team_name on a team event and players by username on a solo event.
  // evT resolves the search placeholder from the "events" i18n namespace. Named evT (not t) so it
  // does not shadow the existing `(t: any) => ...` TEAM-row closures below (mirrors ActionsTab's bcT).
  // Applied to the same two filtered .map() chains that already drop waitlisted rows, so it composes.
  const evT = useTranslations("events");
  // evEditTabs holds the rest of this shared admin/organizer registered-roster surface (buttons,
  // status pills, no-show + letter-assign copy, confirm dialogs). Named etT (not t) so it does NOT
  // shadow the existing `(t: any) => ...` team-row closures below; evT stays for the two search
  // placeholders that already live in the "events" namespace.
  const etT = useTranslations("evEditTabs");
  // Requirement-waiver copy (messages/*/waivers.json).
  const wvT = useTranslations("waivers");
  const [search, setSearch] = useState("");
  const query = search.trim().toLowerCase();
  const matchesQuery = (name?: string | null) =>
    query === "" || (name ?? "").toLowerCase().includes(query);

  // No-show toggle (owner 2026-06-17): mark an active competitor absent so a waitlist team can take
  // the slot (Promote on the Waitlist tab). value flips the current is_no_show. Refreshes after.
  const { token } = useAuth();

  // ── Requirement waivers (owner 2026-08-26) ─────────────────────────────────────────────────
  // Which teams in THIS event have been excused, and from what. Loaded once per event and
  // refreshed after a grant or revoke, so the row can say "Waived by <admin>" instead of leaving
  // an admin guessing why a team that fails a requirement is sitting in the list.
  const [waivers, setWaivers] = useState<Waiver[]>([]);
  const [waiveFor, setWaiveFor] = useState<
    { id: number; name: string; isSolo: boolean } | null
  >(null);

  const loadWaivers = useCallback(async () => {
    if (!token) return;
    try {
      setWaivers(await listWaivers(token, eventDetails.event_id));
    } catch {
      // A waiver list that will not load must not break the registrations table: the table is the
      // primary job here and the waiver badge is extra information.
      setWaivers([]);
    }
  }, [token, eventDetails.event_id]);

  useEffect(() => {
    void loadWaivers();
  }, [loadWaivers]);

  // A SOLO event's waivers name a USER, a team event's name a TEAM (owner 2026-08-26). One lookup
  // that knows which key this event uses, so the row code below reads the same for both.
  const waiverForEntrant = (entrantId: number) =>
    waivers.find((w) =>
      isTeamEvent ? w.team_id === entrantId : w.user_id === entrantId,
    ) ?? null;

  const [noShowBusy, setNoShowBusy] = useState<number | null>(null);
  const markNoShow = async (
    opts: { competitorId?: number; tournamentTeamId?: number; current?: boolean; key: number },
  ) => {
    if (!token) return;
    setNoShowBusy(opts.key);
    try {
      await axios.post(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/mark-no-show/`,
        {
          event_id: eventDetails.event_id,
          value: !opts.current,
          ...(opts.tournamentTeamId
            ? { tournament_team_id: opts.tournamentTeamId }
            : { competitor_id: opts.competitorId }),
        },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      toast.success(
        opts.current
          ? etT("registeredTeams.toastNoShowCleared")
          : etT("registeredTeams.toastNoShowMarked"),
      );
      onRefresh?.();
    } catch (e: any) {
      toast.error(e.response?.data?.message || etT("registeredTeams.toastNoShowFailed"));
    } finally {
      setNoShowBusy(null);
    }
  };

  // Per-team roster-edit allowance (owner 2026-06-24): let THIS one team edit its roster (and its
  // members fix IGN/UID) even when the event-wide window is closed and even after results - "just like
  // the roster-edit window, but for a specific team". Toggle opens it to the max (the backend caps the
  // sent far-future `until` at the event end) or closes it. POSTs /events/team-roster-edit-window/.
  const [rosterAllowBusy, setRosterAllowBusy] = useState<number | null>(null);
  const toggleTeamRosterWindow = async (opts: {
    teamId: number;
    open: boolean; // true => open, false => close
    key: number;
  }) => {
    if (!token) return;
    setRosterAllowBusy(opts.key);
    try {
      // Far-future "until" so the backend caps it to the event end (max allowed window).
      const farUntil = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
      await axios.post(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/team-roster-edit-window/`,
        {
          event_id: eventDetails.event_id,
          team_id: opts.teamId,
          ...(opts.open ? { until: farUntil } : { open: false }),
        },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      toast.success(
        opts.open
          ? etT("registeredTeams.toastRosterOpened")
          : etT("registeredTeams.toastRosterClosed"),
      );
      onRefresh?.();
    } catch (e: any) {
      toast.error(
        e.response?.data?.message || etT("registeredTeams.toastRosterFailed"),
      );
    } finally {
      setRosterAllowBusy(null);
    }
  };
  // Live "is this team's window open?" from roster_edit_until vs the wall clock (the echoed
  // roster_edit_open is only a snapshot; derive live so a closed-by-time window reads correctly).
  const teamWindowOpen = (team: any) =>
    !!team.roster_edit_until &&
    new Date(team.roster_edit_until).getTime() > Date.now();

  // ── F1 no-show reputation (owner 2026-06-19) ──
  // Pull the repeat-no-show warning status for every visible team/player so a "⚠ Repeat no-show"
  // badge can flag teams that no-showed >= 2 times in the last 7 days (across ALL events). Bulk
  // call mirrors the blacklist-counts pattern.
  type Warn = { recent_count: number; total: number; is_warning: boolean };
  const [warnings, setWarnings] = useState<{
    teams: Record<number, Warn>;
    users: Record<number, Warn>;
  }>({ teams: {}, users: {} });
  // Pending no-show MARK awaiting confirmation (clearing a no-show skips the dialog).
  const [confirmTarget, setConfirmTarget] = useState<{
    competitorId?: number;
    tournamentTeamId?: number;
    key: number;
    name: string;
  } | null>(null);
  const [detectBusy, setDetectBusy] = useState(false);

  // A "team event" is anything that registers TEAMS (tournament_teams): both squad AND duo. The old
  // `=== "squad"` checks left duo events rendering an empty table and built warning ids from the wrong
  // collection. get_event_details populates tournament_teams for duo + squad alike. (Adversarial-review
  // fix, owner 2026-06-19.)
  const isTeamEvent = eventDetails.participant_type !== "solo";

  const fetchWarnings = useCallback(async () => {
    if (!token) return;
    const team_ids = isTeamEvent
      ? eventDetails.tournament_teams.map((t: any) => t.team_id).filter(Boolean)
      : [];
    const user_ids = !isTeamEvent
      ? (eventDetails.registered_competitors ?? []).map((c) => c.player_id)
      : [];
    if (team_ids.length === 0 && user_ids.length === 0) return;
    try {
      const res = await axios.post(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/no-show-warnings/`,
        { team_ids, user_ids },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setWarnings({ teams: res.data?.teams ?? {}, users: res.data?.users ?? {} });
    } catch {
      /* badges are best-effort; ignore */
    }
  }, [token, isTeamEvent, eventDetails]);

  useEffect(() => {
    fetchWarnings();
  }, [fetchWarnings]);

  // ── Watchlist tags (owner 2026-06-21) ──
  // One bulk "which of these ids are actively watched" call per load (and again whenever the team
  // list changes), collecting EVERY visible team id + member/competitor player id. Drives the
  // <WatchTag> badge next to flagged team + player names. Best-effort: failures leave it empty.
  const [watched, setWatched] = useState<{
    teamIds: Set<number>;
    playerIds: Set<number>;
  }>({ teamIds: new Set(), playerIds: new Set() });

  const fetchWatchTags = useCallback(async () => {
    // Teams: the registered teams' site team_id. Players: solo competitors OR every team member.
    const teamIds = isTeamEvent
      ? eventDetails.tournament_teams.map((t: any) => t.team_id).filter(Boolean)
      : [];
    const playerIds = isTeamEvent
      ? eventDetails.tournament_teams.flatMap((t: any) =>
          (t.members ?? []).map((m: TeamMember) => m.player_id),
        )
      : (eventDetails.registered_competitors ?? []).map((c) => c.player_id);
    if (teamIds.length === 0 && playerIds.length === 0) return;
    try {
      const res = await watchlistApi.tags({ teamIds, playerIds });
      setWatched({
        teamIds: new Set(res.watched_team_ids),
        playerIds: new Set(res.watched_player_ids),
      });
    } catch {
      /* badges are best-effort; ignore */
    }
  }, [isTeamEvent, eventDetails]);

  useEffect(() => {
    fetchWatchTags();
  }, [fetchWatchTags]);

  // ── Letter Avatars (feature #7, owner 2026-06-29) ──────────────────────────────────────────────
  // Per-event A-Z letter ASSIGNMENT for registered teams. OWNER DECISION (Open Q g): a letter is
  // UNIQUE per team per event. The live available_letters (union of members' owned User.letter_avatars
  // + the team's manual_letter_avatars) + assigned_letter + member_count come from
  // /events/event-team-letters/ (backend get_event_team_letters) - kept OFF get_event_details because
  // the union is heavy. We pull it on load (and after each assignment). assign-team-letter
  // (backend assign_team_letter) sets/changes/clears a team's letter (admins/orgs anytime) and notifies
  // the team's members; the header "Broadcast assignments" button (SendNotificationModal) announces
  // them all at once via /auth/broadcast-letter-assignments/.
  type LetterRow = {
    team_id: number;
    available_letters: string[];
    assigned_letter: string | null;
    member_count: number;
  };
  const [letterRows, setLetterRows] = useState<Record<number, LetterRow>>({});
  const [assignBusy, setAssignBusy] = useState<number | null>(null);
  // Pending assignment awaiting confirmation (it notifies the whole team, so we confirm first).
  const [assignTarget, setAssignTarget] = useState<{
    teamId: number;
    teamName: string;
    letter: string; // "" => unassign
  } | null>(null);

  // Show the letter UI for EVERY team (duo/squad) event (owner 2026-06-29): organizers may assign
  // letter avatars on any team event, not only events that REQUIRE letters. The assign endpoint
  // (assign_team_letter) already works regardless of Event.min_letter_avatars, so this is purely FE
  // visibility. Still hidden for solo events (a letter is a per-TEAM in-game banner). Previously this
  // was gated on min_letter_avatars > 0 OR an existing assignment, which hid the assign UI on a team
  // event that hadn't opted into the registration requirement.
  const showLetters = isTeamEvent;

  const fetchLetters = useCallback(async () => {
    if (!token || !showLetters) return;
    try {
      const res = await axios.get(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/event-team-letters/`,
        {
          params: { event_id: eventDetails.event_id, limit: 200 },
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      const map: Record<number, LetterRow> = {};
      for (const row of res.data?.teams ?? []) {
        map[row.team_id] = {
          team_id: row.team_id,
          available_letters: row.available_letters ?? [],
          assigned_letter: row.assigned_letter ?? null,
          member_count: row.member_count ?? 0,
        };
      }
      setLetterRows(map);
    } catch {
      /* the letter column is best-effort; ignore */
    }
  }, [token, showLetters, eventDetails.event_id]);

  useEffect(() => {
    fetchLetters();
  }, [fetchLetters]);

  // The assigned letter for a team: once the fresh fetch has loaded a row for this team, that row is
  // authoritative (even when its assigned_letter is null after a clear); only fall back to the
  // get_event_details echo when no row has been fetched yet. Distinguishing "row absent" from "row
  // present with null" stops a stale prop echo from re-surfacing a letter the admin just cleared.
  const assignedLetterFor = useCallback(
    (team: any): string | null => {
      const row = letterRows[team.team_id];
      if (row) return row.assigned_letter ?? null;
      return team.assigned_letter ?? null;
    },
    [letterRows],
  );

  // letter -> team_id holding it, across the whole event. Drives greying a letter already taken by
  // ANOTHER team in the per-row Select (a team's own current letter stays selectable).
  const takenByTeam = useMemo(() => {
    const m = new Map<string, number>();
    for (const team of eventDetails.tournament_teams ?? []) {
      const L = assignedLetterFor(team);
      if (L) m.set(L, team.team_id);
    }
    return m;
  }, [eventDetails.tournament_teams, assignedLetterFor]);

  // Teams that currently hold a letter, shaped for the SendNotificationModal broadcast payload.
  const letterAssignments = useMemo(
    () =>
      (eventDetails.tournament_teams ?? [])
        .map((team: any) => ({
          team_id: team.team_id,
          team_name: team.team_name,
          letter: assignedLetterFor(team) || "",
        }))
        .filter((a: { letter: string }) => !!a.letter),
    [eventDetails.tournament_teams, assignedLetterFor],
  );

  // POST the pending assignment (or clear). On success the team's members are notified server-side;
  // we re-pull the letters so every row's Select + the taken-letter greying reflect the change.
  const assignLetter = async () => {
    if (!token || !assignTarget) return;
    setAssignBusy(assignTarget.teamId);
    try {
      await axios.post(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/assign-team-letter/`,
        {
          event_id: eventDetails.event_id,
          team_id: assignTarget.teamId,
          letter: assignTarget.letter, // "" clears the assignment
        },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      toast.success(
        assignTarget.letter
          ? etT("registeredTeams.toastLetterAssigned", {
              letter: assignTarget.letter,
              team: assignTarget.teamName,
            })
          : etT("registeredTeams.toastLetterCleared", { team: assignTarget.teamName }),
      );
      setAssignTarget(null);
      await fetchLetters();
    } catch (e: any) {
      // Backend 409 (letter_taken) names the conflicting team; surface its message.
      toast.error(e.response?.data?.message || etT("registeredTeams.toastLetterFailed"));
    } finally {
      setAssignBusy(null);
    }
  };

  // Warning lookup for a row. Squad rows key on team_id; solo rows on the user id (player_id).
  const teamWarning = (teamId?: number) =>
    teamId != null ? warnings.teams[teamId] : undefined;
  const userWarning = (userId?: number) =>
    userId != null ? warnings.users[userId] : undefined;
  // Amber "⚠ Repeat no-show (N)" chip shown next to a flagged team/player (>=2 no-shows / 7 days).
  const warnBadge = (w?: Warn) =>
    w?.is_warning ? (
      <Badge
        variant="outline"
        className="rounded-full px-2 py-0.5 text-[10px] border-amber-500/60 text-amber-500 inline-flex items-center gap-1"
        title={etT("registeredTeams.repeatNoShowTitle", {
          recent: w.recent_count,
          total: w.total,
        })}
      >
        <IconAlertTriangle size={11} />{" "}
        {etT("registeredTeams.repeatNoShow", { count: w.recent_count })}
      </Badge>
    ) : null;

  // Mark requires confirmation (it counts against the team's reputation + frees their slot);
  // clearing is reversible/safe so it fires straight away.
  const requestNoShow = (opts: {
    competitorId?: number;
    tournamentTeamId?: number;
    current?: boolean;
    key: number;
    name: string;
  }) => {
    if (opts.current) {
      markNoShow(opts);
      return;
    }
    setConfirmTarget({
      competitorId: opts.competitorId,
      tournamentTeamId: opts.tournamentTeamId,
      key: opts.key,
      name: opts.name,
    });
  };

  const confirmAndMark = async () => {
    if (!confirmTarget) return;
    await markNoShow({ ...confirmTarget, current: false });
    setConfirmTarget(null);
    fetchWarnings();
  };

  // Suggest-only detection: ask the backend which registered competitors have NO results entered
  // (look like no-shows). We surface the names; the admin confirms each via the row's No-show button.
  const runDetect = async () => {
    if (!token) return;
    setDetectBusy(true);
    try {
      const res = await axios.post(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/detect-no-shows/`,
        { event_id: eventDetails.event_id },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const names = (res.data?.suggestions ?? []).map((s: any) => s.name);
      if (names.length === 0) {
        toast.success(etT("registeredTeams.toastNoLikelyNoShows"));
      } else {
        toast.warning(
          isTeamEvent
            ? etT("registeredTeams.detectTeams", { count: names.length })
            : etT("registeredTeams.detectPlayers", { count: names.length }),
          {
            description: etT("registeredTeams.detectReview", { names: names.join(", ") }),
            duration: 15000,
          },
        );
      }
    } catch (e: any) {
      toast.error(e.response?.data?.message || etT("registeredTeams.toastDetectFailed"));
    } finally {
      setDetectBusy(false);
    }
  };

  const teamCount =
    isTeamEvent
      ? eventDetails.tournament_teams.filter((t: any) => !t.is_waitlisted)
          .length
      : eventDetails?.registered_competitors?.filter((c) => !c.is_waitlisted)
          .length ?? 0;

  return (
    <div className="flex flex-col gap-4">
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2 flex-wrap">
          <span>
            {isTeamEvent
              ? etT("registeredTeams.headerTeams", { count: teamCount })
              : etT("registeredTeams.headerPlayers", { count: teamCount })}
          </span>
          <span className="inline-flex items-center gap-2 flex-wrap">
            {/* F1 suggest-only no-show detection: lists registered competitors with no results entered. */}
            <Button
              size="sm"
              variant="outline"
              onClick={runDetect}
              disabled={detectBusy}
            >
              {detectBusy && <IconLoader2 className="size-4 animate-spin mr-1" />}
              {etT("registeredTeams.checkNoShows")}
            </Button>
            {/* Letter Avatars (feature #7): announce every assigned letter to its team at once. The
                modal renders its own "Broadcast assignments" trigger when letterAssignments is
                non-empty; shown only when the event uses letters AND at least one team has one. */}
            {showLetters && letterAssignments.length > 0 && (
              <SendNotificationModal
                eventId={eventDetails.event_id}
                groupId={undefined}
                letterAssignments={letterAssignments}
                eventName={eventDetails.event_name}
                onSuccess={() => fetchLetters()}
              />
            )}
            {isTeamEvent && (
              <span className="inline-flex items-center gap-1">
                <AddTeamsModal
                  mode="event"
                  targetId={eventDetails.event_id}
                  targetName={eventDetails.event_name}
                  existingTeamIds={eventDetails.tournament_teams.map(
                    (t: any) => t.team_id,
                  )}
                  // Re-pull + re-render in place after teams are added (no reload).
                  onSuccess={() => onRefresh?.()}
                />
                {/* Edit-only: manually placing teams into the event. */}
                <InfoTip id="events.edit.add_teams" />
              </span>
            )}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="relative">
        {/* Search box (owner 2026-06-29): filters the already-loaded registered list in place by
            team/player name. Mirrors the AddTeamsModal search idiom (IconSearch + pl-9 Input). */}
        <div className="relative mb-3">
          <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder={
              isTeamEvent
                ? evT("registeredTeams.searchTeamsPlaceholder")
                : evT("registeredTeams.searchPlayersPlaceholder")
            }
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="overflow-x-auto rounded-md border max-h-96 overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  {isTeamEvent ? etT("registeredTeams.colTeams") : etT("registeredTeams.colPlayers")}
                </TableHead>
                <TableHead>{etT("registeredTeams.colStatus")}</TableHead>
                {/* Letter Avatars (feature #7): available letters + per-team Assign Select. Only for
                    team events that use letters (showLetters). */}
                {showLetters && <TableHead>{etT("registeredTeams.colLetters")}</TableHead>}
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* Logic for Solo Players */}
              {eventDetails.participant_type === "solo" &&
                eventDetails?.registered_competitors
                  ?.filter((c) => !c.is_waitlisted && matchesQuery(c.username))
                  .map((comp) => (
                  <TableRow key={comp.player_id}>
                    <TableCell className="capitalize font-medium">
                      <span className="inline-flex items-center gap-2 flex-wrap">
                        {comp.username}
                        {/* Advisory watchlist flag for this player. */}
                        {watched.playerIds.has(comp.player_id) && (
                          <WatchTag reason={etT("registeredTeams.watchTagReason")} />
                        )}
                        {warnBadge(userWarning(comp.player_id))}
                      </span>
                    </TableCell>
                    <TableCell className="capitalize">
                      <span
                        className={cn(
                          "px-2 py-1 rounded-full text-xs",
                          comp.status === "registered"
                            ? "bg-green-100 text-green-700"
                            : comp.status === "active"
                              ? "bg-green-100 text-green-700"
                              : "bg-red-100 text-red-700",
                        )}
                      >
                        {comp.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex items-center gap-1.5">
                        {/* No-show toggle (owner 2026-06-17): frees the slot for a waitlist promote. */}
                        <Button
                          size="sm"
                          variant={(comp as any).is_no_show ? "secondary" : "outline"}
                          disabled={noShowBusy === comp.player_id}
                          onClick={() =>
                            requestNoShow({
                              competitorId: comp.player_id,
                              current: !!(comp as any).is_no_show,
                              key: comp.player_id,
                              name: comp.username,
                            })
                          }
                        >
                          {(comp as any).is_no_show ? etT("registeredTeams.noShowDone") : etT("registeredTeams.noShow")}
                        </Button>
                        {/* Requirement waivers for a SOLO entrant (owner 2026-08-26). The same
                            control the team rows carry: an invited player is judged by the same
                            gates as a self-registering one, so excusing them is a decision with a
                            reason and a name on it. `player_id` IS the user id here, which is what
                            the waiver names. */}
                        {(() => {
                          const existing = waiverForEntrant(comp.player_id);
                          return (
                            <>
                              {existing ? (
                                <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                                  {wvT("waivedBy", { admin: existing.created_by })}
                                </span>
                              ) : null}
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  setWaiveFor({
                                    id: comp.player_id,
                                    name: comp.username,
                                    isSolo: true,
                                  })
                                }
                              >
                                {wvT("action")}
                              </Button>
                              {existing ? (
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  onClick={async () => {
                                    if (!token) return;
                                    try {
                                      await revokeWaiver(token, existing.waiver_id);
                                      toast.success(wvT("revoked"));
                                      void loadWaivers();
                                    } catch {
                                      toast.error(wvT("revokeFailed"));
                                    }
                                  }}
                                >
                                  {wvT("revoke")}
                                </Button>
                              ) : null}
                            </>
                          );
                        })()}
                        {comp.status === "registered" ? (
                          <DisqualifyModal
                            competitor_id={comp.player_id}
                            event_id={eventDetails.event_id}
                            name={comp.username}
                            showLabel
                            onSuccess={() =>
                              updateCompetitorStatus(
                                comp.player_id,
                                "disqualified",
                              )
                            }
                          />
                        ) : (
                          <ReactivateModal
                            competitor_id={comp.player_id}
                            event_id={eventDetails.event_id}
                            name={comp.username}
                            showLabel
                            onSuccess={() =>
                              updateCompetitorStatus(comp.player_id, "registered")
                            }
                          />
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}

              {/* Logic for Squads/Teams. Each team row is now EXPANDABLE: clicking the
                  team name (or its chevron) reveals a sub-row listing the team's PLAYERS
                  (in-game name, UID, status) from team.members, so an admin can see who
                  is on each registered team without leaving this tab. */}
              {isTeamEvent &&
                eventDetails?.tournament_teams
                  ?.filter((t: any) => !t.is_waitlisted && matchesQuery(t.team_name))
                  .map((team) => {
                  const key = team.tournament_team_id || team.team_id || team.player_id;
                  const members: TeamMember[] = team.members || [];
                  const isOpen = !!expandedTeams[key];
                  return (
                  <Fragment key={key}>
                  <TableRow>
                    <TableCell className="font-medium">
                      {/* Click the name to expand the roster; chevron rotates when open. */}
                      <button
                        type="button"
                        onClick={() => toggleTeam(key)}
                        className="flex items-center gap-1.5 text-left hover:text-primary transition-colors"
                        aria-expanded={isOpen}
                      >
                        <IconChevronDown
                          size={16}
                          className={cn(
                            "shrink-0 text-muted-foreground transition-transform",
                            isOpen && "rotate-180",
                          )}
                        />
                        {/* Flag beside the team name (team's auto-derived country). */}
                        <CountryFlag country={team.team_country} />
                        <span className="capitalize">{team.team_name}</span>
                        <Badge
                          variant="outline"
                          className="ml-1 rounded-full px-2 py-0.5 text-[10px]"
                        >
                          {etT("registeredTeams.playersCount", { count: members.length })}
                        </Badge>
                      </button>
                      {/* Advisory watchlist flag for this team (keyed on its site team_id). */}
                      {watched.teamIds.has(team.team_id) && (
                        <span className="ml-2 inline-flex">
                          <WatchTag reason={etT("registeredTeams.watchTagReason")} />
                        </span>
                      )}
                      {warnBadge(teamWarning(team.team_id)) && (
                        <span className="ml-2 inline-flex">
                          {warnBadge(teamWarning(team.team_id))}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="capitalize">
                      <span
                        className={cn(
                          "px-2 py-1 rounded-full text-xs",
                          team.status === "registered"
                            ? "bg-green-100 text-green-700"
                            : team.status === "active"
                              ? "bg-green-100 text-green-700"
                              : "bg-red-100 text-red-700",
                        )}
                      >
                        {team.status}
                      </span>
                    </TableCell>
                    {/* Letter Avatars (feature #7): available letters (live union) + the per-team
                        Assign Select. The Select greys letters already taken by ANOTHER team and
                        opens a confirm dialog (assignment notifies the whole team). */}
                    {showLetters && (
                      <TableCell>
                        <div className="flex flex-col gap-1.5">
                          {/* Available letters this team owns/has (members' letters + manual extras). */}
                          <div className="flex flex-wrap items-center gap-1">
                            {(letterRows[team.team_id]?.available_letters ?? []).length > 0 ? (
                              (letterRows[team.team_id]?.available_letters ?? []).map((L) => (
                                <Badge
                                  key={L}
                                  variant="outline"
                                  className="rounded-full px-1.5 py-0 text-[10px] font-mono"
                                >
                                  {L}
                                </Badge>
                              ))
                            ) : (
                              <span className="text-[10px] text-muted-foreground">
                                {etT("registeredTeams.noneOwned")}
                              </span>
                            )}
                          </div>
                          {/* Assigned letter Badge + the A-Z Assign Select. */}
                          <div className="flex items-center gap-1.5">
                            {assignedLetterFor(team) && (
                              <Badge className="rounded-full px-2 py-0.5 text-[10px] bg-primary text-primary-foreground">
                                {assignedLetterFor(team)}
                              </Badge>
                            )}
                            <Select
                              value={assignedLetterFor(team) ?? ""}
                              disabled={assignBusy === team.team_id}
                              onValueChange={(val) => {
                                const next = val === "__none__" ? "" : val;
                                // No-op if they re-picked the team's current letter.
                                if ((assignedLetterFor(team) ?? "") === next) return;
                                setAssignTarget({
                                  teamId: team.team_id,
                                  teamName: team.team_name,
                                  letter: next,
                                });
                              }}
                            >
                              <SelectTrigger className="h-9 w-24 text-xs">
                                <SelectValue placeholder={etT("registeredTeams.assign")} />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__none__">{etT("registeredTeams.unassign")}</SelectItem>
                                {LETTERS_A_Z.map((L) => {
                                  const holder = takenByTeam.get(L);
                                  const takenByOther =
                                    holder != null && holder !== team.team_id;
                                  return (
                                    <SelectItem key={L} value={L} disabled={takenByOther}>
                                      {L}
                                      {takenByOther ? etT("registeredTeams.taken") : ""}
                                    </SelectItem>
                                  );
                                })}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </TableCell>
                    )}
                    <TableCell className="text-right">
                      {/* Squad-only actions: correct the roster, then disqualify /
                          reactivate. EditRosterModal POSTs /events/edit-roster/ for THIS
                          team and reopens it for sponsor re-approval on change. */}
                      <div className="flex items-center justify-end gap-2">
                        {/* No-show toggle (owner 2026-06-17): frees the slot for a waitlist promote. */}
                        <Button
                          size="sm"
                          variant={team.is_no_show ? "secondary" : "outline"}
                          disabled={noShowBusy === key}
                          onClick={() =>
                            requestNoShow({
                              tournamentTeamId: team.tournament_team_id,
                              current: !!team.is_no_show,
                              key,
                              name: team.team_name,
                            })
                          }
                        >
                          {team.is_no_show ? etT("registeredTeams.noShowDone") : etT("registeredTeams.noShow")}
                        </Button>
                        {/* Per-team roster-edit allowance (owner 2026-06-24): let THIS team edit its
                            roster even when the event-wide window is closed / after results. Toggles
                            TournamentTeam.roster_edit_until (open to event end / close). */}
                        <Button
                          size="sm"
                          variant={teamWindowOpen(team) ? "secondary" : "outline"}
                          disabled={rosterAllowBusy === key}
                          title={
                            teamWindowOpen(team)
                              ? etT("registeredTeams.rosterEditOpenTitle")
                              : etT("registeredTeams.rosterEditClosedTitle")
                          }
                          onClick={() =>
                            toggleTeamRosterWindow({
                              teamId: team.team_id || team.player_id,
                              open: !teamWindowOpen(team),
                              key,
                            })
                          }
                        >
                          {teamWindowOpen(team) ? etT("registeredTeams.rosterEdit") : etT("registeredTeams.allowRosterEdit")}
                        </Button>
                        {/* Requirement waivers (owner 2026-08-26). An invited team is judged by
                            the same gates as everyone else, so excusing one is a real decision with
                            a reason and a name attached, not a silent bypass. A team that already
                            has one says so, with who granted it and when. */}
                        {(() => {
                          // On a solo event this row is a PLAYER, and player_id is their user id.
                          const entrantId = isTeamEvent
                            ? team.team_id
                            : team.player_id || team.team_id;
                          const existing = waiverForEntrant(entrantId);
                          return (
                            <div className="flex items-center gap-2">
                              {existing ? (
                                <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                                  {wvT("waivedBy", { admin: existing.created_by })}{" "}
                                  <LocalTime value={existing.created_at} mode="date" />
                                </span>
                              ) : null}
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  setWaiveFor({
                                    id: entrantId,
                                    name: team.team_name,
                                    isSolo: !isTeamEvent,
                                  })
                                }
                              >
                                {existing ? wvT("action") : wvT("action")}
                              </Button>
                              {existing ? (
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  onClick={async () => {
                                    if (!token) return;
                                    try {
                                      await revokeWaiver(token, existing.waiver_id);
                                      toast.success(wvT("revoked"));
                                      void loadWaivers();
                                    } catch {
                                      toast.error(wvT("revokeFailed"));
                                    }
                                  }}
                                >
                                  {wvT("revoke")}
                                </Button>
                              ) : null}
                            </div>
                          );
                        })()}
                        <EditRosterModal
                          event_id={eventDetails.event_id}
                          team_id={team.team_id || team.player_id}
                          team_name={team.team_name}
                          participant_type={eventDetails.participant_type}
                          is_sponsored={!!eventDetails.is_sponsored}
                          currentRoster={members}
                          // Re-pull + re-render in place after the roster is corrected
                          // (no reload): the team's new lineup + reopened status show.
                          onSuccess={() => onRefresh?.()}
                        />
                        {team.status === "active" ? (
                          <DisqualifyModal
                            competitor_id={team.team_id || team.player_id}
                            event_id={eventDetails.event_id}
                            name={team.team_name}
                            showLabel
                            isTeam   // route to /events/disqualify-team/ (was hitting the solo endpoint -> "failed")
                            onSuccess={() =>
                              updateCompetitorStatus(
                                team.team_id || team.player_id,
                                "disqualified",
                              )
                            }
                          />
                        ) : (
                          <ReactivateModal
                            competitor_id={team.team_id || team.player_id}
                            event_id={eventDetails.event_id}
                            name={team.team_name}
                            showLabel
                            isTeam   // route to /events/reactivate-team/
                            onSuccess={() =>
                              updateCompetitorStatus(
                                team.team_id || team.player_id,
                                "registered",
                              )
                            }
                          />
                        )}
                        {/* Remove the team from the event ENTIRELY (frees the slot) - distinct from
                            Disqualify which keeps them on record (owner 2026-06-22). Shown for any
                            status; backend blocks it once the team has match results. */}
                        <RemoveTeamModal
                          team_id={team.team_id || team.player_id}
                          event_id={eventDetails.event_id}
                          name={team.team_name}
                          showLabel
                          onSuccess={() => onRefresh?.()}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                  {/* Expanded roster: the players on this registered team. */}
                  {isOpen && (
                    <TableRow className="bg-muted/30 hover:bg-muted/30">
                      {/* +1 column when the Letters column is shown (feature #7). */}
                      <TableCell colSpan={showLetters ? 4 : 3} className="p-0">
                        {members.length === 0 ? (
                          <p className="px-6 py-3 text-xs text-muted-foreground">
                            {etT("registeredTeams.emptyRoster")}
                          </p>
                        ) : (
                          <div className="px-6 py-2 divide-y divide-border/50">
                            {members.map((m) => (
                              <div
                                key={m.player_id}
                                className="flex items-center gap-2 py-1.5 text-xs"
                              >
                                <IconUser
                                  size={14}
                                  className="shrink-0 text-muted-foreground"
                                />
                                <span className="font-medium">{m.username}</span>
                                {/* Advisory watchlist flag for this roster player. */}
                                {watched.playerIds.has(m.player_id) && (
                                  <WatchTag reason={etT("registeredTeams.watchTagReason")} />
                                )}
                                {m.uid && (
                                  <span className="text-muted-foreground">
                                    {etT("registeredTeams.uid", { uid: m.uid })}
                                  </span>
                                )}
                                {m.full_name && (
                                  <span className="text-muted-foreground">
                                    ({m.full_name})
                                  </span>
                                )}
                                {m.status && (
                                  <Badge
                                    variant="outline"
                                    className="ml-auto rounded-full px-2 py-0.5 text-[10px] capitalize"
                                  >
                                    {m.status}
                                  </Badge>
                                )}
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

              {/* Search empty-state (owner 2026-06-29): when a query is active but matches zero
                  non-waitlisted rows, show a "No teams/players match" line instead of a blank table.
                  Only shown WHILE searching - an event with no registrants at all already reads as an
                  empty table, so we don't want this firing then. colSpan spans every column including
                  the optional Letters column (mirrors the expanded-roster row's colSpan). */}
              {query !== "" &&
                (eventDetails.participant_type === "solo"
                  ? (eventDetails?.registered_competitors ?? []).filter(
                      (c: any) => !c.is_waitlisted && matchesQuery(c.username),
                    ).length
                  : (eventDetails?.tournament_teams ?? []).filter(
                      (t: any) => !t.is_waitlisted && matchesQuery(t.team_name),
                    ).length) === 0 && (
                  <TableRow className="hover:bg-transparent">
                    <TableCell
                      colSpan={showLetters ? 4 : 3}
                      className="py-8 text-center text-sm text-muted-foreground"
                    >
                      {isTeamEvent
                        ? evT("registeredTeams.noTeamsMatch", { query: search.trim() })
                        : evT("registeredTeams.noPlayersMatch", { query: search.trim() })}
                    </TableCell>
                  </TableRow>
                )}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      {/* F1: confirm marking a no-show (it counts against the team's reputation + frees their slot
          for the waitlist). Clearing a no-show skips this and fires immediately. */}
      <AlertDialog
        open={!!confirmTarget}
        onOpenChange={(o) => !o && setConfirmTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {etT("registeredTeams.confirmNoShowTitle", { name: confirmTarget?.name ?? "" })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isTeamEvent
                ? etT("registeredTeams.confirmNoShowDescTeam")
                : etT("registeredTeams.confirmNoShowDescPlayer")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={noShowBusy !== null}>
              {etT("registeredTeams.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                confirmAndMark();
              }}
              disabled={noShowBusy !== null}
            >
              {noShowBusy !== null && (
                <IconLoader2 className="size-4 animate-spin mr-1" />
              )}
              {etT("registeredTeams.markNoShow")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Letter Avatars (feature #7, owner 2026-06-29): confirm a letter assignment / change / clear.
          We confirm because every assignment NOTIFIES the whole team (assign_team_letter ->
          deliver_broadcast). The unique-per-event rule means reassigning frees the team's old letter. */}
      <AlertDialog
        open={!!assignTarget}
        onOpenChange={(o) => !o && setAssignTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {assignTarget?.letter
                ? etT("registeredTeams.confirmAssignTitle", {
                    letter: assignTarget.letter,
                    team: assignTarget?.teamName ?? "",
                  })
                : etT("registeredTeams.confirmClearTitle", {
                    team: assignTarget?.teamName ?? "",
                  })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {assignTarget?.letter
                ? etT("registeredTeams.confirmAssignDesc")
                : etT("registeredTeams.confirmClearDesc")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={assignBusy !== null}>
              {etT("registeredTeams.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                assignLetter();
              }}
              disabled={assignBusy !== null}
            >
              {assignBusy !== null && (
                <IconLoader2 className="size-4 animate-spin mr-1" />
              )}
              {assignTarget?.letter
                ? etT("registeredTeams.assignLetter")
                : etT("registeredTeams.clearLetter")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>

    {/* ── Team invitations (owner backlog item 34) ──────────────────────────────────────
        The ASK-first sibling of the Add-Teams button above: instead of force-registering a
        team or player, invite them and let them accept or decline. Sits in THIS shared tab so the
        admin event-edit page and the organizer one both get it from one component. */}
    {/* Rendered for BOTH shapes now (owner 2026-08-26): a team event invites teams, a solo event
        invites players. Before this a solo event could not invite anybody, because the backend
        refused the case outright. */}
    <EventTeamInvitesCard
      eventId={eventDetails.event_id}
      eventName={eventDetails.event_name}
      solo={!isTeamEvent}
      registeredTeamIds={eventDetails.tournament_teams.map((t: any) => t.team_id)}
    />
      {/* One dialog for the whole table: opened with whichever team the admin picked. */}
      {waiveFor ? (
        <WaiverDialog
          open={!!waiveFor}
          onOpenChange={(open) => {
            if (!open) setWaiveFor(null);
          }}
          eventId={eventDetails.event_id}
          teamId={waiveFor.isSolo ? null : waiveFor.id}
          userId={waiveFor.isSolo ? waiveFor.id : null}
          teamName={waiveFor.name}
          preselected={waiverForEntrant(waiveFor.id)?.waived_codes ?? []}
          onSaved={() => void loadWaivers()}
        />
      ) : null}
    </div>
  );
}
