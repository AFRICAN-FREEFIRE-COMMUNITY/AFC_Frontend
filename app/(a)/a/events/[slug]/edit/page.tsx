"use client";

import {
  useState,
  useTransition,
  useRef,
  useEffect,
  useCallback,
  use,
} from "react";
import { useForm, useFieldArray } from "react-hook-form";
// Stage-shape helper: a Clash Squad stage carries its mode per group now (owner item 21).
import { isClashSquadFormat } from "@/lib/eventFormats";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
// next-intl: this admin edit shell owns its page-header, tab labels, save/discard prompts and
// toasts. Copy lives in the "evEditPage" namespace (messages/{en,fr,pt}) - the SAME namespace the
// organizer edit twin uses, so both edit surfaces read identically across locales.
import { useTranslations } from "next-intl";
import { Form } from "@/components/ui/form";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { InfoTip } from "@/components/ui/info-tip";
// Mobile-first section navigator (dropdown on phones, scrollable tab strip on desktop) shared with
// the organizer edit page so the two never drift (owner 2026-07-13 mobile-discoverability fix).
import { EventEditSectionNav } from "@/components/events/EventEditSectionNav";
import { useAuth } from "@/contexts/AuthContext";
import { env } from "@/lib/env";
// Shared prize-distribution helpers (see lib/eventFormats.ts). Renumber the map to a
// contiguous "1".."N" on every add/remove so a deleted/wrong position can always be
// rebuilt. Same helpers used by the admin create wizard + organizer edit page = parity.
import {
  addPrizePositionTo,
  removePrizePositionFrom,
  formatPrizeKey,
} from "@/lib/eventFormats";
// Save-confirm diff (see lib/eventChangeSummary.ts). Shared with the organizer edit page so the
// two cannot disagree about what counts as a change.
import {
  buildEventChangeRows,
  type EventChangeRow,
} from "@/lib/eventChangeSummary";
import axios from "axios";
import { FullLoader } from "@/components/Loader";
import ResultsTab from "./_components/ResultsTab";
import PrivateEventInvitesCard from "./_components/PrivateEventInvitesCard";
import { SeedStageModal } from "../../_components/SeedStageModal";
import { ConfirmStartTournamentModal } from "../../_components/ConfirmStartTournamentModal";

import {
  EventFormSchema,
  validateStageData,
  showValidationErrors,
  type EventFormType,
  type EventDetails,
  type StageType,
  type AdvancementRuleInput,
  type Params,
} from "./types";

import BasicInfoTab from "./_components/BasicInfoTab";
import RegisteredTeamsTab from "./_components/RegisteredTeamsTab";
// Broadcast media hygiene (owner 2026-07-02): shown under Registered Teams.
import { MediaAuditCard } from "@/components/overlay/MediaAuditCard";
import PrizeRulesTab from "./_components/PrizeRulesTab";
import ActionsTab from "./_components/ActionsTab";
// F6 (owner 2026-06-19): manage co-organizing orgs (invite / accept / revoke) for this event.
import CoOrganizersPanel from "./_components/CoOrganizersPanel";
import { StageConfigModal } from "./_components/StageConfigModal";
import { RemoveStageModal } from "./_components/RemoveStageModal";
// Shared Round-Robin config types + default (sub-project B).
import {
  DEFAULT_ROUND_ROBIN_CONFIG,
  type RoundRobinConfig,
} from "../../_components/RoundRobinPanel";
import { ParticipantTypeWarningModal } from "./_components/ParticipantTypeWarningModal";
import { SaveConfirmModal } from "./_components/SaveConfirmModal";
import StagesGroupsTab from "./_components/StagesGroupsTab";
import SponsorTab from "./_components/SponsorTab";
import WaitlistTab from "./_components/WaitlistTab";
// Linked-events (qualification links) editor - the SAME component the event DETAIL page mounts
// (components/event-links.tsx -> lib/eventLinks.ts -> events/<id>/links/* endpoints). Reused here so
// an admin can create/fire/cancel per-stage qualification links straight from the edit flow. It
// self-loads (eventLinksApi.list) and self-saves (create/fire/cancel/decide), so we only mount it
// with the event id + its stages.
import { LinkedEventsCard } from "@/components/event-links";

// ── Paid-vs-free registration payload helper (non-payment phase) ─────────────────
// Appends registration_type (+ fee/currency when paid) onto the edit-event FormData.
// Shared by all three FormData builders on this page (the main Save, the Sponsor save,
// and the Waitlist save) so they can't drift. AFC-admin events never need the paid
// terms gate (organizer only), so this just sends the values. FREE sends no fee.
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
    // clearing all rows persists (null clears it server-side). JSON-encoded; backend re-validates.
    formData.append(
      "country_payment_rules",
      data.country_payment_rules
        ? JSON.stringify(data.country_payment_rules)
        : "",
    );
  }
}

