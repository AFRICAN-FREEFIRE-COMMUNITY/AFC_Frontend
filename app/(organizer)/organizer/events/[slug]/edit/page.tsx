// ─────────────────────────────────────────────────────────────────────────────
// Organizer › Events › Edit  (full event-EDIT page for an organizer's own event).
//
// FULL feature-parity with the AFC-admin event-EDIT page
// (app/(a)/a/events/[slug]/edit/page.tsx), MINUS every Discord-role input, and
// scoped to the organizer's selected organization. This is the EDIT sibling of the
// organizer create flow (organizer/events/create/page.tsx) and uses the SAME reuse
// pattern: it renders the admin edit's tab components + modals verbatim, passing a
// `hideDiscord` flag to the three that surface Discord inputs.
//
// REUSE (mirror of the create flow's Approach A):
//   The admin edit page composes a Tabs surface from cleanly separable tab
//   components (each takes the shared form + a few callbacks) plus a stage-config
//   modal. This page REUSES them verbatim rather than re-implementing the edit
//   flow, so the organizer surface can't drift from the admin one:
//     • BasicInfoTab        - name, types, dates/times, banner, streams, restrictions
//     • RegisteredTeamsTab   - the event's registered competitors (read + status)
//     • StagesGroupsTab      - per-stage view; opens StageConfigModal to edit a stage
//     • PrizeRulesTab        - top-level prize pool + distribution + rules
//     • ActionsTab           - start/cancel/complete/seed/advance/broadcast/export
//                              (passed hideDiscord → hides only the Sync Discord card)
//     • SponsorTab / WaitlistTab - sponsor gating + waitlist (WaitlistTab hideDiscord)
//     • StageConfigModal     - per-stage config (formats, scoring modes, round-robin,
//                              groups, maps, prizes); passed hideDiscord → hides the
//                              stage + per-group Discord Role ID inputs and drops the
//                              stage-discord requirement from its Step 1 gate.
//   The whole stage-editing STATE + handlers are page-level on the admin edit page
//   too, so they are ported here 1:1 - with the single change that this page's
//   handleSaveStageLogic does NOT require stage_discord_role_id (Discord is omitted).
//
// DISCORD OMISSION (the only intentional divergence from the admin edit page):
//   AFC's Discord-role automation is an admin-only concern for now, so EVERY Discord
//   input is hidden for organizers via the new hideDiscord prop on StageConfigModal,
//   WaitlistTab, and ActionsTab. The empty stage_discord_role_id /
//   group_discord_role_id / waitlist_discord_role_id values still ride in the payload,
//   so the request shape stays identical to the admin one (no backend change needed).
//
// DATA + SUBMIT (org-scoping preserved):
//   • Fetch: POST /events/get-event-details/ + /events/get-event-details-for-admin/
//     (same two calls the admin edit page makes; the admin one carries the per-stage
//     scoring/round-robin echo this page rehydrates).
//   • Org guard: the get-event-details response does NOT carry the owning org, so we
//     additionally fetch GET /events/get-all-events/?organization_id=<id> (the same
//     org-scoped list the organizer events page uses) and confirm THIS slug is in it.
//     If it isn't, the event isn't this org's → a "not found / not yours" state.
//   • Save: POST /events/edit-event/ with the Bearer token + event_id (multipart
//     FormData, identical field set to the admin submit). The backend's edit_event
//     already authorises org members with can_edit_events (or owner/admin) on the
//     event's organization, so this works for org-scoped events with no backend change.
//
// GATING: rendered only when the caller can edit events
//   (isOwner OR membership.permissions.can_edit_events) - mirrors how the create page
//   gates on can_create_events and the metrics page gates on can_view_metrics.
//
// DESIGN: AFC constants throughout (DM Sans, green-primary PageHeader title, pill
// segment Tabs, rounded-md bordered cards). No em/en dashes in user-facing copy.
// ─────────────────────────────────────────────────────────────────────────────

"use client";

import { useState, useTransition, useRef, useEffect, use } from "react";
// Stage-shape helper: a Clash Squad stage carries its mode per group now (owner item 21).
import { isClashSquadFormat } from "@/lib/eventFormats";
// next-intl: this organizer edit shell owns its page-header, tab labels, save/discard
// prompts and toasts. Copy lives in the "evEditPage" namespace (messages/{en,fr,pt}).
import { useTranslations } from "next-intl";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import Link from "next/link";
import { Form } from "@/components/ui/form";
import { Tabs, TabsContent } from "@/components/ui/tabs";
// Shared mobile-first section navigator (dropdown on phones, scrollable strip on desktop) - same
// component the admin edit page uses, so both edit surfaces stay in lock-step (owner 2026-07-13).
import { EventEditSectionNav } from "@/components/events/EventEditSectionNav";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { IconLock, IconCalendarOff } from "@tabler/icons-react";
import { useAuth } from "@/contexts/AuthContext";
import { env } from "@/lib/env";
// Shared prize-distribution helpers (see lib/eventFormats.ts). Renumber the map to a
// contiguous "1".."N" on every add/remove so a deleted/wrong position can always be
// rebuilt. Same helpers used by the admin create wizard + admin edit page = parity.
import {
  addPrizePositionTo,
  removePrizePositionFrom,
  formatPrizeKey,
} from "@/lib/eventFormats";
// Save-confirm diff (see lib/eventChangeSummary.ts). Shared with the admin edit page so the two
// cannot disagree about what counts as a change.
import {
  buildEventChangeRows,
  type EventChangeRow,
} from "@/lib/eventChangeSummary";
import axios from "axios";
import { FullLoader } from "@/components/Loader";
import { useOrganizer } from "../../../_components/OrganizerContext";

// Reuse the admin edit schema + helpers + every admin edit tab/modal (Approach A).
// Importing from the admin edit folder keeps a single source of truth - the organizer
// edit flow can't drift from the admin edit flow's validation, field set, or UI.
import {
  EventFormSchema,
  validateStageData,
  showValidationErrors,
  type EventFormType,
  type EventDetails,
  type StageType,
  type AdvancementRuleInput,
  type Params,
} from "@/app/(a)/a/events/[slug]/edit/types";

import BasicInfoTab from "@/app/(a)/a/events/[slug]/edit/_components/BasicInfoTab";
import RegisteredTeamsTab from "@/app/(a)/a/events/[slug]/edit/_components/RegisteredTeamsTab";
import PrizeRulesTab from "@/app/(a)/a/events/[slug]/edit/_components/PrizeRulesTab";
import ActionsTab from "@/app/(a)/a/events/[slug]/edit/_components/ActionsTab";
import { StageConfigModal } from "@/app/(a)/a/events/[slug]/edit/_components/StageConfigModal";
import { RemoveStageModal } from "@/app/(a)/a/events/[slug]/edit/_components/RemoveStageModal";
import { ParticipantTypeWarningModal } from "@/app/(a)/a/events/[slug]/edit/_components/ParticipantTypeWarningModal";
import { SaveConfirmModal } from "@/app/(a)/a/events/[slug]/edit/_components/SaveConfirmModal";
import StagesGroupsTab from "@/app/(a)/a/events/[slug]/edit/_components/StagesGroupsTab";
import SponsorTab from "@/app/(a)/a/events/[slug]/edit/_components/SponsorTab";
import WaitlistTab from "@/app/(a)/a/events/[slug]/edit/_components/WaitlistTab";
// Broadcast media hygiene (owner 2026-07-02 organizer parity): the SAME card the admin edit page
// mounts under Registered Teams - missing team logos / player esport images, flag bad art,
// per-event hide/show. Self-contained (loads events/<id>/media-audit itself); the backend
// media-audit endpoints already authorise the event's organizer, so this is a pure mount.
import { MediaAuditCard } from "@/components/overlay/MediaAuditCard";
// Co-organizers manager (F6): invite another org to co-own this event, reused verbatim from the
// admin edit page. Backend (organizers.py co-organizer endpoints) only lets the PRIMARY org's
// OWNER (or an AFC admin) invite/revoke, so this page mounts it only when isOwner (below).
import CoOrganizersPanel from "@/app/(a)/a/events/[slug]/edit/_components/CoOrganizersPanel";
// Linked-events (qualification links) editor - the SAME component the admin edit page + the event
// DETAIL pages mount (components/event-links.tsx -> lib/eventLinks.ts -> events/<id>/links/*). The
// backend already authorises the event's organizer on those endpoints, so reusing it here gives the
// organizer the same create/fire/cancel surface with no divergence. Self-loads + self-saves; we just
// mount it with the event id + stages.
import { LinkedEventsCard } from "@/components/event-links";
import { SeedStageModal } from "@/app/(a)/a/events/_components/SeedStageModal";
import { ConfirmStartTournamentModal } from "@/app/(a)/a/events/_components/ConfirmStartTournamentModal";
// Shared Round-Robin config types + default (sub-project B).
import {
  DEFAULT_ROUND_ROBIN_CONFIG,
  type RoundRobinConfig,
} from "@/app/(a)/a/events/_components/RoundRobinPanel";

// ── Paid-vs-free registration payload helper (non-payment phase) ─────────────────
// Appends registration_type (+ fee/currency when paid) onto the edit-event FormData.
// Shared by all three FormData builders on this page (main Save, Sponsor save, Waitlist
// save) so they can't drift. Editing never re-triggers the first-time paid terms gate
// (that's create-only), so no paid_terms_accepted is sent here. FREE sends no fee.
function appendRegistrationFeeFields(
  formData: FormData,
  data: Pick<
    EventFormType,
    | "registration_type"
    | "registration_fee"
    | "registration_fee_currency"
    | "country_payment_rules"
  >,
) {
  formData.append("registration_type", data.registration_type || "free");
  if (data.registration_type === "paid" && data.registration_fee != null) {
    formData.append("registration_fee", data.registration_fee.toString());
    formData.append(
      "registration_fee_currency",
      data.registration_fee_currency || "USD",
    );
    // Per-country payment rules (owner 2026-06-24): always send the key on a paid-event save so
    // clearing all rows persists (empty => null server-side). JSON-encoded; backend re-validates.
    formData.append(
      "country_payment_rules",
      data.country_payment_rules
        ? JSON.stringify(data.country_payment_rules)
        : "",
    );
  }
}

// Append the four (now compulsory) event/registration times + the editor's IANA timezone
// to a save payload (owner 2026-06-21). Mirror of the admin edit page helper. Previously
// the organizer edit page never re-sent the times, so any time edit was silently dropped.
// Called by every save handler below so a partial save can't wipe the times. timezone =
// whoever is SETTING it now (the editor's browser). backend: edit_event.
function appendEventTimes(
  formData: FormData,
  data: Pick<
    EventFormType,
    | "event_start_time"
    | "event_end_time"
    | "registration_start_time"
    | "registration_end_time"
  >,
) {
  formData.append("event_start_time", data.event_start_time || "");
  formData.append("event_end_time", data.event_end_time || "");
  formData.append("registration_start_time", data.registration_start_time || "");
  formData.append("registration_end_time", data.registration_end_time || "");
  formData.append(
    "timezone",
    Intl.DateTimeFormat().resolvedOptions().timeZone || "",
  );
}

