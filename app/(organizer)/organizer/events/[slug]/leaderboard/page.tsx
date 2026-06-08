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
import Link from "next/link";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
  IconEdit,
  IconLock,
  IconMap,
  IconPlus,
  IconTrophy,
  IconUpload,
  IconUsers,
} from "@tabler/icons-react";
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
import { DownloadLeaderboardButton } from "@/app/(a)/a/leaderboards/_components/DownloadLeaderboardButton";
// Create-a-leaderboard wizard (same imports the admin create page uses).
import { BasicInfoStep } from "@/app/(a)/a/leaderboards/_components/BasicInfoStep";
import { ConfigurePointSystem } from "@/app/(a)/a/leaderboards/_components/ConfigurePointSystem";
import { MatchOverviewStep } from "@/app/(a)/a/leaderboards/_components/MatchOverviewStep";
import { EditLeaderboardStep } from "@/app/(a)/a/leaderboards/_components/EditLeaderboardStep";
// Whole-group editor (manual edit + bulk upload, all per group) - shared with the
// AFC admin editor. The bulk-upload panel is embedded INSIDE this editor.
import { GroupResultsEditor } from "@/app/(a)/a/leaderboards/_components/GroupResultsEditor";
import { InfoTip } from "@/components/ui/info-tip";

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

  // The org permission the backend enforces for results upload.
  const canUploadResults =
    membership.permissions.can_upload_results || isOwner;
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
  } | null>(null);
  const [matchPickerOpen, setMatchPickerOpen] = useState(false);
  const [pickerGroupId, setPickerGroupId] = useState<string>("");
  const [pickerMatchId, setPickerMatchId] = useState<string>("");
  // Whole-group editor sub-view (replaces the main view card, same inline-replace
  // pattern as editingMatch). Acts on the selected group; uploading is inside it.
  const [groupEditOpen, setGroupEditOpen] = useState(false);

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

  // Reset match to overall when the selected group changes (admin parity).
  useEffect(() => {
    if (!selectedGroupId) return;
    setSelectedMatchId("overall");
  }, [selectedGroupId]);

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
    if (selectedMatchId !== "overall") {
      const m = currentGroup?.matches?.find(
        (x: any) => x.match_id.toString() === selectedMatchId,
      );
      if (!m) return;
      setEditingMatch({
        match: {
          match_id: m.match_id,
          match_name: `Match ${m.match_number} (${m.match_map})`,
        },
        view: "method",
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
    setEditingMatch({
      match: {
        match_id: m.match_id,
        match_name: `Match ${m.match_number} (${m.match_map})`,
      },
      view: "method",
    });
  };

  const handleEditComplete = () => {
    fetchLeaderboard();
    setEditingMatch(null);
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
        <PageHeader title="Manage Leaderboard" back />
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <div className="flex size-12 items-center justify-center rounded-md bg-muted text-muted-foreground">
              <IconLock className="size-6" />
            </div>
            <p className="max-w-sm text-sm text-muted-foreground">
              You do not have permission to manage results for this organization.
            </p>
            <Button asChild variant="outline" size="sm">
              <Link href="/organizer/leaderboards">Back to leaderboards</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (resolving) return <FullLoader text="Loading event..." />;

  // The slug didn't resolve to one of THIS org's events.
  if (notMine) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeader title="Manage Leaderboard" back />
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <div className="flex size-12 items-center justify-center rounded-md bg-muted text-muted-foreground">
              <IconTrophy className="size-6" />
            </div>
            <p className="max-w-sm text-sm text-muted-foreground">
              We couldn&apos;t find this event under your organization. You can
              only manage leaderboards for your own events.
            </p>
            <Button asChild variant="outline" size="sm">
              <Link href="/organizer/leaderboards">Back to leaderboards</Link>
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
      if (wizardStep === 1) return "Basic Information";
      if (wizardStep === 2) return "Configure Point System";
      if (wizardStep === 3) {
        if (!enteringMatch) return "Match Overview";
        if (enteringMatch.view === "method") return "Select Upload Method";
        if (enteringMatch.view === "manual") return "Manual Input";
        if (enteringMatch.view === "image_upload") return "Image Upload";
        if (enteringMatch.view === "room_file_upload")
          return "3D Room File Upload";
      }
      if (wizardStep === 4) return "Edit Leaderboard";
      return "";
    };

    return (
      <div className="space-y-6 min-h-screen">
        <PageHeader
          back={wizardStep > 1 && !enteringMatch && wizardStep !== 4}
          title="Create Leaderboard"
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

  // ── VIEW + EDIT-RESULTS SURFACE (mirrors the admin [id] page) ──────────────────
  return (
    <div className="space-y-2 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between gap-2 mb-4">
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
          description={`${
            detailsParticipantType === "solo" ? "Solo" : "Team"
          } Tournament • ${eventData.stages?.length ?? 0} Stages`}
        />
        {!editingMatch && (
          <div className="flex gap-2 w-full md:w-auto">
            {/* "Create Leaderboard" removed: leaderboards are now created
                AUTOMATICALLY when the event's groups + maps are set up (backend
                create_event / edit_event), so manual creation is redundant. The AFC
                admin leaderboards list already hides its Create button for the same
                reason. The create wizard code is kept but no longer reachable. */}
            <DownloadLeaderboardButton
              leaderboardName={
                selectedMatchId === "overall"
                  ? eventData.event_name
                  : `${eventData.event_name} - Match ${currentMatch?.match_number} (${currentMatch?.match_map})`
              }
              teamRows={getTableData()}
              playerRows={getPlayerData()}
              participantType={detailsParticipantType}
              killPoint={Number(currentGroup?.leaderboard?.kill_point ?? 1)}
            />
          </div>
        )}
      </div>

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
              No leaderboard yet for this event. Leaderboards are created
              automatically once each group has its maps set up. Add maps to this
              event&apos;s groups in the event editor, then come back here to seed
              competitors and enter results.
            </p>
            <Button asChild variant="outline" size="sm">
              <Link href={`/organizer/events/${routeSlug}/edit`}>
                Open event editor
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Stage tabs - hidden while editing a match (admin [id] parity). */}
      {!editingMatch && hasAnyLeaderboard && eventData.stages?.length > 0 && (
        <Tabs value={selectedStageId} onValueChange={setSelectedStageId}>
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
      {!editingMatch && !groupEditOpen && hasAnyLeaderboard && (
        <Card>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <div className="space-y-2">
                <Label>
                  <IconUsers size={14} /> Group
                </Label>
                <Select
                  value={selectedGroupId}
                  onValueChange={setSelectedGroupId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select Group" />
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
                  <IconMap size={14} /> View Type
                </Label>
                <Select
                  value={selectedMatchId}
                  onValueChange={setSelectedMatchId}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="overall">Overall Leaderboard</SelectItem>
                    {currentGroup?.matches?.map((m: any) => (
                      <SelectItem
                        key={m.match_id}
                        value={m.match_id.toString()}
                      >
                        Match {m.match_number} ({m.match_map})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg">
                <p className="text-[10px] font-semibold text-primary uppercase">
                  Current Kill Points
                </p>
                <p className="text-xl font-bold">
                  {currentGroup?.leaderboard?.kill_point || 0}
                </p>
              </div>
            </div>

            <CardTitle className="text-lg flex items-center gap-2">
              <IconTrophy size={18} className="text-yellow-500" />
              Rankings
            </CardTitle>

            {detailsParticipantType === "solo" ? (
              /* ── Solo: single player table, no tabs ── */
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Rank</TableHead>
                      <TableHead>Player</TableHead>
                      {selectedMatchId === "overall" && (
                        <TableHead>Matches</TableHead>
                      )}
                      <TableHead>Kills</TableHead>
                      <TableHead className="text-right">Total Pts</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {getTableData().map((row: any, idx: number) => (
                      <TableRow key={idx}>
                        <TableCell>#{idx + 1}</TableCell>
                        <TableCell className="font-bold">
                          {row.competitor__user__username ||
                            row.username ||
                            "Unknown"}
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
                    No result found!
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
                  <TabsTrigger value="team">Team Leaderboard</TabsTrigger>
                  <TabsTrigger value="player">Player Leaderboard</TabsTrigger>
                </TabsList>

                {/* ── Team Leaderboard ── */}
                <TabsContent value="team" className="mt-4">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Rank</TableHead>
                        <TableHead>Team</TableHead>
                        {selectedMatchId === "overall" && (
                          <TableHead>Matches</TableHead>
                        )}
                        {selectedMatchId === "overall" && (
                          <TableHead>Booyahs</TableHead>
                        )}
                        <TableHead>Kills</TableHead>
                        <TableHead className="text-right">Total Pts</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {getTableData().map((row: any, idx: number) => (
                        <TableRow key={idx}>
                          <TableCell>#{idx + 1}</TableCell>
                          <TableCell className="font-bold">
                            {row.team_name || row.username || "Unknown"}
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
                      No result found!
                    </div>
                  )}
                </TabsContent>

                {/* ── Player Leaderboard ── */}
                <TabsContent value="player" className="mt-4">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Rank</TableHead>
                        <TableHead>Player</TableHead>
                        <TableHead>Team</TableHead>
                        <TableHead className="text-right">Kills</TableHead>
                        <TableHead className="text-right">Damage</TableHead>
                        <TableHead className="text-right">Assists</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {getPlayerData().map((player: any, idx: number) => (
                        <TableRow key={player.player_id}>
                          <TableCell className="text-muted-foreground">
                            #{idx + 1}
                          </TableCell>
                          <TableCell className="font-bold">
                            {player.username}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {player.team_name}
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
                      No player data available!
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            )}

            {/* Action buttons:
                • Edit Match Results - per-map flow (manual / image / room file) for ONE map.
                • Edit Whole Group   - this group's hub: UPLOAD results (bulk, all maps) AND
                  edit every map manually, then Save all. Upload now lives in here, so there
                  is no separate stage-looking "Bulk Upload" button. */}
            {/* ⓘ sit as siblings (not nested) - InfoTip is itself a button. */}
            <div className="flex gap-2 flex-wrap items-center">
              <Button onClick={handleStartEditMatch}>
                <IconEdit size={18} /> Edit Match Results
              </Button>
              <InfoTip id="leaderboards.detail.edit_match_results" />
              {currentGroup?.matches?.length > 0 && (
                <>
                  <Button
                    variant="outline"
                    onClick={() => setGroupEditOpen(true)}
                  >
                    <IconUpload size={18} /> Upload / Edit Whole Group
                  </Button>
                  <InfoTip id="leaderboards.detail.upload_edit_group" />
                </>
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

      {editingMatch?.view === "image_upload" && (
        <ImageUploadStep
          // The admin [id] page calls ImageUploadStep without a match prop too;
          // the component reads match?.match_id, so we pass the editing match here
          // (an improvement that keeps the prop satisfied without changing behaviour).
          match={editingMatch.match}
          onNext={handleEditComplete}
          onBack={() => setEditingMatch({ ...editingMatch, view: "method" })}
        />
      )}

      {editingMatch?.view === "room_file_upload" && (
        <FileUploadStep
          match={editingMatch.match}
          formData={detailsFormData}
          participantTypeOverride={detailsParticipantType}
          onNext={handleEditComplete}
          onBack={() => setEditingMatch({ ...editingMatch, view: "method" })}
        />
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
            <DialogTitle>Edit Match Results</DialogTitle>
            <DialogDescription>
              Select the group and match you want to edit.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>
                <IconUsers size={14} className="inline mr-1" />
                Group
              </Label>
              <Select
                value={pickerGroupId}
                onValueChange={(v) => {
                  setPickerGroupId(v);
                  setPickerMatchId("");
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select group" />
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
                      Match
                    </Label>
                    <Select
                      value={pickerMatchId}
                      onValueChange={setPickerMatchId}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select match" />
                      </SelectTrigger>
                      <SelectContent>
                        {pickerGroup?.matches?.map((m: any) => (
                          <SelectItem
                            key={m.match_id}
                            value={m.match_id.toString()}
                          >
                            Match {m.match_number} - {m.match_map}
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
              Cancel
            </Button>
            <Button disabled={!pickerMatchId} onClick={handlePickerConfirm}>
              Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
