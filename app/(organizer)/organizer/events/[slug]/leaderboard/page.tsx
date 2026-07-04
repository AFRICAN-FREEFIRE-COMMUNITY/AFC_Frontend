// ─────────────────────────────────────────────────────────────────────────────
// Organizer › Events › [slug] › Leaderboard.
//
// The per-event RESULTS + LEADERBOARD management surface for organizers. This is
// the heavy reuse page: it gives an org owner / a member with can_upload_results
// the SAME leaderboard capabilities AFC admins have on app/(a)/a/leaderboards/[id]
// - view a group's team/player leaderboard, edit a match's results (manual entry,
// OCR image upload, or 3D-room-file upload), configure the point system, and (when
// no leaderboard exists yet) CREATE/GENERATE one with a multi-step wizard - all
// scoped to THIS organizer's event.
//
// ── REUSE (Approach A - import the admin _components, don't re-implement) ──
//   View + edit-results surface (ported 1:1 from the admin [id] page):
//     • MatchMethodSelectionStep - pick manual / image / room-file for a match
//     • ManualMatchResultStep    - manual placement/kills/etc entry
//     • ImageUploadStep          - OCR screenshot upload (the SAME OCR the admin uses)
//     • FileUploadStep           - 3D room .txt/debugger upload
//     • DownloadLeaderboardButton - CSV export
//   Create-a-leaderboard wizard (ported from the admin create page):
//     • BasicInfoStep        - pick stage/group + leaderboard name (event preselected)
//     • ConfigurePointSystem - placement + kill/assist/damage points
//     • MatchOverviewStep    - per-match result entry (drives the 4 step components)
//     • EditLeaderboardStep  - fine-tune generated rows
//   Management tools (owner 2026-07-02 organizer parity, from the admin EDIT page):
//     • MvpTab               - event MVP by arranged criteria (events/<id>/mvp/)
//     • TieBreakersPanel     - equal-points ordering, all|stage|group scope
//     • DebuggerBackfillPanel - post-hoc debugger-log rich-stat fill
//     • Total Leaderboard adjustments tab + "Redo this map" + WatchTag standings
//       badges (ported inline - see the "Manage leaderboard tools" section below)
//   None of these components hard-code an admin role or an /a/ redirect, so they
//   drop straight into the organizer portal. Each already reads its Bearer token
//   from AuthContext (useAuth), and the backend now gates the underlying
//   /events/* result-upload endpoints on org_can(user, "can_upload_results", event)
//   (afc_organizers/permissions.py) - so the SAME calls authorise correctly for an
//   organizer without any per-call change here.
//
// ── ONE admin-only assumption worked around (NOT reused) ──
//   The admin create wizard's terminal step, ReviewAndPublishStep, ends with a
//   hard-coded `router.push("/a/leaderboards")` ("Done" button) - an admin route an
//   organizer can't enter (the admin layout would bounce them to /unauthorized).
//   Rather than fork that whole component just to change one navigation target, this
//   page ENDS the create wizard at MatchOverviewStep's onComplete: it flips back to
//   the VIEW surface (re-fetching the now-created leaderboard), which IS the
//   organizer's review surface. So no admin-only navigation is ever rendered here.
//   (Noted precisely in the agent's openQuestions.)
//
// ── SLUG → EVENT_ID + ORG OWNERSHIP CHECK ──
//   The admin [id] page is keyed by numeric event_id; the organizer portal routes by
//   slug (matching the rest of /organizer/events/*). So we resolve the slug against
//   the org's OWN events (GET /events/get-all-events/?organization_id=<id>) and pull
//   the numeric event_id off the match. If the slug isn't one of THIS org's events,
//   we show a "not your event" notice - the org can only ever touch its own events.
//   The numeric event_id then drives every downstream call exactly as on the admin
//   page (get-all-leaderboard-details-for-event takes { event_id }).
//
// GATING: gated on membership.permissions.can_upload_results OR isOwner (the org
// permission the backend enforces). A member without it gets the same read-only
// lock notice the list page + Design / Create-Event pages use.
//
// CONSUMES (backend, all via the reused components): get-all-leaderboard-details-for-event,
// get-all-events, create-leaderboard, upload-team/solo-match-result,
// upload-match-result-image (OCR), enter-team-match-result-manual, get-group-leaderboard.
// Lives under /organizer/events/<slug>/leaderboard; linked from
// /organizer/leaderboards (the list page's "Manage" button).
// ─────────────────────────────────────────────────────────────────────────────

"use client";

import React, { use, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
// Destructive confirm for "Redo this map" (organizer parity with the admin edit page,
// owner 2026-07-02 organizer parity): wiping a map's results needs an explicit confirm.
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  IconDatabaseImport,
  IconDeviceFloppy,
  IconDownload,
  IconEdit,
  IconLoader2,
  IconLock,
  IconMap,
  IconPlus,
  IconRefresh,
  IconScale,
  IconSettings,
  IconTrophy,
  IconUpload,
  IconUsers,
} from "@tabler/icons-react";
import { toast } from "sonner";
import { env } from "@/lib/env";
import { useAuth } from "@/contexts/AuthContext";
import { FullLoader } from "@/components/Loader";
import { PageHeader } from "@/components/PageHeader";
import { useOrganizer } from "../../../_components/OrganizerContext";

// ── Reused ADMIN leaderboard components (Approach A) ──────────────────────────
// View + edit-results surface (same imports the admin [id] page uses).
import { MatchMethodSelectionStep } from "@/app/(a)/a/leaderboards/_components/MatchMethodSelectionStep";
import { ManualMatchResultStep } from "@/app/(a)/a/leaderboards/_components/ManualMatchResultStep";
import { FileUploadStep } from "@/app/(a)/a/leaderboards/_components/FileUploadStep";
import { ImageUploadStep } from "@/app/(a)/a/leaderboards/_components/ImageUploadStep";
// Single-map OCR review flow (owner 2026-07-04 organizer parity): the SAME two-step upload the
// admin edit page uses for the image_upload path — MapSelectionStep (pick map + drop screenshot,
// POST /events/ocr-match-result/) then OCRReviewTable (edit + commit the extracted rows). Replaces
// the older auto-OCR-and-save ImageUploadStep in the per-match EDIT flow so organizers can review
// and correct rows before committing. Both components are role-agnostic and the endpoint already
// authorises org can_upload_results. (ImageUploadStep is still used by the create wizard below.)
import { MapSelectionStep } from "@/app/(a)/a/leaderboards/_components/MapSelectionStep";
import { OCRReviewTable } from "@/app/(a)/a/leaderboards/_components/OCRReviewTable";
import type { DraftRow } from "@/lib/api/ocr";
import { DownloadLeaderboardButton } from "@/app/(a)/a/leaderboards/_components/DownloadLeaderboardButton";
// Create-a-leaderboard wizard (same imports the admin create page uses).
import { BasicInfoStep } from "@/app/(a)/a/leaderboards/_components/BasicInfoStep";
import { ConfigurePointSystem } from "@/app/(a)/a/leaderboards/_components/ConfigurePointSystem";
import { MatchOverviewStep } from "@/app/(a)/a/leaderboards/_components/MatchOverviewStep";
import { EditLeaderboardStep } from "@/app/(a)/a/leaderboards/_components/EditLeaderboardStep";
// Whole-group editor (manual edit + bulk upload, all per group) - shared with the
// AFC admin editor. The bulk-upload panel is embedded INSIDE this editor.
import { GroupResultsEditor } from "@/app/(a)/a/leaderboards/_components/GroupResultsEditor";
// Flagged-kill controls (owner 2026-06-16): manage "ringer" kills for this TEAM event. Gated to
// organizers with can_upload_results (same as result entry). Backend: events/flagged-kills/*.
import { FlaggedKillsPanel } from "@/components/leaderboards/FlaggedKillsPanel";
// Multi-map .log upload (owner 2026-06-22) — shared with the admin leaderboard (cross-imported via
// the @/app alias, same pattern as EventStageExportGraphicDialog). Drop all maps' match-logs at
// once, assign+review+apply per file (reuses /events/upload-team-match-result/).
import { MultiMapLogUpload, type MatchOption } from "@/app/(a)/a/leaderboards/_components/MultiMapLogUpload";
import { InfoTip } from "@/components/ui/info-tip";
// Export graphic dialog (event-stage variant) - see _components/EventStageExportGraphicDialog.tsx.
// Calls leaderboardDesignsApi.downloadEventStageGraphic, which hits
// GET events/<eventId>/stages/<stageId>/graphic/ and returns a PNG blob.
import { EventStageExportGraphicDialog } from "./_components/EventStageExportGraphicDialog";
// "Copy OBS overlay link" dialog (components/overlay/CopyOverlayLinkDialog.tsx): builds the public
// live-overlay URL for this event's leaderboard so the organizer can drop it into OBS as a Browser
// Source. Shared with the admin leaderboard edit page. Org-scoped design library (organizationId).
import { CopyOverlayLinkDialog } from "@/components/overlay/CopyOverlayLinkDialog";
// Broadcast control (components/overlay/BroadcastControl.tsx, owner 2026-07-01): lets the organizer pick
// which stage/group the live overlay shows, or combine groups/stages into a cumulative, WITHOUT touching
// OBS. A "follow broadcast" overlay link (CopyOverlayLinkDialog with its follow switch on) tracks this
// selection and updates within one poll. Shared with the admin leaderboard edit page.
import { BroadcastControl } from "@/components/overlay/BroadcastControl";
// ── Leaderboard MANAGEMENT TOOLS (owner 2026-07-02 organizer parity) ──────────
// The admin leaderboard edit page (app/(a)/a/leaderboards/[id]/edit) grew four tools organizers
// also need on THEIR events. All four reuse the SAME admin components / endpoints; the backend
// already authorises organizers (see each note), so this page only mounts them:
//   • MvpTab               - event MVP by arranged criteria. GET/POST events/<id>/mvp/
//                            (gate _broadcast_gate = AFC event admin OR org can_edit_events).
//   • TieBreakersPanel     - arranged equal-points ordering, apply to all|stage|group.
//                            GET/POST events/<id>/tie-breakers/ (same _broadcast_gate).
//   • DebuggerBackfillPanel - post-hoc 3D-room debugger-log upload that fills rich player stats
//                            (deaths/headshots/survival...). POST events/<id>/debugger-backfill/
//                            (same _broadcast_gate).
// They render inside the "Manage leaderboard" pill-tab section below the standings card,
// mirroring the admin page's tab idiom. Reused admin components keep their English copy (same
// precedent as ManualMatchResultStep etc. above); the tab labels + everything ELSE authored on
// this page is i18n'd (organizer.eventLeaderboard.*).
import MvpTab from "@/app/(a)/a/leaderboards/_components/MvpTab";
import TieBreakersPanel from "@/app/(a)/a/leaderboards/_components/TieBreakersPanel";
import DebuggerBackfillPanel from "@/app/(a)/a/leaderboards/_components/DebuggerBackfillPanel";
// Scoring Config editor (owner 2026-07-04 organizer parity): the per-match kill/assist/damage +
// placement-ladder editor + "Apply to..." fan-out, shared with the admin edit page's Scoring tab.
// Mounted as a new tab in the "Manage leaderboard tools" section below. POSTs
// /events/edit-match-scoring-config/, which the backend gates on org can_upload_results — this
// page's own baseline gate — so it always shows here (like the Total Leaderboard tab).
import { ScoringConfigPanel } from "@/app/(a)/a/leaderboards/_components/ScoringConfigPanel";
// Advisory watchlist badges (owner 2026-07-02 organizer parity): one bulk watchlistApi.tags call
// per group marks which standings team_ids/player_ids are watched; <WatchTag> renders next to the
// flagged names, exactly like the admin edit page. Backend gate (admin OR organizer) is
// server-side (afc_auth/views_watchlist.py); badges are advisory + best-effort.
import { WatchTag } from "@/components/WatchTag";
// Team country flag beside team names in the team + player standings and the adjust-points table
// (owner 2026-07-03). Each row (overall_leaderboard / match.stats from
// get_all_leaderboard_details_for_event) carries team_country; player rows inherit it below. Mirrors
// the admin leaderboard view. CountryFlag renders nothing when the value is blank/unresolvable.
import { CountryFlag } from "@/lib/countryFlag";
import { watchlistApi } from "@/lib/watchlist";