// Append the four (now compulsory) event/registration times + the editor's IANA timezone
// to a save payload (owner 2026-06-21). Previously the edit page NEVER re-sent the times,
// so any time edit was silently dropped on save. Called by every save handler below (the
// main onSubmit + the per-tab settings saves) so a partial save can't wipe the times.
// timezone reflects whoever is SETTING it now (the editor's browser), matching the rule
// "based off the timezone of whoever creates or sets it". backend: edit_event.
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
// Translate the backend's get-event-details echo into the form's RoundRobinConfig.
// The echo carries base groups (with server group_ids + team_ids) and game_days whose
// lobbies merge groups by GROUP ID; the form edits groups by 0-based INDEX, so we map
// each lobby's source_group_ids back to indices via a group_id → index lookup. Returns
// the default config when the stage has no round-robin structure.
function rehydrateRoundRobin(
  rr: EventDetails["stages"][number]["round_robin"],
): RoundRobinConfig {
  if (!rr || !rr.round_robin_groups?.length) {
    return DEFAULT_ROUND_ROBIN_CONFIG;
  }

  // Keep the server group order so indices line up with the editor's group list.
  const orderedGroups = [...rr.round_robin_groups].sort(
    (a, b) => a.order - b.order,
  );
  const indexByGroupId = new Map<number, number>(
    orderedGroups.map((g, i) => [g.group_id, i]),
  );

  // Flatten the echoed game_days → one form game-day per lobby (a day can hold
  // multiple lobbies). source_group_ids → source_group_indices via the lookup.
  const gameDays = (rr.game_days || []).flatMap((day) =>
    (day.lobbies || []).map((lobby) => ({
      game_day: day.game_day,
      source_group_indices: (lobby.source_group_ids || [])
        .map((gid) => indexByGroupId.get(gid))
        .filter((i): i is number => i !== undefined),
      match_count: lobby.match_count ?? 1,
      match_maps: lobby.match_maps ?? ["Bermuda"],
      // Per-match-day date/time (owner 2026-06-15): rehydrate what was saved so editing the stage
      // shows the real schedule (the backend echoes these on get-event-details-for-admin).
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
    // Prefer the backend's explicit stage-level mode (owner 2026-06-17). Fall back to the old
    // derivation only for events saved before the echo carried these: if lobbies were
    // materialised, show the MANUAL meeting list so the admin edits each match day; otherwise
    // leave auto-generate on. games_per_day now mirrors a lobby's match_count (== len(maps)),
    // so the "matches per meeting" value survives a save/reload instead of collapsing to 1.
    generate_schedule: rr.generate_schedule ?? gameDays.length === 0,
    games_per_day: rr.games_per_day ?? gameDays[0]?.match_count ?? 1,
    game_days: gameDays,
  };
}

// ============================================================================
// PAGE COMPONENT
// ============================================================================

export default function EditEventPage({ params }: { params: Promise<Params> }) {
  const resolvedParams = use(params);
  const { slug } = resolvedParams;
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  // Translations for this page's own chrome (header, tab labels, toasts, validation prompts).
  // Declared early so the eventTitle useState initializer below can read the loading label.
  const t = useTranslations("evEditPage");

  // ── Core loading/UI state ──────────────────────────────────────────────────
  // Active edit tab persists in the URL (?tab=) so a RELOAD keeps you on the same
  // step instead of jumping back to Basic Info (owner 2026-06-20). setCurrentTab is
  // wrapped (selectTab) to mirror the change into the URL; the raw setter is still
  // used for the programmatic jumps to a tab that has validation errors.
  // Tabs that have been renamed keep their OLD ?tab= value working. A bookmark, a link in a
  // handover doc, or a browser history entry pointing at ?tab=results_import must land on the tab
  // that absorbed it rather than silently falling back to Basic Info, which looks like the deep
  // link was ignored (owner 2026-08-22, the Results reshape).
  const TAB_ALIASES: Record<string, string> = {
    results_import: "results",
    basic_info: "setup",
    linked_events: "setup",
    sponsor: "setup",
    registered_teams: "teams",
    waitlist: "teams",
    stages_groups: "structure",
    prize_rules: "prizes",
    actions: "comms",
  };
  const [currentTab, setCurrentTab] = useState(() => {
    const asked = searchParams.get("tab") || "basic_info";
    return TAB_ALIASES[asked] || asked;
  });
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

  // ── stageModalData now includes prize fields ───────────────────────────────
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
    // ── Scoring-mode config (sub-project A). Independent + combinable toggles. ──
    champion_point_enabled: boolean;
    champion_point_threshold?: number;
    point_rush_enabled: boolean;
    point_rush_reward: Record<string, number>;
    point_rush_target_index?: number;
    // ── Branching advancement rules (feature #9). Optional repeatable authoring rows. ──
    advancement_rules?: AdvancementRuleInput[];
    // ── Round-Robin config (sub-project B) - only for "br - round robin" stages. ──
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
    stage_discord_role_id: "",
    total_teams_in_stage: 0,
    prizepool: "",
    prizepool_cash_value: "",
    prize_distribution: {},
    // ── Scoring-mode defaults: both modes off until toggled. ──
    champion_point_enabled: false,
    champion_point_threshold: undefined,
    point_rush_enabled: false,
    point_rush_reward: {},
    point_rush_target_index: undefined,
    // ── Branching advancement default (feature #9): no rules = legacy linear advance. ──
    advancement_rules: [],
    // ── Round-Robin default: two empty base groups, auto-schedule. ──
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
    // Slot-assignment mode (owner 2026-06-17). Default earliest-registered.
    waitlist_mode: "first_registered",
    // F3 registration requirements (owner 2026-06-19) - edited + saved via the Waitlist tab,
    // which is the shared home for registration-behavior toggles in the edit form.
    require_team_logo: false,
    require_esport_images: false,
    require_player_uid: false,
    require_player_profile_image: false,
    // WhatsApp number gate (owner 2026-08-03): same shape as the four above.
    require_whatsapp: false,
    // Required connected accounts (owner 2026-08-26): a LIST of provider slugs, not a bool.
    // Edited on Basic Info by the shared RequiredConnectionsPicker and saved by the waitlist save
    // -> edit_event, the same route min_letter_avatars takes.
    required_connections: [] as string[],
    // Teams filing their own map results (owner backlog item 6, 2026-08-04). NOT a registration
    // requirement like the toggles above, it is a capability the organizer switches on for this
    // event, but it rides the same waitlistForm state and the same save so an organizer does not
    // have to hunt for a second Save button. Default OFF: most organizers will not want it.
    allow_team_result_submissions: false,
    // Letter-avatars gate (feature #7, owner 2026-06-29): a NUMBER (0 = off, 1-26 = required min),
    // not a bool. Edited on Basic Info (BasicInfoTab) alongside the require_* toggles, prefilled from
    // ed.min_letter_avatars below and persisted by saveWaitlistSettings -> edit_event.
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
  // diffs against this, so it can list exactly what the admin changed. Filled in the reset effect.
  const editBaselineRef = useRef<Record<string, unknown> | null>(null);
  // The same snapshot for the settings that are NOT in the form: the registration-requirement
  // toggles and the waitlist block, which live in `waitlistForm` state but ride to edit_event on
  // the same save. Without it the dialog said "No changes detected" after a real requirement
  // change (owner report 2026-08-14), and Go Back then threw the change away. Filled beside
  // setWaitlistForm in the fetch below, so it is re-taken after every save's refetch.
  const settingsBaselineRef = useRef<Record<string, unknown> | null>(null);

  // ── Form setup ─────────────────────────────────────────────────────────────
  const form = useForm<EventFormType>({
    resolver: zodResolver(EventFormSchema),
    defaultValues: {
      event_name: "",
      event_description: "",
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
    if (!slug || authLoading || !token) return;
    fetchEventDetails();
    // fetchEventDetails is a stable useCallback declared below; it is intentionally not
    // listed here to avoid a use-before-declaration TDZ (the deps array is evaluated at
    // render time, before the const is initialised). slug/token/authLoading gate the load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, token, authLoading]);

  useEffect(() => {
    if (eventDetails && !initialLoading) {
      // The form drives Point-Rush by a 0-based stage INDEX (point_rush_target_index),
      // but get-event-details echoes the target as a stage_id (point_rush_target_stage_id).
      // Build a stage_id → index lookup so we can translate it back on rehydration.
      const stageIndexById = new Map<number, number>(
        eventDetails.stages.map((s, i) => [s.stage_id || s.id, i]),
      );

      const mappedStages = eventDetails.stages.map((stage) => ({
        ...stage,
        stage_id: stage.stage_id || stage.id,
        prizepool: stage.prizepool || "",
        prizepool_cash_value: stage.prizepool_cash_value || "",
        prize_distribution: stage.prize_distribution || {},
        // ── Scoring-mode config: normalise nullable threshold + resolve target index. ──
        champion_point_enabled: stage.champion_point_enabled ?? false,
        champion_point_threshold: stage.champion_point_threshold ?? undefined,
        point_rush_enabled: stage.point_rush_enabled ?? false,
        point_rush_reward: stage.point_rush_reward || {},
        point_rush_target_index:
          stage.point_rush_target_stage_id != null
            ? stageIndexById.get(stage.point_rush_target_stage_id)
            : undefined,
        // ── Branching advancement rules (feature #9): translate the echoed rules (which carry
        //    target_stage_id + source_group_id) back into the form's index shape. target_stage_id
        //    -> index via stageIndexById; source_group_id -> its position in this stage's groups.
        //    The `...stage` spread above pulls in the echo shape, so we OVERRIDE it here. ──
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
        // ── Round-Robin config (sub-project B): rebuild the form shape from the
        //    echoed structure. The backend uses base-group IDS for lobby merges; the
        //    form uses 0-based INDICES - translate via a group_id → index lookup so
        //    the schedule survives a round-trip. Defaults when the stage has none. ──
        round_robin: rehydrateRoundRobin(stage.round_robin),
        groups: stage.groups.map((group) => ({
          ...group,
          group_id: group.group_id,
          prizepool: group.prizepool || "",
          prizepool_cash_value: group.prizepool_cash_value || "",
          prize_distribution: group.prize_distribution || {},
          // Room name + password start EMPTY on the edit form (owner 2026-06-13):
          // they are per-session secrets, so the admin re-enters them each time
          // instead of the form pre-showing the saved value. What is typed here is
          // what gets saved. room_id (a non-secret label like "Room 1") is kept.
          room_name: "",
          room_password: "",
        })),
      }));

      setTimeout(() => {
        form.reset({
          banner: eventDetails.event_banner_url || "",
          event_name: eventDetails.event_name,
          event_description: eventDetails.event_description ?? "",
          competition_type: eventDetails.competition_type,
          participant_type: eventDetails.participant_type,
          event_type: eventDetails.event_type,
          is_public: eventDetails.is_public ? "True" : "False",
          // Pre-fill the Discord gate toggle + Guild ID from the fetched event so the
          // BasicInfoTab controls show the saved state and re-save it unchanged.
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
          // Prize currency (owner 2026-07-01): preselect the event's stored currency (default USD).
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
        // See lib/eventChangeSummary.ts for why the dialog stopped being a hand-written list.
        editBaselineRef.current = form.getValues() as Record<string, unknown>;

        setPreviewUrl(eventDetails.event_banner_url || "");
        setPreviewRuleUrl(eventDetails.uploaded_rules_url || "");
        setRulesInputMethod(eventDetails.event_rules ? "type" : "upload");
        setEventTitle(t("editEventTitle", { name: eventDetails.event_name }));
      }, 100);
    }
  }, [eventDetails, initialLoading, form]);

  // Track errors per tab
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

  // Draft / publish mutual exclusivity
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

  // Reusable event-details loader (owner 2026-06-13 "no manual refresh"): this is the
  // SINGLE place the edit page pulls fresh server state. The initial load effect above
  // calls it, and it is threaded into the action tabs (Actions / Stages & Groups /
  // Registered Teams) as `onRefresh` so any mutating action (start/pause/resume, add
  // teams, edit roster, etc.) can re-pull + re-render in place instead of forcing a
  // window.location.reload(). Re-running it re-runs form.reset(...) (via the eventDetails
  // effect) so the react-hook-form fields + every tab reflect the latest server state.
  // Wrapped in useCallback so the deps it closes over (slug/token/authLoading/router) are
  // stable and it can safely sit in the load effect's dependency array.
  const fetchEventDetails = useCallback(async () => {
    if (!slug || authLoading || !token) return;
    try {
      setLoadingEvent(true);
      const commonConfig = {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      };

      const [res, resAdmin] = await Promise.all([
        axios.post(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/get-event-details/`,
          { slug },
          commonConfig,
        ),
        axios.post(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/get-event-details-for-admin/`,
          { slug },
          commonConfig,
        ),
      ]);

      const adminStages =
        resAdmin.data.event_details?.stages || resAdmin.data.stages || [];
      const mergedDetails: EventDetails = {
        ...res.data.event_details,
        stages: adminStages,
      };

      if (adminStages.length > 0)
        setStageNames(adminStages.map((s: any) => s.stage_name));

      setEventDetails(mergedDetails);

      const ed = res.data.event_details;
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
          // F3: prefill the registration-requirement toggles from the event.
          require_team_logo: ed.require_team_logo ?? false,
          require_esport_images: ed.require_esport_images ?? false,
          require_player_uid: ed.require_player_uid ?? false,
          require_player_profile_image: ed.require_player_profile_image ?? false,
          require_whatsapp: ed.require_whatsapp ?? false,
          // Rehydrate the list so a reopened form shows what is stored, not an empty picker.
          required_connections: ed.required_connections ?? [],
          allow_team_result_submissions: ed.allow_team_result_submissions ?? false,
          // Letter-avatars gate (feature #7): rehydrate the count from the event (0 = off). Coerced
          // to a clean 0-or-positive number so the BasicInfoTab control reads a real value.
          min_letter_avatars: Number(ed.min_letter_avatars ?? 0) || 0,
        };
        setWaitlistForm(seededSettings);
        // What the save-confirm dialog diffs these against. Taken from the SAME object that seeds
        // the state, and re-taken on the refetch after each save, so the dialog reports a toggle
        // change once and stops reporting it afterwards.
        settingsBaselineRef.current = { ...seededSettings };
      }

      setLoadingEvent(false);
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.message ||
        error.response?.data?.detail ||
        t("toast.fetchDetailsFailed");
      toast.error(errorMessage);
      // DO NOT hard-redirect to /login on a failed load (owner 2026-07-04 random-logout fix): this
      // catch fired for ANY error - a transient 5xx, a timeout, a network blip - so a momentary
      // backend hiccup while opening the edit page looked like a logout ("opening a page logs me
      // out"). Genuine session expiry is handled by AuthContext's interceptor (revalidate-once +
      // in-place login modal); here we just toast and let the user retry (reload).
    } finally {
      setLoadingEvent(false);
      setInitialLoading(false);
    }
    // Closes over slug/token/authLoading/router; setState setters are stable.
  }, [slug, token, authLoading, router]);

  // ============================================================================
  // HANDLERS
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
        // ── prize fields loaded from existing stage ──
        prizepool: existingStage.prizepool || "",
        prizepool_cash_value: existingStage.prizepool_cash_value || "",
        prize_distribution: existingStage.prize_distribution || {},
        // ── Clash Squad: the mode + any groups (owner item 21, 2026-08-13) ──────────────
        // Read from eventDetails, NOT from the form's copy of the stage: the form's group rows
        // are rebuilt through the zod schema and the mode did not survive that round-trip, so a
        // round-robin stage opened the editor showing "Knockout". eventDetails is the API
        // response verbatim, which is where bracket_format actually lives.
        ...(() => {
          const apiStage = (eventDetails?.stages || []).find(
            (st: any) => (st.stage_id ?? st.id) === existingStage.stage_id,
          );
          const brackets = ((apiStage as any)?.groups || []).filter(
            (g: any) => g?.bracket_format,
          );
          return {
            cs_bracket_format: brackets[0]?.bracket_format ?? "single_elim",
            // One bracket group IS an unsplit stage, so it stays out of the group editor.
            cs_groups:
              brackets.length > 1
                ? brackets.map((g: any) => ({
                    group_id: g.group_id,
                    group_name: g.group_name,
                    bracket_format: g.bracket_format,
                  }))
                : [],
          };
        })(),
        // ── Scoring-mode config carried back into the modal for re-editing. ──
        champion_point_enabled: existingStage.champion_point_enabled ?? false,
        champion_point_threshold: existingStage.champion_point_threshold,
        point_rush_enabled: existingStage.point_rush_enabled ?? false,
        point_rush_reward: existingStage.point_rush_reward ?? {},
        point_rush_target_index: existingStage.point_rush_target_index,
        // ── Branching advancement rules carried back into the modal (feature #9). The form
        //    already holds them as indices, so pass straight through. ──
        advancement_rules: existingStage.advancement_rules ?? [],
        // ── Round-Robin config carried back (default if the stage had none). ──
        round_robin: existingStage.round_robin ?? DEFAULT_ROUND_ROBIN_CONFIG,
      });
      setTempGroups(
        existingStage.groups.map((g) => ({
          ...g,
          group_id: g.group_id,
          prizepool: g.prizepool || "",
          prizepool_cash_value: g.prizepool_cash_value || "",
          prize_distribution: g.prize_distribution || {},
          // Room name + password always start EMPTY in the editor (owner 2026-06-13):
          // per-session secrets, re-entered each time, never pre-shown.
          room_name: "",
          room_password: "",
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
        // ── Scoring-mode defaults for a brand-new stage. ──
        champion_point_enabled: false,
        champion_point_threshold: undefined,
        point_rush_enabled: false,
        point_rush_reward: {},
        point_rush_target_index: undefined,
        // ── Branching advancement default for a brand-new stage (feature #9). ──
        advancement_rules: [],
        // ── Round-Robin default for a brand-new stage. ──
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
      // ── Scoring-mode defaults for a brand-new stage. ──
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
  // Keep match_count in sync with match_maps.length on every map change.
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

  const handleSaveStageLogic = async () => {
    if (
      !stageModalData.stage_name ||
      !stageModalData.stage_format ||
      !stageModalData.start_date ||
      !stageModalData.end_date ||
      // Stage Discord Role ID is OPTIONAL (owner 2026-06-13): adding a Discord role to a
      // stage or group is never compulsory for admins or organizers. Left blank, the
      // stage just has no Discord automation wired.
      stageModalData.teams_qualifying_from_stage === undefined
    ) {
      toast.error(t("toast.stageFieldsRequired"));
      return;
    }

    // Round-robin stages validate their BASE GROUPS, not the classic per-group config
    // the backend ignores for this format (mirrors the create wizard; the modal no
    // longer shows Step 2 for round-robin).
    const isRoundRobinStage = stageModalData.stage_format === "br - round robin";
    // Clash Squad (cs - *) runs as a head-to-head BRACKET: it has no classic groups and no
    // base groups to validate (the bracket is seeded from the registered teams on the event
    // page). Like round-robin it sends groups: [] and the backend (P1#1 guard) skips group
    // materialisation for it. Without this branch CS fell into the BR `else` below and the
    // leftover default tempGroups failed "complete all group details" (P1#2, owner 2026-07-13).
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
      // group_discord_role_id is OPTIONAL (owner 2026-06-13): a per-group Discord role
      // is never compulsory. Everything else stays required.
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
      // Round-robin stages get their lobbies from the base groups (round_robin config), NOT the
      // classic per-group list; sending leftover tempGroups here makes the backend create a STRAY
      // extra group alongside the lobbies (same bug fixed in the create flow, 2026-06-29). Send [].
      // Clash Squad likewise has no groups (a bracket) - send [] so no phantom BR group is created.
      groups: isRoundRobinStage || isClashSquadStage
        ? []
        : tempGroups.map((tg, i) => ({
            ...tg,
            matches: (existingStage?.groups[i] as any)?.matches || [],
            // prize fields from tempGroups are already included via spread
          })),
      stage_discord_role_id: stageModalData.stage_discord_role_id,
      teams_qualifying_from_stage: stageModalData.teams_qualifying_from_stage,
      total_teams_in_stage: stageModalData.total_teams_in_stage,
      // ── stage-level prize fields ──
      prizepool: stageModalData.prizepool,
      prizepool_cash_value: stageModalData.prizepool_cash_value,
      prize_distribution: stageModalData.prize_distribution,
      // ── Scoring-mode config (sub-project A) - rides into the FormData stages array. ──
      champion_point_enabled: stageModalData.champion_point_enabled,
      champion_point_threshold: stageModalData.champion_point_threshold,
      point_rush_enabled: stageModalData.point_rush_enabled,
      point_rush_reward: stageModalData.point_rush_reward,
      point_rush_target_index: stageModalData.point_rush_target_index,
      // ── Branching advancement rules (feature #9) - rides into the FormData stages array;
      //    resolved to StageAdvancementRule rows in the backend edit second pass. ──
      advancement_rules: stageModalData.advancement_rules ?? [],
      // ── Round-Robin config (sub-project B) - sent only for the BR Round-Robin
      //    format so other bracket types don't carry a stray round_robin payload. ──
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

  // ── Sponsor save ───────────────────────────────────────────────────────────

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
      formData.append("event_description", data.event_description ?? "");
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
      formData.append("prize_currency", (data.prize_currency || "USD").toString());
      // Duplication-bug fix (owner 2026-06-15): was hardcoded "2", which wrongly reset the event's
      // stage count on every save. Use the actual number of stages the form holds.
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
      // Settings-only save (duplication-bug fix 2026-06-15): do NOT re-send `stages`. edit_event
      // treats a missing `stages` key as "no structure change", so the sponsor save cannot
      // duplicate stages/groups. Full structure is saved by the main Save Changes button.

      // Sponsor fields from sponsorForm (the ones being saved)
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

  // ── Waitlist save ──────────────────────────────────────────────────────────

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
      formData.append("event_description", data.event_description ?? "");
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
      formData.append("prize_currency", (data.prize_currency || "USD").toString());
      // Duplication-bug fix (owner 2026-06-15): was hardcoded "2", which wrongly reset the event's
      // stage count on every save. Use the actual number of stages the form holds.
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
      // Settings-only save (duplication-bug fix 2026-06-15): do NOT re-send `stages`. edit_event
      // treats a missing `stages` key as "no structure change", so the waitlist save cannot
      // duplicate stages/groups. Full structure is saved by the main Save Changes button.

      // Keep existing sponsor fields untouched
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

      // Waitlist fields
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

      // F3 registration requirements (owner 2026-06-19) - saved alongside the waitlist config.
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
      // multipart FormData can only carry strings. edit_event coerces it with _as_list and
      // validates every slug against the provider registry.
      formData.append(
        "required_connections",
        JSON.stringify(waitlistForm.required_connections ?? []),
      );
      // Teams filing their own map results (item 6). Read by edit_event, which flips
      // Event.allow_team_result_submissions; the submit endpoint refuses when it is off.
      formData.append(
        "allow_team_result_submissions",
        waitlistForm.allow_team_result_submissions ? "True" : "False",
      );
      // Letter-avatars gate (feature #7): a NUMBER (0-26), not a bool. edit_event re-parses + clamps
      // it (_parse_min_letter_avatars). Without this append, editing the count never reached the API.
      formData.append(
        "min_letter_avatars",
        String(Number(waitlistForm.min_letter_avatars ?? 0) || 0),
      );

      // fetch() only rejects on a NETWORK failure, not on HTTP 4xx/5xx - so check res.ok before
      // reporting success. Without this a 403/400/500 (e.g. not authorized to edit) still showed
      // "saved!" and optimistically flipped the toggles while the backend persisted nothing.
      // (Adversarial-review fix, owner 2026-06-19.)
      const res = await fetch(`${env.NEXT_PUBLIC_BACKEND_API_URL}/events/edit-event/`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || t("toast.waitlistSaveFailed"));
      }

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
              waitlist_mode: waitlistForm.waitlist_mode,
              require_team_logo: waitlistForm.require_team_logo,
              require_esport_images: waitlistForm.require_esport_images,
              require_player_uid: waitlistForm.require_player_uid,
              require_player_profile_image: waitlistForm.require_player_profile_image,
              require_whatsapp: waitlistForm.require_whatsapp,
              // Mirror the saved list so a reopened Basic Info reflects it without a refetch.
              required_connections: waitlistForm.required_connections,
              // Letter-avatars gate (feature #7): mirror the saved count into the cached event so the
              // RegisteredTeamsTab letter UI + a reopened Basic Info reflect it without a refetch.
              min_letter_avatars: waitlistForm.min_letter_avatars,
            }
          : prev,
      );
    } catch (error: any) {
      toast.error(
        error?.response?.data?.message || error?.message || t("toast.waitlistSaveFailed"),
      );
    } finally {
      setSavingWaitlist(false);
    }
  };

  // ── Prize distribution ─────────────────────────────────────────────────────
  // These delegate to the shared lib/eventFormats helpers (imported above) so the admin
  // create wizard, this admin edit tab, and the organizer edit page behave identically.
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

  // ── Save / submit ──────────────────────────────────────────────────────────

  // What the save-confirm dialog lists. The comparison itself lives in lib/eventChangeSummary.ts
  // and is shared with the organizer edit page, because the old hand-written list of fields drifted
  // from the form schema and told admins "No changes detected" while saving a real edit.
  const getChangedFields = (data: EventFormType): EventChangeRow[] =>
    buildEventChangeRows({
      baseline: editBaselineRef.current,
      current: data as unknown as Record<string, unknown>,
      t,
      bannerFileName: selectedFile?.name ?? null,
      rulesFileName: selectedRuleFile?.name ?? null,
      // The Basic Info requirement toggles + the waitlist block live here, not in the form, and
      // this save sends them. Without this pair the dialog denied a real change.
      extraBaseline: settingsBaselineRef.current,
      extraCurrent: waitlistForm as unknown as Record<string, unknown>,
    });

  // Round-robin schedule backfill (owner 2026-07-01) - mirrors the create flow. A round-robin stage
  // keeps its schedule on the game-day MEETINGS (round_robin.game_days), so its base groups A/B/C have
  // no playing_date/match_maps and would fail validateStageData ("Group N: Playing Date required").
  // The backend ignores group date/maps for a round-robin stage, so copy the meetings' date/time/maps
  // onto the base groups before validating + saving. Non-round-robin stages are untouched.
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
        setCurrentTab("structure");
        if (stageIndex !== undefined) openAddStageModalLogic(stageIndex);
      });
      return;
    }

    // Re-read so the backfilled group schedule is included in the saved payload.
    setPendingSaveData(form.getValues());
    setShowSaveConfirmModal(true);
  };

  // Distribution-vs-cash-value guard (owner 2026-07-02): the prize distribution MUST add up to
  // the cash value exactly - saves are blocked with a message saying how far off it is.
  const prizeDistributionMismatch = (data: EventFormType): string | null => {
    const cash = Number(data.prizepool_cash_value);
    if (!cash || Number.isNaN(cash)) return null; // no cash value set = nothing to check against
    const sum = Object.values(data.prize_distribution || {}).reduce(
      (acc, v) => acc + (Number(String(v).replace(/[^0-9.]/g, "")) || 0),
      0,
    );
    if (sum === cash) return null;
    const diff = Math.abs(cash - sum);
    const ccy = (data.prize_currency || "USD").toString();
    return sum > cash
      ? t("toast.prizeMismatchMore", { sum, ccy, diff, cash })
      : t("toast.prizeMismatchLess", { sum, ccy, diff, cash });
  };

  const onSubmit = async (data: EventFormType) => {
    {
      const mismatch = prizeDistributionMismatch(data);
      if (mismatch) {
        toast.error(mismatch);
        return;
      }
    }
    if (!eventDetails?.event_id) {
      toast.error(t("toast.eventIdMissing"));
      return;
    }

    const currentStages = form.getValues("stages");
    const stageValidation = validateStageData(currentStages);
    if (!stageValidation.isValid) {
      showValidationErrors(stageValidation.errors, (stageIndex) => {
        setCurrentTab("structure");
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
      setCurrentTab("setup");
      return;
    }
    if (regOpen > regClose) {
      toast.error(t("toast.regOpenAfterClose"));
      setCurrentTab("setup");
      return;
    }
    if (regClose > eventStart) {
      toast.error(t("toast.regCloseBeforeStart"));
      setCurrentTab("setup");
      return;
    }
    // Mirror the backend 400: require_discord=true demands a non-empty invite link.
    if (data.require_discord && !data.discord_invite_link?.trim()) {
      toast.error(t("toast.discordLinkRequired"));
      setCurrentTab("setup");
      return;
    }

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
      formData.append("event_description", data.event_description ?? "");
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
        // THE "disappearing cash value" bug (owner 2026-07-02): this main save path never sent
        // prizepool_cash_value (the two per-tab paths did), so the backend kept the old value and
        // the refetch re-seeded the field empty - typed input silently vanished on save.
        formData.append(
          "prizepool_cash_value",
          (data.prizepool_cash_value ?? "").toString(),
        );
        formData.append("prize_currency", (data.prize_currency || "USD").toString());
        // Duplication-bug fix (owner 2026-06-15): was hardcoded "2", which wrongly reset the event's
      // stage count on every save. Use the actual number of stages the form holds.
      formData.append("number_of_stages", String(data.stages?.length ?? 1));
        formData.append("start_date", data.start_date);
        formData.append("end_date", data.end_date);
        formData.append("registration_open_date", data.registration_open_date);
        formData.append("registration_end_date", data.registration_end_date);
        formData.append("registration_link", data.registration_link || "");
        // Registration-requirement toggles (owner 2026-07-04 bug fix): these live on the Basic Info
        // tab but in the separate waitlistForm state, and were ONLY sent by saveWaitlistSettings (the
        // Waitlist tab's button). So toggling a requirement on Basic Info + hitting THIS main Save did
        // not persist it - it reverted on refresh. Re-send them here too (edit_event reads them), so
        // whichever Save the operator clicks persists the requirements.
        formData.append("require_team_logo", waitlistForm.require_team_logo ? "True" : "False");
        formData.append("require_esport_images", waitlistForm.require_esport_images ? "True" : "False");
        formData.append("require_player_uid", waitlistForm.require_player_uid ? "True" : "False");
        formData.append("require_player_profile_image", waitlistForm.require_player_profile_image ? "True" : "False");
        formData.append("require_whatsapp", waitlistForm.require_whatsapp ? "True" : "False");
        // Required connected accounts (owner 2026-08-26): a LIST, so it travels as JSON because
        // multipart FormData can only carry strings. edit_event coerces it with _as_list and
        // validates every slug against the provider registry.
        formData.append(
          "required_connections",
          JSON.stringify(waitlistForm.required_connections ?? []),
        );
        formData.append(
          "allow_team_result_submissions",
          waitlistForm.allow_team_result_submissions ? "True" : "False",
        );
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
        // Stages now carry prize fields through naturally via JSON.stringify
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
          // Live-update (owner 2026-06-20): re-pull the saved event so the form +
          // displays reflect the changes immediately, without a manual page reload.
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

      <PageHeader
        back
        // Wrap the title so the page-level ⓘ sits right after it (PageHeader takes a ReactNode).
        // data-tour anchor (event-edit-title): admin tour "Edit event" step (events-lb area).
        title={
          <span data-tour="event-edit-title" className="inline-flex flex-wrap items-center">
            {eventTitle}
            <InfoTip id="events.edit._page" className="ml-1.5" />
          </span>
        }
      />

      <Form {...form}>
        <form className="space-y-6">
          <Tabs value={currentTab} onValueChange={selectTab}>
            {/* Section navigator: a dropdown on phones (so an organizer/admin editing on mobile
                can't miss a section), a scrollable tab strip on desktop. The per-tab InfoTip ⓘ ids +
                guided-tour anchors + error/enabled dots that used to be inline are passed as data so
                this page and the organizer edit page share ONE nav (see EventEditSectionNav). */}
            <EventEditSectionNav
              value={currentTab}
              onValueChange={selectTab}
              sections={[
                // SIX SECTIONS (owner 2026-08-22, Option A). Nine tabs became six by putting
                // things that are one job back together: Linked Events and Sponsor were separate
                // tabs describing the same event, and Waitlist was a separate tab describing the
                // same competitors as Registered Teams. Each merged tab STACKS the existing
                // components under headings rather than rewriting them, so every save button keeps
                // its own form and its own state. Old ?tab= values still resolve, via TAB_ALIASES.
                {
                  value: "setup",
                  label: t("tabs.setup"),
                  infoTipId: "events.edit.basic_info._section",
                  triggerTourAttr: "event-edit-basic",
                  dot: tabErrors.basic_info ? "error" : null,
                },
                {
                  value: "teams",
                  label: t("tabs.teams"),
                  infoTipId: "events.edit.registered_teams._section",
                  dot: tabErrors.registered_teams
                    ? "error"
                    : waitlistForm.is_waitlist_enabled
                      ? "active"
                      : null,
                },
                {
                  value: "structure",
                  label: t("tabs.structure"),
                  infoTipId: "events.edit.stages_groups._section",
                  triggerTourAttr: "event-edit-stages",
                  dot: tabErrors.stages_groups ? "error" : null,
                },
                // RESULTS (owner 2026-08-22). Was "Import results", one of the FOUR ways results
                // reach an event; the other three lived on separate pages and one was linked from
                // nowhere at all. Now every route, labelled by how the numbers arrived. The dot
                // still marks results that came from an import, because those did not happen here.
                {
                  value: "results",
                  label: t("tabs.results"),
                  dot: eventDetails?.results_imported ? "active" : null,
                },
                {
                  value: "prizes",
                  label: t("tabs.prizes"),
                  infoTipId: "events.edit.prize_rules._section",
                  triggerTourAttr: "event-edit-prizes",
                  dot: tabErrors.prize_rules ? "error" : null,
                },
                {
                  value: "comms",
                  label: t("tabs.comms"),
                  infoTipId: "events.edit.actions._section",
                  triggerTourAttr: "event-edit-actions",
                },
              ]}
            />
            <TabsContent value="setup" className="space-y-6">
              <section className="space-y-2">
                <h3 className="text-sm font-semibold">{t("sections.basicInfo")}</h3>
              <BasicInfoTab
                eventDetails={eventDetails}
                // Registration-requirement toggles moved to Basic Info (owner 2026-06-22)
                // but still backed by the same waitlistForm state the page saves via
                // saveWaitlistSettings - so the field bindings + save are unchanged.
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
              />
                          </section>
              <section className="space-y-2">
                <h3 className="text-sm font-semibold">{t("sections.linkedEvents")}</h3>
              <LinkedEventsCard
                eventId={eventDetails.event_id}
                stages={(eventDetails.stages ?? []).map((s: any) => ({
                  id: s.stage_id ?? s.id,
                  stage_name: s.stage_name,
                }))}
              />
                          </section>
              <section className="space-y-2">
                <h3 className="text-sm font-semibold">{t("sections.sponsor")}</h3>
              {/* eventId powers the new sponsorship builder (P2): SponsorTab loads
                  sponsorsApi.forEvent(eventId) and diff-saves attach/detach/configure.
                  The legacy free-text fields still save through saveSponsorRequirement. */}
              <SponsorTab
                slug={slug}
                // Display-only sponsor logos (owner 2026-08-05, item 26). Both public detail
                // builders return them on the event payload, so there is nothing to fetch.
                publicSponsors={(eventDetails as any)?.public_sponsors ?? []}
                sponsorForm={sponsorForm}
                setSponsorForm={setSponsorForm}
                onSave={saveSponsorRequirement}
                saving={savingSponsor}
                eventId={eventDetails.event_id}
              />
                          </section>
            </TabsContent>
            <TabsContent value="teams" className="space-y-6">
              <section className="space-y-2">
                <h3 className="text-sm font-semibold">{t("sections.registered")}</h3>
              <RegisteredTeamsTab
                eventDetails={eventDetails}
                updateCompetitorStatus={updateCompetitorStatus}
                // In-place refresh (no manual reload): the tab's Add-Teams / Edit-Roster
                // modals call this onSuccess to re-pull the event and re-render the roster.
                onRefresh={fetchEventDetails}
              />
              {/* Broadcast media hygiene (owner 2026-07-02): also on the EDIT page - missing team
                  logos / player esport images, flag bad art, per-event hide/show. Same card the
                  overlay studio + event view mount. */}
              {eventDetails?.event_id ? (
                <div className="mt-4">
                  <MediaAuditCard eventId={eventDetails.event_id} />
                </div>
              ) : null}
                          </section>
              {/* Invites decide WHO CAN REGISTER, so they belong with the teams rather than on a
                  read-only page. Renders nothing for a public event. */}
              <PrivateEventInvitesCard
                eventId={eventDetails.event_id}
                token={token || ""}
                isPublic={Boolean(eventDetails.is_public)}
              />

              <section className="space-y-2">
                <h3 className="text-sm font-semibold">{t("sections.waitlist")}</h3>
              <WaitlistTab
                waitlistForm={waitlistForm}
                setWaitlistForm={setWaitlistForm}
                onSave={saveWaitlistSettings}
                saving={savingWaitlist}
                eventDetails={eventDetails}
                eventId={eventDetails.event_id}
                onRefresh={fetchEventDetails}
              />
                          </section>
            </TabsContent>


            <TabsContent value="structure">
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
                // In-place refresh (no manual reload): the stage/group Add-Teams modals
                // call this onSuccess to re-pull the event and re-render the new rosters.
                onRefresh={fetchEventDetails}
              />
            </TabsContent>

            <TabsContent value="prizes">
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

            {/* Linked Events (owner 2026-06-29): the qualification-links editor, reused verbatim
                from the event DETAIL page. eventId + stages drive its create dialog; everything else
                (load + create/fire/cancel/decide + refresh) is self-contained in the card. Stages map
                to { id, stage_name } using the server stage_id (mirrors the detail-page mount). */}

            <TabsContent value="comms" className="space-y-4">
              <ActionsTab
                eventDetails={eventDetails}
                onStartTournament={() =>
                  setOpenConfirmStartTournamentModal(true)
                }
                onRefresh={fetchEventDetails}
              />
              {/* F6: manage co-organizing organizations for this event. Pass the primary org slug so
                  it's excluded from the invite picker (it already owns the event). */}
              <CoOrganizersPanel
                eventId={eventDetails.event_id}
                primaryOrgSlug={(eventDetails as any).organization_slug}
              />
            </TabsContent>

            <TabsContent value="results">
              <ResultsTab
                slug={slug}
                token={token || ""}
                apiBase={env.NEXT_PUBLIC_BACKEND_API_URL}
                eventDetails={eventDetails}
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
          // Registered teams → round-robin base-group team picker (TEAM PK + name).
          availableTeams={(eventDetails?.tournament_teams ?? [])
            .filter((t: any) => t?.team_id != null && t?.team_name)
            .map((t: any) => ({ team_id: t.team_id, team_name: t.team_name }))}
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
            // Refetch after starting (owner 2026-07-04): the modal seeds the stage but nothing
            // re-pulled, so the stage looked empty until a manual reload.
            onSuccess={fetchEventDetails}
          />
        )}
      </Form>
    </div>
  );
}
