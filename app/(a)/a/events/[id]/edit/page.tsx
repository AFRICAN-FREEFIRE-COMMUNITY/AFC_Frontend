"use client";

import React, { useState, useTransition, useRef, useEffect, use } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import { Trash2, Edit, AlertTriangle, EyeOffIcon, EyeIcon } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { useAuth } from "@/contexts/AuthContext";
import { env } from "@/lib/env";
import { Separator } from "@/components/ui/separator";
import axios from "axios";
import {
  IconFile,
  IconFileText,
  IconPhoto,
  IconTrophy,
  IconUpload,
  IconX,
} from "@tabler/icons-react";
import Image from "next/image";
import { FullLoader, Loader } from "@/components/Loader";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { GroupResultModal } from "../../_components/GroupResultModal";
import { SeedStageModal } from "../../_components/SeedStageModal";
import { formatDate } from "@/lib/utils";
import { DisqualifyModal } from "../../_components/DisqualifyModal";
import { ReactivateModal } from "../../_components/ReactivateModal";
import { ConfirmStartTournamentModal } from "../../_components/ConfirmStartTournamentModal";

// ============================================================================
// CONSTANTS & TYPES
// ============================================================================

const formattedWord: Record<string, string> = {
  "br - normal": "Battle Royale - Normal",
  "br - roundrobin": "Battle Royale - Round Robin",
  "br - point rush": "Battle Royale - Point Rush",
  "br - champion rush": "Battle Royale - Champion Rush",
  "cs - normal": "Clash Squad - Normal",
  "cs - league": "Clash Squad - League",
  "cs - knockout": "Clash Squad - Knockout",
  "cs - double elimination": "Clash Squad - Double Elimination",
  "cs - round robin": "Clash Squad - Round Robin",
};

const AVAILABLE_MAPS = [
  "Bermuda",
  "Kalahari",
  "Purgatory",
  "Nexterra",
  "Alpine",
  "Solara",
];

const STAGE_FORMATS = [
  "br - normal",
  "br - roundrobin",
  "br - point rush",
  "br - champion rush",
  "cs - normal",
  "cs - league",
  "cs - knockout",
  "cs - double elimination",
  "cs - round robin",
];

// ============================================================================
// SCHEMAS
// ============================================================================

const GroupSchema = z.object({
  group_id: z.number().optional(),
  group_name: z.string().min(1, "Group name required"),
  group_discord_role_id: z.string().min(1, "Discord Role ID required"),
  room_id: z.string().optional(),
  room_name: z.string().optional(),
  room_password: z.string().optional(),
  playing_date: z.string().min(1, "Playing date required"),
  playing_time: z.string().min(1, "Playing time required"),
  teams_qualifying: z.coerce.number().min(1, "Must qualify at least 1 team"),
  match_count: z.coerce.number().min(1, "Must play at least 1 match"),
  match_maps: z.array(z.string()).min(1, "At least one map must be selected"),
});

const StageSchema = z.object({
  stage_id: z.number().optional(),
  stage_name: z.string().min(1, "Stage name required"),
  stage_discord_role_id: z.string().min(1, "Discord Role ID required"),
  start_date: z.string().min(1, "Start date required"),
  end_date: z.string().min(1, "End date required"),
  number_of_groups: z.coerce.number().min(1, "Must have at least 1 group"),
  stage_format: z.string().min(1, "Stage format required"),
  groups: z.array(GroupSchema).min(1, "At least one group required"),
  teams_qualifying_from_stage: z.coerce.number().min(0).default(0),
  total_teams_in_stage: z.coerce.number().min(0).default(0),
});

const EventFormSchema = z
  .object({
    event_name: z.string().min(1, "Event name required"),
    competition_type: z.string().min(1, "Competition type required"),
    participant_type: z.string().min(1, "Participant type required"),
    event_type: z.string().min(1, "Event type required"),
    max_teams_or_players: z.coerce
      .number()
      .min(1, "Max teams/players required"),
    banner: z.string().optional(),
    stream_channels: z.array(z.string()).optional(),
    event_mode: z.string().min(1, "Event mode required"),
    number_of_stages: z.coerce.number().min(1, "At least 1 stage required"),
    stages: z.array(StageSchema).min(1, "At least one stage required"),
    prizepool: z.string().min(1, "Prize pool required"),
    prize_distribution: z.record(z.string(), z.coerce.number()),
    event_rules: z.string().optional(),
    rules_document: z.any().optional(),
    start_date: z.string().min(1, "Start date required"),
    end_date: z.string().min(1, "End date required"),
    registration_open_date: z
      .string()
      .min(1, "Registration open date required"),
    registration_end_date: z.string().min(1, "Registration end date required"),
    registration_link: z.string().optional().or(z.literal("")),
    event_status: z.string().default("upcoming"),
    publish_to_tournaments: z.boolean().default(false),
    publish_to_news: z.boolean().default(false),
    save_to_drafts: z.boolean().default(false),
  })
  .refine(
    (data) => {
      if (data.save_to_drafts) {
        return !data.publish_to_tournaments && !data.publish_to_news;
      }
      if (data.publish_to_tournaments || data.publish_to_news) {
        return !data.save_to_drafts;
      }
      return true;
    },
    {
      message:
        "An event cannot be saved as a draft and published simultaneously.",
      path: ["save_to_drafts"],
    }
  );

type EventFormType = z.infer<typeof EventFormSchema>;
type StageType = z.infer<typeof StageSchema>;
type GroupType = z.infer<typeof GroupSchema>;

interface EventDetails {
  event_id: number;
  competition_type: string;
  participant_type: string;
  event_type: string;
  max_teams_or_players: number;
  event_name: string;
  event_mode: string;
  start_date: string;
  end_date: string;
  registration_open_date: string;
  registration_end_date: string;
  prizepool: string;
  prize_distribution: { [key: string]: number };
  event_rules: string;
  event_status: string;
  registration_link: string | null;
  tournament_tier: string;
  event_banner_url: string | null;
  uploaded_rules_url: string | null;
  number_of_stages: number;
  created_at: string;
  is_registered: boolean;
  stream_channels: string[];
  registered_competitors: Array<{
    player_id: number;
    username: string;
    status: string;
  }>;
  tournament_teams: any[];
  stages: Array<{
    id: number;
    stage_id: number;
    stage_name: string;
    stage_discord_role_id: string;
    total_teams_in_stage: number;
    start_date: string;
    end_date: string;
    number_of_groups: number;
    stage_format: string;
    teams_qualifying_from_stage: number;
    stage_status: string;
    groups: Array<{
      id: number; // This is what comes from backend
      group_id?: number; // Add this as well for compatibility
      group_name: string;
      group_discord_role_id: string;
      playing_date: string;
      playing_time: string;
      teams_qualifying: number;
      match_count: number;
      match_maps: string[];
      matches: any[];
      room_id: string;
      room_name: string;
      room_password: string;
    }>;
  }>;
}

type Params = {
  id: string;
};

// ============================================================================
// VALIDATION HELPER FUNCTIONS
// ============================================================================

interface ValidationError {
  field: string;
  message: string;
  tab: string;
  stageIndex?: number;
  groupIndex?: number;
}

