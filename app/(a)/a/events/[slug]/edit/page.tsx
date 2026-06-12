"use client";

import { useState, useTransition, useRef, useEffect, use } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Form } from "@/components/ui/form";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { InfoTip } from "@/components/ui/info-tip";
import { useAuth } from "@/contexts/AuthContext";
import { env } from "@/lib/env";
import axios from "axios";
import { FullLoader } from "@/components/Loader";
import { SeedStageModal } from "../../_components/SeedStageModal";
import { ConfirmStartTournamentModal } from "../../_components/ConfirmStartTournamentModal";

import {
  EventFormSchema,
  validateStageData,
  showValidationErrors,
  type EventFormType,
  type EventDetails,
  type StageType,
  type Params,
} from "./types";

import BasicInfoTab from "./_components/BasicInfoTab";
import RegisteredTeamsTab from "./_components/RegisteredTeamsTab";
import PrizeRulesTab from "./_components/PrizeRulesTab";
import ActionsTab from "./_components/ActionsTab";
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

// ── Paid-vs-free registration payload helper (non-payment phase) ─────────────────
// Appends registration_type (+ fee/currency when paid) onto the edit-event FormData.
// Shared by all three FormData builders on this page (the main Save, the Sponsor save,
// and the Waitlist save) so they can't drift. AFC-admin events never need the paid
// terms gate (organizer only), so this just sends the values. FREE sends no fee.
function appendRegistrationFeeFields(
  formData: FormData,
  data: Pick<
    EventFormType,
    "registration_type" | "registration_fee" | "registration_fee_currency"
  >,
) {
  formData.append("registration_type", data.registration_type || "free");
  if (data.registration_type === "paid" && data.registration_fee != null) {
    formData.append("registration_fee", data.registration_fee.toString());
    formData.append(
      "registration_fee_currency",
      data.registration_fee_currency || "USD",
    );
  }
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
    })),
  );

  return {
    round_robin_groups: orderedGroups.map((g) => ({
      label: g.label,
      order: g.order,
      team_ids: g.team_ids || [],
    })),
    // If the backend already materialised game days, default the toggle to MANUAL so
    // the admin sees the real schedule; otherwise leave auto-generate on.
    generate_schedule: gameDays.length === 0,
    games_per_day: gameDays[0]?.match_count ?? 1,
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

  // ── Core loading/UI state ──────────────────────────────────────────────────
  const [currentTab, setCurrentTab] = useState("basic_info");
  const [loadingEvent, setLoadingEvent] = useState(true);
  const [initialLoading, setInitialLoading] = useState(true);
  const [eventTitle, setEventTitle] = useState("Loading Event...");
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
    // ── Round-Robin config (sub-project B) - only for "br - round robin" stages. ──
    round_robin: RoundRobinConfig;
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

  // ── Form setup ─────────────────────────────────────────────────────────────
  const form = useForm<EventFormType>({
    resolver: zodResolver(EventFormSchema),
    defaultValues: {
      event_name: "",
      competition_type: "",
      participant_type: "",
      event_type: "",
      is_public: "True",
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
          max_teams_or_players: eventDetails.max_teams_or_players,
          stream_channels: eventDetails.stream_channels || [],
          event_mode: eventDetails.event_mode,
          number_of_stages: eventDetails.number_of_stages,
          stages: mappedStages,
          prizepool: eventDetails.prizepool,
          prizepool_cash_value: eventDetails.prizepool_cash_value ?? undefined,
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

        setPreviewUrl(eventDetails.event_banner_url || "");
        setPreviewRuleUrl(eventDetails.uploaded_rules_url || "");
        setRulesInputMethod(eventDetails.event_rules ? "type" : "upload");
        setEventTitle(`Edit Event: ${eventDetails.event_name}`);
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
        setWaitlistForm({
          is_waitlist_enabled: ed.is_waitlist_enabled ?? false,
          waitlist_capacity:
            ed.waitlist_capacity != null ? Number(ed.waitlist_capacity) : "",
          waitlist_discord_role_id: ed.waitlist_discord_role_id ?? "",
        });
      }

      setLoadingEvent(false);
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.message ||
        error.response?.data?.detail ||
        "Failed to fetch event details.";
      toast.error(errorMessage);
      router.push("/login");
    } finally {
      setLoadingEvent(false);
      setInitialLoading(false);
    }
  };

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
      toast.success("Leaderboard updated");
      return response.data;
    } catch (error: any) {
      toast.error(
        error.response?.data?.message || "Failed to fetch leaderboard",
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
        toast.success(res.data.message || "Seeding successful");
        setIsSeedModalOpen(false);
      } catch (error: any) {
        toast.error(
          error.response?.data?.message || "Oops! An error occurred.",
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
        // ── Scoring-mode config carried back into the modal for re-editing. ──
        champion_point_enabled: existingStage.champion_point_enabled ?? false,
        champion_point_threshold: existingStage.champion_point_threshold,
        point_rush_enabled: existingStage.point_rush_enabled ?? false,
        point_rush_reward: existingStage.point_rush_reward ?? {},
        point_rush_target_index: existingStage.point_rush_target_index,
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
      toast.error("An event must have at least one stage.");
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
        toast.error("Failed to delete stage from server");
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
      `Stage "${currentStages[stageToRemove]?.stage_name || `Stage ${stageToRemove + 1}`}" removed successfully`,
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

  const addMapToGroup = (groupIndex: number, map: string) => {
    const newGroups = [...tempGroups];
    newGroups[groupIndex].match_maps = [
      ...(newGroups[groupIndex].match_maps || []),
      map,
    ];
    setTempGroups(newGroups);
  };

  const removeOneMapFromGroup = (groupIndex: number, map: string) => {
    const newGroups = [...tempGroups];
    const current: string[] = newGroups[groupIndex].match_maps || [];
    const idx = current.lastIndexOf(map);
    if (idx !== -1) {
      newGroups[groupIndex].match_maps = current.filter((_, i) => i !== idx);
    }
    setTempGroups(newGroups);
  };

  const handleSaveStageLogic = async () => {
    if (
      !stageModalData.stage_name ||
      !stageModalData.stage_format ||
      !stageModalData.start_date ||
      !stageModalData.end_date ||
      !stageModalData.stage_discord_role_id ||
      stageModalData.teams_qualifying_from_stage === undefined
    ) {
      toast.error("Please fill all required stage fields (Step 1)");
      return;
    }

    const invalidGroup = tempGroups.find(
      (g) =>
        !g.playing_date ||
        !g.playing_time ||
        !g.group_discord_role_id ||
        !g.group_name.trim() ||
        g.teams_qualifying < 1 ||
        g.match_count < 1 ||
        !g.match_maps ||
        g.match_maps.length === 0,
    );

    if (invalidGroup) {
      toast.error(
        "Please complete all group details correctly, including selecting at least one map per group (Step 2)",
      );
      return;
    }

    if (stageModalData.number_of_groups < 1) {
      toast.error("A stage must have at least one group.");
      return;
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
      groups: tempGroups.map((tg, i) => ({
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
      // ── Round-Robin config (sub-project B) - sent only for the BR Round-Robin
      //    format so other bracket types don't carry a stray round_robin payload. ──
      ...(stageModalData.stage_format === "br - round robin"
        ? { round_robin: stageModalData.round_robin }
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
    toast.success(
      "Stage configuration updated. Click 'Save Changes' to finalize.",
    );
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
      formData.append("competition_type", data.competition_type);
      formData.append("participant_type", data.participant_type);
      formData.append("event_type", data.event_type);
      formData.append("is_public", data.is_public);
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
      formData.append("number_of_stages", "2");
      formData.append("start_date", data.start_date);
      formData.append("end_date", data.end_date);
      formData.append("registration_open_date", data.registration_open_date);
      formData.append("registration_end_date", data.registration_end_date);
      formData.append("registration_link", data.registration_link || "");
      // Paid-vs-free registration (re-sent on every full-event save so it isn't lost).
      appendRegistrationFeeFields(formData, data);
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

      toast.success("Sponsor settings saved!");
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
        error?.response?.data?.message || "Failed to save sponsor settings",
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
      formData.append("competition_type", data.competition_type);
      formData.append("participant_type", data.participant_type);
      formData.append("event_type", data.event_type);
      formData.append("is_public", data.is_public);
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
      formData.append("number_of_stages", "2");
      formData.append("start_date", data.start_date);
      formData.append("end_date", data.end_date);
      formData.append("registration_open_date", data.registration_open_date);
      formData.append("registration_end_date", data.registration_end_date);
      formData.append("registration_link", data.registration_link || "");
      // Paid-vs-free registration (re-sent on every full-event save so it isn't lost).
      appendRegistrationFeeFields(formData, data);
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

      await fetch(`${env.NEXT_PUBLIC_BACKEND_API_URL}/events/edit-event/`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      toast.success("Waitlist settings saved!");
      setEventDetails((prev) =>
        prev
          ? {
              ...prev,
              is_waitlist_enabled: waitlistForm.is_waitlist_enabled,
              waitlist_capacity: waitlistForm.waitlist_capacity
                ? Number(waitlistForm.waitlist_capacity)
                : null,
              waitlist_discord_role_id: waitlistForm.waitlist_discord_role_id,
            }
          : prev,
      );
    } catch (error: any) {
      toast.error(
        error?.response?.data?.message || "Failed to save waitlist settings",
      );
    } finally {
      setSavingWaitlist(false);
    }
  };

  // ── Prize distribution ─────────────────────────────────────────────────────

  const addPrizePosition = () => {
    const current = { ...form.watch("prize_distribution") };
    const numericKeys = Object.keys(current)
      .map((key) => parseInt(key.replace(/[^0-9]/g, "")))
      .filter((n) => !isNaN(n));
    const nextPos = (numericKeys.length > 0 ? Math.max(...numericKeys) : 0) + 1;
    form.setValue("prize_distribution", { ...current, [`${nextPos}`]: "" });
  };

  const removePrizePosition = (key: string) => {
    const current = { ...form.watch("prize_distribution") };
    if (Object.keys(current).length <= 1) return;
    delete current[key];
    form.setValue("prize_distribution", current);
  };

  const formatPrizeKey = (key: string) => {
    if (key.endsWith("Place")) key = key.split(" ")[0];
    const numericPart = parseInt(key.replace(/[^0-9]/g, ""));
    if (isNaN(numericPart)) return key;
    const suffix =
      numericPart === 1
        ? "st"
        : numericPart === 2
          ? "nd"
          : numericPart === 3
            ? "rd"
            : "th";
    return `${numericPart}${suffix}`;
  };

  // ── Save / submit ──────────────────────────────────────────────────────────

  const getChangedFields = (
    data: EventFormType,
  ): { label: string; from: string; to: string }[] => {
    if (!eventDetails) return [];
    const changes: { label: string; from: string; to: string }[] = [];

    const check = (
      label: string,
      original: string | number | boolean | null | undefined,
      updated: string | number | boolean | null | undefined,
    ) => {
      const orig = String(original ?? "").trim();
      const upd = String(updated ?? "").trim();
      if (orig !== upd) changes.push({ label, from: orig, to: upd });
    };

    check("Event Name", eventDetails.event_name, data.event_name);
    check(
      "Competition Type",
      eventDetails.competition_type,
      data.competition_type,
    );
    check(
      "Participant Type",
      eventDetails.participant_type,
      data.participant_type,
    );
    check("Event Type", eventDetails.event_type, data.event_type);
    check(
      "Event Privacy",
      eventDetails.is_public ? "Public" : "Private",
      data.is_public === "True" ? "Public" : "Private",
    );
    check(
      "Max Participants",
      eventDetails.max_teams_or_players,
      data.max_teams_or_players,
    );
    check("Event Mode", eventDetails.event_mode, data.event_mode);
    check("Start Date", eventDetails.start_date, data.start_date);
    check("End Date", eventDetails.end_date, data.end_date);
    check(
      "Registration Open",
      eventDetails.registration_open_date,
      data.registration_open_date,
    );
    check(
      "Registration Close",
      eventDetails.registration_end_date,
      data.registration_end_date,
    );
    check(
      "Registration Link",
      eventDetails.registration_link ?? "",
      data.registration_link ?? "",
    );
    check("Prize Pool", eventDetails.prizepool, data.prizepool);
    check("Event Status", eventDetails.event_status, data.event_status);

    if (selectedFile)
      changes.push({
        label: "Event Banner",
        from: "Previous banner",
        to: `New file: ${selectedFile.name}`,
      });
    if (selectedRuleFile)
      changes.push({
        label: "Rules Document",
        from: "Previous document",
        to: `New file: ${selectedRuleFile.name}`,
      });

    return changes;
  };

  const handleSaveChangesClick = (data: EventFormType) => {
    const currentStages = form.getValues("stages");
    const validation = validateStageData(currentStages);

    if (!validation.isValid) {
      showValidationErrors(validation.errors, (stageIndex) => {
        setCurrentTab("stages_groups");
        if (stageIndex !== undefined) openAddStageModalLogic(stageIndex);
      });
      return;
    }

    setPendingSaveData(data);
    setShowSaveConfirmModal(true);
  };

  const onSubmit = async (data: EventFormType) => {
    if (!eventDetails?.event_id) {
      toast.error("Event ID is missing");
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
      toast.error("Event start date cannot be after event end date");
      setCurrentTab("basic_info");
      return;
    }
    if (regOpen > regClose) {
      toast.error(
        "Registration open date cannot be after registration close date",
      );
      setCurrentTab("basic_info");
      return;
    }
    if (regClose > eventStart) {
      toast.error("Registration must close before the event starts");
      setCurrentTab("basic_info");
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
        formData.append("competition_type", data.competition_type);
        formData.append("participant_type", data.participant_type);
        formData.append("event_type", data.event_type);
        formData.append("is_public", data.is_public);
        formData.append(
          "max_teams_or_players",
          data.max_teams_or_players.toString(),
        );
        formData.append("event_mode", data.event_mode);
        formData.append("prizepool", data.prizepool);
        formData.append("number_of_stages", "2");
        formData.append("start_date", data.start_date);
        formData.append("end_date", data.end_date);
        formData.append("registration_open_date", data.registration_open_date);
        formData.append("registration_end_date", data.registration_end_date);
        formData.append("registration_link", data.registration_link || "");
        // Paid-vs-free registration (re-sent on save so the values persist).
        appendRegistrationFeeFields(formData, data);
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
          toast.error("Server error: Unexpected response format.", {
            duration: 5000,
          });
          return;
        }

        const res = await response.json();

        if (response.ok) {
          toast.success(
            `Event "${data.event_name}" saved as ${data.save_to_drafts ? "Draft" : "Published"} successfully!`,
            { duration: 4000 },
          );
        } else {
          const errorMessage = res.message || res.detail || res.error;
          if (response.status === 400) {
            toast.error(
              <div className="space-y-1">
                <p className="font-semibold">Validation Error</p>
                <p className="text-sm">{errorMessage}</p>
              </div>,
              { duration: 5000 },
            );
          } else if (response.status === 401) {
            toast.error("Your session has expired. Please log in again.");
            router.push("/login");
          } else if (response.status === 403) {
            toast.error("You don't have permission to edit this event.");
          } else if (response.status === 404) {
            toast.error("Event not found. It may have been deleted.");
          } else if (response.status >= 500) {
            toast.error("Server error occurred. Please try again later.");
          } else {
            toast.error(errorMessage || "Failed to update event.");
          }
        }
      } catch (error: any) {
        if (
          error.message === "Failed to fetch" ||
          error.message?.includes("NetworkError")
        ) {
          toast.error("Network error: Please check your internet connection.");
        } else {
          toast.error("An unexpected error occurred. Please try again.");
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
          <span data-tour="event-edit-title" className="inline-flex items-center">
            {eventTitle}
            <InfoTip id="events.edit._page" className="ml-1.5" />
          </span>
        }
      />

      <Form {...form}>
        <form className="space-y-6">
          <Tabs value={currentTab} onValueChange={setCurrentTab}>
            <TabsList className="w-full justify-start overflow-x-auto mb-2">
              {/*
                Each tab carries a section-level ⓘ explaining what that area does.
                The ⓘ (a real <button>) is rendered as a SIBLING of the
                TabsTrigger - NOT inside it - because a <button> nested in a
                <button> is invalid HTML (validateDOMNesting / hydration error).
                Each trigger+ⓘ pair lives in a `relative inline-flex flex-1`
                wrapper: the wrapper owns the flex sizing + the error-dot anchor,
                while the trigger keeps `w-full` so it still fills the cell.
              */}
              <span className="relative inline-flex flex-1 items-center justify-center">
                {/* data-tour anchor (event-edit-basic): admin tour "Basic info tab" step. */}
                <TabsTrigger
                  value="basic_info"
                  className="px-6 w-full"
                  data-tour="event-edit-basic"
                >
                  Basic Info
                </TabsTrigger>
                <InfoTip id="events.edit.basic_info._section" className="ml-1" />
                {tabErrors.basic_info && (
                  <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-destructive" />
                )}
              </span>
              <span className="relative inline-flex flex-1 items-center justify-center">
                <TabsTrigger value="registered_teams" className="px-6 w-full">
                  Registered Teams
                </TabsTrigger>
                <InfoTip
                  id="events.edit.registered_teams._section"
                  className="ml-1"
                />
                {tabErrors.registered_teams && (
                  <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-destructive" />
                )}
              </span>
              <span className="relative inline-flex flex-1 items-center justify-center">
                {/* data-tour anchor (event-edit-stages): admin tour "Stages and groups tab" step. */}
                <TabsTrigger
                  value="stages_groups"
                  className="px-6 w-full"
                  data-tour="event-edit-stages"
                >
                  Stages & Groups
                </TabsTrigger>
                <InfoTip
                  id="events.edit.stages_groups._section"
                  className="ml-1"
                />
                {tabErrors.stages_groups && (
                  <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-destructive" />
                )}
              </span>
              <span className="relative inline-flex flex-1 items-center justify-center">
                {/* data-tour anchor (event-edit-prizes): admin tour "Prize and rules tab" step. */}
                <TabsTrigger
                  value="prize_rules"
                  className="px-6 w-full"
                  data-tour="event-edit-prizes"
                >
                  Prize & Rules
                </TabsTrigger>
                <InfoTip id="events.edit.prize_rules._section" className="ml-1" />
                {tabErrors.prize_rules && (
                  <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-destructive" />
                )}
              </span>
              <span className="relative inline-flex flex-1 items-center justify-center">
                {/* data-tour anchor (event-edit-actions): admin tour "Actions tab" step. */}
                <TabsTrigger
                  value="actions"
                  className="px-6 w-full"
                  data-tour="event-edit-actions"
                >
                  Event Actions
                </TabsTrigger>
                <InfoTip id="events.edit.actions._section" className="ml-1" />
              </span>
              <span className="relative inline-flex flex-1 items-center justify-center">
                <TabsTrigger value="sponsor" className="px-6 w-full">
                  Sponsor
                </TabsTrigger>
                <InfoTip id="events.edit.sponsor._section" className="ml-1" />
                {sponsorForm.is_sponsored && (
                  <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-primary" />
                )}
              </span>
              <span className="relative inline-flex flex-1 items-center justify-center">
                <TabsTrigger value="waitlist" className="px-6 w-full">
                  Waitlist
                </TabsTrigger>
                <InfoTip id="events.edit.waitlist._section" className="ml-1" />
                {waitlistForm.is_waitlist_enabled && (
                  <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-primary" />
                )}
              </span>
            </TabsList>

            <TabsContent value="basic_info">
              <BasicInfoTab
                eventDetails={eventDetails}
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
            </TabsContent>

            <TabsContent value="registered_teams">
              <RegisteredTeamsTab
                eventDetails={eventDetails}
                updateCompetitorStatus={updateCompetitorStatus}
              />
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

            <TabsContent value="actions">
              <ActionsTab
                eventDetails={eventDetails}
                onStartTournament={() =>
                  setOpenConfirmStartTournamentModal(true)
                }
                onRefresh={fetchEventDetails}
              />
            </TabsContent>

            <TabsContent value="sponsor">
              {/* eventId powers the new sponsorship builder (P2): SponsorTab loads
                  sponsorsApi.forEvent(eventId) and diff-saves attach/detach/configure.
                  The legacy free-text fields still save through saveSponsorRequirement. */}
              <SponsorTab
                slug={slug}
                sponsorForm={sponsorForm}
                setSponsorForm={setSponsorForm}
                onSave={saveSponsorRequirement}
                saving={savingSponsor}
                eventId={eventDetails.event_id}
              />
            </TabsContent>

            <TabsContent value="waitlist">
              <WaitlistTab
                waitlistForm={waitlistForm}
                setWaitlistForm={setWaitlistForm}
                onSave={saveWaitlistSettings}
                saving={savingWaitlist}
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
            eventDetails.participant_type === "squad" ? "teams" : "players"
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
          />
        )}
      </Form>
    </div>
  );
}