// ── Round-Robin rehydration (sub-project B) ─────────────────────────────────────
// Identical to the admin edit page's helper: translate the backend's get-event-details
// echo into the form's RoundRobinConfig. The echo carries base groups (with server
// group_ids + team_ids) and game_days whose lobbies merge groups by GROUP ID; the form
// edits groups by 0-based INDEX, so each lobby's source_group_ids map back to indices
// via a group_id → index lookup. Returns the default when the stage has no RR structure.
function rehydrateRoundRobin(
  rr: EventDetails["stages"][number]["round_robin"],
): RoundRobinConfig {
  if (!rr || !rr.round_robin_groups?.length) {
    return DEFAULT_ROUND_ROBIN_CONFIG;
  }

  const orderedGroups = [...rr.round_robin_groups].sort(
    (a, b) => a.order - b.order,
  );
  const indexByGroupId = new Map<number, number>(
    orderedGroups.map((g, i) => [g.group_id, i]),
  );

  const gameDays = (rr.game_days || []).flatMap((day) =>
    (day.lobbies || []).map((lobby) => ({
      game_day: day.game_day,
      source_group_indices: (lobby.source_group_ids || [])
        .map((gid) => indexByGroupId.get(gid))
        .filter((i): i is number => i !== undefined),
      match_count: lobby.match_count ?? 1,
      match_maps: lobby.match_maps ?? ["Bermuda"],
      // Per-match-day date/time (owner 2026-06-15): rehydrate the saved schedule so the organizer
      // editor shows real per-meeting dates instead of blanks (parity with the admin edit flow).
      playing_date: lobby.playing_date ?? "",
      playing_time: lobby.playing_time ?? "",
    })),
  );

  return {
    round_robin_groups: orderedGroups.map((g) => ({
      label: g.label,
      order: g.order,
      team_ids: g.team_ids || [],
    })),
    // Prefer the backend's explicit stage-level mode (owner 2026-06-17); fall back to the old
    // derivation for events saved before the echo carried it. Keeps "matches per meeting" stable.
    generate_schedule: rr.generate_schedule ?? gameDays.length === 0,
    games_per_day: rr.games_per_day ?? gameDays[0]?.match_count ?? 1,
    game_days: gameDays,
  };
}

// ============================================================================
// PAGE COMPONENT
// ============================================================================