const validateStageData = (
  stages: StageType[]
): { isValid: boolean; errors: ValidationError[] } => {
  const errors: ValidationError[] = [];

  // Check for undefined stages
  stages.forEach((stage, sIdx) => {
    if (!stage || typeof stage !== "object") {
      errors.push({
        field: `stages.${sIdx}`,
        message: `Stage ${sIdx + 1} is not configured`,
        tab: "stages_groups",
        stageIndex: sIdx,
      });
      return;
    }

    // Validate stage-level fields
    if (!stage.stage_name || stage.stage_name.trim() === "") {
      errors.push({
        field: `stages.${sIdx}.stage_name`,
        message: `Stage ${sIdx + 1}: Stage name is required`,
        tab: "stages_groups",
        stageIndex: sIdx,
      });
    }

    if (!stage.stage_format) {
      errors.push({
        field: `stages.${sIdx}.stage_format`,
        message: `Stage ${sIdx + 1}: Stage format is required`,
        tab: "stages_groups",
        stageIndex: sIdx,
      });
    }

    if (!stage.start_date) {
      errors.push({
        field: `stages.${sIdx}.start_date`,
        message: `Stage ${sIdx + 1}: Start date is required`,
        tab: "stages_groups",
        stageIndex: sIdx,
      });
    }

    if (!stage.end_date) {
      errors.push({
        field: `stages.${sIdx}.end_date`,
        message: `Stage ${sIdx + 1}: End date is required`,
        tab: "stages_groups",
        stageIndex: sIdx,
      });
    }

    if (
      !stage.stage_discord_role_id ||
      stage.stage_discord_role_id.trim() === ""
    ) {
      errors.push({
        field: `stages.${sIdx}.stage_discord_role_id`,
        message: `Stage ${sIdx + 1}: Discord Role ID is required`,
        tab: "stages_groups",
        stageIndex: sIdx,
      });
    }

    if (
      stage.teams_qualifying_from_stage === undefined ||
      stage.teams_qualifying_from_stage === null ||
      stage.teams_qualifying_from_stage < 0
    ) {
      errors.push({
        field: `stages.${sIdx}.teams_qualifying_from_stage`,
        message: `Stage ${sIdx + 1}: Teams qualifying must be specified`,
        tab: "stages_groups",
        stageIndex: sIdx,
      });
    }

    if (!stage.groups || stage.groups.length === 0) {
      errors.push({
        field: `stages.${sIdx}.groups`,
        message: `Stage ${sIdx + 1}: At least one group is required`,
        tab: "stages_groups",
        stageIndex: sIdx,
      });
    }

    // Validate date logic
    if (stage.start_date && stage.end_date) {
      const startDate = new Date(stage.start_date);
      const endDate = new Date(stage.end_date);
      if (startDate > endDate) {
        errors.push({
          field: `stages.${sIdx}.dates`,
          message: `Stage ${sIdx + 1}: Start date cannot be after end date`,
          tab: "stages_groups",
          stageIndex: sIdx,
        });
      }
    }

    // Validate groups
    if (stage.groups && stage.groups.length > 0) {
      stage.groups.forEach((group, gIdx) => {
        if (!group.group_name || group.group_name.trim() === "") {
          errors.push({
            field: `stages.${sIdx}.groups.${gIdx}.group_name`,
            message: `Stage ${sIdx + 1}, Group ${
              gIdx + 1
            }: Group name is required`,
            tab: "stages_groups",
            stageIndex: sIdx,
            groupIndex: gIdx,
          });
        }

        if (!group.playing_date) {
          errors.push({
            field: `stages.${sIdx}.groups.${gIdx}.playing_date`,
            message: `Stage ${sIdx + 1}, Group ${
              gIdx + 1
            }: Playing date is required`,
            tab: "stages_groups",
            stageIndex: sIdx,
            groupIndex: gIdx,
          });
        }

        if (!group.playing_time) {
          errors.push({
            field: `stages.${sIdx}.groups.${gIdx}.playing_time`,
            message: `Stage ${sIdx + 1}, Group ${
              gIdx + 1
            }: Playing time is required`,
            tab: "stages_groups",
            stageIndex: sIdx,
            groupIndex: gIdx,
          });
        }

        if (
          !group.group_discord_role_id ||
          group.group_discord_role_id.trim() === ""
        ) {
          errors.push({
            field: `stages.${sIdx}.groups.${gIdx}.group_discord_role_id`,
            message: `Stage ${sIdx + 1}, Group ${
              gIdx + 1
            }: Discord Role ID is required`,
            tab: "stages_groups",
            stageIndex: sIdx,
            groupIndex: gIdx,
          });
        }

        if (!group.match_maps || group.match_maps.length === 0) {
          errors.push({
            field: `stages.${sIdx}.groups.${gIdx}.match_maps`,
            message: `Stage ${sIdx + 1}, Group ${
              gIdx + 1
            }: At least one map must be selected`,
            tab: "stages_groups",
            stageIndex: sIdx,
            groupIndex: gIdx,
          });
        }

        if (
          group.teams_qualifying === undefined ||
          group.teams_qualifying === null ||
          group.teams_qualifying < 1
        ) {
          errors.push({
            field: `stages.${sIdx}.groups.${gIdx}.teams_qualifying`,
            message: `Stage ${sIdx + 1}, Group ${
              gIdx + 1
            }: Teams qualifying must be at least 1`,
            tab: "stages_groups",
            stageIndex: sIdx,
            groupIndex: gIdx,
          });
        }

        if (
          group.match_count === undefined ||
          group.match_count === null ||
          group.match_count < 1
        ) {
          errors.push({
            field: `stages.${sIdx}.groups.${gIdx}.match_count`,
            message: `Stage ${sIdx + 1}, Group ${
              gIdx + 1
            }: Match count must be at least 1`,
            tab: "stages_groups",
            stageIndex: sIdx,
            groupIndex: gIdx,
          });
        }
      });
    }
  });

  return {
    isValid: errors.length === 0,
    errors,
  };
};