type Params = { slug: string };
// The match-edit sub-views, mirroring the admin [id] page's MatchView union.
type MatchView = "method" | "manual" | "image_upload" | "room_file_upload";
// The create-leaderboard wizard's step machine (ported from the admin create page,
// MINUS its Review-and-Publish terminal step - see the header note on that).
type WizardView = "method" | "manual" | "image_upload" | "room_file_upload";

// formData shape the reused create-wizard steps consume (mirror of the admin
// create page's FormData). Held in page state across the wizard's steps.
interface WizardFormData {
  event_id: string;
  stage_id: string;
  group_id: string;
  event_slug: string;
  group_matches: any[];
  competitors_in_group: string[];
  group_leaderboard: any | null;
  placement_points: Record<string, number>;
  kill_point: string;
  assist_point: string;
  damage_point: string;
  apply_to_all_maps: boolean;
  placement_points_all?: Array<{
    match_id: number;
    kill_point: string;
    assist_point: string;
    damage_point: string;
  }>;
  leaderboard_id: number | null;
  completed_match_ids: number[];
}

const EMPTY_WIZARD_FORM: WizardFormData = {
  event_id: "",
  stage_id: "",
  group_id: "",
  event_slug: "",
  group_matches: [],
  competitors_in_group: [],
  group_leaderboard: null,
  placement_points: {},
  kill_point: "1",
  assist_point: "0.5",
  damage_point: "0.5",
  apply_to_all_maps: true,
  leaderboard_id: null,
  completed_match_ids: [],
};

export default function OrganizerEventLeaderboardPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug: routeSlug } = use(params);
  const { token } = useAuth();
  const { membership, isOwner } = useOrganizer();
  // i18n: organizer-facing page, keys under the "organizer" namespace (eventLeaderboard.*).
  const t = useTranslations("organizer");

  // The org permission the backend enforces for results upload.
  const canUploadResults =
    membership.permissions.can_upload_results || isOwner;
  // MVPs / tie-breakers / debugger backfill are gated server-side by _broadcast_gate
  // (org can_edit_events), NOT can_upload_results - so those tabs only show when the
  // member holds that permission (owner 2026-07-02 organizer parity).
  const canEditEvents = membership.permissions.can_edit_events || isOwner;
  const organizationId = membership.organization.organization_id;

  // ── slug → event resolution state ──
  // resolving: still mapping the slug to one of the org's events.
  // notMine: the slug resolved to an event that is NOT homed to this org (or no
  //          event matched at all) - the org can't manage it.
  const [resolving, setResolving] = useState(true);
  const [notMine, setNotMine] = useState(false);
  const [eventId, setEventId] = useState<string>("");
  const [eventNameFromList, setEventNameFromList] = useState<string>("");

  // ── Leaderboard-details state (mirrors the admin [id] page) ──
  const [eventData, setEventData] = useState<any>(null);
  // Bumped after a multi-map upload applies so FlaggedKillsPanel remounts + re-fetches its flags
  // (applying .log files rewrites MatchKillFlag; fetchLeaderboard alone doesn't refresh the panel).
  const [flagRefreshKey, setFlagRefreshKey] = useState(0);
  const [eventSlug, setEventSlug] = useState<string>(routeSlug);
  const [selectedStageId, setSelectedStageId] = useState<string>("");
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");
  const [selectedMatchId, setSelectedMatchId] = useState<string>("overall");
  const [leaderboardTab, setLeaderboardTab] = useState<"team" | "player">(
    "team",
  );

  // ── Edit-results state (mirrors the admin [id] page) ──
  const [editingMatch, setEditingMatch] = useState<{
    match: { match_id: number; match_name: string };
    view: MatchView;
    // Matches of the group that owns this match — fed to FileUploadStep's "All maps at once" mode.
    groupMatches?: MatchOption[];
  } | null>(null);
  const [matchPickerOpen, setMatchPickerOpen] = useState(false);
  const [pickerGroupId, setPickerGroupId] = useState<string>("");
  const [pickerMatchId, setPickerMatchId] = useState<string>("");
  // ── OCR review sub-flow state (image_upload edit path, owner 2026-07-04) ──
  // The image_upload edit flow is a 2-step mini-stepper: MapSelectionStep (pick map + upload
  // screenshot) hands a session up here, then OCRReviewTable takes over to edit + commit. null =
  // still on the map picker. Reset on every fresh edit + on commit so a new upload starts clean.
  const [ocrSession, setOcrSession] = useState<{
    sessionId: string;
    draftRows: DraftRow[];
    engine?: string | null;
  } | null>(null);
  // Whole-group editor sub-view (replaces the main view card, same inline-replace
  // pattern as editingMatch). Acts on the selected group; uploading is inside it.
  const [groupEditOpen, setGroupEditOpen] = useState(false);

  // ── Management-tools state (owner 2026-07-02 organizer parity) ──
  // Redo this map: in-flight flag for the destructive "clear this map" action
  // (POST /events/clear-match-result/, gate = admin OR org can_upload_results).
  const [redoingMap, setRedoingMap] = useState(false);
  // Total Leaderboard adjustments: per-entity point delta (positive = bonus, negative =
  // penalty, applied to the FIRST map, same semantics as the admin edit page) + save flag.
  const [adjustments, setAdjustments] = useState<Record<number, number>>({});
  const [savingAdjust, setSavingAdjust] = useState(false);
  // Advisory watchlist: which of the displayed standings ids are watched (bulk-tagged per
  // group via watchlistApi.tags; see the effect below). Mirrors the admin edit page.
  const [watched, setWatched] = useState<{
    teamIds: Set<number>;
    playerIds: Set<number>;
  }>({ teamIds: new Set(), playerIds: new Set() });

  // ── Create-leaderboard wizard state ──
  // mode "view" = the leaderboard view/edit surface; mode "create" = the wizard.
  const [mode, setMode] = useState<"view" | "create">("view");
  const [wizardStep, setWizardStep] = useState(1);
  const [wizardForm, setWizardForm] = useState<WizardFormData>(EMPTY_WIZARD_FORM);
  const [enteringMatch, setEnteringMatch] = useState<{
    match: { match_id: number; match_name: string };
    view: WizardView;
  } | null>(null);

  const updateWizardForm = (newData: Partial<WizardFormData>) =>
    setWizardForm((prev) => ({ ...prev, ...newData }));

  // ── 1) Resolve the slug to one of THIS org's events ───────────────────────────
  // We query the org's OWN events list (scoped by organization_id) and find the
  // event whose slug matches the route. This both maps slug → numeric event_id AND
  // enforces "only your own events" - a slug not in this list is treated as notMine.
  useEffect(() => {
    if (!canUploadResults) {
      setResolving(false);
      return;
    }
    const resolve = async () => {
      setResolving(true);
      try {
        const res = await fetch(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/get-all-events/?organization_id=${organizationId}`,
          { headers: token ? { Authorization: `Bearer ${token}` } : undefined },
        );
        const data = await res.json();
        const match = (data.events ?? []).find(
          (e: any) => e.slug === routeSlug,
        );
        if (!match) {
          setNotMine(true);
        } else {
          setEventId(String(match.event_id));
          setEventNameFromList(match.event_name ?? "");
          setEventSlug(match.slug ?? routeSlug);
        }
      } catch {
        // A failed resolution is treated as "not yours" rather than crashing the
        // page - the org simply can't manage what we couldn't confirm is theirs.
        setNotMine(true);
      } finally {
        setResolving(false);
      }
    };
    resolve();
  }, [routeSlug, organizationId, token, canUploadResults]);

  // ── 2) Load the leaderboard details for the resolved event_id ─────────────────
  // Same call the admin [id] page makes (POST get-all-leaderboard-details-for-event
  // with { event_id }). Re-fetched after each result edit so the view stays fresh.
  const fetchLeaderboard = async () => {
    if (!eventId) return;
    try {
      // AUTO-SEED safety-net (owner 2026-06-21): before loading standings, ensure every team added to
      // this event (organizer/public registration, admin add, or qualifier) is seeded into the ENTRY
      // stage's groups, so it appears here for stat entry WITHOUT a manual "Seed to groups" step.
      // Idempotent + gated (organizer with can_manage_registrations OR admin) on the backend; errors
      // are ignored so the page still loads. Endpoint: seeding_management.sync_entry_stage_seeding.
      try {
        await fetch(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/seeding/sync-entry-stage/`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ event_id: eventId }),
          },
        );
      } catch {
        // Non-fatal: standings still load.
      }

      const res = await fetch(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/get-all-leaderboard-details-for-event/`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ event_id: eventId }),
        },
      );
      const data = await res.json();
      setEventData(data);

      const slug = data.event_slug ?? data.slug ?? "";
      if (slug) setEventSlug(slug);

      if (!selectedStageId && data.stages?.length > 0) {
        setSelectedStageId(data.stages[0].stage_id.toString());
        setSelectedGroupId(data.stages[0].groups[0]?.group_id.toString());
      }
    } catch (error) {
      // Surface (not swallow) the failure - mirrors the admin page's logging so a
      // broken load is visible in the console instead of showing stale data silently.
      console.error(
        "Failed to load leaderboard details for event",
        eventId,
        error,
      );
    }
  };

  useEffect(() => {
    if (eventId) fetchLeaderboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, token]);

  // Reset group + match to defaults when the selected stage changes (admin parity).
  useEffect(() => {
    if (!selectedStageId || !eventData) return;
    const stage = eventData.stages?.find(
      (s: any) => s.stage_id.toString() === selectedStageId,
    );
    const firstGroup = stage?.groups?.[0];
    setSelectedGroupId(firstGroup?.group_id?.toString() ?? "");
    setSelectedMatchId("overall");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStageId]);

  // Reset match to overall when the selected group changes (admin parity). Pending
  // total-leaderboard adjustments are per-group deltas, so drop them too (admin parity).
  useEffect(() => {
    if (!selectedGroupId) return;
    setSelectedMatchId("overall");
    setAdjustments({});
  }, [selectedGroupId]);

  // ── Watchlist tags (owner 2026-07-02 organizer parity) ────────────────────────
  // Mark which standings rows are on the AFC-wide advisory watchlist so <WatchTag> can flag
  // them (ported from the admin edit page). Ids come from the SELECTED group's loaded data:
  // overall rows + per-match team/solo rows + each team's per-player rows. Id semantics differ
  // by mode (admin parity): in TEAM mode a standings row id is the team id and players[] carry
  // player ids; in SOLO mode a standings row id is the player (competitor) id. One bulk
  // watchlistApi.tags call per group change; best-effort (badges are advisory only).
  useEffect(() => {
    const stage = eventData?.stages?.find(
      (s: any) => s.stage_id.toString() === selectedStageId,
    );
    const group = stage?.groups?.find(
      (g: any) => g.group_id.toString() === selectedGroupId,
    );
    const isTeam = eventData?.participant_type !== "solo";
    const teamIds = new Set<number>();
    const playerIds = new Set<number>();
    const bucket = isTeam ? teamIds : playerIds;
    // overall standings rows (tournament_team_id in team mode, competitor_id in solo mode).
    for (const e of group?.overall_leaderboard ?? []) {
      const eid = e.tournament_team_id ?? e.competitor_id;
      if (eid) bucket.add(eid);
    }
    // per-match rows + each team's per-player rows (players only exist in team mode).
    for (const m of group?.matches ?? []) {
      for (const stat of m.stats ?? []) {
        const sid = stat.tournament_team_id ?? stat.competitor_id;
        if (sid) bucket.add(sid);
        for (const p of stat.players ?? []) {
          if (p.player_id) playerIds.add(p.player_id);
        }
      }
    }
    const teamArr = [...teamIds];
    const playerArr = [...playerIds];
    if (teamArr.length === 0 && playerArr.length === 0) {
      setWatched({ teamIds: new Set(), playerIds: new Set() });
      return;
    }
    let cancelled = false;
    watchlistApi
      .tags({ teamIds: teamArr, playerIds: playerArr })
      .then((res) => {
        if (cancelled) return;
        setWatched({
          teamIds: new Set(res.watched_team_ids),
          playerIds: new Set(res.watched_player_ids),
        });
      })
      .catch(() => {
        /* badges are best-effort; ignore */
      });
    return () => {
      cancelled = true;
    };
  }, [eventData, selectedStageId, selectedGroupId]);

  // Is this standings-row entity (a team in team mode, a player in solo mode) watched?
  const isEntityWatched = (id?: number) =>
    id != null &&
    (eventData?.participant_type !== "solo"
      ? watched.teamIds.has(id)
      : watched.playerIds.has(id));

  // ── Derived helpers (ported 1:1 from the admin [id] page) ─────────────────────
  const currentStage = eventData?.stages?.find(
    (s: any) => s.stage_id.toString() === selectedStageId,
  );
  const currentGroup = currentStage?.groups?.find(
    (g: any) => g.group_id.toString() === selectedGroupId,
  );
  const currentMatch = currentGroup?.matches?.find(
    (m: any) => m.match_id.toString() === selectedMatchId,
  );

  // Does ANY group in the event already have a saved leaderboard? Drives the
  // "create a leaderboard" empty state vs the normal view surface.
  const hasAnyLeaderboard = !!eventData?.stages?.some((s: any) =>
    s.groups?.some((g: any) => g.leaderboard),
  );

  const getTableData = () => {
    if (selectedMatchId === "overall")
      return currentGroup?.overall_leaderboard || [];
    const match = currentGroup?.matches?.find(
      (m: any) => m.match_id.toString() === selectedMatchId,
    );
    return match?.stats || [];
  };

  const getPlayerData = () => {
    if (selectedMatchId === "overall") {
      const playerMap = new Map<number, any>();
      for (const match of currentGroup?.matches ?? []) {
        for (const teamStat of match.stats ?? []) {
          for (const player of teamStat.players ?? []) {
            const existing = playerMap.get(player.player_id);
            if (existing) {
              existing.total_kills += player.kills;
              existing.total_damage += player.damage;
              existing.total_assists += player.assists;
            } else {
              playerMap.set(player.player_id, {
                player_id: player.player_id,
                username: player.username,
                team_name: teamStat.team_name ?? "-",
                // Carry the team's country onto the player row so the Player tab shows the same flag.
                team_country: teamStat.team_country,
                total_kills: player.kills,
                total_damage: player.damage,
                total_assists: player.assists,
              });
            }
          }
        }
      }
      return [...playerMap.values()].sort(
        (a, b) => b.total_kills - a.total_kills,
      );
    } else {
      const players: any[] = [];
      for (const teamStat of currentMatch?.stats ?? []) {
        for (const player of teamStat.players ?? []) {
          players.push({
            player_id: player.player_id,
            username: player.username,
            team_name: teamStat.team_name ?? "-",
            // Carry the team's country onto the player row so the Player tab shows the same flag.
            team_country: teamStat.team_country,
            total_kills: player.kills,
            total_damage: player.damage,
            total_assists: player.assists,
          });
        }
      }
      return players.sort((a, b) => b.total_kills - a.total_kills);
    }
  };

  // Derive participant type from API response ("squad"/anything-not-solo → "team").
  const detailsParticipantType: "solo" | "team" =
    eventData?.participant_type === "solo" ? "solo" : "team";

  // formData the reused ManualMatchResultStep / FileUploadStep consume in the EDIT
  // flow (built from the live leaderboard details, exactly like the admin [id] page).
  const detailsFormData = {
    event_slug: eventSlug,
    event_id: eventId,
    completed_match_ids:
      editingMatch && currentMatch?.result_inputted
        ? [editingMatch.match.match_id]
        : [],
    group_matches: currentGroup?.matches ?? [],
    competitors_in_group: [],
    group_leaderboard: currentGroup?.leaderboard ?? null,
    placement_points: {},
    kill_point: String(currentGroup?.leaderboard?.kill_point ?? "1"),
    assist_point: String(currentGroup?.leaderboard?.assist_point ?? "0.5"),
    damage_point: String(currentGroup?.leaderboard?.damage_point ?? "0.5"),
    apply_to_all_maps: true,
    leaderboard_id: currentGroup?.leaderboard?.leaderboard_id ?? null,
    group_id: selectedGroupId,
    stage_id: selectedStageId,
  };

  // ── Edit-results handlers (ported 1:1 from the admin [id] page) ───────────────
  const handleStartEditMatch = () => {
    // Start the OCR mini-stepper fresh every time (a stale session from a prior match must not
    // leak into a new one, since editingMatch alone drives which match the review commits to).
    setOcrSession(null);
    if (selectedMatchId !== "overall") {
      const m = currentGroup?.matches?.find(
        (x: any) => x.match_id.toString() === selectedMatchId,
      );
      if (!m) return;
      setEditingMatch({
        match: {
          match_id: m.match_id,
          match_name: t("eventLeaderboard.matchLabel", {
            number: m.match_number,
            map: m.match_map,
          }),
        },
        view: "method",
        groupMatches: currentGroup?.matches ?? [],
      });
    } else {
      setPickerGroupId(selectedGroupId);
      setPickerMatchId("");
      setMatchPickerOpen(true);
    }
  };

  const handlePickerConfirm = () => {
    const stage = eventData?.stages?.find(
      (s: any) => s.stage_id.toString() === selectedStageId,
    );
    const group = stage?.groups?.find(
      (g: any) => g.group_id.toString() === pickerGroupId,
    );
    const m = group?.matches?.find(
      (x: any) => x.match_id.toString() === pickerMatchId,
    );
    if (!m) return;
    setMatchPickerOpen(false);
    setOcrSession(null); // fresh OCR mini-stepper for the picked match
    setEditingMatch({
      match: {
        match_id: m.match_id,
        match_name: t("eventLeaderboard.matchLabel", {
          number: m.match_number,
          map: m.match_map,
        }),
      },
      view: "method",
      // Use the PICKED group's matches (the picker may target a different group than the one shown).
      groupMatches: group?.matches ?? [],
    });
  };

  const handleEditComplete = () => {
    fetchLeaderboard();
    setEditingMatch(null);
    setOcrSession(null); // clear any in-flight OCR draft when the edit flow closes
  };

  // ── Redo this map (owner 2026-07-02 organizer parity) ─────────────────────────
  // Wipe the currently selected map's results (stats reset, result_inputted -> False) so the
  // organizer can re-enter them from scratch. Other maps in the group are untouched. Ported
  // from the admin edit page; hits BE POST /events/clear-match-result/ (gate = AFC event admin
  // OR org can_upload_results, i.e. this page's own gate), then re-fetches so the map repaints
  // blank. Only offered while a SPECIFIC match is selected (not the overall view); gated
  // behind an AlertDialog because it is destructive.
  const handleRedoMap = async () => {
    if (selectedMatchId === "overall") return;
    setRedoingMap(true);
    try {
      const res = await fetch(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/clear-match-result/`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ match_id: Number(selectedMatchId), force: true }),
        },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || err.detail || "");
      }
      toast.success(t("eventLeaderboard.redoMap.success"));
      // Back to the overall view (the cleared map has nothing left to show), refresh the
      // standings and the flagged-kills panel (a wiped map also wipes its ringer flags).
      setSelectedMatchId("overall");
      fetchLeaderboard();
      setFlagRefreshKey((k) => k + 1);
    } catch (err: any) {
      toast.error(err.message || t("eventLeaderboard.redoMap.error"));
    } finally {
      setRedoingMap(false);
    }
  };

  // ── Total Leaderboard adjustments (owner 2026-07-02 organizer parity) ─────────
  // Apply overall point deltas: a positive adjustment adds bonus points, a negative one adds
  // penalty points, both onto the FIRST map of the group (same semantics as the admin edit
  // page's Total Leaderboard tab). Rows are rebuilt from the first map's SAVED stats (the same
  // data the admin page seeds its edit rows from) and re-posted through the proven per-map save
  // endpoints (edit-match-result / edit-solo-match-result, gate = org can_upload_results), so
  // the backend recomputes that map's totals and the overall standings shift by the delta.
  // NOTE: the request shape deliberately mirrors this page's other result saves (players keyed
  // by user_id, bonus/penalty included on team rows) - the shape the backend actually reads -
  // rather than the admin handler's stale variant.
  const handleSaveAdjustments = async () => {
    if (!currentGroup?.leaderboard?.leaderboard_id) {
      toast.error(t("eventLeaderboard.tools.noLeaderboard"));
      return;
    }
    const hasChanges = Object.values(adjustments).some((v) => v !== 0);
    if (!hasChanges) {
      toast.info(t("eventLeaderboard.tools.noAdjustments"));
      return;
    }
    const firstMatch = currentGroup?.matches?.[0];
    const stats: any[] = firstMatch?.stats ?? [];
    if (!firstMatch || stats.length === 0) {
      toast.error(t("eventLeaderboard.tools.noMatches"));
      return;
    }

    setSavingAdjust(true);
    try {
      // Fold each entity's delta into the first map's saved bonus/penalty. placement 0 marks a
      // not-played row in the saved stats (backend convention), so those re-save as played=false
      // to keep "placements unique among played teams" validation happy.
      const updatedRows = stats.map((stat: any) => {
        const rid = stat.competitor_id ?? stat.tournament_team_id ?? 0;
        const adj = adjustments[rid] ?? 0;
        return {
          id: rid,
          placement: stat.placement ?? 0,
          kills: stat.kills ?? 0,
          played: (stat.placement ?? 0) > 0,
          bonus_points: Math.max(
            0,
            (stat.bonus_points ?? 0) + (adj > 0 ? adj : 0),
          ),
          penalty_points: Math.max(
            0,
            (stat.penalty_points ?? 0) + (adj < 0 ? Math.abs(adj) : 0),
          ),
          // Saved per-player rows = the players who actually played this map (they are only
          // persisted for played players), re-sent unchanged keyed by user_id.
          players: (stat.players ?? []).map((p: any) => ({
            user_id: p.player_id,
            kills: p.kills ?? 0,
            damage: p.damage ?? 0,
            assists: p.assists ?? 0,
            played: true,
          })),
        };
      });

      let endpoint: string;
      let body: any;
      if (detailsParticipantType === "solo") {
        endpoint = `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/edit-solo-match-result/`;
        body = {
          match_id: firstMatch.match_id.toString(),
          rows: updatedRows.map((r) => ({
            competitor_id: r.id,
            placement: r.placement,
            kills: r.kills,
            played: r.played,
            bonus_points: r.bonus_points,
            penalty_points: r.penalty_points,
          })),
        };
      } else {
        endpoint = `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/edit-match-result/`;
        body = {
          match_id: firstMatch.match_id,
          results: updatedRows.map((r) => ({
            tournament_team_id: r.id,
            placement: r.placement,
            played: r.played,
            bonus_points: r.bonus_points,
            penalty_points: r.penalty_points,
            players: r.players,
          })),
        };
      }

      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || err.detail || "");
      }

      toast.success(t("eventLeaderboard.tools.adjustmentsSaved"));
      setAdjustments({});
      fetchLeaderboard();
    } catch (err: any) {
      toast.error(err.message || t("eventLeaderboard.tools.adjustmentsError"));
    } finally {
      setSavingAdjust(false);
    }
  };

  // ── Recalc after a scoring-config save (owner 2026-07-04 organizer parity) ────
  // The shared <ScoringConfigPanel> POSTs edit-match-scoring-config, which only STORES the new
  // scoring_settings — it does not recompute the map's already-saved points. So, exactly like the
  // admin edit page (whose onScoringSaved is handleSaveMatch), we re-save that map's SAVED stats
  // through the proven per-map endpoints (edit-match-result / edit-solo-match-result, gate = org
  // can_upload_results) so the backend recomputes its points against the new config, then refresh.
  // Row shape mirrors handleSaveAdjustments (players keyed by user_id; placement 0 = not played).
  // If the map has no saved results yet, there is nothing to recompute — just refresh (the config
  // is stored and will apply on the next result save). matchId always belongs to the current group
  // (the panel's groupMatches is currentGroup.matches).
  const resaveMatchForRecalc = async (matchId: number) => {
    const match = currentGroup?.matches?.find(
      (m: any) => m.match_id === matchId,
    );
    const stats: any[] = match?.stats ?? [];
    if (!match || stats.length === 0) {
      fetchLeaderboard();
      return;
    }

    const updatedRows = stats.map((stat: any) => {
      const rid = stat.competitor_id ?? stat.tournament_team_id ?? 0;
      return {
        id: rid,
        placement: stat.placement ?? 0,
        kills: stat.kills ?? 0,
        played: (stat.placement ?? 0) > 0,
        bonus_points: stat.bonus_points ?? 0,
        penalty_points: stat.penalty_points ?? 0,
        players: (stat.players ?? []).map((p: any) => ({
          user_id: p.player_id,
          kills: p.kills ?? 0,
          damage: p.damage ?? 0,
          assists: p.assists ?? 0,
          played: true,
        })),
      };
    });

    let endpoint: string;
    let body: any;
    if (detailsParticipantType === "solo") {
      endpoint = `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/edit-solo-match-result/`;
      body = {
        match_id: matchId.toString(),
        rows: updatedRows.map((r) => ({
          competitor_id: r.id,
          placement: r.placement,
          kills: r.kills,
          played: r.played,
          bonus_points: r.bonus_points,
          penalty_points: r.penalty_points,
        })),
      };
    } else {
      endpoint = `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/edit-match-result/`;
      body = {
        match_id: matchId,
        results: updatedRows.map((r) => ({
          tournament_team_id: r.id,
          placement: r.placement,
          played: r.played,
          bonus_points: r.bonus_points,
          penalty_points: r.penalty_points,
          players: r.players,
        })),
      };
    }

    try {
      await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
    } catch {
      // Non-fatal: the scoring config is already stored; the standings just won't reflect the
      // recompute until the next result save. The refresh below still runs.
    }
    fetchLeaderboard();
  };

  // ── Create-wizard handlers ────────────────────────────────────────────────────
  // Enter the wizard from the empty state. Steps: BasicInfo → ConfigurePoints →
  // MatchOverview (which opens the 4 reused result-entry steps per match). When the
  // organizer finishes the match overview, we leave the wizard and re-fetch the now
  // existing leaderboard into the VIEW surface (the organizer's review surface) -
  // see the header note on why we don't reuse the admin ReviewAndPublishStep here.
  const startCreate = () => {
    setWizardForm(EMPTY_WIZARD_FORM);
    setWizardStep(1);
    setEnteringMatch(null);
    setMode("create");
  };

  const exitCreateToView = () => {
    setMode("view");
    setWizardStep(1);
    setEnteringMatch(null);
    // Re-fetch so the freshly-created leaderboard shows in the view surface.
    fetchLeaderboard();
  };

  // ── Loading + gate states ─────────────────────────────────────────────────────

  // Permission gate first (no fetches happen without it).
  if (!canUploadResults) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeader title={t("eventLeaderboard.manageTitle")} back />
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <div className="flex size-12 items-center justify-center rounded-md bg-muted text-muted-foreground">
              <IconLock className="size-6" />
            </div>
            <p className="max-w-sm text-sm text-muted-foreground">
              {t("eventLeaderboard.noPermission")}
            </p>
            <Button asChild variant="outline" size="sm">
              <Link href="/organizer/leaderboards">
                {t("eventLeaderboard.backToLeaderboards")}
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (resolving)
    return <FullLoader text={t("eventLeaderboard.loadingEvent")} />;

  // The slug didn't resolve to one of THIS org's events.
  if (notMine) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeader title={t("eventLeaderboard.manageTitle")} back />
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <div className="flex size-12 items-center justify-center rounded-md bg-muted text-muted-foreground">
              <IconTrophy className="size-6" />
            </div>
            <p className="max-w-sm text-sm text-muted-foreground">
              {t("eventLeaderboard.notMine")}
            </p>
            <Button asChild variant="outline" size="sm">
              <Link href="/organizer/leaderboards">
                {t("eventLeaderboard.backToLeaderboards")}
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!eventData) return <FullLoader />;

  // ── CREATE-LEADERBOARD WIZARD ─────────────────────────────────────────────────
  // Rendered when the organizer chose to create a leaderboard. Reuses the admin
  // create steps; the only divergence is the terminal step (see header note).
  if (mode === "create") {
    const getStepTitle = () => {
      if (wizardStep === 1) return t("eventLeaderboard.wizard.basicInfo");
      if (wizardStep === 2) return t("eventLeaderboard.wizard.configurePoints");
      if (wizardStep === 3) {
        if (!enteringMatch) return t("eventLeaderboard.wizard.matchOverview");
        if (enteringMatch.view === "method")
          return t("eventLeaderboard.wizard.selectMethod");
        if (enteringMatch.view === "manual")
          return t("eventLeaderboard.wizard.manualInput");
        if (enteringMatch.view === "image_upload")
          return t("eventLeaderboard.wizard.imageUpload");
        if (enteringMatch.view === "room_file_upload")
          return t("eventLeaderboard.wizard.roomFileUpload");
      }
      if (wizardStep === 4) return t("eventLeaderboard.wizard.editLeaderboard");
      return "";
    };

    return (
      <div className="space-y-6 min-h-screen">
        <PageHeader
          back={wizardStep > 1 && !enteringMatch && wizardStep !== 4}
          title={t("eventLeaderboard.createLeaderboard")}
          description={`${eventData.event_name} • ${getStepTitle()}`}
        />

        <div className="mt-4">
          {/* Step 1: Basic Information - event is preselected to THIS event. */}
          {wizardStep === 1 && (
            <BasicInfoStep
              onNext={() => setWizardStep(2)}
              onBack={exitCreateToView}
              updateData={updateWizardForm}
              preselectedEventId={eventId}
            />
          )}

          {/* Step 2: Configure Point System */}
          {wizardStep === 2 && (
            <ConfigurePointSystem
              parentFormData={wizardForm}
              onNext={(data: any) => {
                updateWizardForm({
                  placement_points: data.placement_points,
                  kill_point: data.kill_point,
                  assist_point: data.assist_point,
                  damage_point: data.damage_point,
                  apply_to_all_maps: data.apply_to_all_maps,
                  placement_points_all: data.placement_points_all,
                  leaderboard_id: data.leaderboard_id ?? null,
                });
                setWizardStep(3);
              }}
              onBack={() => setWizardStep(1)}
            />
          )}

          {/* Step 3: Match Overview (opens the 4 reused result-entry sub-steps). */}
          {wizardStep === 3 && !enteringMatch && (
            <MatchOverviewStep
              formData={wizardForm}
              updateData={updateWizardForm}
              onEnterMatch={(match) =>
                setEnteringMatch({ match, view: "method" })
              }
              onComplete={() => setWizardStep(4)}
              onBack={() => setWizardStep(2)}
            />
          )}

          {/* Step 3 sub-view: choose upload method for a match. */}
          {wizardStep === 3 && enteringMatch?.view === "method" && (
            <MatchMethodSelectionStep
              matchName={enteringMatch.match.match_name}
              onSelect={(method) =>
                setEnteringMatch({
                  match: enteringMatch.match,
                  view: method as WizardView,
                })
              }
              onBack={() => setEnteringMatch(null)}
            />
          )}

          {/* Step 3 sub-view: manual result entry. */}
          {wizardStep === 3 && enteringMatch?.view === "manual" && (
            <ManualMatchResultStep
              match={enteringMatch.match}
              formData={wizardForm}
              onComplete={(matchId: number) => {
                updateWizardForm({
                  completed_match_ids: [
                    ...wizardForm.completed_match_ids,
                    matchId,
                  ].filter((v, i, a) => a.indexOf(v) === i),
                });
                setEnteringMatch(null);
              }}
              onBack={() =>
                setEnteringMatch({ match: enteringMatch.match, view: "method" })
              }
            />
          )}

          {/* Step 3 sub-view: OCR image upload. */}
          {wizardStep === 3 && enteringMatch?.view === "image_upload" && (
            <ImageUploadStep
              match={enteringMatch.match}
              onNext={() => {
                updateWizardForm({
                  completed_match_ids: [
                    ...wizardForm.completed_match_ids,
                    enteringMatch.match.match_id,
                  ].filter((v, i, a) => a.indexOf(v) === i),
                });
                setEnteringMatch(null);
              }}
              onBack={() =>
                setEnteringMatch({ match: enteringMatch.match, view: "method" })
              }
            />
          )}

          {/* Step 3 sub-view: 3D room file upload. */}
          {wizardStep === 3 && enteringMatch?.view === "room_file_upload" && (
            <FileUploadStep
              match={enteringMatch.match}
              formData={wizardForm}
              onNext={() => {
                updateWizardForm({
                  completed_match_ids: [
                    ...wizardForm.completed_match_ids,
                    enteringMatch.match.match_id,
                  ].filter((v, i, a) => a.indexOf(v) === i),
                });
                setEnteringMatch(null);
              }}
              onBack={() =>
                setEnteringMatch({ match: enteringMatch.match, view: "method" })
              }
            />
          )}

          {/* Step 4: Edit Leaderboard - then "Done" returns to the view surface
              (the organizer's review surface), instead of the admin's
              ReviewAndPublishStep with its /a/leaderboards redirect. */}
          {wizardStep === 4 && (
            <EditLeaderboardStep
              formData={wizardForm}
              onNext={exitCreateToView}
              onBack={() => setWizardStep(3)}
            />
          )}
        </div>
      </div>
    );
  }

  // Overall standings of the selected group ordered by effective total - feeds the
  // Total Leaderboard adjustments tab below (owner 2026-07-02 organizer parity).
  const sortedOverall: any[] = [...(currentGroup?.overall_leaderboard ?? [])].sort(
    (a: any, b: any) =>
      (b.effective_total ?? b.total_points ?? 0) -
      (a.effective_total ?? a.total_points ?? 0),
  );

  // ── VIEW + EDIT-RESULTS SURFACE (mirrors the admin [id] page) ──────────────────
  return (
    <div className="space-y-2 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between gap-2 mb-4">
        {/* data-tour anchor: PageHeader does not forward props to the DOM, so wrap it. */}
        <div data-tour="org-event-lb-title">
          <PageHeader
            back={!editingMatch}
            // ⓘ next to the title explains the whole flow: leaderboard auto-created at
            // event setup, then seed + start, then enter/upload results.
            title={
              <span className="inline-flex items-center gap-2">
                {eventData.event_name || eventNameFromList}
                <InfoTip id="leaderboards.detail._page" />
              </span>
            }
            description={t("eventLeaderboard.tournamentDescription", {
              type:
                detailsParticipantType === "solo"
                  ? t("eventLeaderboard.solo")
                  : t("eventLeaderboard.team"),
              count: eventData.stages?.length ?? 0,
            })}
          />
        </div>
        {!editingMatch && (
          <div className="flex gap-2 w-full md:w-auto">
            {/* "Create Leaderboard" removed: leaderboards are now created
                AUTOMATICALLY when the event's groups + maps are set up (backend
                create_event / edit_event), so manual creation is redundant. The AFC
                admin leaderboards list already hides its Create button for the same
                reason. The create wizard code is kept but no longer reachable. */}
            {/* Live OBS overlay link: builds the public /overlay/leaderboard/<token> URL for this
                event's leaderboard (org-scoped design library). Defaults to the on-screen stage/group;
                the dialog lets the organizer re-pick. Mirror mount on the admin edit page. */}
            {eventId && (
              <CopyOverlayLinkDialog
                eventId={eventId}
                stageId={selectedStageId}
                groupId={selectedGroupId}
                stages={eventData?.stages ?? []}
                organizationId={organizationId}
              />
            )}
            <DownloadLeaderboardButton
              leaderboardName={
                selectedMatchId === "overall"
                  ? eventData.event_name
                  : `${eventData.event_name} - ${t(
                      "eventLeaderboard.matchLabel",
                      {
                        number: currentMatch?.match_number,
                        map: currentMatch?.match_map,
                      },
                    )}`
              }
              teamRows={getTableData()}
              playerRows={getPlayerData()}
              participantType={detailsParticipantType}
              killPoint={Number(currentGroup?.leaderboard?.kill_point ?? 1)}
            />
          </div>
        )}
      </div>

      {/* Broadcast control: switch what the live overlay shows (group / stage-cumulative /
          event-cumulative / custom) WITHOUT touching OBS. Only meaningful once a leaderboard exists
          (there are stages/groups to broadcast) and not while editing a match. Passes the org id for
          parity with the overlay link dialog. */}
      {!editingMatch && hasAnyLeaderboard && eventId && (
        <div className="mb-4">
          <BroadcastControl eventId={eventId} organizationId={organizationId} />
        </div>
      )}

      {/* ── Empty state: no leaderboard yet ──
          Leaderboards auto-create when the event's groups + maps are set up, so the
          fix for an empty state is to finish that setup (not a manual create). */}
      {!editingMatch && !hasAnyLeaderboard && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <div className="flex size-12 items-center justify-center rounded-md bg-primary/10 text-primary">
              <IconTrophy className="size-6" />
            </div>
            <p className="max-w-sm text-sm text-muted-foreground">
              {t("eventLeaderboard.emptyState")}
            </p>
            <Button asChild variant="outline" size="sm">
              <Link href={`/organizer/events/${routeSlug}/edit`}>
                {t("eventLeaderboard.openEventEditor")}
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Stage tabs - hidden while editing a match (admin [id] parity). */}
      {!editingMatch && hasAnyLeaderboard && eventData.stages?.length > 0 && (
        <Tabs
          data-tour="org-event-lb-stage-tabs"
          value={selectedStageId}
          onValueChange={setSelectedStageId}
        >
          <ScrollArea>
            <TabsList className="w-full justify-start">
              {eventData.stages.map((s: any) => (
                <TabsTrigger key={s.stage_id} value={s.stage_id.toString()}>
                  {s.stage_name}
                </TabsTrigger>
              ))}
            </TabsList>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </Tabs>
      )}

      {/* ── Normal leaderboard view ── */}
      {/* data-tour anchor: this Card wraps the whole standings panel (group/view
          pickers + the solo table or team tabs), so the tour step works for both
          solo and team events without targeting a conditional inner branch. */}
      {!editingMatch && !groupEditOpen && hasAnyLeaderboard && (
        <Card data-tour="org-event-lb-table">
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <div className="space-y-2">
                <Label>
                  <IconUsers size={14} /> {t("eventLeaderboard.group")}
                </Label>
                <Select
                  value={selectedGroupId}
                  onValueChange={setSelectedGroupId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("eventLeaderboard.selectGroup")} />
                  </SelectTrigger>
                  <SelectContent>
                    {currentStage?.groups.map((g: any) => (
                      <SelectItem
                        key={g.group_id}
                        value={g.group_id.toString()}
                      >
                        {g.group_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>
                  <IconMap size={14} /> {t("eventLeaderboard.viewType")}
                </Label>
                <Select
                  value={selectedMatchId}
                  onValueChange={setSelectedMatchId}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="overall">
                      {t("eventLeaderboard.overallLeaderboard")}
                    </SelectItem>
                    {currentGroup?.matches?.map((m: any) => (
                      <SelectItem
                        key={m.match_id}
                        value={m.match_id.toString()}
                      >
                        {t("eventLeaderboard.matchLabel", {
                          number: m.match_number,
                          map: m.match_map,
                        })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg">
                <p className="text-[10px] font-semibold text-primary uppercase">
                  {t("eventLeaderboard.currentKillPoints")}
                </p>
                <p className="text-xl font-bold">
                  {currentGroup?.leaderboard?.kill_point || 0}
                </p>
              </div>
            </div>

            <CardTitle className="text-lg flex items-center gap-2">
              <IconTrophy size={18} className="text-yellow-500" />
              {t("eventLeaderboard.rankings")}
            </CardTitle>

            {detailsParticipantType === "solo" ? (
              /* ── Solo: single player table, no tabs ── */
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("eventLeaderboard.table.rank")}</TableHead>
                      <TableHead>{t("eventLeaderboard.table.player")}</TableHead>
                      {selectedMatchId === "overall" && (
                        <TableHead>
                          {t("eventLeaderboard.table.matches")}
                        </TableHead>
                      )}
                      <TableHead>{t("eventLeaderboard.table.kills")}</TableHead>
                      <TableHead className="text-right">
                        {t("eventLeaderboard.table.totalPts")}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {getTableData().map((row: any, idx: number) => (
                      <TableRow key={idx}>
                        <TableCell>#{idx + 1}</TableCell>
                        <TableCell className="font-bold">
                          <span className="inline-flex items-center gap-2">
                            {row.competitor__user__username ||
                              row.username ||
                              t("eventLeaderboard.unknown")}
                            {/* Advisory watchlist flag (solo mode: row id = player). */}
                            {isEntityWatched(
                              row.competitor_id ?? row.tournament_team_id,
                            ) && (
                              <WatchTag
                                label={t("eventLeaderboard.watch.label")}
                                reason={t("eventLeaderboard.watch.reason")}
                              />
                            )}
                          </span>
                        </TableCell>
                        {selectedMatchId === "overall" && (
                          <TableCell className="text-zinc-400">
                            {row.matches_played || 0}
                          </TableCell>
                        )}
                        <TableCell>
                          {(row.total_kills || row.kills) ?? "0"}
                        </TableCell>
                        <TableCell className="text-right font-bold text-primary">
                          {(row.total_points || row.total_pts || 0).toFixed(1)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {getTableData().length === 0 && (
                  <div className="text-center py-14 text-muted-foreground italic border-2 border-dashed border-zinc-800 rounded-lg">
                    {t("eventLeaderboard.noResult")}
                  </div>
                )}
              </>
            ) : (
              /* ── Team: two tabs ── */
              <Tabs
                value={leaderboardTab}
                onValueChange={(v) => setLeaderboardTab(v as "team" | "player")}
              >
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="team">
                    {t("eventLeaderboard.teamLeaderboard")}
                  </TabsTrigger>
                  <TabsTrigger value="player">
                    {t("eventLeaderboard.playerLeaderboard")}
                  </TabsTrigger>
                </TabsList>

                {/* ── Team Leaderboard ── */}
                <TabsContent value="team" className="mt-4">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("eventLeaderboard.table.rank")}</TableHead>
                        <TableHead>{t("eventLeaderboard.table.team")}</TableHead>
                        {selectedMatchId === "overall" && (
                          <TableHead>
                            {t("eventLeaderboard.table.matches")}
                          </TableHead>
                        )}
                        {selectedMatchId === "overall" && (
                          <TableHead>
                            {t("eventLeaderboard.table.booyahs")}
                          </TableHead>
                        )}
                        <TableHead>{t("eventLeaderboard.table.kills")}</TableHead>
                        <TableHead className="text-right">
                          {t("eventLeaderboard.table.totalPts")}
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {getTableData().map((row: any, idx: number) => (
                        <TableRow key={idx}>
                          <TableCell>#{idx + 1}</TableCell>
                          <TableCell className="font-bold">
                            <span className="inline-flex items-center gap-2">
                              {/* Flag beside the team name (team's country). */}
                              <CountryFlag country={row.team_country} />
                              {row.team_name ||
                                row.username ||
                                t("eventLeaderboard.unknown")}
                              {/* Advisory watchlist flag (team mode: row id = team). */}
                              {isEntityWatched(
                                row.tournament_team_id ?? row.competitor_id,
                              ) && (
                                <WatchTag
                                  label={t("eventLeaderboard.watch.label")}
                                  reason={t("eventLeaderboard.watch.reason")}
                                />
                              )}
                            </span>
                          </TableCell>
                          {selectedMatchId === "overall" && (
                            <TableCell className="text-zinc-400">
                              {row.matches_played || 0}
                            </TableCell>
                          )}
                          {selectedMatchId === "overall" && (
                            <TableCell className="text-zinc-400">
                              {row.total_booyah ?? 0}
                            </TableCell>
                          )}
                          <TableCell>
                            {(row.total_kills || row.kills) ?? "0"}
                          </TableCell>
                          <TableCell className="text-right font-bold text-primary">
                            {(row.total_points || row.total_pts || 0).toFixed(1)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {getTableData().length === 0 && (
                    <div className="text-center py-14 text-muted-foreground italic border-2 border-dashed border-zinc-800 rounded-lg">
                      {t("eventLeaderboard.noResult")}
                    </div>
                  )}
                </TabsContent>

                {/* ── Player Leaderboard ── */}
                <TabsContent value="player" className="mt-4">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("eventLeaderboard.table.rank")}</TableHead>
                        <TableHead>
                          {t("eventLeaderboard.table.player")}
                        </TableHead>
                        <TableHead>{t("eventLeaderboard.table.team")}</TableHead>
                        <TableHead className="text-right">
                          {t("eventLeaderboard.table.kills")}
                        </TableHead>
                        <TableHead className="text-right">
                          {t("eventLeaderboard.table.damage")}
                        </TableHead>
                        <TableHead className="text-right">
                          {t("eventLeaderboard.table.assists")}
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {getPlayerData().map((player: any, idx: number) => (
                        <TableRow key={player.player_id}>
                          <TableCell className="text-muted-foreground">
                            #{idx + 1}
                          </TableCell>
                          <TableCell className="font-bold">
                            <span className="inline-flex items-center gap-2">
                              {player.username}
                              {/* Advisory watchlist flag for this player. */}
                              {watched.playerIds.has(player.player_id) && (
                                <WatchTag
                                  label={t("eventLeaderboard.watch.label")}
                                  reason={t("eventLeaderboard.watch.reason")}
                                />
                              )}
                            </span>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            <span className="inline-flex items-center gap-1.5">
                              {/* Flag beside the player's team name (team's country). */}
                              <CountryFlag country={player.team_country} />
                              {player.team_name}
                            </span>
                          </TableCell>
                          <TableCell className="text-right font-bold text-primary">
                            {player.total_kills}
                          </TableCell>
                          <TableCell className="text-right">
                            {player.total_damage}
                          </TableCell>
                          <TableCell className="text-right">
                            {player.total_assists}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {getPlayerData().length === 0 && (
                    <div className="text-center py-14 text-muted-foreground italic border-2 border-dashed border-zinc-800 rounded-lg">
                      {t("eventLeaderboard.noPlayerData")}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            )}

            {/* Action buttons:
                • Edit Match Results - per-map flow (manual / image / room file) for ONE map.
                • Edit Whole Group   - this group's hub: UPLOAD results (bulk, all maps) AND
                  edit every map manually, then Save all. Upload now lives in here, so there
                  is no separate stage-looking "Bulk Upload" button.
                • Export graphic     - download the current stage standings as a branded PNG.
                  Only shown on the overall view (selectedMatchId === "overall") since the
                  backend graphic endpoint renders cumulative stage standings, not a single map. */}
            {/* ⓘ sit as siblings (not nested) - InfoTip is itself a button. */}
            <div className="flex gap-2 flex-wrap items-center">
              <Button onClick={handleStartEditMatch}>
                <IconEdit size={18} /> {t("eventLeaderboard.editMatchResults")}
              </Button>
              <InfoTip id="leaderboards.detail.edit_match_results" />
              {currentGroup?.matches?.length > 0 && (
                <>
                  <Button
                    variant="outline"
                    onClick={() => setGroupEditOpen(true)}
                  >
                    <IconUpload size={18} />{" "}
                    {t("eventLeaderboard.uploadEditGroup")}
                  </Button>
                  <InfoTip id="leaderboards.detail.upload_edit_group" />
                </>
              )}
              {/* Redo this map (owner 2026-07-02 organizer parity): clears ONLY the selected
                  map's results so they can be re-entered. Only offered while a specific match
                  is on screen (not the overall view). Destructive -> AlertDialog confirm.
                  Calls handleRedoMap -> POST /events/clear-match-result/. */}
              {selectedMatchId !== "overall" && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" disabled={redoingMap}>
                      {redoingMap ? (
                        <span className="flex items-center gap-2">
                          <IconLoader2 size={14} className="animate-spin" />
                          {t("eventLeaderboard.redoMap.clearing")}
                        </span>
                      ) : (
                        <span className="flex items-center gap-2">
                          <IconRefresh size={14} />
                          {t("eventLeaderboard.redoMap.button")}
                        </span>
                      )}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>
                        {t("eventLeaderboard.redoMap.title")}
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        {t("eventLeaderboard.redoMap.description")}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>
                        {t("eventLeaderboard.cancel")}
                      </AlertDialogCancel>
                      <AlertDialogAction onClick={handleRedoMap}>
                        {t("eventLeaderboard.redoMap.confirm")}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
              {/* Export graphic - only meaningful on the cumulative overall view. */}
              {selectedMatchId === "overall" && selectedStageId && (
                <EventStageExportGraphicDialog
                  eventId={eventId}
                  stageId={selectedStageId}
                  // Default to the on-screen per-group "Overall Leaderboard" (owner 2026-06-16);
                  // the dialog lets the organizer re-pick any stage/group via `stages`.
                  groupId={selectedGroupId}
                  stages={eventData?.stages ?? []}
                  organizationId={organizationId}
                  defaultTitle={eventData.event_name || eventNameFromList}
                  defaultSubtitle={currentStage?.stage_name ?? ""}
                  trigger={
                    <Button variant="outline" size="sm">
                      <IconDownload size={16} />{" "}
                      {t("eventLeaderboard.exportGraphic")}
                    </Button>
                  }
                />
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Edit sub-views (inline, replacing the card) - reused result steps ── */}

      {editingMatch?.view === "method" && (
        <MatchMethodSelectionStep
          matchName={editingMatch.match.match_name}
          onSelect={(method) =>
            setEditingMatch({ ...editingMatch, view: method as MatchView })
          }
          onBack={() => setEditingMatch(null)}
        />
      )}

      {editingMatch?.view === "manual" && (
        <ManualMatchResultStep
          match={editingMatch.match}
          formData={detailsFormData}
          participantTypeOverride={detailsParticipantType}
          initialStats={currentMatch?.stats ?? []}
          // Surface the ordered-entry banner only on Champion-Point stages.
          championPointEnabled={currentStage?.champion_point_enabled ?? false}
          onComplete={handleEditComplete}
          onBack={() => setEditingMatch({ ...editingMatch, view: "method" })}
        />
      )}

      {/* ── Image Upload = the OCR review mini-stepper (owner 2026-07-04 organizer parity) ──
          Step 1 (no session yet): MapSelectionStep — pick which map this screenshot is for and
          upload it (POST /events/ocr-match-result/). Step 2 (session ready): OCRReviewTable —
          edit + commit the auto-extracted rows before they are written. Mirrors the admin edit
          page exactly; onCommitted runs handleEditComplete (refresh + close, same as every other
          edit path). `maps` is this match's group's matches (position drives the 1-based map_index
          the backend expects). Replaces the older auto-OCR-and-save ImageUploadStep so organizers
          can review/correct rows first. */}
      {editingMatch?.view === "image_upload" && !ocrSession && (
        <MapSelectionStep
          matchId={editingMatch.match.match_id}
          maps={editingMatch.groupMatches ?? currentGroup?.matches ?? []}
          onSessionReady={(sessionId, draftRows, engine) =>
            setOcrSession({ sessionId, draftRows, engine })
          }
          onBack={() => setEditingMatch({ ...editingMatch, view: "method" })}
        />
      )}

      {editingMatch?.view === "image_upload" && ocrSession && (
        <OCRReviewTable
          sessionId={ocrSession.sessionId}
          draftRows={ocrSession.draftRows}
          matchId={editingMatch.match.match_id}
          engine={ocrSession.engine}
          onCommitted={handleEditComplete}
          onBack={() => setOcrSession(null)}
        />
      )}

      {editingMatch?.view === "room_file_upload" && (
        <FileUploadStep
          match={editingMatch.match}
          formData={detailsFormData}
          participantTypeOverride={detailsParticipantType}
          // Enables the "All maps at once" toggle (3D Room File), scoped to this match's group.
          groupMatches={editingMatch.groupMatches ?? currentGroup?.matches ?? []}
          canManage={canUploadResults}
          onAllMapsApplied={() => {
            fetchLeaderboard();
            setFlagRefreshKey((k) => k + 1);
          }}
          // Inline flag approval (name-matching feature): same refresh as the all-maps apply.
          onFlagsChanged={() => {
            fetchLeaderboard();
            setFlagRefreshKey((k) => k + 1);
          }}
          onNext={handleEditComplete}
          onBack={() => setEditingMatch({ ...editingMatch, view: "method" })}
        />
      )}

      {/* Multi-map .log upload (owner 2026-06-22; SOLO support 2026-06-25): drop every map's
          match-log at once, assign each to a match in THIS group, review, apply. Works for team
          AND solo (participantType picks the endpoint). Hidden while editing a match/group.
          canManage follows can_upload_results. */}
      {!editingMatch && !groupEditOpen && eventData && currentGroup && (
        <div className="mt-4 flex justify-end">
          <MultiMapLogUpload
            matches={currentGroup?.matches ?? []}
            token={token}
            participantType={detailsParticipantType}
            canManage={canUploadResults}
            onChanged={() => {
              fetchLeaderboard();
              setFlagRefreshKey((k) => k + 1); // re-fetch the flagged-kills panel too
            }}
          />
        </div>
      )}

      {/* Flagged-kill controls (owner 2026-06-16): TEAM events only (ringer flags come from the
          team match-log file upload). Organizer can count/exclude flagged players' kills.
          key=flagRefreshKey remounts + re-fetches after a multi-map upload rewrites the flags. */}
      {!editingMatch && !groupEditOpen && eventData && detailsParticipantType !== "solo" && (
        <div className="mt-4">
          <FlaggedKillsPanel
            key={flagRefreshKey}
            eventId={eventId}
            token={token}
            canManage={canUploadResults}
            onChanged={fetchLeaderboard}
          />
        </div>
      )}

      {/* ── Manage leaderboard tools (owner 2026-07-02 organizer parity) ──
          Pill-tab section mirroring the admin edit page's tab idiom, scoped to THIS org's
          event. "Total Leaderboard" (overall point adjustments) rides this page's own
          can_upload_results gate; Tie-breakers / MVPs / Debugger backfill call endpoints the
          backend gates on org can_edit_events (_broadcast_gate), so those three tabs only
          render for members holding that permission. Hidden while a match or the whole-group
          editor is open (same visibility rule as the standings card above). */}
      {!editingMatch &&
        !groupEditOpen &&
        eventData &&
        hasAnyLeaderboard &&
        eventId && (
          <div className="mt-4">
            <Tabs defaultValue="total">
              <TabsList
                className={`grid w-full ${canEditEvents ? "grid-cols-5" : "grid-cols-2"}`}
              >
                <TabsTrigger value="total">
                  <IconTrophy size={14} className="mr-1" />
                  {t("eventLeaderboard.tools.totalTab")}
                </TabsTrigger>
                {/* Scoring Config (owner 2026-07-04 organizer parity): always shown — editing a
                    match's scoring requires can_upload_results, which is this page's baseline gate
                    (like the Total tab). The other three tools need can_edit_events. */}
                <TabsTrigger value="scoring">
                  <IconSettings size={14} className="mr-1" />
                  {t("eventLeaderboard.tools.scoringTab")}
                </TabsTrigger>
                {canEditEvents && (
                  <>
                    <TabsTrigger value="tiebreakers">
                      <IconScale size={14} className="mr-1" />
                      {t("eventLeaderboard.tools.tieBreakersTab")}
                    </TabsTrigger>
                    <TabsTrigger value="mvp">
                      <IconTrophy size={14} className="mr-1" />
                      {t("eventLeaderboard.tools.mvpTab")}
                    </TabsTrigger>
                    <TabsTrigger value="backfill">
                      <IconDatabaseImport size={14} className="mr-1" />
                      {t("eventLeaderboard.tools.backfillTab")}
                    </TabsTrigger>
                  </>
                )}
              </TabsList>

              {/* ── Total Leaderboard adjustments ── overall standings of the selected group
                  with a per-row Adjust delta (positive = bonus, negative = penalty, folded
                  into the FIRST map by handleSaveAdjustments - admin-page semantics). */}
              <TabsContent value="total" className="mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle>{t("eventLeaderboard.tools.totalTitle")}</CardTitle>
                    <CardDescription>
                      {t("eventLeaderboard.tools.totalDescription")}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {sortedOverall.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-8 text-center">
                        {t("eventLeaderboard.tools.noData")}
                      </p>
                    ) : (
                      <>
                        <div className="rounded-md border overflow-hidden">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>
                                  {t("eventLeaderboard.table.rank")}
                                </TableHead>
                                <TableHead>
                                  {detailsParticipantType === "team"
                                    ? t("eventLeaderboard.table.team")
                                    : t("eventLeaderboard.table.player")}
                                </TableHead>
                                <TableHead className="text-right">
                                  {t("eventLeaderboard.table.booyahs")}
                                </TableHead>
                                <TableHead className="text-right">
                                  {t("eventLeaderboard.table.kills")}
                                </TableHead>
                                <TableHead className="text-right">
                                  {t("eventLeaderboard.tools.placePts")}
                                </TableHead>
                                <TableHead className="text-right">
                                  {t("eventLeaderboard.table.totalPts")}
                                </TableHead>
                                <TableHead className="w-28">
                                  {t("eventLeaderboard.tools.adjust")}
                                </TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {sortedOverall.map((entry: any, idx: number) => {
                                const entityId =
                                  entry.tournament_team_id ??
                                  entry.competitor_id ??
                                  0;
                                const adj = adjustments[entityId] ?? 0;
                                return (
                                  <TableRow key={entityId || idx}>
                                    <TableCell className="text-muted-foreground">
                                      #{idx + 1}
                                    </TableCell>
                                    <TableCell className="font-medium">
                                      <span className="inline-flex items-center gap-2">
                                        {/* Flag beside the team name (team's country). */}
                                        <CountryFlag country={entry.team_country} />
                                        {entry.team_name ??
                                          entry.competitor__user__username ??
                                          t("eventLeaderboard.unknown")}
                                        {/* Advisory watchlist flag (team in team mode, player in solo). */}
                                        {isEntityWatched(entityId) && (
                                          <WatchTag
                                            label={t(
                                              "eventLeaderboard.watch.label",
                                            )}
                                            reason={t(
                                              "eventLeaderboard.watch.reason",
                                            )}
                                          />
                                        )}
                                      </span>
                                    </TableCell>
                                    <TableCell className="text-right">
                                      {entry.total_booyah ?? 0}
                                    </TableCell>
                                    <TableCell className="text-right">
                                      {entry.total_kills ?? 0}
                                    </TableCell>
                                    <TableCell className="text-right">
                                      {entry.placement_sum ?? 0}
                                    </TableCell>
                                    {/* Live preview: saved total + the pending (unsaved) delta. */}
                                    <TableCell className="text-right font-semibold">
                                      {(
                                        (entry.effective_total ??
                                          entry.total_points ??
                                          0) + adj
                                      ).toFixed(1)}
                                    </TableCell>
                                    <TableCell>
                                      <Input
                                        type="number"
                                        className="h-8 w-24"
                                        value={adj || ""}
                                        placeholder="0"
                                        onChange={(e) => {
                                          const v = parseInt(e.target.value);
                                          setAdjustments((prev) => ({
                                            ...prev,
                                            [entityId]: isNaN(v) ? 0 : v,
                                          }));
                                        }}
                                      />
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                        </div>

                        <div className="flex justify-end">
                          <Button
                            onClick={handleSaveAdjustments}
                            disabled={
                              savingAdjust ||
                              Object.values(adjustments).every((v) => v === 0)
                            }
                          >
                            {savingAdjust ? (
                              <span className="flex items-center gap-2">
                                <IconLoader2
                                  size={14}
                                  className="animate-spin"
                                />
                                {t("eventLeaderboard.tools.saving")}
                              </span>
                            ) : (
                              <span className="flex items-center gap-2">
                                <IconDeviceFloppy size={14} />
                                {t("eventLeaderboard.tools.saveAdjustments")}
                              </span>
                            )}
                          </Button>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* ── Scoring Config ── the shared per-match scoring editor + "Apply to..." fan-out,
                  scoped to THIS group's matches (currentGroup.matches). Uncontrolled selection
                  (this page has no shared match cursor for the tools tabs), so the panel manages
                  its own selected map. onScoringSaved re-saves that map's results so the standings
                  recompute against the new config (see resaveMatchForRecalc). Copy inside the panel
                  is English (same precedent as the reused admin components above); only this tab
                  label is i18n'd. */}
              <TabsContent value="scoring" className="mt-4">
                <ScoringConfigPanel
                  stages={eventData?.stages ?? []}
                  groupMatches={currentGroup?.matches ?? []}
                  token={token}
                  apiBase={env.NEXT_PUBLIC_BACKEND_API_URL}
                  onScoringSaved={resaveMatchForRecalc}
                />
              </TabsContent>

              {canEditEvents && (
                <>
                  {/* ── Tie-breakers ── equal-points ordering; scope follows the on-screen
                      stage/group (admin mount passes the same props on its Scoring tab). */}
                  <TabsContent value="tiebreakers" className="mt-4">
                    <TieBreakersPanel
                      eventId={eventId}
                      stageId={selectedStageId}
                      stageName={currentStage?.stage_name}
                      groupId={selectedGroupId}
                      groupName={currentGroup?.group_name}
                    />
                  </TabsContent>

                  {/* ── MVPs ── event-scoped (ignores the stage/group pickers), admin parity. */}
                  <TabsContent value="mvp" className="mt-4">
                    <MvpTab eventId={eventId} />
                  </TabsContent>

                  {/* ── Debugger backfill ── event-wide: every stage/group/match is a mapping
                      target (same flatMap the admin mount builds on its Upload tab). */}
                  <TabsContent value="backfill" className="mt-4">
                    <DebuggerBackfillPanel
                      eventId={eventId}
                      matchOptions={(eventData?.stages ?? []).flatMap(
                        (st: any) =>
                          (st.groups ?? []).flatMap((g: any) =>
                            (g.matches ?? []).map((m: any) => ({
                              match_id: m.match_id,
                              label: `${st.stage_name} · ${g.group_name} · ${t(
                                "eventLeaderboard.matchLabel",
                                {
                                  number: m.match_number,
                                  map: m.match_map || "-",
                                },
                              )}`,
                            })),
                          ),
                      )}
                    />
                  </TabsContent>
                </>
              )}
            </Tabs>
          </div>
        )}

      {/* ── Whole-group editor: upload (bulk) + manual edit + Save all, per group ── */}
      {groupEditOpen && currentGroup && (
        <GroupResultsEditor
          // Remount on group switch so it always seeds from the current group.
          key={currentGroup.group_id}
          participantType={detailsParticipantType}
          group={currentGroup}
          apiBase={env.NEXT_PUBLIC_BACKEND_API_URL}
          token={token}
          onSaved={fetchLeaderboard}
          onClose={() => setGroupEditOpen(false)}
        />
      )}

      {/* Match picker modal (ported 1:1 from the admin [id] page). */}
      <Dialog open={matchPickerOpen} onOpenChange={setMatchPickerOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("eventLeaderboard.editMatchResults")}</DialogTitle>
            <DialogDescription>
              {t("eventLeaderboard.pickerDescription")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>
                <IconUsers size={14} className="inline mr-1" />
                {t("eventLeaderboard.group")}
              </Label>
              <Select
                value={pickerGroupId}
                onValueChange={(v) => {
                  setPickerGroupId(v);
                  setPickerMatchId("");
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("eventLeaderboard.pickerSelectGroup")} />
                </SelectTrigger>
                <SelectContent>
                  {currentStage?.groups?.map((g: any) => (
                    <SelectItem key={g.group_id} value={g.group_id.toString()}>
                      {g.group_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {pickerGroupId &&
              (() => {
                const pickerGroup = currentStage?.groups?.find(
                  (g: any) => g.group_id.toString() === pickerGroupId,
                );
                return (
                  <div className="space-y-2">
                    <Label>
                      <IconMap size={14} className="inline mr-1" />
                      {t("eventLeaderboard.match")}
                    </Label>
                    <Select
                      value={pickerMatchId}
                      onValueChange={setPickerMatchId}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t("eventLeaderboard.selectMatch")} />
                      </SelectTrigger>
                      <SelectContent>
                        {pickerGroup?.matches?.map((m: any) => (
                          <SelectItem
                            key={m.match_id}
                            value={m.match_id.toString()}
                          >
                            {t("eventLeaderboard.matchOption", {
                              number: m.match_number,
                              map: m.match_map,
                            })}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                );
              })()}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setMatchPickerOpen(false)}>
              {t("eventLeaderboard.cancel")}
            </Button>
            <Button disabled={!pickerMatchId} onClick={handlePickerConfirm}>
              {t("eventLeaderboard.continue")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