export default function OrganizerEditEventPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const resolvedParams = use(params);
  const { slug } = resolvedParams;
  const router = useRouter();
  // Translations for this page's own chrome (header, tab labels, toasts, gates). Declared
  // early so the eventTitle useState initializer below can read the loading label.
  const t = useTranslations("evEditPage");

  // ── Org context: gate the page + verify the event belongs to THIS org ────────
  const { slug: orgSlug, membership, isOwner } = useOrganizer();
  const organizationId = membership.organization.organization_id;
  // Same shape the backend edit_event already authorises: owner OR can_edit_events.
  const canEditEvents = membership.permissions.can_edit_events || isOwner;

  const searchParams = useSearchParams();
  const pathname = usePathname();

  // ── Core loading/UI state ──────────────────────────────────────────────────
  // Active edit tab persists in the URL (?tab=) so a RELOAD keeps the step (owner
  // 2026-06-20), same as the admin edit page. selectTab mirrors the change into the URL.
  const [currentTab, setCurrentTab] = useState(
    searchParams.get("tab") || "basic_info",
  );
  const selectTab = (v: string) => {
    setCurrentTab(v);
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", v);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };
  const [loadingEvent, setLoadingEvent] = useState(true);
  const [initialLoading, setInitialLoading] = useState(true);
  const [eventTitle, setEventTitle] = useState(t("loadingTitle"));
  const [pendingSubmit, startSubmitTransition] = useTransition();
  const [pendingSeeding, startPendingTransition] = useTransition();
  // True once we've confirmed the fetched event is NOT homed to the selected org.
  const [notMyOrgEvent, setNotMyOrgEvent] = useState(false);

  // ── Event data ─────────────────────────────────────────────────────────────
  const [eventDetails, setEventDetails] = useState<EventDetails>();

  // ── File uploads ───────────────────────────────────────────────────────────
  const [previewUrl, setPreviewUrl] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewRuleUrl, setPreviewRuleUrl] = useState("");
  const [selectedRuleFile, setSelectedRuleFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [rulesInputMethod, setRulesInputMethod] = useState<"type" | "upload">(
    "type",
  );
  const fileInputRef = useRef<HTMLInputElement>(null);
  const rulesFileInputRef = useRef<HTMLInputElement>(null);

  // ── Stage / group modal state ──────────────────────────────────────────────
  const [stageNames, setStageNames] = useState<string[]>(["Stage 1"]);
  const [isStageModalOpen, setIsStageModalOpen] = useState(false);
  const [stageModalStep, setStageModalStep] = useState(1);
  const [editingStageIndex, setEditingStageIndex] = useState<number | null>(
    null,
  );
  const [tempGroups, setTempGroups] = useState<any[]>([]);
  const [passwordVisibility, setPasswordVisibility] = useState<
    Record<number, boolean>
  >({});

  // ── stageModalData includes prize + scoring + round-robin fields ────────────
  const [stageModalData, setStageModalData] = useState<{
    stage_id?: number;
    stage_name: string;
    start_date: string;
    end_date: string;
    stage_format: string;
    number_of_groups: number;
    teams_qualifying_from_stage: number;
    stage_discord_role_id: string;
    total_teams_in_stage: number;
    prizepool: string;
    prizepool_cash_value: string;
    prize_distribution: Record<string, string>;
    champion_point_enabled: boolean;
    champion_point_threshold?: number;
    point_rush_enabled: boolean;
    point_rush_reward: Record<string, number>;
    point_rush_target_index?: number;
    // ── Branching advancement rules (feature #9). Optional repeatable authoring rows. ──
    advancement_rules?: AdvancementRuleInput[];
    round_robin: RoundRobinConfig;
    // Clash Squad room settings drafted for a stage that has no stage_id yet
    // (owner 2026-08-13). A saved stage edits its settings through the API instead.
    cs_room_settings?: import("@/components/cs-room-settings").CSRoomDraft | null;
    // Clash Squad mode + the optional split into groups (owner item 21, 2026-08-13).
    cs_bracket_format?: import("@/lib/eventFormats").CSBracketMode;
    cs_groups?: import("@/app/(a)/a/events/_components/ClashSquadPanel").CSGroupDraft[];
  }>({
    stage_name: "",
    start_date: "",
    end_date: "",
    stage_format: "",
    number_of_groups: 2,
    teams_qualifying_from_stage: 0,
    stage_discord_role_id: "", // never edited in the organizer flow (Discord omitted)
    total_teams_in_stage: 0,
    prizepool: "",
    prizepool_cash_value: "",
    prize_distribution: {},
    champion_point_enabled: false,
    champion_point_threshold: undefined,
    point_rush_enabled: false,
    point_rush_reward: {},
    point_rush_target_index: undefined,
    advancement_rules: [],
    round_robin: DEFAULT_ROUND_ROBIN_CONFIG,
  });

  // ── Remove stage modal ─────────────────────────────────────────────────────
  const [stageToRemove, setStageToRemove] = useState<number | null>(null);
  const [isRemoveConfirmOpen, setIsRemoveConfirmOpen] = useState(false);
  const [loadingRemove, setLoadingRemove] = useState(false);

  // ── Seeding / leaderboard ──────────────────────────────────────────────────
  const [isSeedModalOpen, setIsSeedModalOpen] = useState(false);
  const [selectedGroupForSeed, setSelectedGroupForSeed] = useState<any>(null);
  const [leaderboardData, setLeaderboardData] = useState<any>(null);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);

  // ── Tournament start modal ─────────────────────────────────────────────────
  const [openConfirmStartTournamentModal, setOpenConfirmStartTournamentModal] =
    useState(false);

  // ── Participant type change warning ────────────────────────────────────────
  const [pendingParticipantType, setPendingParticipantType] = useState<
    string | null
  >(null);
  const [showParticipantTypeWarning, setShowParticipantTypeWarning] =
    useState(false);

  // ── Save confirmation modal ────────────────────────────────────────────────
  const [showSaveConfirmModal, setShowSaveConfirmModal] = useState(false);
  const [pendingSaveData, setPendingSaveData] = useState<EventFormType | null>(
    null,
  );

  // ── Sponsor ────────────────────────────────────────────────────────────────
  const [sponsorForm, setSponsorForm] = useState({
    is_sponsored: false,
    sponsor_name: "",
    sponsor_usernames: [] as string[],
    requirement_description: "",
    sponsor_field_label: "Player UUID",
  });
  const [savingSponsor, setSavingSponsor] = useState(false);

  // ── Waitlist ───────────────────────────────────────────────────────────────
  const [waitlistForm, setWaitlistForm] = useState<any>({
    is_waitlist_enabled: false,
    waitlist_capacity: 0,
    waitlist_discord_role_id: "",
    waitlist_mode: "first_registered",
    // Registration-requirement toggles (owner correction 2026-06-22): rendered on Basic Info
    // (BasicInfoTab) but still stored here + saved by the waitlist save, for parity with the
    // admin edit page. Previously the organizer flow never carried/saved these.
    require_team_logo: false,
    require_esport_images: false,
    require_player_uid: false,
    require_player_profile_image: false,
    // WhatsApp number gate (owner 2026-08-03): same shape as the four above.
    require_whatsapp: false,
    // Required connected accounts (owner 2026-08-26): a LIST of provider slugs, not a bool.
    // Edited on Basic Info by the shared RequiredConnectionsPicker, prefilled below, and saved by
    // the waitlist save -> edit_event, same route as min_letter_avatars.
    required_connections: [] as string[],
    // Letter-avatars gate (feature #7, owner 2026-06-29): a NUMBER (0 = off, 1-26 = required min),
    // not a bool. Edited on Basic Info (BasicInfoTab) alongside the require_* toggles, prefilled from
    // ed.min_letter_avatars below and persisted by the waitlist save -> edit_event (admin parity).
    min_letter_avatars: 0,
  });
  const [savingWaitlist, setSavingWaitlist] = useState(false);

  // ── Tab error indicators ───────────────────────────────────────────────────
  const [tabErrors, setTabErrors] = useState({
    basic_info: false,
    registered_teams: false,
    stages_groups: false,
    prize_rules: false,
  });

  const { token, loading: authLoading } = useAuth();

  // Snapshot of the form as it stood when the event finished loading. The save-confirm dialog
  // diffs against this, so it lists exactly what the organizer changed. Filled in the reset effect.
  const editBaselineRef = useRef<Record<string, unknown> | null>(null);
  // The same for the settings kept outside the form (registration requirements + waitlist), which
  // this page sends to edit_event on the same save. See the admin edit page for the bug.
  const settingsBaselineRef = useRef<Record<string, unknown> | null>(null);

  // ── Form setup (same defaults as the admin edit page) ──────────────────────
  const form = useForm<EventFormType>({
    resolver: zodResolver(EventFormSchema),
    defaultValues: {
      event_name: "",
      competition_type: "",
      participant_type: "",
      event_type: "",
      is_public: "True",
      // Discord registration gate defaults OFF; rehydrated from the fetched event below.
      require_discord: false,
      discord_server_id: "",
      discord_invite_link: "",
      max_teams_or_players: 1,
      banner: "",
      stream_channels: [""],
      event_mode: "",
      number_of_stages: 1,
      stages: [
        {
          stage_name: "Stage 1",
          stage_discord_role_id: "",
          start_date: "",
          end_date: "",
          number_of_groups: 1,
          stage_format: "",
          groups: [
            {
              group_name: "Group 1",
              group_discord_role_id: "",
              playing_date: "",
              playing_time: "00:00",
              teams_qualifying: 1,
              match_count: 1,
              match_maps: [],
              room_id: "",
              room_name: "",
              room_password: "",
              prizepool: "",
              prizepool_cash_value: "",
              prize_distribution: {},
            },
          ],
          teams_qualifying_from_stage: 0,
          total_teams_in_stage: 0,
          prizepool: "",
          prizepool_cash_value: "",
          prize_distribution: {},
        },
      ],
      prizepool: "",
      prizepool_cash_value: undefined,
      prize_distribution: { "1": "", "2": "", "3": "" },
      rules_document: "",
      start_date: "",
      end_date: "",
      registration_open_date: "",
      registration_end_date: "",
      registration_link: "",
      event_status: "upcoming",
      publish_to_tournaments: false,
      publish_to_news: false,
      save_to_drafts: false,
      event_start_time: "",
      event_end_time: "",
      registration_start_time: "",
      registration_end_time: "",
    },
  });

  const {
    fields: streamFields,
    append: appendStream,
    remove: removeStream,
  } = useFieldArray({ control: form.control, name: "stream_channels" });

  const stages = form.watch("stages") || [];

  // ============================================================================
  // EFFECTS
  // ============================================================================

  useEffect(() => {
    // Only fetch when the caller is allowed to edit - a gated member never loads
    // the event (mirrors how the metrics page skips its fetch when not permitted).
    if (!slug || authLoading || !token || !canEditEvents) {
      if (!canEditEvents) {
        setInitialLoading(false);
        setLoadingEvent(false);
      }
      return;
    }
    fetchEventDetails();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, token, authLoading, canEditEvents, organizationId]);

  // Rehydrate the form once the event is loaded (ported 1:1 from the admin edit page).
  useEffect(() => {
    if (eventDetails && !initialLoading) {
      const stageIndexById = new Map<number, number>(
        eventDetails.stages.map((s, i) => [s.stage_id || s.id, i]),
      );

      const mappedStages = eventDetails.stages.map((stage) => ({
        ...stage,
        stage_id: stage.stage_id || stage.id,
        prizepool: stage.prizepool || "",
        prizepool_cash_value: stage.prizepool_cash_value || "",
        prize_distribution: stage.prize_distribution || {},
        champion_point_enabled: stage.champion_point_enabled ?? false,
        champion_point_threshold: stage.champion_point_threshold ?? undefined,
        point_rush_enabled: stage.point_rush_enabled ?? false,
        point_rush_reward: stage.point_rush_reward || {},
        point_rush_target_index:
          stage.point_rush_target_stage_id != null
            ? stageIndexById.get(stage.point_rush_target_stage_id)
            : undefined,
        // ── Branching advancement rules (feature #9): translate the echoed rules
        //    (target_stage_id + source_group_id) into the form's index shape. Mirrors the
        //    admin edit page; the `...stage` spread pulls the echo shape so we OVERRIDE here. ──
        advancement_rules: (stage.advancement_rules ?? [])
          .map((r) => {
            const groupIdx =
              r.source_group_id != null
                ? stage.groups.findIndex(
                    (g) => (g.group_id ?? g.id) === r.source_group_id,
                  )
                : -1;
            const targetIdx = stageIndexById.get(r.target_stage_id);
            return targetIdx === undefined
              ? null
              : {
                  position_from: r.position_from,
                  position_to: r.position_to,
                  source_group_index: groupIdx >= 0 ? groupIdx : null,
                  target_stage_index: targetIdx,
                };
          })
          .filter(Boolean) as AdvancementRuleInput[],
        round_robin: rehydrateRoundRobin(stage.round_robin),
        groups: stage.groups.map((group) => ({
          ...group,
          group_id: group.group_id,
          prizepool: group.prizepool || "",
          prizepool_cash_value: group.prizepool_cash_value || "",
          prize_distribution: group.prize_distribution || {},
          // Room name + password start EMPTY (owner 2026-06-13): per-session secrets,
          // re-entered each time, never pre-shown. room_id (a label) is kept.
          room_name: "",
          room_password: "",
        })),
      }));

      setTimeout(() => {
        form.reset({
          banner: eventDetails.event_banner_url || "",
          event_name: eventDetails.event_name,
          competition_type: eventDetails.competition_type,
          participant_type: eventDetails.participant_type,
          event_type: eventDetails.event_type,
          is_public: eventDetails.is_public ? "True" : "False",
          // Pre-fill the Discord gate toggle + Guild ID from the fetched event (parity
          // with the admin edit page) so BasicInfoTab shows + re-saves the saved state.
          require_discord: eventDetails.require_discord ?? false,
          discord_server_id: eventDetails.discord_server_id ?? "",
          // Pre-fill the required invite link too (only meaningful when the gate is on).
          discord_invite_link: eventDetails.discord_invite_link ?? "",
          max_teams_or_players: eventDetails.max_teams_or_players,
          stream_channels: eventDetails.stream_channels || [],
          event_mode: eventDetails.event_mode,
          number_of_stages: eventDetails.number_of_stages,
          stages: mappedStages,
          prizepool: eventDetails.prizepool,
          prizepool_cash_value: eventDetails.prizepool_cash_value ?? undefined,
          // Prize currency (owner 2026-07-02): the org edit page never loaded this, so it always
          // showed USD even for an NGN event. Load it from the detail echo (mirrors the admin edit).
          prize_currency:
            (eventDetails as { prize_currency?: string }).prize_currency || "USD",
          prize_distribution: eventDetails.prize_distribution,
          event_rules: eventDetails.event_rules,
          rules_document: eventDetails.uploaded_rules_url || "",
          start_date: eventDetails.start_date,
          end_date: eventDetails.end_date,
          registration_open_date: eventDetails.registration_open_date,
          registration_end_date: eventDetails.registration_end_date,
          registration_link: eventDetails.registration_link || "",
          // Pre-fill the Free/Paid toggle + fee/currency from the fetched event.
          registration_type: eventDetails.registration_type || "free",
          registration_fee: eventDetails.registration_fee ?? null,
          registration_fee_currency:
            eventDetails.registration_fee_currency || "USD",
          // Per-country payment rules (owner 2026-06-24): rehydrate the editor from the echo.
          country_payment_rules: eventDetails.country_payment_rules ?? null,
          event_status: eventDetails.event_status,
          event_start_time: eventDetails.event_start_time || "",
          event_end_time: eventDetails.event_end_time || "",
          registration_start_time: eventDetails.registration_start_time || "",
          registration_end_time: eventDetails.registration_end_time || "",
          publish_to_tournaments: eventDetails.tournament_tier !== "",
          publish_to_news: false,
          save_to_drafts: false,
          registration_restriction:
            eventDetails.registration_restriction || "none",
          restriction_mode: eventDetails.restriction_mode || "allow_only",
          selected_locations: eventDetails.restricted_countries || [],
          is_sponsored: eventDetails.is_sponsored ?? false,
          sponsor_name: eventDetails.sponsor_name ?? "",
          sponsor_usernames:
            eventDetails.sponsors?.map((s) => s.sponsor_username) ?? [],
          requirement_description:
            eventDetails.sponsor_requirement_description ?? "",
          sponsor_field_label:
            eventDetails.sponsor_field_label ?? "Player UUID",
        });

        // Baseline for the save-confirm dialog. Taken from the FORM, not from eventDetails, so
        // both sides of the later comparison have the same shape and only real edits show up.
        editBaselineRef.current = form.getValues() as Record<string, unknown>;

        setPreviewUrl(eventDetails.event_banner_url || "");
        setPreviewRuleUrl(eventDetails.uploaded_rules_url || "");
        setRulesInputMethod(eventDetails.event_rules ? "type" : "upload");
        setEventTitle(t("editEventTitle", { name: eventDetails.event_name }));
      }, 100);
    }
  }, [eventDetails, initialLoading, form]);

  // Track errors per tab (ported 1:1 from the admin edit page).
  useEffect(() => {
    const errors = form.formState.errors;
    const stageValidation = validateStageData(form.watch("stages"));

    setTabErrors({
      basic_info: !!(
        errors.event_name ||
        errors.competition_type ||
        errors.participant_type ||
        errors.event_type ||
        errors.is_public ||
        errors.max_teams_or_players ||
        errors.event_mode ||
        errors.start_date ||
        errors.end_date ||
        errors.registration_open_date ||
        errors.registration_end_date ||
        errors.banner ||
        errors.stream_channels
      ),
      registered_teams: false,
      stages_groups:
        !stageValidation.isValid ||
        !!errors.stages ||
        !!errors.number_of_stages,
      prize_rules: !!(
        errors.prizepool ||
        errors.prize_distribution ||
        errors.event_rules ||
        errors.rules_document
      ),
    });
  }, [form.formState.errors, form.watch("stages")]);

  // Draft / publish mutual exclusivity (ported 1:1 from the admin edit page).
  const saveToDraftsWatch = form.watch("save_to_drafts");
  const publishToTournamentsWatch = form.watch("publish_to_tournaments");
  const publishToNewsWatch = form.watch("publish_to_news");

  useEffect(() => {
    if (
      saveToDraftsWatch &&
      (publishToTournamentsWatch || publishToNewsWatch)
    ) {
      if (publishToTournamentsWatch)
        form.setValue("publish_to_tournaments", false, { shouldDirty: false });
      if (publishToNewsWatch)
        form.setValue("publish_to_news", false, { shouldDirty: false });
    } else if (
      (publishToTournamentsWatch || publishToNewsWatch) &&
      saveToDraftsWatch
    ) {
      form.setValue("save_to_drafts", false, { shouldDirty: false });
    }
  }, [saveToDraftsWatch, publishToTournamentsWatch, publishToNewsWatch, form]);

  // ============================================================================
  // DATA FETCHING
  // ============================================================================

  const fetchEventDetails = async () => {
    if (!slug || authLoading || !token) return;
    try {
      setLoadingEvent(true);
      const commonConfig = {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      };

      // ONE call: get-event-details. Unlike the admin edit page (which also calls
      // get-event-details-for-admin), the organizer page uses ONLY the public detail
      // endpoint, for two reasons:
      //   • get-event-details-for-admin hard-rejects non-platform-admins (403), so an
      //     organizer could never call it.
      //   • get-event-details already returns everything the edit form needs: the full
      //     per-stage groups + the scoring-mode + round-robin echo this page rehydrates,
      //     PLUS (newly added) organization_slug for the ownership guard below.
      const res = await axios.post(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/get-event-details/`,
        { slug },
        commonConfig,
      );

      const ed = res.data.event_details;

      // ── ORG GUARD ──────────────────────────────────────────────────────────
      // The event must be homed to the SELECTED org. get-event-details echoes the
      // owning org's slug (null for native AFC events); if it doesn't match the
      // context slug, the event isn't this org's → show the "not yours" state and
      // never load it. This works for drafts too (the events-list-based guard would
      // not, since that list omits drafts).
      if (!ed || ed.organization_slug !== orgSlug) {
        setNotMyOrgEvent(true);
        setLoadingEvent(false);
        setInitialLoading(false);
        return;
      }

      // Normalise the public stages echo into the admin EventDetails stage shape the
      // reused tabs/modal expect. The public echo omits a few admin-only fields:
      //   • number_of_groups        → derive from groups.length
      //   • total_teams_in_stage    → default 0 (admin-only stat, not edited here)
      //   • stage_discord_role_id   → default "" (Discord omitted in the organizer flow)
      //   • per-group group_discord_role_id / id → default "" / group_id
      const rawStages: any[] = ed.stages || [];
      const normalisedStages = rawStages.map((s: any) => ({
        ...s,
        id: s.stage_id ?? s.id,
        number_of_groups: s.number_of_groups ?? (s.groups?.length || 0),
        total_teams_in_stage: s.total_teams_in_stage ?? 0,
        stage_discord_role_id: s.stage_discord_role_id ?? "",
        groups: (s.groups || []).map((g: any) => ({
          ...g,
          id: g.id ?? g.group_id,
          group_discord_role_id: g.group_discord_role_id ?? "",
          room_id: g.room_id ?? "",
          // Room name + password start EMPTY (owner 2026-06-13): per-session secrets,
          // never pre-filled from the saved value.
          room_name: "",
          room_password: "",
        })),
      }));

      const mergedDetails: EventDetails = {
        ...ed,
        stages: normalisedStages,
      };

      if (normalisedStages.length > 0)
        setStageNames(normalisedStages.map((s: any) => s.stage_name));

      setEventDetails(mergedDetails);

      // Seed the sponsor + waitlist sub-forms from the same payload (ed is the
      // get-event-details event_details object resolved above).
      if (ed) {
        setSponsorForm({
          is_sponsored: ed.is_sponsored ?? false,
          sponsor_name: ed.sponsor_name ?? "",
          sponsor_usernames:
            ed.sponsors?.map(
              (s: { sponsor_username: string }) => s.sponsor_username,
            ) ?? [],
          requirement_description: ed.sponsor_requirement_description ?? "",
          sponsor_field_label: ed.sponsor_field_label ?? "Player UUID",
        });
        const seededSettings = {
          is_waitlist_enabled: ed.is_waitlist_enabled ?? false,
          waitlist_capacity:
            ed.waitlist_capacity != null ? Number(ed.waitlist_capacity) : "",
          waitlist_discord_role_id: ed.waitlist_discord_role_id ?? "",
          waitlist_mode: ed.waitlist_mode ?? "first_registered",
          // Prefill the registration-requirement toggles from the event (now on Basic Info).
          require_team_logo: ed.require_team_logo ?? false,
          require_esport_images: ed.require_esport_images ?? false,
          require_player_uid: ed.require_player_uid ?? false,
          require_player_profile_image: ed.require_player_profile_image ?? false,
          require_whatsapp: ed.require_whatsapp ?? false,
          // Required connected accounts (owner 2026-08-26): rehydrate the list so a reopened form
          // shows what is actually stored rather than an empty picker.
          required_connections: ed.required_connections ?? [],
          // Letter-avatars gate (feature #7): rehydrate the count from the event (0 = off). Coerced
          // to a clean 0-or-positive number so the BasicInfoTab control reads a real value.
          min_letter_avatars: Number(ed.min_letter_avatars ?? 0) || 0,
        };
        setWaitlistForm(seededSettings);
        // Baseline for the save-confirm dialog's non-form half. Same reason as the admin page: a
        // requirement toggle lives here, not in the form, so without this the dialog claimed
        // nothing had changed right after the organizer changed something real.
        settingsBaselineRef.current = { ...seededSettings };
      }

      setLoadingEvent(false);
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.message ||
        error.response?.data?.detail ||
        t("toast.fetchDetailsFailed");
      toast.error(errorMessage);
      // Unlike the admin page (which bounces to /login), an org member who can't
      // load the event is sent back to their events list - that's the org surface
      // they came from, and the 401 interceptor already handles a real session loss.
      router.push("/organizer/events");
    } finally {
      setLoadingEvent(false);
      setInitialLoading(false);
    }
  };

  // ============================================================================
  // HANDLERS (ported 1:1 from the admin edit page)
  // ============================================================================

  const updateCompetitorStatus = (playerId: number, newStatus: string) => {
    setEventDetails((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        registered_competitors: prev.registered_competitors.map((comp) =>
          comp.player_id === playerId ? { ...comp, status: newStatus } : comp,
        ),
      };
    });
  };

  const fetchGroupLeaderboard = async (groupId: number) => {
    try {
      setLoadingLeaderboard(true);
      const response = await axios.post(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/get-group-leaderboard/`,
        { event_id: eventDetails?.event_id, group_id: groupId },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setLeaderboardData(response.data.leaderboard);
      toast.success(t("toast.leaderboardUpdated"));
      return response.data;
    } catch (error: any) {
      toast.error(
        error.response?.data?.message || t("toast.leaderboardFailed"),
      );
    } finally {
      setLoadingLeaderboard(false);
    }
  };

  const handleConfirmSeed = async (groupId: number) => {
    startPendingTransition(async () => {
      try {
        const res = await axios.post(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/advance-group-competitors-to-next-stage/`,
          { event_id: eventDetails?.event_id, group_id: groupId },
          { headers: { Authorization: `Bearer ${token}` } },
        );
        toast.success(res.data.message || t("toast.seedingSuccess"));
        setIsSeedModalOpen(false);
      } catch (error: any) {
        toast.error(
          error.response?.data?.message || t("toast.genericError"),
        );
      }
    });
  };

  const toggleVisibility = (groupIndex: number) => {
    setPasswordVisibility((prev) => ({
      ...prev,
      [groupIndex]: !prev[groupIndex],
    }));
  };

  // ── Stage management ───────────────────────────────────────────────────────

  const openAddStageModalLogic = (stageIndex: number) => {
    setEditingStageIndex(stageIndex);
    setStageModalStep(1);
    const existingStage = stages[stageIndex];

    if (existingStage) {
      setStageModalData({
        stage_id: existingStage.stage_id,
        stage_name: existingStage.stage_name,
        start_date: existingStage.start_date,
        end_date: existingStage.end_date,
        stage_format: existingStage.stage_format,
        number_of_groups: existingStage.number_of_groups,
        stage_discord_role_id: existingStage.stage_discord_role_id || "",
        teams_qualifying_from_stage:
          existingStage.teams_qualifying_from_stage || 0,
        total_teams_in_stage: existingStage.total_teams_in_stage || 0,
        prizepool: existingStage.prizepool || "",
        prizepool_cash_value: existingStage.prizepool_cash_value || "",
        prize_distribution: existingStage.prize_distribution || {},
        champion_point_enabled: existingStage.champion_point_enabled ?? false,
        champion_point_threshold: existingStage.champion_point_threshold,
        point_rush_enabled: existingStage.point_rush_enabled ?? false,
        point_rush_reward: existingStage.point_rush_reward ?? {},
        point_rush_target_index: existingStage.point_rush_target_index,
        // ── Branching advancement rules carried back into the modal (feature #9). ──
        advancement_rules: existingStage.advancement_rules ?? [],
        round_robin: existingStage.round_robin ?? DEFAULT_ROUND_ROBIN_CONFIG,
      });
      setTempGroups(
        existingStage.groups.map((g) => ({
          ...g,
          group_id: g.group_id,
          prizepool: g.prizepool || "",
          prizepool_cash_value: g.prizepool_cash_value || "",
          prize_distribution: g.prize_distribution || {},
        })),
      );
    } else {
      setStageModalData({
        stage_name: stageNames[stageIndex] || `Stage ${stageIndex + 1}`,
        start_date: "",
        end_date: "",
        stage_discord_role_id: "",
        stage_format: "",
        number_of_groups: 2,
        teams_qualifying_from_stage: 0,
        total_teams_in_stage: 0,
        prizepool: "",
        prizepool_cash_value: "",
        prize_distribution: {},
        champion_point_enabled: false,
        champion_point_threshold: undefined,
        point_rush_enabled: false,
        point_rush_reward: {},
        point_rush_target_index: undefined,
        // ── Branching advancement default for a brand-new stage (feature #9). ──
        advancement_rules: [],
        round_robin: DEFAULT_ROUND_ROBIN_CONFIG,
      });
      setTempGroups(
        Array.from({ length: 2 }, (_, i) => ({
          group_name: `Group ${i + 1}`,
          playing_date: "",
          playing_time: "00:00",
          teams_qualifying: 1,
          match_count: 1,
          group_discord_role_id: "",
          match_maps: [],
          room_id: "",
          room_name: "",
          room_password: "",
          prizepool: "",
          prizepool_cash_value: "",
          prize_distribution: {},
        })),
      );
    }

    setPasswordVisibility({});
    setIsStageModalOpen(true);
  };

  const addNewStage = () => {
    const currentCount = form.getValues("number_of_stages") || 0;
    const newCount = currentCount + 1;
    const currentStages = form.getValues("stages") || [];

    const newStage: StageType = {
      stage_name: `Stage ${newCount}`,
      stage_discord_role_id: "",
      start_date: "",
      end_date: "",
      number_of_groups: 2,
      stage_format: "",
      groups: Array.from({ length: 2 }, (_, i) => ({
        group_name: `Group ${i + 1}`,
        group_discord_role_id: "",
        playing_date: "",
        playing_time: "00:00",
        teams_qualifying: 1,
        match_count: 1,
        match_maps: [],
        room_id: "",
        room_name: "",
        room_password: "",
        prizepool: "",
        prizepool_cash_value: "",
        prize_distribution: {},
      })),
      teams_qualifying_from_stage: 0,
      total_teams_in_stage: 0,
      prizepool: "",
      prizepool_cash_value: "",
      prize_distribution: {},
      champion_point_enabled: false,
      champion_point_threshold: undefined,
      point_rush_enabled: false,
      point_rush_reward: {},
      point_rush_target_index: undefined,
      // ── Branching advancement default for a brand-new stage (feature #9). ──
      advancement_rules: [],
    };

    form.setValue("stages", [...currentStages, newStage], {
      shouldValidate: false,
    });
    form.setValue("number_of_stages", newCount);
    setStageNames([...stageNames, `Stage ${newCount}`]);
    openAddStageModalLogic(currentCount);
  };

  const handleRemoveStage = (indexToRemove: number) => {
    const currentStages = form.getValues("stages") || [];
    if (currentStages.length <= 1) {
      toast.error(t("toast.eventNeedsStage"));
      return;
    }
    setStageToRemove(indexToRemove);
    setIsRemoveConfirmOpen(true);
  };

  const confirmRemoveStage = async () => {
    if (stageToRemove === null) return;

    const currentStages = form.getValues("stages") || [];
    const stageToDelete = currentStages[stageToRemove];

    if (stageToDelete?.stage_id) {
      try {
        setLoadingRemove(true);
        const response = await fetch(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/delete-stage/`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ stage_id: stageToDelete.stage_id }),
          },
        );
        if (!response.ok) throw new Error("Failed to delete stage");
      } catch {
        toast.error(t("toast.deleteStageFailed"));
        return;
      } finally {
        setLoadingRemove(false);
      }
    }

    const currentCount = form.getValues("number_of_stages") || 0;
    const updatedStages = currentStages.filter(
      (_, idx) => idx !== stageToRemove,
    );
    const updatedNames = stageNames.filter((_, idx) => idx !== stageToRemove);

    form.setValue("stages", updatedStages, {
      shouldDirty: true,
      shouldValidate: true,
    });
    form.setValue("number_of_stages", currentCount - 1);
    setStageNames(updatedNames);

    toast.success(
      t("toast.stageRemoved", {
        name:
          currentStages[stageToRemove]?.stage_name ||
          `Stage ${stageToRemove + 1}`,
      }),
    );
    setIsRemoveConfirmOpen(false);
    setStageToRemove(null);
  };

  // ── Stage modal inner handlers ─────────────────────────────────────────────

  const handleGroupCountChangeLogic = (count: number) => {
    const newCount = Math.max(0, count);
    const newTempGroups = Array.from(
      { length: newCount },
      (_, i) =>
        tempGroups[i] ?? {
          group_name: `Group ${i + 1}`,
          playing_date: stageModalData.start_date || "",
          playing_time: "00:00",
          teams_qualifying: 1,
          match_count: 1,
          group_discord_role_id: "",
          match_maps: [],
          room_id: "",
          room_name: "",
          room_password: "",
          prizepool: "",
          prizepool_cash_value: "",
          prize_distribution: {},
        },
    );
    setTempGroups(newTempGroups);
    setStageModalData({ ...stageModalData, number_of_groups: newCount });
  };

  const updateGroupDetailLogic = (index: number, field: string, value: any) => {
    const newGroups = [...tempGroups];
    newGroups[index] = { ...newGroups[index], [field]: value };
    setTempGroups(newGroups);
  };

  // Match count is DERIVED from the maps selected (owner 2026-06-13): one match per map.
  const addMapToGroup = (groupIndex: number, map: string) => {
    const newGroups = [...tempGroups];
    const maps = [...(newGroups[groupIndex].match_maps || []), map];
    newGroups[groupIndex].match_maps = maps;
    newGroups[groupIndex].match_count = maps.length;
    setTempGroups(newGroups);
  };

  const removeOneMapFromGroup = (groupIndex: number, map: string) => {
    const newGroups = [...tempGroups];
    const current: string[] = newGroups[groupIndex].match_maps || [];
    const idx = current.lastIndexOf(map);
    if (idx !== -1) {
      const maps = current.filter((_, i) => i !== idx);
      newGroups[groupIndex].match_maps = maps;
      newGroups[groupIndex].match_count = maps.length;
    }
    setTempGroups(newGroups);
  };

  // Stage save. IDENTICAL to the admin edit page's handler EXCEPT it does NOT require
  // stage_discord_role_id - the organizer flow hides every Discord input, so a missing
  // stage Discord id must not block the save. The empty id still rides in the payload.
  const handleSaveStageLogic = async () => {
    if (
      !stageModalData.stage_name ||
      !stageModalData.stage_format ||
      !stageModalData.start_date ||
      !stageModalData.end_date ||
      stageModalData.teams_qualifying_from_stage === undefined
    ) {
      toast.error(t("toast.stageFieldsRequired"));
      return;
    }

    // Round-robin stages validate their BASE GROUPS, not the classic per-group config
    // the backend ignores for this format (mirrors the admin edit + create flows).
    const isRoundRobinStage = stageModalData.stage_format === "br - round robin";
    // Clash Squad (cs - *) runs as a head-to-head BRACKET seeded from the registered teams on
    // the event page - no groups/maps to validate. Send groups: [] so no phantom BR group is
    // created (P1#1 backend guard also skips CS). Without this it fell into the BR `else` and
    // the default tempGroups failed "complete all group details" (P1#2, owner 2026-07-13).
    const isClashSquadStage = isClashSquadFormat(stageModalData.stage_format);
    if (isRoundRobinStage) {
      const baseGroups = stageModalData.round_robin?.round_robin_groups ?? [];
      if (baseGroups.length < 2) {
        toast.error(t("toast.rrNeedsTwoGroups"));
        return;
      }
      if (baseGroups.some((g) => !g.label.trim())) {
        toast.error(t("toast.rrGroupNeedsLabel"));
        return;
      }
      if (
        stageModalData.round_robin.generate_schedule &&
        stageModalData.round_robin.games_per_day < 1
      ) {
        toast.error(t("toast.gamesPerDayMin"));
        return;
      }
    } else if (isClashSquadStage) {
      // Nothing to validate: a bracket has no groups/maps. Falls through to send groups: [].
    } else {
      // Group validation also drops the group_discord_role_id requirement (Discord omitted).
      const invalidGroup = tempGroups.find(
        (g) =>
          !g.playing_date ||
          !g.playing_time ||
          !g.group_name.trim() ||
          g.teams_qualifying < 1 ||
          g.match_count < 1 ||
          !g.match_maps ||
          g.match_maps.length === 0,
      );

      if (invalidGroup) {
        toast.error(t("toast.groupDetailsIncomplete"));
        return;
      }

      if (stageModalData.number_of_groups < 1) {
        toast.error(t("toast.stageNeedsGroup"));
        return;
      }
    }

    const existingStage = form.getValues("stages")[editingStageIndex!];

    const newStage: StageType = {
      ...(stageModalData.stage_id && { stage_id: stageModalData.stage_id }),
      ...(existingStage?.stage_id &&
        !stageModalData.stage_id && { stage_id: existingStage.stage_id }),
      stage_name: stageModalData.stage_name,
      start_date: stageModalData.start_date,
      end_date: stageModalData.end_date,
      number_of_groups: stageModalData.number_of_groups,
      stage_format: stageModalData.stage_format,
      // Clash Squad has no groups (a bracket) - send [] so the backend creates no phantom BR group.
      groups: isClashSquadStage
        ? []
        : tempGroups.map((tg, i) => ({
            ...tg,
            matches: (existingStage?.groups[i] as any)?.matches || [],
          })),
      stage_discord_role_id: stageModalData.stage_discord_role_id, // empty (omitted)
      teams_qualifying_from_stage: stageModalData.teams_qualifying_from_stage,
      total_teams_in_stage: stageModalData.total_teams_in_stage,
      prizepool: stageModalData.prizepool,
      prizepool_cash_value: stageModalData.prizepool_cash_value,
      prize_distribution: stageModalData.prize_distribution,
      champion_point_enabled: stageModalData.champion_point_enabled,
      champion_point_threshold: stageModalData.champion_point_threshold,
      point_rush_enabled: stageModalData.point_rush_enabled,
      point_rush_reward: stageModalData.point_rush_reward,
      point_rush_target_index: stageModalData.point_rush_target_index,
      // ── Branching advancement rules (feature #9) - rides into the FormData stages array. ──
      advancement_rules: stageModalData.advancement_rules ?? [],
      ...(stageModalData.stage_format === "br - round robin"
        ? { round_robin: stageModalData.round_robin }
        : {}),
      // ── Clash Squad room settings (owner 2026-08-13) - optional ────────────────
      // Sent only when the organizer actually filled it in, and only for a CS stage. Absent
      // means no room configuration is created, exactly as before this existed. The backend
      // materialises it into a CSRoomConfig scoped to the stage.
      ...(stageModalData.cs_room_settings &&
      isClashSquadFormat(stageModalData.stage_format)
        ? { cs_room_settings: stageModalData.cs_room_settings }
        : {}),
      // ── Clash Squad mode + optional groups (owner item 21, 2026-08-13) ────────
      // The mode no longer lives in stage_format: it rides here for a one-bracket stage, or
      // per group when the organizer split the stage. Sent only for a CS stage.
      ...(isClashSquadFormat(stageModalData.stage_format)
        ? {
            cs_bracket_format: stageModalData.cs_bracket_format,
            cs_groups: stageModalData.cs_groups ?? [],
          }
        : {}),
    };

    const currentStages = [...form.getValues("stages")];
    currentStages[editingStageIndex!] = newStage;
    form.setValue("stages", currentStages, { shouldDirty: true });

    const currentNames = [...stageNames];
    if (currentNames[editingStageIndex!] !== newStage.stage_name) {
      currentNames[editingStageIndex!] = newStage.stage_name;
      setStageNames(currentNames);
    }

    await form.trigger();
    setIsStageModalOpen(false);
    setStageModalStep(1);
    toast.success(t("toast.stageConfigUpdated"));
  };

  // ── Sponsor save (ported 1:1 from the admin edit page) ──────────────────────

  const saveSponsorRequirement = async () => {
    if (!eventDetails?.event_id || !token) return;
    setSavingSponsor(true);
    try {
      const data = form.getValues();
      const formData = new FormData();

      formData.append("event_id", eventDetails.event_id.toString());
      formData.append("is_draft", data.save_to_drafts ? "True" : "False");
      formData.append(
        "event_status",
        data.save_to_drafts
          ? "draft"
          : (data.event_status ?? eventDetails.event_status ?? "upcoming"),
      );
      formData.append("event_name", data.event_name);
      formData.append("competition_type", data.competition_type);
      formData.append("participant_type", data.participant_type);
      formData.append("event_type", data.event_type);
      formData.append("is_public", data.is_public);
      // Re-send the Discord gate on every save path (sponsor / waitlist / main) so it's
      // never dropped. Always send the flag; only send the Guild ID when ON (blank = main
      // AFC server). edit_event reads require_discord + discord_server_id +
      // discord_invite_link (the link is required when the gate is on).
      formData.append(
        "require_discord",
        (data.require_discord ?? false).toString(),
      );
      if (data.require_discord) {
        formData.append("discord_server_id", data.discord_server_id || "");
        formData.append("discord_invite_link", data.discord_invite_link || "");
      }
      formData.append(
        "max_teams_or_players",
        data.max_teams_or_players.toString(),
      );
      formData.append("event_mode", data.event_mode);
      formData.append("prizepool", data.prizepool);
      formData.append(
        "prizepool_cash_value",
        (data.prizepool_cash_value ?? "").toString(),
      );
      // Prize currency (owner 2026-07-02): the org edit page was NOT sending this, so an organizer's
      // NGN pick silently reverted to USD on save. Mirror the admin edit + create pages.
      formData.append("prize_currency", (data.prize_currency || "USD").toString());
      // Real stage count (matches the admin edit page). The old hardcoded "2" corrupted
      // Event.number_of_stages for any 1- or 3-stage org event on every organizer save. (fix 2026-06-20)
      formData.append("number_of_stages", String(data.stages?.length ?? 1));
      formData.append("start_date", data.start_date);
      formData.append("end_date", data.end_date);
      formData.append("registration_open_date", data.registration_open_date);
      formData.append("registration_end_date", data.registration_end_date);
      formData.append("registration_link", data.registration_link || "");
      // Paid-vs-free registration (re-sent on every full-event save so it isn't lost).
      appendRegistrationFeeFields(formData, data);
      // Re-send the (compulsory) times + tz on this partial save too, so it can't wipe them.
      appendEventTimes(formData, data);
      formData.append(
        "publish_to_tournaments",
        data.publish_to_tournaments.toString(),
      );
      formData.append("publish_to_news", data.publish_to_news.toString());
      formData.append(
        "registration_restriction",
        data.registration_restriction || "none",
      );
      formData.append(
        "restriction_mode",
        data.restriction_mode || "allow_only",
      );
      formData.append(
        "restricted_countries",
        JSON.stringify(
          data.selected_locations && data.selected_locations.length > 0
            ? data.selected_locations
            : [],
        ),
      );
      if (rulesInputMethod === "type") {
        formData.append("event_rules", data.event_rules || "");
        formData.append("uploaded_rules", "");
      } else {
        formData.append("event_rules", "");
      }
      formData.append(
        "prize_distribution",
        JSON.stringify(data.prize_distribution),
      );
      formData.append(
        "stream_channels",
        JSON.stringify(
          data.stream_channels?.filter((s) => s.trim() !== "") || [],
        ),
      );
      formData.append("stages", JSON.stringify(data.stages));

      formData.append(
        "is_sponsored",
        sponsorForm.is_sponsored ? "True" : "False",
      );
      formData.append("sponsor_name", sponsorForm.sponsor_name || "");
      formData.append(
        "sponsor_usernames",
        JSON.stringify(sponsorForm.sponsor_usernames ?? []),
      );
      formData.append(
        "requirement_description",
        sponsorForm.requirement_description || "",
      );
      formData.append(
        "sponsor_field_label",
        sponsorForm.sponsor_field_label || "Player UUID",
      );

      await fetch(`${env.NEXT_PUBLIC_BACKEND_API_URL}/events/edit-event/`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      toast.success(t("toast.sponsorSaved"));
      setEventDetails((prev) =>
        prev
          ? {
              ...prev,
              is_sponsored: sponsorForm.is_sponsored,
              sponsor_name: sponsorForm.sponsor_name,
              sponsor_usernames: sponsorForm.sponsor_usernames,
              sponsor_field_label: sponsorForm.sponsor_field_label,
              sponsor_requirement_description:
                sponsorForm.requirement_description,
            }
          : prev,
      );
    } catch (error: any) {
      toast.error(
        error?.response?.data?.message || t("toast.sponsorSaveFailed"),
      );
    } finally {
      setSavingSponsor(false);
    }
  };

  // ── Waitlist save (ported 1:1 from the admin edit page) ─────────────────────

  const saveWaitlistSettings = async () => {
    if (!eventDetails?.event_id || !token) return;
    setSavingWaitlist(true);
    try {
      const data = form.getValues();
      const formData = new FormData();

      formData.append("event_id", eventDetails.event_id.toString());
      formData.append("is_draft", data.save_to_drafts ? "True" : "False");
      formData.append(
        "event_status",
        data.save_to_drafts
          ? "draft"
          : (data.event_status ?? eventDetails.event_status ?? "upcoming"),
      );
      formData.append("event_name", data.event_name);
      formData.append("competition_type", data.competition_type);
      formData.append("participant_type", data.participant_type);
      formData.append("event_type", data.event_type);
      formData.append("is_public", data.is_public);
      // Re-send the Discord gate on every save path (sponsor / waitlist / main) so it's
      // never dropped. Always send the flag; only send the Guild ID when ON (blank = main
      // AFC server). edit_event reads require_discord + discord_server_id +
      // discord_invite_link (the link is required when the gate is on).
      formData.append(
        "require_discord",
        (data.require_discord ?? false).toString(),
      );
      if (data.require_discord) {
        formData.append("discord_server_id", data.discord_server_id || "");
        formData.append("discord_invite_link", data.discord_invite_link || "");
      }
      formData.append(
        "max_teams_or_players",
        data.max_teams_or_players.toString(),
      );
      formData.append("event_mode", data.event_mode);
      formData.append("prizepool", data.prizepool);
      formData.append(
        "prizepool_cash_value",
        (data.prizepool_cash_value ?? "").toString(),
      );
      // Prize currency (owner 2026-07-02): the org edit page was NOT sending this, so an organizer's
      // NGN pick silently reverted to USD on save. Mirror the admin edit + create pages.
      formData.append("prize_currency", (data.prize_currency || "USD").toString());
      // Real stage count (matches the admin edit page). The old hardcoded "2" corrupted
      // Event.number_of_stages for any 1- or 3-stage org event on every organizer save. (fix 2026-06-20)
      formData.append("number_of_stages", String(data.stages?.length ?? 1));
      formData.append("start_date", data.start_date);
      formData.append("end_date", data.end_date);
      formData.append("registration_open_date", data.registration_open_date);
      formData.append("registration_end_date", data.registration_end_date);
      formData.append("registration_link", data.registration_link || "");
      // Paid-vs-free registration (re-sent on every full-event save so it isn't lost).
      appendRegistrationFeeFields(formData, data);
      // Re-send the (compulsory) times + tz on this partial save too, so it can't wipe them.
      appendEventTimes(formData, data);
      formData.append(
        "publish_to_tournaments",
        data.publish_to_tournaments.toString(),
      );
      formData.append("publish_to_news", data.publish_to_news.toString());
      formData.append(
        "registration_restriction",
        data.registration_restriction || "none",
      );
      formData.append(
        "restriction_mode",
        data.restriction_mode || "allow_only",
      );
      formData.append(
        "restricted_countries",
        JSON.stringify(
          data.selected_locations && data.selected_locations.length > 0
            ? data.selected_locations
            : [],
        ),
      );
      if (rulesInputMethod === "type") {
        formData.append("event_rules", data.event_rules || "");
        formData.append("uploaded_rules", "");
      } else {
        formData.append("event_rules", "");
      }
      formData.append(
        "prize_distribution",
        JSON.stringify(data.prize_distribution),
      );
      formData.append(
        "stream_channels",
        JSON.stringify(
          data.stream_channels?.filter((s) => s.trim() !== "") || [],
        ),
      );
      formData.append("stages", JSON.stringify(data.stages));

      formData.append(
        "is_sponsored",
        sponsorForm.is_sponsored ? "True" : "False",
      );
      formData.append("sponsor_name", sponsorForm.sponsor_name || "");
      formData.append(
        "sponsor_usernames",
        JSON.stringify(sponsorForm.sponsor_usernames ?? []),
      );
      formData.append(
        "requirement_description",
        sponsorForm.requirement_description || "",
      );
      formData.append(
        "sponsor_field_label",
        sponsorForm.sponsor_field_label || "Player UUID",
      );

      // Waitlist fields. waitlist_discord_role_id stays whatever it was (empty for
      // organizer-created events) - the Discord input is hidden so the organizer
      // never edits it, but we still send the (empty) field so the shape matches.
      formData.append(
        "is_waitlist_enabled",
        waitlistForm.is_waitlist_enabled ? "True" : "False",
      );
      formData.append("waitlist_capacity", waitlistForm.waitlist_capacity || 0);
      formData.append(
        "waitlist_discord_role_id",
        waitlistForm.waitlist_discord_role_id || "",
      );
      formData.append(
        "waitlist_mode",
        waitlistForm.waitlist_mode || "first_registered",
      );

      // Registration-requirement toggles (owner correction 2026-06-22): edited on Basic Info
      // but saved here (parity with the admin edit page). edit_event reads these require_* keys.
      formData.append("require_team_logo", waitlistForm.require_team_logo ? "True" : "False");
      formData.append("require_esport_images", waitlistForm.require_esport_images ? "True" : "False");
      formData.append("require_player_uid", waitlistForm.require_player_uid ? "True" : "False");
      formData.append(
        "require_player_profile_image",
        waitlistForm.require_player_profile_image ? "True" : "False",
      );
      // WhatsApp number gate (owner 2026-08-03), saved with the requirements above.
      formData.append("require_whatsapp", waitlistForm.require_whatsapp ? "True" : "False");
      // Required connected accounts (owner 2026-08-26): a LIST, so it travels as JSON because
      // multipart FormData can only carry strings. edit_event coerces it back with _as_list and
      // validates each slug against the provider registry. Without this append, editing the
      // selection would never reach the API, which is the bug min_letter_avatars had.
      formData.append(
        "required_connections",
        JSON.stringify(waitlistForm.required_connections ?? []),
      );
      // Letter-avatars gate (feature #7): a NUMBER (0-26), not a bool. edit_event re-parses + clamps
      // it (_parse_min_letter_avatars). Without this append, editing the count never reached the API.
      formData.append(
        "min_letter_avatars",
        String(Number(waitlistForm.min_letter_avatars ?? 0) || 0),
      );

      await fetch(`${env.NEXT_PUBLIC_BACKEND_API_URL}/events/edit-event/`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      toast.success(t("toast.waitlistSaved"));
      setEventDetails((prev) =>
        prev
          ? {
              ...prev,
              is_waitlist_enabled: waitlistForm.is_waitlist_enabled,
              waitlist_capacity: waitlistForm.waitlist_capacity
                ? Number(waitlistForm.waitlist_capacity)
                : null,
              waitlist_discord_role_id: waitlistForm.waitlist_discord_role_id,
              require_team_logo: waitlistForm.require_team_logo,
              require_esport_images: waitlistForm.require_esport_images,
              require_player_uid: waitlistForm.require_player_uid,
              require_player_profile_image: waitlistForm.require_player_profile_image,
              require_whatsapp: waitlistForm.require_whatsapp,
              // Mirror the saved list into the cached event so a reopened Basic Info reflects it
              // without a refetch.
              required_connections: waitlistForm.required_connections,
              // Letter-avatars gate (feature #7): mirror the saved count into the cached event so the
              // RegisteredTeamsTab letter UI + a reopened Basic Info reflect it without a refetch.
              min_letter_avatars: waitlistForm.min_letter_avatars,
            }
          : prev,
      );
    } catch (error: any) {
      toast.error(
        error?.response?.data?.message || t("toast.waitlistSaveFailed"),
      );
    } finally {
      setSavingWaitlist(false);
    }
  };

  // ── Prize distribution (ported 1:1 from the admin edit page) ────────────────
  // Delegates to the shared lib/eventFormats helpers (imported above) so the organizer
  // edit page, the admin edit tab, and the admin create wizard behave identically.
  //
  // ROOT CAUSE the helpers fix: the OLD addPrizePosition used Math.max(existingKeys)+1
  // and never renumbered, so deleting a middle position ("2") from {1,2,3} left {1,3} and
  // adding produced {1,3,4} -> a permanent gap with no way to re-add the "2" slot or fix
  // a wrong entry. The shared helpers renumber the survivors to a gap-free 1..N on every
  // add/remove, so the list can always be rebuilt. Wire shape (Record<string,string>
  // JSON.stringified) is unchanged. formatPrizeKey still maps the numeric key to "1st".
  const addPrizePosition = () => {
    form.setValue(
      "prize_distribution",
      addPrizePositionTo(form.watch("prize_distribution")),
      { shouldDirty: true },
    );
  };

  const removePrizePosition = (key: string) => {
    form.setValue(
      "prize_distribution",
      removePrizePositionFrom(form.watch("prize_distribution"), key),
      { shouldDirty: true },
    );
  };

  // ── Save / submit (ported 1:1 from the admin edit page) ─────────────────────

  // What the save-confirm dialog lists. The comparison itself lives in lib/eventChangeSummary.ts
  // and is shared with the admin edit page, because the old hand-written list of fields drifted
  // from the form schema and reported "No changes detected" while saving a real edit.
  const getChangedFields = (data: EventFormType): EventChangeRow[] =>
    buildEventChangeRows({
      baseline: editBaselineRef.current,
      current: data as unknown as Record<string, unknown>,
      t,
      bannerFileName: selectedFile?.name ?? null,
      rulesFileName: selectedRuleFile?.name ?? null,
      // Requirement toggles + waitlist: state, not form, but saved by the same call.
      extraBaseline: settingsBaselineRef.current,
      extraCurrent: waitlistForm as unknown as Record<string, unknown>,
    });

  // Round-robin schedule backfill (owner 2026-07-01) - mirrors the create + admin-edit flow. A
  // round-robin stage keeps its schedule on the game-day meetings, so its base groups have no
  // date/maps and would fail validateStageData. The backend ignores group date/maps for a round-robin
  // stage, so copy the meetings' date/time/maps onto the base groups before validating + saving.
  const backfillRoundRobinGroups = () => {
    const stages = (form.getValues("stages") as any[]) || [];
    stages.forEach((s, si) => {
      const isRR =
        /round.?robin/i.test(s?.stage_format || "") ||
        (s?.round_robin?.round_robin_groups?.length ?? 0) > 0;
      if (!isRR) return;
      const days = s?.round_robin?.game_days || [];
      const maps = Array.from(new Set(days.flatMap((d: any) => d?.match_maps || []))) as string[];
      const date = days.map((d: any) => d?.playing_date).find(Boolean) || s?.start_date || "";
      const time = days.map((d: any) => d?.playing_time).find(Boolean) || "18:00";
      (s?.groups || []).forEach((g: any, gi: number) => {
        if (!g?.playing_date) form.setValue(`stages.${si}.groups.${gi}.playing_date` as any, date);
        if (!g?.playing_time) form.setValue(`stages.${si}.groups.${gi}.playing_time` as any, time);
        if (!g?.match_maps || !g.match_maps.length)
          form.setValue(`stages.${si}.groups.${gi}.match_maps` as any, maps.length ? maps : ["Bermuda"]);
        if (!g?.match_count) form.setValue(`stages.${si}.groups.${gi}.match_count` as any, 1);
        if (!g?.teams_qualifying) form.setValue(`stages.${si}.groups.${gi}.teams_qualifying` as any, 1);
      });
    });
  };

  const handleSaveChangesClick = (_data: EventFormType) => {
    backfillRoundRobinGroups();
    const currentStages = form.getValues("stages");
    const validation = validateStageData(currentStages);

    if (!validation.isValid) {
      showValidationErrors(validation.errors, (stageIndex) => {
        setCurrentTab("stages_groups");
        if (stageIndex !== undefined) openAddStageModalLogic(stageIndex);
      });
      return;
    }

    setPendingSaveData(form.getValues());
    setShowSaveConfirmModal(true);
  };

  const onSubmit = async (data: EventFormType) => {
    if (!eventDetails?.event_id) {
      toast.error(t("toast.eventIdMissing"));
      return;
    }

    const currentStages = form.getValues("stages");
    const stageValidation = validateStageData(currentStages);
    if (!stageValidation.isValid) {
      showValidationErrors(stageValidation.errors, (stageIndex) => {
        setCurrentTab("stages_groups");
        if (stageIndex !== undefined) openAddStageModalLogic(stageIndex);
      });
      return;
    }

    const eventStart = new Date(data.start_date);
    const eventEnd = new Date(data.end_date);
    const regOpen = new Date(data.registration_open_date);
    const regClose = new Date(data.registration_end_date);

    if (eventStart > eventEnd) {
      toast.error(t("toast.startAfterEnd"));
      setCurrentTab("basic_info");
      return;
    }
    if (regOpen > regClose) {
      toast.error(t("toast.regOpenAfterClose"));
      setCurrentTab("basic_info");
      return;
    }
    // Mirror the backend 400: require_discord=true demands a non-empty invite link.
    if (data.require_discord && !data.discord_invite_link?.trim()) {
      toast.error(t("toast.discordLinkRequired"));
      setCurrentTab("basic_info");
      return;
    }
    // NOTE (fix 2026-06-20): we intentionally do NOT block saving when registration closes at/after
    // the event start. The backend edit_event does not enforce that rule, and the create flow + form
    // schema allow it, so rolling/late registration is a valid configuration. The old hard guard here
    // ("Registration must close before the event starts") meant any such org event could never be
    // re-saved OR unpublished (unpublish flows through this same onSubmit), which is exactly the
    // "save fails / cannot unpublish" the owner reported. Keeping only the two guards the backend also
    // enforces (start<=end, regOpen<=regClose) above.

    startSubmitTransition(async () => {
      try {
        const formData = new FormData();

        let finalEventStatus = data.event_status;
        if (data.save_to_drafts) finalEventStatus = "draft";

        formData.append("is_draft", data.save_to_drafts ? "True" : "False");
        formData.append("event_status", finalEventStatus);
        formData.append("event_id", eventDetails.event_id.toString());

        if (selectedFile) formData.append("event_banner", selectedFile);
        if (selectedRuleFile)
          formData.append("uploaded_rules", selectedRuleFile);

        formData.append("event_name", data.event_name);
        formData.append("competition_type", data.competition_type);
        formData.append("participant_type", data.participant_type);
        formData.append("event_type", data.event_type);
        formData.append("is_public", data.is_public);
        // Discord gate on the main save (mirrors the sponsor/waitlist save paths above).
        formData.append(
          "require_discord",
          (data.require_discord ?? false).toString(),
        );
        if (data.require_discord) {
          formData.append("discord_server_id", data.discord_server_id || "");
          formData.append("discord_invite_link", data.discord_invite_link || "");
        }
        formData.append(
          "max_teams_or_players",
          data.max_teams_or_players.toString(),
        );
        formData.append("event_mode", data.event_mode);
        formData.append("prizepool", data.prizepool);
        // Prize cash value + currency (owner 2026-07-02): this save path omitted BOTH, so it wiped the
        // cash value + reverted the currency to USD. Send them like the other save paths do.
        formData.append(
          "prizepool_cash_value",
          (data.prizepool_cash_value ?? "").toString(),
        );
        formData.append("prize_currency", (data.prize_currency || "USD").toString());
        // Real stage count (matches the admin edit page). The old hardcoded "2" corrupted
      // Event.number_of_stages for any 1- or 3-stage org event on every organizer save. (fix 2026-06-20)
      formData.append("number_of_stages", String(data.stages?.length ?? 1));
        formData.append("start_date", data.start_date);
        formData.append("end_date", data.end_date);
        formData.append("registration_open_date", data.registration_open_date);
        formData.append("registration_end_date", data.registration_end_date);
        formData.append("registration_link", data.registration_link || "");
        // Registration-requirement toggles (owner 2026-07-04 bug fix): live on Basic Info but in the
        // separate waitlistForm state, previously only sent by saveWaitlistSettings - so toggling one
        // and hitting THIS main Save didn't persist it (reverted on refresh). Re-send here too.
        formData.append("require_team_logo", waitlistForm.require_team_logo ? "True" : "False");
        formData.append("require_esport_images", waitlistForm.require_esport_images ? "True" : "False");
        formData.append("require_player_uid", waitlistForm.require_player_uid ? "True" : "False");
        formData.append("require_player_profile_image", waitlistForm.require_player_profile_image ? "True" : "False");
        formData.append("require_whatsapp", waitlistForm.require_whatsapp ? "True" : "False");
        formData.append("min_letter_avatars", String(Number(waitlistForm.min_letter_avatars ?? 0) || 0));
        // Paid-vs-free registration (re-sent on save so the values persist).
        appendRegistrationFeeFields(formData, data);
        // Compulsory event/registration times + editor tz (re-sent so an edit actually
        // persists; previously the times were never sent and edits were silently lost).
        appendEventTimes(formData, data);
        formData.append(
          "publish_to_tournaments",
          data.publish_to_tournaments.toString(),
        );
        formData.append("publish_to_news", data.publish_to_news.toString());
        formData.append(
          "registration_restriction",
          data.registration_restriction || "none",
        );
        formData.append(
          "restriction_mode",
          data.restriction_mode || "allow_only",
        );
        formData.append(
          "restricted_countries",
          JSON.stringify(
            data.selected_locations && data.selected_locations.length > 0
              ? data.selected_locations
              : [],
          ),
        );

        if (rulesInputMethod === "type") {
          formData.append("event_rules", data.event_rules || "");
          formData.append("uploaded_rules", "");
        } else {
          formData.append("event_rules", "");
        }

        formData.append(
          "prize_distribution",
          JSON.stringify(data.prize_distribution),
        );
        formData.append(
          "stream_channels",
          JSON.stringify(
            data.stream_channels?.filter((s) => s.trim() !== "") || [],
          ),
        );
        formData.append("stages", JSON.stringify(data.stages));

        formData.append("is_sponsored", data.is_sponsored ? "True" : "False");
        formData.append("sponsor_name", data.sponsor_name || "");
        formData.append(
          "sponsor_usernames",
          JSON.stringify(data.sponsor_usernames ?? []),
        );
        formData.append(
          "requirement_description",
          data.requirement_description || "",
        );
        formData.append(
          "sponsor_field_label",
          data.sponsor_field_label || "Player UUID",
        );

        formData.append(
          "is_waitlist_enabled",
          waitlistForm.is_waitlist_enabled ? "True" : "False",
        );
        formData.append(
          "waitlist_capacity",
          waitlistForm.waitlist_capacity || 0,
        );
        formData.append(
          "waitlist_discord_role_id",
          waitlistForm.waitlist_discord_role_id || "",
        );
        formData.append(
          "waitlist_mode",
          waitlistForm.waitlist_mode || "first_registered",
        );

        const response = await fetch(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/edit-event/`,
          {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
            body: formData,
          },
        );

        const contentType = response.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
          toast.error(t("toast.unexpectedFormat"), {
            duration: 5000,
          });
          return;
        }

        const res = await response.json();

        if (response.ok) {
          toast.success(
            t("toast.savedSuccess", {
              name: data.event_name,
              status: data.save_to_drafts
                ? t("status.draft")
                : t("status.published"),
            }),
            { duration: 4000 },
          );
          // Live-update (owner 2026-06-20): re-pull the saved event so changes show
          // immediately without a manual reload (same as the admin edit page).
          await fetchEventDetails();
        } else {
          const errorMessage = res.message || res.detail || res.error;
          if (response.status === 400) {
            toast.error(
              <div className="space-y-1">
                <p className="font-semibold">{t("validationErrorTitle")}</p>
                <p className="text-sm">{errorMessage}</p>
              </div>,
              { duration: 5000 },
            );
          } else if (response.status === 401) {
            toast.error(t("toast.sessionExpired"));
            router.push("/login");
          } else if (response.status === 403) {
            toast.error(t("toast.noEditPermission"));
          } else if (response.status === 404) {
            toast.error(t("toast.eventNotFound"));
          } else if (response.status >= 500) {
            toast.error(t("toast.serverError"));
          } else {
            toast.error(errorMessage || t("toast.updateFailed"));
          }
        }
      } catch (error: any) {
        if (
          error.message === "Failed to fetch" ||
          error.message?.includes("NetworkError")
        ) {
          toast.error(t("toast.networkError"));
        } else {
          toast.error(t("toast.unexpectedError"));
        }
      }
    });
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  // ── Permission gate ────────────────────────────────────────────────────────
  // No edit permission → a read-only lock notice (mirrors the create page's gate and
  // the metrics page's lock notice). The event is never fetched for a gated member.
  if (!canEditEvents) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeader title={t("pageTitle")} back />
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <div className="flex size-12 items-center justify-center rounded-md bg-muted text-muted-foreground">
              <IconLock className="size-6" />
            </div>
            <p className="text-sm text-muted-foreground">
              {t("gate.noPermission")}
            </p>
            <Button asChild variant="outline" size="sm">
              <Link href="/organizer/events">{t("backToEvents")}</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Not-yours / not-found gate ──────────────────────────────────────────────
  // The slug isn't one of the selected org's events (org guard above failed). Show a
  // calm "not found here" card rather than loading another org's event into the editor.
  if (notMyOrgEvent) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeader title={t("pageTitle")} back />
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <div className="flex size-12 items-center justify-center rounded-md bg-muted text-muted-foreground">
              <IconCalendarOff className="size-6" />
            </div>
            <p className="max-w-sm text-sm text-muted-foreground">
              {t.rich("notMine.body", {
                org: membership.organization.name,
                strong: (chunks) => (
                  <span className="font-medium text-foreground">{chunks}</span>
                ),
              })}
            </p>
            <Button asChild variant="outline" size="sm">
              <Link href="/organizer/events">{t("backToEvents")}</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (initialLoading || loadingEvent || !eventDetails) return <FullLoader />;

  return (
    <div>
      <SeedStageModal
        isOpen={isSeedModalOpen}
        pendingSeeding={pendingSeeding}
        onOpenChange={setIsSeedModalOpen}
        activeGroup={selectedGroupForSeed}
        onConfirm={() => handleConfirmSeed(selectedGroupForSeed?.group_id)}
      />

      {/* data-tour anchor: PageHeader does not forward props to the DOM, so wrap it. */}
      <div data-tour="org-event-edit-title">
        <PageHeader title={eventTitle} back />
      </div>

      <Form {...form}>
        <form className="space-y-6">
          <Tabs value={currentTab} onValueChange={selectTab}>
            {/* Section navigator: dropdown on phones (organizers editing on mobile were missing the
                sideways-scrolling tabs), scrollable strip on desktop. Shares EventEditSectionNav with
                the admin edit page; the organizer surface ships no InfoTip ids, so only labels + error/
                enabled dots + the strip-level tour anchor are passed. */}
            <EventEditSectionNav
              value={currentTab}
              onValueChange={selectTab}
              listTourAttr="org-event-edit-tabs"
              sections={[
                {
                  value: "basic_info",
                  label: t("tabs.basicInfo"),
                  dot: tabErrors.basic_info ? "error" : null,
                },
                {
                  value: "registered_teams",
                  label: t("tabs.registeredTeams"),
                  dot: tabErrors.registered_teams ? "error" : null,
                },
                {
                  value: "stages_groups",
                  label: t("tabs.stagesGroups"),
                  dot: tabErrors.stages_groups ? "error" : null,
                },
                {
                  value: "prize_rules",
                  label: t("tabs.prizeRules"),
                  dot: tabErrors.prize_rules ? "error" : null,
                },
                // Linked Events (owner 2026-06-29): parity with the admin edit page.
                { value: "linked_events", label: t("tabs.linkedEvents") },
                { value: "actions", label: t("tabs.actions") },
                {
                  value: "sponsor",
                  label: t("tabs.sponsor"),
                  dot: sponsorForm.is_sponsored ? "active" : null,
                },
                {
                  value: "waitlist",
                  label: t("tabs.waitlist"),
                  dot: waitlistForm.is_waitlist_enabled ? "active" : null,
                },
              ]}
            />

            <TabsContent value="basic_info">
              <BasicInfoTab
                eventDetails={eventDetails}
                // Registration-requirement toggles live on Basic Info (owner 2026-06-22) but
                // are stored + saved via waitlistForm/saveWaitlistSettings (admin parity).
                requirementsForm={waitlistForm}
                setRequirementsForm={setWaitlistForm}
                previewUrl={previewUrl}
                setPreviewUrl={setPreviewUrl}
                selectedFile={selectedFile}
                setSelectedFile={setSelectedFile}
                isDragging={isDragging}
                setIsDragging={setIsDragging}
                fileInputRef={fileInputRef}
                streamFields={streamFields}
                appendStream={() => appendStream("")}
                removeStream={removeStream}
                setPendingParticipantType={setPendingParticipantType}
                setShowParticipantTypeWarning={setShowParticipantTypeWarning}
                onSaveChanges={() => handleSaveChangesClick(form.getValues())}
                loadingEvent={loadingEvent}
                pendingSubmit={pendingSubmit}
                // Internal/External Event Type is AFC-only; hide it for organizers.
                hideEventType
                // Registration link is an AFC-only concern; NOT applied to organizer events at all
                // (owner reverted 2026-06-20: organizers do not get the external registration link).
                hideRegistrationLink
              />
            </TabsContent>

            <TabsContent value="registered_teams">
              <RegisteredTeamsTab
                eventDetails={eventDetails}
                updateCompetitorStatus={updateCompetitorStatus}
                // In-place refresh (owner 2026-07-02 organizer parity): the tab's Add-Teams /
                // Edit-Roster modals call this onSuccess to re-pull the event and re-render the
                // roster without a manual reload (same wiring as the admin edit page).
                onRefresh={fetchEventDetails}
              />
              {/* Broadcast media hygiene (owner 2026-07-02 organizer parity): missing team logos /
                  player esport images, flag bad art, per-event hide/show. Same card the admin edit
                  page + overlay studio mount; the backend already allows the event's organizer. */}
              {eventDetails?.event_id ? (
                <div className="mt-4">
                  <MediaAuditCard eventId={eventDetails.event_id} />
                </div>
              ) : null}
            </TabsContent>

            <TabsContent value="stages_groups">
              <StagesGroupsTab
                eventDetails={eventDetails}
                stageNames={stageNames}
                passwordVisibility={passwordVisibility}
                leaderboardData={leaderboardData}
                loadingLeaderboard={loadingLeaderboard}
                loadingEvent={loadingEvent}
                pendingSubmit={pendingSubmit}
                onOpenStageModal={openAddStageModalLogic}
                onRemoveStage={handleRemoveStage}
                onSeedGroup={(group: any) => {
                  setSelectedGroupForSeed(group);
                  setIsSeedModalOpen(true);
                }}
                onViewResult={() => {}}
                onFetchLeaderboard={fetchGroupLeaderboard}
                onToggleVisibility={toggleVisibility}
                onAddNewStage={addNewStage}
                onSaveChanges={() => handleSaveChangesClick(form.getValues())}
                // In-place refresh (owner 2026-07-02 organizer parity): the stage/group
                // Add-Teams modals + stage reordering call this onSuccess to re-pull the
                // event and re-render the new rosters/order (same as the admin edit page).
                onRefresh={fetchEventDetails}
              />
            </TabsContent>

            <TabsContent value="prize_rules">
              <PrizeRulesTab
                rulesInputMethod={rulesInputMethod}
                setRulesInputMethod={setRulesInputMethod}
                previewRuleUrl={previewRuleUrl}
                setPreviewRuleUrl={setPreviewRuleUrl}
                selectedRuleFile={selectedRuleFile}
                setSelectedRuleFile={setSelectedRuleFile}
                rulesFileInputRef={rulesFileInputRef}
                addPrizePosition={addPrizePosition}
                removePrizePosition={removePrizePosition}
                formatPrizeKey={formatPrizeKey}
                onSaveChanges={() => handleSaveChangesClick(form.getValues())}
                loadingEvent={loadingEvent}
                pendingSubmit={pendingSubmit}
              />
            </TabsContent>

            {/* Linked Events (owner 2026-06-29): the qualification-links editor, reused verbatim from
                the event DETAIL page (parity with the admin edit page). Self-contained load + save;
                we only pass the event id + its stages mapped to { id, stage_name }. */}
            <TabsContent value="linked_events">
              <LinkedEventsCard
                eventId={eventDetails.event_id}
                stages={(eventDetails.stages ?? []).map((s: any) => ({
                  id: s.stage_id ?? s.id,
                  stage_name: s.stage_name,
                }))}
              />
            </TabsContent>

            <TabsContent value="actions" className="space-y-4">
              {/* hideDiscord: hides only the "Sync Discord Roles" control; every other
                  event action (start / cancel / complete / seed / advance / broadcast /
                  visibility / export) stays available to the organizer. */}
              <ActionsTab
                eventDetails={eventDetails}
                onStartTournament={() =>
                  setOpenConfirmStartTournamentModal(true)
                }
                onRefresh={fetchEventDetails}
                hideDiscord
              />
              {/* F6 co-organizers (owner 2026-07-02 organizer parity): manage which OTHER orgs
                  co-own this event, same panel the admin edit page mounts. The backend only lets
                  the PRIMARY org's OWNER (or an AFC admin) invite/revoke, so it renders only for
                  isOwner - a can_edit_events member would just get 403s from every action in it.
                  primaryOrgSlug = the context org's slug (the org guard above already proved the
                  event is homed to it), so the picker excludes the owning org itself. */}
              {isOwner && (
                <CoOrganizersPanel
                  eventId={eventDetails.event_id}
                  primaryOrgSlug={orgSlug}
                />
              )}
            </TabsContent>

            <TabsContent value="sponsor">
              {/* reviewSponsorsHref (owner 2026-07-02 organizer parity): the "Review Sponsors"
                  shortcut used to be hidden here (hideAdminReviewLink) because it deep-linked
                  into the admin route. Organizers now have their own scoped review page at
                  /organizer/events/<slug>/sponsors, so point the shortcut there instead.
                  eventId powers the new sponsorship builder (P2): SponsorTab loads
                  sponsorsApi.forEvent(eventId) and diff-saves attach/detach/configure
                  (the configure endpoint allows the event's organizer too). */}
              <SponsorTab
                slug={slug}
                // Display-only sponsor logos (owner 2026-08-05, item 26). Both public detail
                // builders return them on the event payload, so there is nothing to fetch.
                publicSponsors={(eventDetails as any)?.public_sponsors ?? []}
                sponsorForm={sponsorForm}
                setSponsorForm={setSponsorForm}
                onSave={saveSponsorRequirement}
                saving={savingSponsor}
                reviewSponsorsHref={`/organizer/events/${slug}/sponsors`}
                eventId={eventDetails?.event_id ?? null}
              />
            </TabsContent>

            <TabsContent value="waitlist">
              {/* hideDiscord: hides the Waitlist Discord Role ID input only; the rest
                  of the waitlist UI (toggle, capacity, waitlisted list) stays. */}
              <WaitlistTab
                waitlistForm={waitlistForm}
                setWaitlistForm={setWaitlistForm}
                onSave={saveWaitlistSettings}
                saving={savingWaitlist}
                eventDetails={eventDetails}
                eventId={eventDetails.event_id}
                onRefresh={fetchEventDetails}
                hideDiscord
              />
            </TabsContent>
          </Tabs>
        </form>

        {/* ── Modals ─────────────────────────────────────────────────────── */}

        <ParticipantTypeWarningModal
          open={showParticipantTypeWarning}
          currentType={form.getValues("participant_type")}
          pendingType={pendingParticipantType}
          participantLabel={
            eventDetails.participant_type === "squad"
              ? t("participant.teams")
              : t("participant.players")
          }
          onCancel={() => {
            setPendingParticipantType(null);
            setShowParticipantTypeWarning(false);
          }}
          onConfirm={(newType) => {
            form.setValue("participant_type", newType);
            setPendingParticipantType(null);
            setShowParticipantTypeWarning(false);
          }}
        />

        <SaveConfirmModal
          open={showSaveConfirmModal}
          changes={pendingSaveData ? getChangedFields(pendingSaveData) : []}
          pendingSubmit={pendingSubmit}
          onCancel={() => {
            setShowSaveConfirmModal(false);
            setPendingSaveData(null);
          }}
          onConfirm={async () => {
            setShowSaveConfirmModal(false);
            if (pendingSaveData) {
              await onSubmit(pendingSaveData);
              setPendingSaveData(null);
            }
          }}
        />

        {/* hideDiscord: hides the stage + per-group Discord Role ID inputs and drops
            the stage-discord requirement from the modal's Step 1 gate. */}
        <StageConfigModal
          isOpen={isStageModalOpen}
          onOpenChange={setIsStageModalOpen}
          stageModalStep={stageModalStep}
          setStageModalStep={setStageModalStep}
          editingStageIndex={editingStageIndex}
          stageNames={stageNames}
          stageModalData={stageModalData}
          setStageModalData={setStageModalData}
          tempGroups={tempGroups}
          setTempGroups={setTempGroups}
          handleGroupCountChangeLogic={handleGroupCountChangeLogic}
          updateGroupDetailLogic={updateGroupDetailLogic}
          onAddMap={addMapToGroup}
          onRemoveMap={removeOneMapFromGroup}
          handleSaveStageLogic={handleSaveStageLogic}
          passwordVisibility={passwordVisibility}
          toggleVisibility={toggleVisibility}
          availableTeams={(eventDetails?.tournament_teams ?? [])
            .filter((t: any) => t?.team_id != null && t?.team_name)
            .map((t: any) => ({ team_id: t.team_id, team_name: t.team_name }))}
          hideDiscord
        />

        <RemoveStageModal
          open={isRemoveConfirmOpen}
          onOpenChange={(open) => {
            setIsRemoveConfirmOpen(open);
            if (!open) setStageToRemove(null);
          }}
          onConfirm={confirmRemoveStage}
        />

        {openConfirmStartTournamentModal && (
          <ConfirmStartTournamentModal
            open={openConfirmStartTournamentModal}
            eventId={eventDetails.event_id}
            participantType={eventDetails.participant_type}
            eventName={eventDetails.event_name}
            stageId={eventDetails.stages[0]?.stage_id}
            onClose={() => setOpenConfirmStartTournamentModal(false)}
            // Refetch after starting (owner 2026-07-04): nothing re-pulled, so the stage looked
            // empty until a manual reload.
            onSuccess={fetchEventDetails}
          />
        )}
      </Form>
    </div>
  );
}
