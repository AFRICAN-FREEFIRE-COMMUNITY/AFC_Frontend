"use client";

import { useState, useTransition, useRef, useEffect, use } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Form } from "@/components/ui/form";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
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
import StagesGroupsTab from "./_components/StagesGroupsTab";
import PrizeRulesTab from "./_components/PrizeRulesTab";
import ActionsTab from "./_components/ActionsTab";
import { StageConfigModal } from "./_components/StageConfigModal";
import { RemoveStageModal } from "./_components/RemoveStageModal";
import { ParticipantTypeWarningModal } from "./_components/ParticipantTypeWarningModal";
import { SaveConfirmModal } from "./_components/SaveConfirmModal";

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
  const [rulesInputMethod, setRulesInputMethod] = useState<"type" | "upload">("type");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const rulesFileInputRef = useRef<HTMLInputElement>(null);

  // ── Stage / group modal state ──────────────────────────────────────────────
  const [stageNames, setStageNames] = useState<string[]>(["Stage 1"]);
  const [isStageModalOpen, setIsStageModalOpen] = useState(false);
  const [stageModalStep, setStageModalStep] = useState(1);
  const [editingStageIndex, setEditingStageIndex] = useState<number | null>(null);
  const [tempGroups, setTempGroups] = useState<any[]>([]);
  const [passwordVisibility, setPasswordVisibility] = useState<Record<number, boolean>>({});
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
  }>({
    stage_name: "",
    start_date: "",
    end_date: "",
    stage_format: "",
    number_of_groups: 2,
    teams_qualifying_from_stage: 0,
    stage_discord_role_id: "",
    total_teams_in_stage: 0,
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
  const [openConfirmStartTournamentModal, setOpenConfirmStartTournamentModal] = useState(false);

  // ── Participant type change warning ────────────────────────────────────────
  const [pendingParticipantType, setPendingParticipantType] = useState<string | null>(null);
  const [showParticipantTypeWarning, setShowParticipantTypeWarning] = useState(false);

  // ── Save confirmation modal ────────────────────────────────────────────────
  const [showSaveConfirmModal, setShowSaveConfirmModal] = useState(false);
  const [pendingSaveData, setPendingSaveData] = useState<EventFormType | null>(null);

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
            },
          ],
          teams_qualifying_from_stage: 0,
          total_teams_in_stage: 0,
        },
      ],
      prizepool: "",
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
      const mappedStages = eventDetails.stages.map((stage) => ({
        ...stage,
        stage_id: stage.stage_id || stage.id,
        groups: stage.groups.map((group) => ({
          ...group,
          group_id: group.group_id,
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
          prize_distribution: eventDetails.prize_distribution,
          event_rules: eventDetails.event_rules,
          rules_document: eventDetails.uploaded_rules_url || "",
          start_date: eventDetails.start_date,
          end_date: eventDetails.end_date,
          registration_open_date: eventDetails.registration_open_date,
          registration_end_date: eventDetails.registration_end_date,
          registration_link: eventDetails.registration_link || "",
          event_status: eventDetails.event_status,
          publish_to_tournaments: eventDetails.tournament_tier !== "",
          publish_to_news: false,
          save_to_drafts: false,
          registration_restriction: eventDetails.registration_restriction || "none",
          restriction_mode: eventDetails.restriction_mode || "allow_only",
          selected_locations: eventDetails.restricted_countries || [],
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
      stages_groups: !stageValidation.isValid || !!errors.stages || !!errors.number_of_stages,
      prize_rules: !!(errors.prizepool || errors.prize_distribution || errors.event_rules || errors.rules_document),
    });
  }, [form.formState.errors, form.watch("stages")]);

  // Draft / publish mutual exclusivity
  const saveToDraftsWatch = form.watch("save_to_drafts");
  const publishToTournamentsWatch = form.watch("publish_to_tournaments");
  const publishToNewsWatch = form.watch("publish_to_news");

  useEffect(() => {
    if (saveToDraftsWatch && (publishToTournamentsWatch || publishToNewsWatch)) {
      if (publishToTournamentsWatch) form.setValue("publish_to_tournaments", false, { shouldDirty: false });
      if (publishToNewsWatch) form.setValue("publish_to_news", false, { shouldDirty: false });
    } else if ((publishToTournamentsWatch || publishToNewsWatch) && saveToDraftsWatch) {
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
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      };

      const [res, resAdmin] = await Promise.all([
        axios.post(`${env.NEXT_PUBLIC_BACKEND_API_URL}/events/get-event-details/`, { slug }, commonConfig),
        axios.post(`${env.NEXT_PUBLIC_BACKEND_API_URL}/events/get-event-details-for-admin/`, { slug }, commonConfig),
      ]);

      const adminStages = resAdmin.data.event_details?.stages || resAdmin.data.stages || [];
      const mergedDetails: EventDetails = { ...res.data.event_details, stages: adminStages };

      if (adminStages.length > 0) setStageNames(adminStages.map((s: any) => s.stage_name));

      setEventDetails(mergedDetails);
      setLoadingEvent(false);
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.message || error.response?.data?.detail || "Failed to fetch event details.";
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
      toast.error(error.response?.data?.message || "Failed to fetch leaderboard");
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
        toast.error(error.response?.data?.message || "Oops! An error occurred.");
      }
    });
  };

  const toggleVisibility = (groupIndex: number) => {
    setPasswordVisibility((prev) => ({ ...prev, [groupIndex]: !prev[groupIndex] }));
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
        teams_qualifying_from_stage: existingStage.teams_qualifying_from_stage || 0,
        total_teams_in_stage: existingStage.total_teams_in_stage || 0,
      });
      setTempGroups(existingStage.groups.map((g) => ({ ...g, group_id: g.group_id })));
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
      })),
      teams_qualifying_from_stage: 0,
      total_teams_in_stage: 0,
    };

    form.setValue("stages", [...currentStages, newStage], { shouldValidate: false });
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
        const response = await fetch(`${env.NEXT_PUBLIC_BACKEND_API_URL}/events/delete-stage/`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ stage_id: stageToDelete.stage_id }),
        });
        if (!response.ok) throw new Error("Failed to delete stage");
      } catch {
        toast.error("Failed to delete stage from server");
        return;
      } finally {
        setLoadingRemove(false);
      }
    }

    const currentCount = form.getValues("number_of_stages") || 0;
    const updatedStages = currentStages.filter((_, idx) => idx !== stageToRemove);
    const updatedNames = stageNames.filter((_, idx) => idx !== stageToRemove);

    form.setValue("stages", updatedStages, { shouldDirty: true, shouldValidate: true });
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
    const newTempGroups = Array.from({ length: newCount }, (_, i) =>
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

  const toggleMapSelection = (groupIndex: number, map: string) => {
    const newGroups = [...tempGroups];
    const currentMaps = newGroups[groupIndex].match_maps || [];
    newGroups[groupIndex].match_maps = currentMaps.includes(map)
      ? currentMaps.filter((m: string) => m !== map)
      : [...currentMaps, map];
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
      toast.error("Please complete all group details correctly, including selecting at least one map per group (Step 2)");
      return;
    }

    if (stageModalData.number_of_groups < 1) {
      toast.error("A stage must have at least one group.");
      return;
    }

    const existingStage = form.getValues("stages")[editingStageIndex!];

    const newStage: StageType = {
      ...(stageModalData.stage_id && { stage_id: stageModalData.stage_id }),
      ...(existingStage?.stage_id && !stageModalData.stage_id && { stage_id: existingStage.stage_id }),
      stage_name: stageModalData.stage_name,
      start_date: stageModalData.start_date,
      end_date: stageModalData.end_date,
      number_of_groups: stageModalData.number_of_groups,
      stage_format: stageModalData.stage_format,
      groups: tempGroups.map((tg, i) => ({
        ...tg,
        matches: (existingStage?.groups[i] as any)?.matches || [],
      })),
      stage_discord_role_id: stageModalData.stage_discord_role_id,
      teams_qualifying_from_stage: stageModalData.teams_qualifying_from_stage,
      total_teams_in_stage: stageModalData.total_teams_in_stage,
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
    toast.success("Stage configuration updated. Click 'Save Changes' to finalize.");
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
    const suffix = numericPart === 1 ? "st" : numericPart === 2 ? "nd" : numericPart === 3 ? "rd" : "th";
    return `${numericPart}${suffix}`;
  };

  // ── Save / submit ──────────────────────────────────────────────────────────

  const getChangedFields = (data: EventFormType): { label: string; from: string; to: string }[] => {
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
    check("Competition Type", eventDetails.competition_type, data.competition_type);
    check("Participant Type", eventDetails.participant_type, data.participant_type);
    check("Event Type", eventDetails.event_type, data.event_type);
    check("Event Privacy", eventDetails.is_public ? "Public" : "Private", data.is_public === "True" ? "Public" : "Private");
    check("Max Participants", eventDetails.max_teams_or_players, data.max_teams_or_players);
    check("Event Mode", eventDetails.event_mode, data.event_mode);
    check("Start Date", eventDetails.start_date, data.start_date);
    check("End Date", eventDetails.end_date, data.end_date);
    check("Registration Open", eventDetails.registration_open_date, data.registration_open_date);
    check("Registration Close", eventDetails.registration_end_date, data.registration_end_date);
    check("Registration Link", eventDetails.registration_link ?? "", data.registration_link ?? "");
    check("Prize Pool", eventDetails.prizepool, data.prizepool);
    check("Event Status", eventDetails.event_status, data.event_status);

    if (selectedFile) changes.push({ label: "Event Banner", from: "Previous banner", to: `New file: ${selectedFile.name}` });
    if (selectedRuleFile) changes.push({ label: "Rules Document", from: "Previous document", to: `New file: ${selectedRuleFile.name}` });

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
      toast.error("Registration open date cannot be after registration close date");
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
        if (selectedRuleFile) formData.append("uploaded_rules", selectedRuleFile);

        formData.append("event_name", data.event_name);
        formData.append("competition_type", data.competition_type);
        formData.append("participant_type", data.participant_type);
        formData.append("event_type", data.event_type);
        formData.append("is_public", data.is_public);
        formData.append("max_teams_or_players", data.max_teams_or_players.toString());
        formData.append("event_mode", data.event_mode);
        formData.append("prizepool", data.prizepool);
        formData.append("number_of_stages", "2");
        formData.append("start_date", data.start_date);
        formData.append("end_date", data.end_date);
        formData.append("registration_open_date", data.registration_open_date);
        formData.append("registration_end_date", data.registration_end_date);
        formData.append("registration_link", data.registration_link || "");
        formData.append("publish_to_tournaments", data.publish_to_tournaments.toString());
        formData.append("publish_to_news", data.publish_to_news.toString());
        formData.append("registration_restriction", data.registration_restriction || "none");
        formData.append("restriction_mode", data.restriction_mode || "allow_only");
        formData.append(
          "restricted_countries",
          JSON.stringify(data.selected_locations && data.selected_locations.length > 0 ? data.selected_locations : []),
        );

        if (rulesInputMethod === "type") {
          formData.append("event_rules", data.event_rules || "");
          formData.append("uploaded_rules", "");
        } else {
          formData.append("event_rules", "");
        }

        formData.append("prize_distribution", JSON.stringify(data.prize_distribution));
        formData.append(
          "stream_channels",
          JSON.stringify(data.stream_channels?.filter((s) => s.trim() !== "") || []),
        );
        formData.append("stages", JSON.stringify(data.stages));

        const response = await fetch(`${env.NEXT_PUBLIC_BACKEND_API_URL}/events/edit-event/`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });

        const contentType = response.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
          toast.error("Server error: Unexpected response format.", { duration: 5000 });
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
            toast.error(<div className="space-y-1"><p className="font-semibold">Validation Error</p><p className="text-sm">{errorMessage}</p></div>, { duration: 5000 });
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
        if (error.message === "Failed to fetch" || error.message?.includes("NetworkError")) {
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

      <PageHeader back title={eventTitle} />

      <Form {...form}>
        <form className="space-y-6">
          <Tabs value={currentTab} onValueChange={setCurrentTab}>
            <TabsList className="w-full justify-start overflow-x-auto mb-2">
              <TabsTrigger value="basic_info" className="px-6 relative">
                Basic Info
                {tabErrors.basic_info && (
                  <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-destructive" />
                )}
              </TabsTrigger>
              <TabsTrigger value="registered_teams" className="px-6 relative">
                Registered Teams
                {tabErrors.registered_teams && (
                  <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-destructive" />
                )}
              </TabsTrigger>
              <TabsTrigger value="stages_groups" className="px-6 relative">
                Stages & Groups
                {tabErrors.stages_groups && (
                  <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-destructive" />
                )}
              </TabsTrigger>
              <TabsTrigger value="prize_rules" className="px-6 relative">
                Prize & Rules
                {tabErrors.prize_rules && (
                  <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-destructive" />
                )}
              </TabsTrigger>
              <TabsTrigger value="actions" className="px-6 relative">
                Event Actions
              </TabsTrigger>
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
                onStartTournament={() => setOpenConfirmStartTournamentModal(true)}
              />
            </TabsContent>
          </Tabs>
        </form>

        {/* ── Modals ─────────────────────────────────────────────────────── */}

        <ParticipantTypeWarningModal
          open={showParticipantTypeWarning}
          currentType={form.getValues("participant_type")}
          pendingType={pendingParticipantType}
          participantLabel={eventDetails.participant_type === "squad" ? "teams" : "players"}
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
          toggleMapSelection={toggleMapSelection}
          handleSaveStageLogic={handleSaveStageLogic}
          passwordVisibility={passwordVisibility}
          toggleVisibility={toggleVisibility}
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