const showValidationErrors = (
  errors: ValidationError[],
  onFixClick: (stageIndex?: number) => void
) => {
  if (errors.length === 0) return;

  const firstError = errors[0];
  const errorsByStage: { [key: number]: ValidationError[] } = {};

  errors.forEach((error) => {
    if (error.stageIndex !== undefined) {
      if (!errorsByStage[error.stageIndex]) {
        errorsByStage[error.stageIndex] = [];
      }
      errorsByStage[error.stageIndex].push(error);
    }
  });

  const stageIndex = firstError.stageIndex;
  const stageErrors =
    stageIndex !== undefined ? errorsByStage[stageIndex] : errors;

  toast.error(
    <div className="space-y-2">
      <p className="font-semibold">
        {stageIndex !== undefined
          ? `Stage ${stageIndex + 1} has validation errors`
          : "Form has validation errors"}
      </p>
      <ul className="list-disc list-inside text-sm space-y-1 max-h-32 overflow-auto">
        {stageErrors.slice(0, 5).map((error, idx) => (
          <li key={idx}>{error.message}</li>
        ))}
      </ul>
      {stageErrors.length > 5 && (
        <p className="text-xs text-muted-foreground">
          ...and {stageErrors.length - 5} more error(s)
        </p>
      )}
    </div>,
    {
      duration: 6000,
      action:
        stageIndex !== undefined
          ? {
              label: "Fix Now",
              onClick: () => onFixClick(stageIndex),
            }
          : undefined,
    }
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function EditEventPage({ params }: { params: Promise<Params> }) {
  const resolvedParams = use(params);
  const { id } = resolvedParams;
  const router = useRouter();
  const searchParams = useSearchParams();
  const [stageModalStep, setStageModalStep] = useState(1);
  const [tempGroups, setTempGroups] = useState<GroupType[]>([]);
  const [currentTab, setCurrentTab] = useState("basic_info");
  const [isPending, startTransition] = useTransition();
  const [rulesInputMethod, setRulesInputMethod] = useState<"type" | "upload">(
    "type"
  );

  const [isSeedModalOpen, setIsSeedModalOpen] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [eventTitle, setEventTitle] = useState("Loading Event...");
  const [stageNames, setStageNames] = useState<string[]>(["Stage 1"]);
  const [isStageModalOpen, setIsStageModalOpen] = useState(false);
  const [editingStageIndex, setEditingStageIndex] = useState<number | null>(
    null
  );
  const [passwordVisibility, setPasswordVisibility] = useState<
    Record<number, boolean>
  >({});
  const [eventDetails, setEventDetails] = useState<EventDetails>();

  const [stageModalData, setStageModalData] = useState<{
    stage_id?: number; // ✅ CORRECT TYPE
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

  const { token, loading: authLoading } = useAuth();

  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [openConfirmStartTournamentModal, setOpenConfirmStartTournamentModal] =
    useState(false);
  const [isResultsModalOpen, setIsResultsModalOpen] = useState(false);
  const [selectedGroupForResult, setSelectedGroupForResult] = useState(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedRuleFile, setSelectedRuleFile] = useState<File | null>(null);
  const [previewRuleUrl, setPreviewRuleUrl] = useState<string>("");
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const rulesFileInputRef = useRef<HTMLInputElement>(null);
  const [selectedGroupForSeed, setSelectedGroupForSeed] = useState(null);
  const [stageToRemove, setStageToRemove] = useState<number | null>(null);
  const [isRemoveConfirmOpen, setIsRemoveConfirmOpen] = useState(false);

  const [tabErrors, setTabErrors] = useState<{
    basic_info: boolean;
    registered_teams: boolean;
    stages_groups: boolean;
    prize_rules: boolean;
  }>({
    basic_info: false,
    registered_teams: false,
    stages_groups: false,
    prize_rules: false,
  });

  const form = useForm<EventFormType>({
    resolver: zodResolver(EventFormSchema),
    defaultValues: {
      event_name: "",
      competition_type: "",
      participant_type: "",
      event_type: "",
      max_teams_or_players: 1,
      banner: "",
      stream_channels: [""],
      event_mode: "",
      number_of_stages: 1,
      stages: [
        {
          // No stage_id for new stages ✅
          stage_name: "Stage 1",
          stage_discord_role_id: "",
          start_date: "",
          end_date: "",
          number_of_groups: 1,
          stage_format: "",
          groups: [
            {
              // No group_id for new groups ✅
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
      prize_distribution: { "1": 0, "2": 0, "3": 0 },
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
  } = useFieldArray({
    control: form.control,
    name: "stream_channels",
  });

  const stages = form.watch("stages") || [];

  // ============================================================================
  // EFFECTS
  // ============================================================================

  useEffect(() => {
    if (!id || authLoading || !token) return;

    startTransition(async () => {
      try {
        const decodedId = decodeURIComponent(id);
        const commonConfig = {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        };

        const [res, resAdmin] = await Promise.all([
          axios.post(
            `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/get-event-details/`,
            { event_id: decodedId },
            commonConfig
          ),
          axios.post(
            `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/get-event-details-for-admin/`,
            { event_id: decodedId },
            commonConfig
          ),
        ]);

        const adminStages =
          resAdmin.data.event_details?.stages || resAdmin.data.stages || [];

        const mergedDetails: EventDetails = {
          ...res.data.event_details,
          stages: adminStages,
        };

        if (adminStages.length > 0) {
          const names = adminStages.map((s: any) => s.stage_name);
          setStageNames(names);
        }

        setEventDetails(mergedDetails);
      } catch (error: any) {
        const errorMessage =
          error.response?.data?.message ||
          error.response?.data?.detail ||
          "Failed to fetch event details.";
        toast.error(errorMessage);
        router.push("/login");
      }
    });
  }, [id, token, authLoading, router]);

  useEffect(() => {
    if (eventDetails) {
      // Map backend IDs to the field names backend expects
      const mappedStages = eventDetails.stages.map((stage) => ({
        ...stage,
        stage_id: stage.stage_id || stage.id, // Use stage_id or fallback to id
        groups: stage.groups.map((group) => ({
          ...group,
          group_id: group.group_id, // Map id to group_id
        })),
      }));
      form.reset({
        banner: eventDetails.event_banner_url || "",
        event_name: eventDetails.event_name,
        competition_type: eventDetails.competition_type,
        participant_type: eventDetails.participant_type,
        event_type: eventDetails.event_type,
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
      });

      setPreviewUrl(eventDetails.event_banner_url || "");
      setPreviewRuleUrl(eventDetails.uploaded_rules_url || "");
      setRulesInputMethod(eventDetails.event_rules ? "type" : "upload");
      setEventTitle(`Edit Event: ${eventDetails.event_name}`);
      setInitialLoading(false);
    }
  }, [eventDetails, form]);

  // Track errors per tab
  useEffect(() => {
    const errors = form.formState.errors;
    const stages = form.watch("stages");

    // Validate stages separately
    const stageValidation = validateStageData(stages);

    setTabErrors({
      basic_info: !!(
        errors.event_name ||
        errors.competition_type ||
        errors.participant_type ||
        errors.event_type ||
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

  // Handle draft/publish mutual exclusivity
  const saveToDraftsWatch = form.watch("save_to_drafts");
  const publishToTournamentsWatch = form.watch("publish_to_tournaments");
  const publishToNewsWatch = form.watch("publish_to_news");

  useEffect(() => {
    const isDraftChecked = saveToDraftsWatch;
    const isPublishChecked = publishToTournamentsWatch || publishToNewsWatch;

    if (isDraftChecked && isPublishChecked) {
      if (publishToTournamentsWatch) {
        form.setValue("publish_to_tournaments", false, { shouldDirty: false });
      }
      if (publishToNewsWatch) {
        form.setValue("publish_to_news", false, { shouldDirty: false });
      }
    } else if (isPublishChecked && isDraftChecked) {
      form.setValue("save_to_drafts", false, { shouldDirty: false });
    }
  }, [saveToDraftsWatch, publishToTournamentsWatch, publishToNewsWatch, form]);

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const toggleVisibility = (groupIndex: number) => {
    setPasswordVisibility((prev) => ({
      ...prev,
      [groupIndex]: !prev[groupIndex],
    }));
  };

  const handleConfirmSeed = (groupId: number) => {
    console.log("Seeding teams for group:", groupId);
    setIsSeedModalOpen(false);
    toast.success("Teams seeded successfully!");
  };

  const updateCompetitorStatus = (playerId: number, newStatus: string) => {
    setEventDetails((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        registered_competitors: prev.registered_competitors.map((comp) =>
          comp.player_id === playerId ? { ...comp, status: newStatus } : comp
        ),
      };
    });
  };

  const handleStageCountChangeLogic = (count: number) => {
    const newCount = Math.max(1, count);
    form.setValue("number_of_stages", newCount);

    const newNames = Array.from(
      { length: newCount },
      (_, i) => stageNames[i] || `Stage ${i + 1}`
    );
    setStageNames(newNames);

    const currentStages = form.getValues("stages") || [];
    const newStages = Array.from({ length: newCount }, (_, i) => {
      if (currentStages[i]) {
        return currentStages[i];
      }
      return {
        stage_name: newNames[i],
        stage_discord_role_id: "",
        start_date: "",
        end_date: "",
        number_of_groups: 1,
        stage_format: "",
        total_teams_in_stage: 0,
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
      } as StageType;
    });

    form.setValue("stages", newStages, {
      shouldDirty: true,
      shouldValidate: false,
    });
  };

  const handleGroupCountChangeLogic = (count: number) => {
    const newCount = Math.max(0, count);

    const newTempGroups = Array.from({ length: newCount }, (_, i) => {
      if (tempGroups[i]) {
        return tempGroups[i];
      }
      return {
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
      };
    });

    setTempGroups(newTempGroups);
    setStageModalData({
      ...stageModalData,
      number_of_groups: newCount,
    });
  };

  const updateGroupDetailLogic = (
    index: number,
    field: keyof GroupType,
    value: string | number | string[]
  ) => {
    const newGroups = [...tempGroups];
    newGroups[index] = {
      ...newGroups[index],
      [field]: value,
    };
    setTempGroups(newGroups);
  };

  const toggleMapSelection = (groupIndex: number, map: string) => {
    const newGroups = [...tempGroups];
    const currentMaps = newGroups[groupIndex].match_maps || [];

    if (currentMaps.includes(map)) {
      newGroups[groupIndex].match_maps = currentMaps.filter((m) => m !== map);
    } else {
      newGroups[groupIndex].match_maps = [...currentMaps, map];
    }

    setTempGroups(newGroups);
  };

  const handleSaveStageLogic = async () => {
    // Validate stage data
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
        g.match_maps.length === 0
    );

    if (invalidGroup) {
      toast.error(
        "Please complete all group details correctly, including selecting at least one map per group (Step 2)"
      );
      return;
    }

    if (stageModalData.number_of_groups < 1) {
      toast.error("A stage must have at least one group.");
      return;
    }

    // CRITICAL FIX: Get existing stage to preserve stage_id
    const existingStage = form.getValues("stages")[editingStageIndex!];

    const newStage: StageType = {
      // ✅ PRESERVE stage_id - use from stageModalData OR existingStage
      ...(stageModalData.stage_id && { stage_id: stageModalData.stage_id }),
      ...(existingStage?.stage_id &&
        !stageModalData.stage_id && { stage_id: existingStage.stage_id }),
      stage_name: stageModalData.stage_name,
      start_date: stageModalData.start_date,
      end_date: stageModalData.end_date,
      number_of_groups: stageModalData.number_of_groups,
      stage_format: stageModalData.stage_format,
      groups: tempGroups, // Already has group_id preserved
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
    toast.success(
      "Stage configuration updated. Click 'Save Changes' to finalize."
    );
  };

  const openAddStageModalLogic = (stageIndex: number) => {
    setEditingStageIndex(stageIndex);
    setStageModalStep(1);
    const existingStage = stages[stageIndex];

    if (existingStage) {
      setStageModalData({
        // ✅ PRESERVE stage_id for existing stages
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
      });

      // ✅ PRESERVE group_id when loading groups
      setTempGroups(
        existingStage.groups.map((g) => ({
          ...g,
          group_id: g.group_id,
        }))
      );
    } else {
      setStageModalData({
        // No stage_id for new stages ✅
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
          // No group_id for new groups ✅
        }))
      );
    }

    setPasswordVisibility({});
    setIsStageModalOpen(true);
  };

  // const openAddStageModalLogic = (stageIndex: number) => {
  //   setEditingStageIndex(stageIndex);
  //   setStageModalStep(1);
  //   const existingStage = stages[stageIndex];

  //   if (existingStage) {
  //     setStageModalData({
  //       stage_name: existingStage.stage_name,
  //       start_date: existingStage.start_date,
  //       end_date: existingStage.end_date,
  //       stage_format: existingStage.stage_format,
  //       number_of_groups: existingStage.number_of_groups,
  //       stage_discord_role_id: existingStage.stage_discord_role_id || "",
  //       teams_qualifying_from_stage:
  //         existingStage.teams_qualifying_from_stage || 0,
  //       total_teams_in_stage: existingStage.total_teams_in_stage || 0,
  //     });

  //     // CRITICAL FIX: Preserve group_id when loading groups
  //     setTempGroups(
  //       existingStage.groups.map((g) => ({
  //         ...g,
  //         // Ensure group_id is preserved
  //         group_id: g.group_id,
  //       }))
  //     );
  //   } else {
  //     setStageModalData({
  //       stage_name: stageNames[stageIndex] || `Stage ${stageIndex + 1}`,
  //       start_date: "",
  //       end_date: "",
  //       stage_discord_role_id: "",
  //       stage_format: "",
  //       number_of_groups: 2,
  //       teams_qualifying_from_stage: 0,
  //       total_teams_in_stage: 0,
  //     });
  //     setTempGroups(
  //       Array.from({ length: 2 }, (_, i) => ({
  //         group_name: `Group ${i + 1}`,
  //         playing_date: "",
  //         playing_time: "00:00",
  //         teams_qualifying: 1,
  //         match_count: 1,
  //         group_discord_role_id: "",
  //         match_maps: [],
  //         room_id: "",
  //         room_name: "",
  //         room_password: "",
  //         // No group_id for new groups - backend will create them
  //       }))
  //     );
  //   }

  //   setPasswordVisibility({});
  //   setIsStageModalOpen(true);
  // };

  // const handleSaveStageLogic = async () => {
  //   // Validate stage data
  //   if (
  //     !stageModalData.stage_name ||
  //     !stageModalData.stage_format ||
  //     !stageModalData.start_date ||
  //     !stageModalData.end_date ||
  //     !stageModalData.stage_discord_role_id ||
  //     stageModalData.teams_qualifying_from_stage === undefined
  //   ) {
  //     toast.error("Please fill all required stage fields (Step 1)");
  //     return;
  //   }

  //   const invalidGroup = tempGroups.find(
  //     (g) =>
  //       !g.playing_date ||
  //       !g.playing_time ||
  //       !g.group_discord_role_id ||
  //       !g.group_name.trim() ||
  //       g.teams_qualifying < 1 ||
  //       g.match_count < 1 ||
  //       !g.match_maps ||
  //       g.match_maps.length === 0
  //   );

  //   if (invalidGroup) {
  //     toast.error(
  //       "Please complete all group details correctly, including selecting at least one map per group (Step 2)"
  //     );
  //     return;
  //   }

  //   if (stageModalData.number_of_groups < 1) {
  //     toast.error("A stage must have at least one group.");
  //     return;
  //   }

  //   const newStage: StageType = {
  //     stage_name: stageModalData.stage_name,
  //     start_date: stageModalData.start_date,
  //     end_date: stageModalData.end_date,
  //     number_of_groups: stageModalData.number_of_groups,
  //     stage_format: stageModalData.stage_format,
  //     groups: tempGroups,
  //     stage_discord_role_id: stageModalData.stage_discord_role_id,
  //     teams_qualifying_from_stage: stageModalData.teams_qualifying_from_stage,
  //     total_teams_in_stage: stageModalData.total_teams_in_stage,
  //   };

  //   const currentStages = [...form.getValues("stages")];
  //   currentStages[editingStageIndex!] = newStage;

  //   form.setValue("stages", currentStages, { shouldDirty: true });

  //   const currentNames = [...stageNames];
  //   if (currentNames[editingStageIndex!] !== newStage.stage_name) {
  //     currentNames[editingStageIndex!] = newStage.stage_name;
  //     setStageNames(currentNames);
  //   }

  //   await form.trigger();

  //   setIsStageModalOpen(false);
  //   setStageModalStep(1);
  //   toast.success(
  //     "Stage configuration updated. Click 'Save Changes' to finalize."
  //   );
  // };

  // const openAddStageModalLogic = (stageIndex: number) => {
  //   setEditingStageIndex(stageIndex);
  //   setStageModalStep(1);
  //   const existingStage = stages[stageIndex];

  //   if (existingStage) {
  //     setStageModalData({
  //       stage_id: existingStage.stage_id,
  //       stage_name: existingStage.stage_name,
  //       start_date: existingStage.start_date,
  //       end_date: existingStage.end_date,
  //       stage_format: existingStage.stage_format,
  //       number_of_groups: existingStage.number_of_groups,
  //       stage_discord_role_id: existingStage.stage_discord_role_id || "",
  //       teams_qualifying_from_stage:
  //         existingStage.teams_qualifying_from_stage || 0,
  //       total_teams_in_stage: existingStage.total_teams_in_stage || 0,
  //     });
  //     setTempGroups(existingStage.groups);
  //   } else {
  //     setStageModalData({
  //       stage_id: "",
  //       stage_name: stageNames[stageIndex] || `Stage ${stageIndex + 1}`,
  //       start_date: "",
  //       end_date: "",
  //       stage_discord_role_id: "",
  //       stage_format: "",
  //       number_of_groups: 2,
  //       teams_qualifying_from_stage: 0,
  //       total_teams_in_stage: 0,
  //     });
  //     setTempGroups(
  //       Array.from({ length: 2 }, (_, i) => ({
  //         group_name: `Group ${i + 1}`,
  //         playing_date: "",
  //         playing_time: "00:00",
  //         teams_qualifying: 1,
  //         match_count: 1,
  //         group_discord_role_id: "",
  //         match_maps: [],
  //         room_id: "",
  //         room_name: "",
  //         room_password: "",
  //       }))
  //     );
  //   }

  //   setPasswordVisibility({});
  //   setIsStageModalOpen(true);
  // };

  const addNewStage = () => {
    const currentCount = form.getValues("number_of_stages") || 0;
    const newCount = currentCount + 1;

    const currentStages = form.getValues("stages") || [];

    const newStage: StageType = {
      // No stage_id - this is a NEW stage, backend will assign ID
      stage_name: `Stage ${newCount}`,
      stage_discord_role_id: "",
      start_date: "",
      end_date: "",
      number_of_groups: 2,
      stage_format: "",
      groups: Array.from({ length: 2 }, (_, i) => ({
        // No group_id - these are NEW groups
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

    const updatedStages = [...currentStages, newStage];

    form.setValue("stages", updatedStages, { shouldValidate: false });
    form.setValue("number_of_stages", newCount);

    const newNames = [...stageNames, `Stage ${newCount}`];
    setStageNames(newNames);

    openAddStageModalLogic(currentCount);
  };

  // const addNewStage = () => {
  //   const currentCount = form.getValues("number_of_stages") || 0;
  //   const newCount = currentCount + 1;

  //   const currentStages = form.getValues("stages") || [];

  //   const newStage: StageType = {
  //     stage_name: `Stage ${newCount}`,
  //     stage_discord_role_id: "",
  //     start_date: "",
  //     end_date: "",
  //     number_of_groups: 2,
  //     stage_format: "",
  //     groups: Array.from({ length: 2 }, (_, i) => ({
  //       group_name: `Group ${i + 1}`,
  //       group_discord_role_id: "",
  //       playing_date: "",
  //       playing_time: "00:00",
  //       teams_qualifying: 1,
  //       match_count: 1,
  //       match_maps: [],
  //       room_id: "",
  //       room_name: "",
  //       room_password: "",
  //     })),
  //     teams_qualifying_from_stage: 0,
  //     total_teams_in_stage: 0,
  //   };

  //   const updatedStages = [...currentStages, newStage];

  //   form.setValue("stages", updatedStages, { shouldValidate: false });
  //   form.setValue("number_of_stages", newCount);

  //   const newNames = [...stageNames, `Stage ${newCount}`];
  //   setStageNames(newNames);

  //   openAddStageModalLogic(currentCount);
  // };

  const handleRemoveStage = (indexToRemove: number) => {
    const currentStages = form.getValues("stages") || [];

    if (currentStages.length <= 1) {
      toast.error("An event must have at least one stage.");
      return;
    }

    setStageToRemove(indexToRemove);
    setIsRemoveConfirmOpen(true);
  };

  //   if (stageToRemove === null) return;

  //   const currentStages = form.getValues("stages") || [];
  //   const currentCount = form.getValues("number_of_stages") || 0;

  //   const updatedStages = currentStages.filter(
  //     (_, idx) => idx !== stageToRemove
  //   );
  //   const updatedNames = stageNames.filter((_, idx) => idx !== stageToRemove);

  //   console.log(currentStages);

  //   // form.setValue("stages", updatedStages, {
  //   //   shouldDirty: true,
  //   //   shouldValidate: true,
  //   // });

  //   // form.setValue("number_of_stages", currentCount - 1);
  //   // setStageNames(updatedNames);

  //   // toast.success(
  //   //   `Stage "${
  //   //     currentStages[stageToRemove]?.stage_name || `Stage ${stageToRemove + 1}`
  //   //   }" removed successfully`
  //   // );

  //   // setIsRemoveConfirmOpen(false);
  //   // setStageToRemove(null);
  // };

  const [loadingRemove, setLoadingRemove] = useState(false);

  const confirmRemoveStage = async () => {
    if (stageToRemove === null) return;

    const currentStages = form.getValues("stages") || [];
    const stageToDelete = currentStages[stageToRemove];

    // If the stage has an ID, it exists in the database and needs to be deleted
    if (stageToDelete?.stage_id) {
      try {
        setLoadingRemove(true);
        const response = await fetch(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/delete-stage/`,
          {
            method: "POST", // or "DELETE" depending on your API
            headers: {
              "Content-Type": "application/json",
              // Add authorization header if needed
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              stage_id: stageToDelete.stage_id,
            }),
          }
        );

        if (!response.ok) {
          throw new Error("Failed to delete stage");
        }

        setLoadingRemove(false);

        // Optional: handle response
        // const data = await response.json();
      } catch (error) {
        console.error("Error deleting stage:", error);
        toast.error("Failed to delete stage from server");
        return; // Exit early if API call fails
      } finally {
        setLoadingRemove(false);
      }
    }

    // Proceed with local state updates only if API call succeeds (or stage is new)
    const currentCount = form.getValues("number_of_stages") || 0;
    const updatedStages = currentStages.filter(
      (_, idx) => idx !== stageToRemove
    );
    const updatedNames = stageNames.filter((_, idx) => idx !== stageToRemove);

    form.setValue("stages", updatedStages, {
      shouldDirty: true,
      shouldValidate: true,
    });

    form.setValue("number_of_stages", currentCount - 1);
    setStageNames(updatedNames);

    toast.success(
      `Stage "${
        currentStages[stageToRemove]?.stage_name || `Stage ${stageToRemove + 1}`
      }" removed successfully`
    );

    setIsRemoveConfirmOpen(false);
    setStageToRemove(null);
  };

  // Prize distribution
  const prizeDistribution = form.watch("prize_distribution") || {};

  const addPrizePosition = () => {
    const current = { ...prizeDistribution };
    const numericKeys = Object.keys(current)
      .map((key) => parseInt(key.replace(/[^0-9]/g, "")))
      .filter((n) => !isNaN(n));
    const nextPos = (numericKeys.length > 0 ? Math.max(...numericKeys) : 0) + 1;

    form.setValue("prize_distribution", {
      ...current,
      [`${nextPos}`]: 0,
    });
  };

  const removePrizePosition = (key: string) => {
    if (Object.keys(prizeDistribution).length <= 1) return;
    const current = { ...prizeDistribution };
    delete current[key];
    form.setValue("prize_distribution", current);
  };

  const formatPrizeKey = (key: string) => {
    if (key.endsWith("Place")) {
      key = key.split(" ")[0];
    }
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
    return `${numericPart}${suffix} Place`;
  };

  const addStreamChannel = () => appendStream("");

  const removeStreamChannel = (index: number) => {
    if (streamFields.length <= 1) return;
    removeStream(index);
  };

  const eventType = form.watch("event_type") === "external";

  // ============================================================================
  // SUBMIT HANDLER
  // ============================================================================

  const onSubmit = async (data: EventFormType) => {
    if (!eventDetails?.event_id) {
      toast.error("Event ID is missing");
      return;
    }

    // Comprehensive validation
    const currentStages = form.getValues("stages");
    const stageValidation = validateStageData(currentStages);

    if (!stageValidation.isValid) {
      showValidationErrors(stageValidation.errors, (stageIndex) => {
        setCurrentTab("stages_groups");
        if (stageIndex !== undefined) {
          openAddStageModalLogic(stageIndex);
        }
      });
      return;
    }

    // Validate event-level dates
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
        "Registration open date cannot be after registration close date"
      );
      setCurrentTab("basic_info");
      return;
    }

    if (regClose > eventStart) {
      toast.error("Registration must close before the event starts");
      setCurrentTab("basic_info");
      return;
    }

    // // Run form validation
    // const isValid = await form.trigger();
    // if (!isValid) {
    //   const errors = form.formState.errors;
    //   const errorMessages: string[] = [];

    //   if (errors.event_name) errorMessages.push("Event name is required");
    //   if (errors.competition_type)
    //     errorMessages.push("Competition type is required");
    //   if (errors.participant_type)
    //     errorMessages.push("Participant type is required");
    //   if (errors.event_type) errorMessages.push("Event type is required");
    //   if (errors.max_teams_or_players)
    //     errorMessages.push("Max teams/players is required");
    //   if (errors.event_mode) errorMessages.push("Event mode is required");
    //   if (errors.start_date) errorMessages.push("Event start date is required");
    //   if (errors.end_date) errorMessages.push("Event end date is required");
    //   if (errors.registration_open_date)
    //     errorMessages.push("Registration open date is required");
    //   if (errors.registration_end_date)
    //     errorMessages.push("Registration end date is required");
    //   if (errors.prizepool) errorMessages.push("Prize pool is required");
    //   if (errors.prize_distribution)
    //     errorMessages.push("Prize distribution is incomplete");

    //   if (errorMessages.length > 0) {
    //     const displayErrors = errorMessages.slice(0, 4);
    //     const remaining = errorMessages.length - 4;

    //     toast.error(
    //       <div className="space-y-2">
    //         <p className="font-semibold">Please fix the following errors:</p>
    //         <ul className="list-disc list-inside text-sm space-y-1">
    //           {displayErrors.map((msg, idx) => (
    //             <li key={idx}>{msg}</li>
    //           ))}
    //         </ul>
    //         {remaining > 0 && (
    //           <p className="text-xs text-muted-foreground mt-2">
    //             ...and {remaining} more error(s)
    //           </p>
    //         )}
    //       </div>,
    //       { duration: 6000 }
    //     );
    //   }

    //   // Navigate to first tab with errors
    //   if (
    //     errors.event_name ||
    //     errors.competition_type ||
    //     errors.participant_type ||
    //     errors.event_type ||
    //     errors.max_teams_or_players ||
    //     errors.event_mode ||
    //     errors.start_date ||
    //     errors.end_date ||
    //     errors.registration_open_date ||
    //     errors.registration_end_date
    //   ) {
    //     setCurrentTab("basic_info");
    //   } else if (errors.prizepool || errors.prize_distribution) {
    //     setCurrentTab("prize_rules");
    //   }

    //   return;
    // }

    // Submit
    startTransition(async () => {
      try {
        const formData = new FormData();

        let finalEventStatus = data.event_status;
        if (data.save_to_drafts) {
          finalEventStatus = "draft";
        }

        formData.append("is_draft", data.save_to_drafts ? "True" : "False");
        formData.append("event_status", finalEventStatus);
        formData.append("event_id", eventDetails.event_id.toString());

        if (selectedFile) {
          formData.append("event_banner", selectedFile);
        }
        if (selectedRuleFile) {
          formData.append("uploaded_rules", selectedRuleFile);
        }

        formData.append("event_name", data.event_name);
        formData.append("competition_type", data.competition_type);
        formData.append("participant_type", data.participant_type);
        formData.append("event_type", data.event_type);
        formData.append(
          "max_teams_or_players",
          data.max_teams_or_players.toString()
        );
        formData.append("event_mode", data.event_mode);
        formData.append("prizepool", data.prizepool);
        formData.append("number_of_stages", "2");
        formData.append("start_date", data.start_date);
        formData.append("end_date", data.end_date);
        formData.append("registration_open_date", data.registration_open_date);
        formData.append("registration_end_date", data.registration_end_date);
        formData.append("registration_link", data.registration_link || "");
        formData.append(
          "publish_to_tournaments",
          data.publish_to_tournaments.toString()
        );
        formData.append("publish_to_news", data.publish_to_news.toString());

        if (rulesInputMethod === "type") {
          formData.append("event_rules", data.event_rules || "");
          formData.append("uploaded_rules", "");
        } else {
          formData.append("event_rules", "");
        }

        formData.append(
          "prize_distribution",
          JSON.stringify(data.prize_distribution)
        );
        formData.append(
          "stream_channels",
          JSON.stringify(
            data.stream_channels?.filter((s) => s.trim() !== "") || []
          )
        );
        formData.append("stages", JSON.stringify(data.stages));

        const response = await fetch(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/edit-event/`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
            },
            body: formData,
          }
        );

        const contentType = response.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
          const textResponse = await response.text();
          console.error("Non-JSON Response:", textResponse);
          toast.error("Server error: Unexpected response format.", {
            duration: 5000,
          });
          return;
        }

        const res = await response.json();

        if (response.ok) {
          toast.success(
            `Event "${data.event_name}" saved as ${
              data.save_to_drafts ? "Draft" : "Published"
            } successfully!`,
            { duration: 4000 }
          );
        } else {
          const errorMessage = res.message || res.detail || res.error;

          if (response.status === 400) {
            toast.error(
              <div className="space-y-1">
                <p className="font-semibold">Validation Error</p>
                <p className="text-sm">{errorMessage}</p>
              </div>,
              { duration: 5000 }
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

          console.error("Server Error:", res);
        }
      } catch (error: any) {
        console.error("Error:", error);

        if (
          error.message === "Failed to fetch" ||
          error.message.includes("NetworkError")
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

  if (initialLoading || !eventDetails) {
    return <FullLoader />;
  }

  return (
    <div>
      <GroupResultModal
        isOpen={isResultsModalOpen}
        onOpenChange={setIsResultsModalOpen}
        activeGroup={selectedGroupForResult}
      />
      <SeedStageModal
        isOpen={isSeedModalOpen}
        onOpenChange={setIsSeedModalOpen}
        activeGroup={selectedGroupForSeed}
        onConfirm={handleConfirmSeed}
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

            {/* ACTIONS TAB */}
            <TabsContent value="actions">
              <Card>
                <CardHeader>
                  <CardTitle>Actions</CardTitle>
                </CardHeader>
                <CardContent>
                  <Button
                    type="button"
                    onClick={() => setOpenConfirmStartTournamentModal(true)}
                    className="w-full"
                    disabled={
                      eventDetails.stages[0]?.stage_status === "ongoing"
                    }
                  >
                    {eventDetails.stages[0]?.stage_status === "ongoing"
                      ? "Tournament started"
                      : "Start this tournament"}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            {/* BASIC INFO TAB */}
            <TabsContent value="basic_info">
              <Card className="bg-primary/10">
                <CardHeader>
                  <CardTitle>Event Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="event_name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Event Name</FormLabel>
                          <Input {...field} />
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="max_teams_or_players"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Max Teams/Players</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              value={
                                field.value === undefined ||
                                field.value === null ||
                                field.value === 0
                                  ? ""
                                  : field.value.toString()
                              }
                              onChange={(e) => {
                                const val = e.target.value;
                                field.onChange(val);
                              }}
                              placeholder="e.g., 128"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="competition_type"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Competition Type</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="tournament">
                                Tournament
                              </SelectItem>
                              <SelectItem value="scrims">Scrims</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="participant_type"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Participant Type</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="solo">Solo</SelectItem>
                              <SelectItem value="duo">Duo</SelectItem>
                              <SelectItem value="squad">Squad</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="event_mode"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Event Mode</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select mode" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="virtual">Virtual</SelectItem>
                              <SelectItem value="physical">
                                Physical (LAN)
                              </SelectItem>
                              <SelectItem value="hybrid">Hybrid</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="event_type"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Event Type</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="internal">
                                Internal event
                              </SelectItem>
                              <SelectItem value="external">
                                External event
                              </SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {eventType && (
                    <FormField
                      control={form.control}
                      name="registration_link"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            Registration Link (Required for External)
                          </FormLabel>
                          <Input
                            {...field}
                            placeholder="https://registration.example.com"
                          />
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  <div className="space-y-2">
                    <FormLabel>Streaming Channel Links</FormLabel>
                    {streamFields.map((field, index) => (
                      <div key={field.id} className="flex gap-2 items-center">
                        <FormField
                          control={form.control}
                          name={`stream_channels.${index}`}
                          render={({ field }) => (
                            <Input
                              {...field}
                              className="flex-1"
                              placeholder="https://..."
                            />
                          )}
                        />
                        <Button
                          type="button"
                          variant="destructive"
                          size="md"
                          className="h-11"
                          onClick={() => removeStreamChannel(index)}
                        >
                          Remove
                        </Button>
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addStreamChannel}
                    >
                      + Add Streaming Link
                    </Button>
                  </div>

                  <FormField
                    control={form.control}
                    name="banner"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tournament Banner</FormLabel>
                        <FormControl>
                          <div className="space-y-4">
                            {!previewUrl ? (
                              <div
                                onDragOver={(e) => {
                                  e.preventDefault();
                                  setIsDragging(true);
                                }}
                                onDragLeave={(e) => {
                                  e.preventDefault();
                                  setIsDragging(false);
                                }}
                                onDrop={(e) => {
                                  e.preventDefault();
                                  setIsDragging(false);
                                  const file = e.dataTransfer.files?.[0];
                                  if (file) {
                                    if (
                                      ![
                                        "image/png",
                                        "image/jpeg",
                                        "image/jpg",
                                        "image/webp",
                                      ].includes(file.type)
                                    ) {
                                      toast.error(
                                        "Only PNG, JPG, JPEG, or WEBP files are supported."
                                      );
                                      return;
                                    }
                                    setSelectedFile(file);
                                    setPreviewUrl(URL.createObjectURL(file));
                                  }
                                }}
                                className={`border-2 bg-muted border-dashed rounded-md p-12 text-center transition-colors cursor-pointer ${
                                  isDragging
                                    ? "border-primary bg-primary/5"
                                    : "border-gray-300 bg-gray-50"
                                }`}
                                onClick={() => fileInputRef.current?.click()}
                              >
                                <div className="flex flex-col items-center gap-3">
                                  <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                                    <IconPhoto
                                      size={32}
                                      className="text-primary dark:text-white"
                                    />
                                  </div>
                                  <p className="text-sm text-muted-foreground">
                                    Drop your image here, or{" "}
                                    <span className="text-primary font-medium hover:underline">
                                      browse
                                    </span>
                                  </p>
                                  <p className="text-xs text-muted-foreground mt-1">
                                    Supports: PNG, JPG, JPEG, WEBP
                                  </p>
                                </div>
                              </div>
                            ) : (
                              <div className="space-y-4">
                                <div className="relative w-full aspect-video bg-gray-50 border rounded-md flex items-center justify-center overflow-hidden">
                                  <Image
                                    width={1000}
                                    height={1000}
                                    src={previewUrl}
                                    alt="Featured image"
                                    className="aspect-video size-full object-cover"
                                  />
                                </div>

                                <div className="flex gap-2">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    className="flex-1"
                                    onClick={() => {
                                      setSelectedFile(null);
                                      setPreviewUrl("");
                                      field.onChange("");
                                      if (fileInputRef.current) {
                                        fileInputRef.current.value = "";
                                      }
                                    }}
                                  >
                                    <IconX size={16} className="mr-2" />
                                    Remove
                                  </Button>

                                  <Button
                                    type="button"
                                    variant="outline"
                                    className="flex-1"
                                    onClick={() =>
                                      fileInputRef.current?.click()
                                    }
                                  >
                                    <IconUpload size={16} className="mr-2" />
                                    Replace
                                  </Button>
                                </div>
                              </div>
                            )}

                            <input
                              ref={fileInputRef}
                              type="file"
                              accept="image/png,image/jpeg,image/jpg,image/webp"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;

                                if (
                                  ![
                                    "image/png",
                                    "image/jpeg",
                                    "image/jpg",
                                    "image/webp",
                                  ].includes(file.type)
                                ) {
                                  toast.error(
                                    "Only PNG, JPG, JPEG, or WEBP files are supported."
                                  );
                                  return;
                                }

                                setSelectedFile(file);
                                setPreviewUrl(URL.createObjectURL(file));
                              }}
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="registration_open_date"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Registration Opens</FormLabel>
                          <Input type="date" {...field} />
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="registration_end_date"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Registration Closes</FormLabel>
                          <Input type="date" {...field} />
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="start_date"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Event Start Date</FormLabel>
                          <Input type="date" {...field} />
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="end_date"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Event End Date</FormLabel>
                          <Input type="date" {...field} />
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="space-y-3 pt-4 border-t">
                    <FormLabel>Publish Options</FormLabel>
                    <FormField
                      control={form.control}
                      name="publish_to_tournaments"
                      render={({ field }) => (
                        <FormItem className="flex items-center gap-3 p-4 border rounded-lg">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              disabled={saveToDraftsWatch}
                            />
                          </FormControl>
                          <FormLabel className="!mt-0 cursor-pointer">
                            Publish to Tournaments
                          </FormLabel>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="save_to_drafts"
                      render={({ field }) => (
                        <FormItem className="flex items-center gap-3 p-4 border rounded-lg">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              disabled={
                                publishToTournamentsWatch || publishToNewsWatch
                              }
                            />
                          </FormControl>
                          <FormLabel className="!mt-0 cursor-pointer">
                            Save as Draft
                          </FormLabel>
                        </FormItem>
                      )}
                    />
                  </div>

                  <Button
                    type="button"
                    onClick={async () => {
                      const currentStages = form.getValues("stages");
                      const validation = validateStageData(currentStages);

                      if (!validation.isValid) {
                        showValidationErrors(
                          validation.errors,
                          (stageIndex) => {
                            setCurrentTab("stages_groups");
                            if (stageIndex !== undefined) {
                              openAddStageModalLogic(stageIndex);
                            }
                          }
                        );
                        return;
                      }

                      await onSubmit(form.getValues());
                    }}
                    disabled={isPending}
                  >
                    {isPending ? <Loader text="Saving..." /> : "Save Changes"}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            {/* REGISTERED TEAMS TAB */}
            <TabsContent value="registered_teams">
              <Card>
                <CardHeader>
                  <CardTitle>
                    Registered Teams/Players (
                    {eventDetails?.registered_competitors.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="relative">
                  <div className="overflow-x-auto rounded-md border max-h-96 overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Players</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {eventDetails?.registered_competitors.map((comp) => (
                          <TableRow key={comp.player_id}>
                            <TableCell className="capitalize">
                              {comp.username}
                            </TableCell>
                            <TableCell className="capitalize">
                              {comp.status}
                            </TableCell>
                            <TableCell className="text-right">
                              {comp.status === "registered" ? (
                                <DisqualifyModal
                                  competitor_id={comp.player_id}
                                  event_id={eventDetails.event_id}
                                  name={comp.username}
                                  showLabel
                                  onSuccess={() =>
                                    updateCompetitorStatus(
                                      comp.player_id,
                                      "disqualified"
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
                                    updateCompetitorStatus(
                                      comp.player_id,
                                      "registered"
                                    )
                                  }
                                />
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* STAGES & GROUPS TAB */}
            <TabsContent value="stages_groups" className="space-y-4">
              {form.watch("stages").map((stage, sIdx) => {
                if (!stage || typeof stage !== "object") {
                  return (
                    <Card key={sIdx} className="bg-yellow-50 border-yellow-200">
                      <CardContent className="p-4">
                        <p className="text-yellow-800">
                          ⚠️ Stage {sIdx + 1} is not configured.
                          <Button
                            type="button"
                            variant="link"
                            onClick={() => openAddStageModalLogic(sIdx)}
                          >
                            Click here to configure
                          </Button>
                        </p>
                      </CardContent>
                    </Card>
                  );
                }

                return (
                  <Card key={sIdx} className="bg-primary/10">
                    <CardHeader className="flex flex-row items-center justify-between">
                      <div className="space-y-1 w-full">
                        <CardTitle className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 md:gap-2">
                          <div>
                            <span>
                              <IconTrophy className="inline-block mr-2" />
                              {stage.stage_name}{" "}
                              <Badge className="capitalize">
                                {stage.stage_status || "upcoming"}
                              </Badge>
                            </span>
                            <p className="text-xs mt-1 text-muted-foreground">
                              {formatDate(stage.start_date)} →{" "}
                              {formatDate(stage.end_date)} |{" "}
                              {formattedWord[stage.stage_format]} |{" "}
                              {stage.teams_qualifying_from_stage} teams qualify
                            </p>
                          </div>

                          <div className="flex items-center gap-2 w-full md:w-auto">
                            <Button
                              type="button"
                              variant="outline"
                              className="flex-1 md:flex-none"
                              onClick={() => openAddStageModalLogic(sIdx)}
                            >
                              <Edit className="w-3 h-3 mr-1" />
                              Edit Details
                            </Button>

                            <Button
                              type="button"
                              variant="destructive"
                              size="icon"
                              onClick={() => handleRemoveStage(sIdx)}
                              disabled={form.watch("stages").length <= 1}
                              title={
                                form.watch("stages").length <= 1
                                  ? "Cannot remove the last stage"
                                  : "Remove this stage"
                              }
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </CardTitle>
                      </div>
                    </CardHeader>

                    <CardContent className="space-y-2 max-h-96 overflow-auto">
                      {stage.groups.map((group, gIdx) => (
                        <Card key={gIdx} className="bg-primary/10 gap-0">
                          <CardHeader>
                            <CardTitle>{group?.group_name}</CardTitle>
                          </CardHeader>
                          <CardContent className="pt-2 text-muted-foreground text-sm space-y-2">
                            <div className="space-y-1">
                              <p>
                                {formatDate(group?.playing_date)} at{" "}
                                {group?.playing_time}
                              </p>
                              <p className="text-primary">
                                Maps:{" "}
                                {group?.match_maps?.join(", ") || (
                                  <span className="italic">
                                    No maps selected
                                  </span>
                                )}
                              </p>
                              <p>
                                {group?.total_teams_in_group ||
                                  group?.competitors_in_group?.length}{" "}
                                {group?.total_teams_in_group === 0
                                  ? "Players"
                                  : "Teams"}{" "}
                                | {group?.teams_qualifying} qualify
                              </p>
                            </div>
                            <div className="w-full">
                              <Card className="bg-primary/10 gap-0">
                                <CardHeader>
                                  <CardTitle>Players</CardTitle>
                                </CardHeader>
                                <CardContent className="pt-1 max-h-40 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-1 mt-1.5">
                                  {group?.competitors_in_group?.map(
                                    (competitor, index) => (
                                      <Card
                                        className="w-full py-4 px-0 bg-primary/10"
                                        key={index}
                                      >
                                        <CardContent>
                                          <CardTitle className="text-sm">
                                            {competitor}
                                          </CardTitle>
                                        </CardContent>
                                      </Card>
                                    )
                                  )}
                                </CardContent>
                              </Card>
                            </div>
                            <div className="flex w-full lg:w-auto items-start gap-2">
                              <Button
                                variant="secondary"
                                type="button"
                                size="md"
                                className="flex-1"
                                onClick={() => {
                                  setSelectedGroupForResult(group);
                                  setIsResultsModalOpen(true);
                                }}
                              >
                                View Results
                              </Button>
                              <Button
                                size="md"
                                type="button"
                                className="flex-1"
                                onClick={() => {
                                  setSelectedGroupForSeed(group);
                                  setIsSeedModalOpen(true);
                                }}
                              >
                                Seed to Next Stage
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </CardContent>
                  </Card>
                );
              })}

              <div className="flex justify-center p-4 border-2 border-dashed rounded-lg border-primary/20 hover:border-primary/50 transition-colors">
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full h-full py-4 text-primary"
                  onClick={addNewStage}
                >
                  <IconTrophy className="mr-2 h-5 w-5" />
                  Add New Stage
                </Button>
              </div>

              <Button
                type="button"
                onClick={async () => {
                  const currentStages = form.getValues("stages");
                  const validation = validateStageData(currentStages);

                  if (!validation.isValid) {
                    showValidationErrors(validation.errors, (stageIndex) => {
                      if (stageIndex !== undefined) {
                        openAddStageModalLogic(stageIndex);
                      }
                    });
                    return;
                  }

                  await onSubmit(form.getValues());
                }}
                disabled={isPending}
              >
                {isPending ? <Loader text="Saving..." /> : "Save Changes"}
              </Button>
            </TabsContent>

            {/* PRIZE & RULES TAB */}
            <TabsContent value="prize_rules">
              <Card>
                <CardHeader>
                  <CardTitle>Prize Pool & Rules</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <FormField
                    control={form.control}
                    name="prizepool"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Total Prize Pool</FormLabel>
                        <Input
                          type="text"
                          {...field}
                          placeholder="e.g., 50000"
                        />
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Separator />

                  <div className="space-y-3">
                    <FormLabel>Prize Distribution</FormLabel>
                    {Object.entries(prizeDistribution).map(([key, value]) => (
                      <div key={key} className="grid grid-cols-4 gap-2">
                        <Input
                          value={formatPrizeKey(key)}
                          disabled
                          className="col-span-1"
                        />
                        <div className="col-span-3 flex items-center justify-end gap-1">
                          <Input
                            type="number"
                            value={value === 0 ? "" : value}
                            onChange={(e) => {
                              const inputVal = e.target.value;
                              const updated = { ...prizeDistribution };
                              updated[key] =
                                inputVal === "" ? 0 : Number(inputVal);
                              form.setValue("prize_distribution", updated, {
                                shouldDirty: true,
                              });
                            }}
                            placeholder="Earnings"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removePrizePosition(key)}
                            disabled={
                              Object.keys(prizeDistribution).length <= 1
                            }
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      onClick={addPrizePosition}
                    >
                      + Add Prize Position
                    </Button>
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <FormLabel>Tournament Rules</FormLabel>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant={
                          rulesInputMethod === "type" ? "default" : "outline"
                        }
                        onClick={() => setRulesInputMethod("type")}
                      >
                        Type Rules
                      </Button>
                      <Button
                        type="button"
                        variant={
                          rulesInputMethod === "upload" ? "default" : "outline"
                        }
                        onClick={() => setRulesInputMethod("upload")}
                      >
                        Upload Document
                      </Button>
                    </div>

                    {rulesInputMethod === "type" ? (
                      <FormField
                        control={form.control}
                        name="event_rules"
                        render={({ field }) => (
                          <FormItem>
                            <Textarea
                              {...field}
                              rows={10}
                              placeholder="Enter event rules..."
                              onFocus={() =>
                                form.setValue("rules_document", "")
                              }
                            />
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    ) : (
                      <FormField
                        control={form.control}
                        name="rules_document"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Upload Rules Document</FormLabel>
                            <FormControl>
                              <div className="space-y-4">
                                {!previewRuleUrl ? (
                                  <div
                                    onDragOver={(e) => {
                                      e.preventDefault();
                                      setIsDragging(true);
                                    }}
                                    onDragLeave={(e) => {
                                      e.preventDefault();
                                      setIsDragging(false);
                                    }}
                                    onDrop={(e) => {
                                      e.preventDefault();
                                      setIsDragging(false);
                                      const file = e.dataTransfer.files?.[0];
                                      if (file) {
                                        const supportedTypes = [
                                          "application/pdf",
                                          "application/msword",
                                          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                                        ];
                                        if (
                                          !supportedTypes.includes(file.type)
                                        ) {
                                          toast.error(
                                            "Only PDF, DOC, or DOCX files are supported."
                                          );
                                          return;
                                        }
                                        setSelectedRuleFile(file);
                                        setPreviewRuleUrl(
                                          URL.createObjectURL(file)
                                        );
                                      }
                                    }}
                                    className={`border-2 bg-muted border-dashed rounded-md p-12 text-center transition-colors cursor-pointer ${
                                      isDragging
                                        ? "border-primary bg-primary/5"
                                        : "border-gray-300 bg-gray-50"
                                    }`}
                                    onClick={() =>
                                      rulesFileInputRef.current?.click()
                                    }
                                  >
                                    <div className="flex flex-col items-center gap-3">
                                      <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                                        <IconFileText
                                          size={32}
                                          className="text-primary dark:text-white"
                                        />
                                      </div>
                                      <p className="text-sm text-muted-foreground">
                                        Drop your document here, or{" "}
                                        <span className="text-primary font-medium hover:underline">
                                          browse
                                        </span>
                                      </p>
                                      <p className="text-xs text-muted-foreground mt-1">
                                        Supports: PDF, DOC, DOCX
                                      </p>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="space-y-4">
                                    <div className="relative w-full aspect-video bg-gray-50 border rounded-md flex flex-col items-center justify-center p-8">
                                      <IconFile
                                        size={64}
                                        className="text-primary"
                                      />
                                      <p className="text-sm font-medium mt-2">
                                        {selectedRuleFile?.name ||
                                          "Rules Document Uploaded"}
                                      </p>
                                      <p className="text-xs text-muted-foreground">
                                        File Size:{" "}
                                        {(
                                          (selectedRuleFile?.size || 0) /
                                          1024 /
                                          1024
                                        ).toFixed(2)}{" "}
                                        MB
                                      </p>
                                    </div>

                                    <div className="flex gap-2">
                                      <Button
                                        type="button"
                                        variant="outline"
                                        className="flex-1"
                                        onClick={() => {
                                          setSelectedRuleFile(null);
                                          setPreviewRuleUrl("");
                                          field.onChange("");
                                          if (rulesFileInputRef.current) {
                                            rulesFileInputRef.current.value =
                                              "";
                                          }
                                        }}
                                      >
                                        <IconX size={16} className="mr-2" />
                                        Remove
                                      </Button>

                                      <Button
                                        type="button"
                                        variant="outline"
                                        className="flex-1"
                                        onClick={() =>
                                          rulesFileInputRef.current?.click()
                                        }
                                      >
                                        <IconUpload
                                          size={16}
                                          className="mr-2"
                                        />
                                        Replace
                                      </Button>
                                    </div>
                                  </div>
                                )}

                                <input
                                  ref={rulesFileInputRef}
                                  type="file"
                                  accept=".pdf,application/pdf,.doc,application/msword,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                                  className="hidden"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (!file) return;

                                    const supportedTypes = [
                                      "application/pdf",
                                      "application/msword",
                                      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                                    ];

                                    if (!supportedTypes.includes(file.type)) {
                                      toast.error(
                                        "Only PDF, DOC, or DOCX files are supported."
                                      );
                                      return;
                                    }

                                    setSelectedRuleFile(file);
                                    field.onChange(file);
                                    setPreviewRuleUrl(
                                      URL.createObjectURL(file)
                                    );
                                  }}
                                />
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}
                  </div>

                  <Button
                    type="button"
                    onClick={async () => {
                      const currentStages = form.getValues("stages");
                      const validation = validateStageData(currentStages);

                      if (!validation.isValid) {
                        showValidationErrors(
                          validation.errors,
                          (stageIndex) => {
                            setCurrentTab("stages_groups");
                            if (stageIndex !== undefined) {
                              openAddStageModalLogic(stageIndex);
                            }
                          }
                        );
                        return;
                      }

                      await onSubmit(form.getValues());
                    }}
                    disabled={isPending}
                  >
                    {isPending ? <Loader text="Saving..." /> : "Save Changes"}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </form>

        {/* STAGE CONFIG MODAL */}
        <Dialog open={isStageModalOpen} onOpenChange={setIsStageModalOpen}>
          <DialogContent className="flex max-h-[90vh] overflow-auto justify-start flex-col gap-0">
            <DialogHeader>
              <DialogTitle>
                {stageModalStep === 1 ? "Stage Details" : "Configure Groups"}
              </DialogTitle>
              <p className="text-sm text-muted-foreground mb-4">
                Step {stageModalStep} of 2 (Configuration for{" "}
                {editingStageIndex !== null
                  ? stageNames[editingStageIndex]
                  : "New Stage"}
                )
              </p>
            </DialogHeader>

            {stageModalStep === 1 && (
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Stage Name
                  </label>
                  <Input
                    value={stageModalData.stage_name}
                    onChange={(e) =>
                      setStageModalData({
                        ...stageModalData,
                        stage_name: e.target.value,
                      })
                    }
                    placeholder="e.g., Group Stage, Finals"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">
                      Start Date
                    </label>
                    <Input
                      type="date"
                      value={stageModalData.start_date}
                      onChange={(e) =>
                        setStageModalData({
                          ...stageModalData,
                          start_date: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">
                      End Date
                    </label>
                    <Input
                      type="date"
                      value={stageModalData.end_date}
                      onChange={(e) =>
                        setStageModalData({
                          ...stageModalData,
                          end_date: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Stage Format
                  </label>
                  <Select
                    value={stageModalData.stage_format}
                    onValueChange={(value) =>
                      setStageModalData({
                        ...stageModalData,
                        stage_format: value,
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select format" />
                    </SelectTrigger>
                    <SelectContent>
                      {STAGE_FORMATS.map((format) => (
                        <SelectItem key={format} value={format}>
                          {formattedWord[format]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Teams Qualifying from this Stage
                  </label>
                  <Input
                    type="number"
                    min={0}
                    value={
                      stageModalData.teams_qualifying_from_stage ===
                        undefined ||
                      stageModalData.teams_qualifying_from_stage === 0
                        ? ""
                        : stageModalData.teams_qualifying_from_stage
                    }
                    onChange={(e) => {
                      const val = e.target.value;
                      setStageModalData({
                        ...stageModalData,
                        teams_qualifying_from_stage:
                          val === "" ? 0 : Number(val),
                      });
                    }}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Number of Groups
                  </label>
                  <Input
                    type="number"
                    min={1}
                    value={
                      stageModalData.number_of_groups === 0
                        ? ""
                        : stageModalData.number_of_groups
                    }
                    onChange={(e) =>
                      handleGroupCountChangeLogic(
                        e.target.value === "" ? 0 : Number(e.target.value)
                      )
                    }
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Stage Discord Role ID
                  </label>
                  <Input
                    value={stageModalData.stage_discord_role_id}
                    onChange={(e) =>
                      setStageModalData({
                        ...stageModalData,
                        stage_discord_role_id: e.target.value,
                      })
                    }
                    placeholder="e.g: 1234567890"
                  />
                </div>

                <div className="pt-4 border-t">
                  <p className="text-xs text-muted-foreground mb-3">
                    You will configure {stageModalData.number_of_groups}{" "}
                    group(s) in the next step
                  </p>
                  <div className="flex gap-2 flex-wrap">
                    {tempGroups
                      .slice(0, stageModalData.number_of_groups)
                      .map((group, i) => (
                        <div
                          key={i}
                          className="px-3 py-1 bg-primary/10 border border-primary rounded-md text-xs"
                        >
                          {group.group_name}
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            )}

            {stageModalStep === 2 && (
              <div className="space-y-2">
                <div className="bg-primary/10 border border-primary/50 rounded-lg p-4">
                  <p className="text-sm">
                    <span className="font-semibold">Stage:</span>{" "}
                    {stageModalData.stage_name}
                  </p>
                  <p className="text-sm text-zinc-400">
                    {stageModalData.start_date} to {stageModalData.end_date} •{" "}
                    {formattedWord[stageModalData.stage_format]}
                  </p>
                </div>

                {tempGroups.map((group, index) => (
                  <div key={index} className="border rounded-lg p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold">Group {index + 1}</h4>
                      <span className="text-xs text-zinc-500">
                        {group.group_name}
                      </span>
                    </div>

                    <div>
                      <label className="text-sm font-medium mb-2 block">
                        Group Name
                      </label>
                      <Input
                        value={group.group_name}
                        onChange={(e) =>
                          updateGroupDetailLogic(
                            index,
                            "group_name",
                            e.target.value
                          )
                        }
                        placeholder={`Group ${index + 1}`}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium mb-2 block">
                          Playing Date
                        </label>
                        <Input
                          type="date"
                          value={group.playing_date}
                          onChange={(e) =>
                            updateGroupDetailLogic(
                              index,
                              "playing_date",
                              e.target.value
                            )
                          }
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-2 block">
                          Playing Time
                        </label>
                        <Input
                          type="time"
                          value={group.playing_time}
                          onChange={(e) =>
                            updateGroupDetailLogic(
                              index,
                              "playing_time",
                              e.target.value
                            )
                          }
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-sm font-medium mb-2 block">
                        Teams Qualifying from this Group
                      </label>
                      <Input
                        type="number"
                        min={1}
                        value={
                          group.teams_qualifying === 0
                            ? ""
                            : group.teams_qualifying
                        }
                        onChange={(e) =>
                          updateGroupDetailLogic(
                            index,
                            "teams_qualifying",
                            e.target.value === "" ? 0 : Number(e.target.value)
                          )
                        }
                      />
                    </div>

                    <div>
                      <label className="text-sm font-medium mb-2 block">
                        Match count
                      </label>
                      <Input
                        type="number"
                        min={1}
                        value={group.match_count === 0 ? "" : group.match_count}
                        onChange={(e) =>
                          updateGroupDetailLogic(
                            index,
                            "match_count",
                            e.target.value === "" ? 0 : Number(e.target.value)
                          )
                        }
                      />
                    </div>

                    <div>
                      <label className="text-sm font-medium mb-2 block">
                        Discord Role ID
                      </label>
                      <Input
                        value={group.group_discord_role_id}
                        onChange={(e) =>
                          updateGroupDetailLogic(
                            index,
                            "group_discord_role_id",
                            e.target.value
                          )
                        }
                        placeholder="e.g: 1234567890"
                      />
                    </div>

                    <div>
                      <label className="text-sm font-medium mb-2 block">
                        Maps to be Played{" "}
                        <span className="text-red-500">*</span>
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {AVAILABLE_MAPS.map((map) => {
                          const isSelected =
                            group.match_maps?.includes(map) || false;
                          return (
                            <Badge
                              key={map}
                              onClick={() => toggleMapSelection(index, map)}
                              className={`cursor-pointer ${
                                isSelected
                                  ? "border-primary bg-primary/10 text-primary"
                                  : "border-gray-300 bg-muted hover:border-primary/50"
                              }`}
                            >
                              {map}
                              {isSelected && <span className="ml-1">✓</span>}
                            </Badge>
                          );
                        })}
                      </div>
                      {(!group.match_maps || group.match_maps.length === 0) && (
                        <p className="text-xs text-red-500 mt-1">
                          Please select at least one map
                        </p>
                      )}
                      {group.match_maps && group.match_maps.length > 0 && (
                        <p className="text-xs text-muted-foreground mt-2">
                          Selected: {group.match_maps.join(", ")}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="text-sm font-medium mb-2 block">
                        Room ID
                      </label>
                      <Input
                        value={group.room_id}
                        onChange={(e) =>
                          updateGroupDetailLogic(
                            index,
                            "room_id",
                            e.target.value
                          )
                        }
                        placeholder={`Room ${index + 1}`}
                      />
                    </div>

                    <div>
                      <label className="text-sm font-medium mb-2 block">
                        Room name
                      </label>
                      <Input
                        value={group.room_name}
                        onChange={(e) =>
                          updateGroupDetailLogic(
                            index,
                            "room_name",
                            e.target.value
                          )
                        }
                        placeholder="Room name"
                      />
                    </div>

                    <div>
                      <label className="text-sm font-medium mb-2 block">
                        Room password
                      </label>
                      <div className="relative">
                        <Input
                          type={passwordVisibility[index] ? "text" : "password"}
                          value={group.room_password || ""}
                          onChange={(e) =>
                            updateGroupDetailLogic(
                              index,
                              "room_password",
                              e.target.value
                            )
                          }
                          className="pr-10"
                          placeholder="Enter room password"
                        />
                        <Button
                          className="absolute top-[50%] translate-y-[-50%] end-1 text-muted-foreground/80"
                          variant="ghost"
                          size="icon"
                          type="button"
                          onClick={() => toggleVisibility(index)}
                          aria-label={
                            passwordVisibility[index]
                              ? "Hide password"
                              : "Show password"
                          }
                        >
                          {passwordVisibility[index] ? (
                            <EyeOffIcon className="size-4" />
                          ) : (
                            <EyeIcon className="size-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <DialogFooter className="flex justify-between mt-4">
              <div>
                {stageModalStep === 2 && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setStageModalStep(1)}
                    className="w-full"
                  >
                    Back
                  </Button>
                )}
              </div>

              <div className="flex justify-between items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setIsStageModalOpen(false);
                    setStageModalStep(1);
                  }}
                >
                  Cancel
                </Button>

                {stageModalStep === 1 ? (
                  <Button
                    type="button"
                    onClick={() => {
                      if (
                        !stageModalData.stage_name ||
                        !stageModalData.stage_format ||
                        !stageModalData.start_date ||
                        !stageModalData.end_date ||
                        !stageModalData.stage_discord_role_id ||
                        stageModalData.teams_qualifying_from_stage === undefined
                      ) {
                        toast.error(
                          "Please fill all required stage fields (Step 1)"
                        );
                        return;
                      }
                      if (stageModalData.number_of_groups < 1) {
                        toast.error("Number of groups must be at least 1.");
                        return;
                      }
                      setStageModalStep(2);
                    }}
                  >
                    Next: Configure Groups
                  </Button>
                ) : (
                  <Button type="button" onClick={handleSaveStageLogic}>
                    Save Stage
                  </Button>
                )}
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* REMOVE STAGE CONFIRMATION MODAL */}
        <Dialog
          open={isRemoveConfirmOpen}
          onOpenChange={setIsRemoveConfirmOpen}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="w-5 h-5" />
                Remove Stage?
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <p className="text-sm text-muted-foreground">
                Are you sure you want to remove{" "}
                <span className="font-semibold text-foreground">
                  "
                  {stageToRemove !== null
                    ? form.watch("stages")[stageToRemove]?.stage_name ||
                      `Stage ${stageToRemove + 1}`
                    : ""}
                  "
                </span>
                ?
              </p>

              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
                <p className="text-sm text-destructive font-medium">
                  ⚠️ This action cannot be undone
                </p>
                <ul className="text-xs text-muted-foreground mt-2 space-y-1 ml-4 list-disc">
                  <li>All groups in this stage will be removed</li>
                  <li>All match data will be lost</li>
                  <li>Stage order will be updated automatically</li>
                </ul>
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsRemoveConfirmOpen(false);
                  setStageToRemove(null);
                }}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={confirmRemoveStage}
                disabled={loadingRemove}
              >
                {loadingRemove ? (
                  <Loader text="Removing..." />
                ) : (
                  <>
                    <Trash2 className="w-4 h-4 mr-2" />
                    Remove Stage
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* CONFIRM START TOURNAMENT MODAL */}
        {openConfirmStartTournamentModal && (
          <ConfirmStartTournamentModal
            open={openConfirmStartTournamentModal}
            eventId={eventDetails.event_id}
            eventName={eventDetails.event_name}
            stageId={eventDetails.stages[0]?.stage_id}
            onClose={() => setOpenConfirmStartTournamentModal(false)}
          />
        )}
      </Form>
    </div>
  );
}
