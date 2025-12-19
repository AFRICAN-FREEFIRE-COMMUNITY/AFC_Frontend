"use client";

import React, { useState, useTransition, useRef, useEffect, use } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { optional, z } from "zod";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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
import {
  Trash2,
  ChevronUp,
  ChevronDown,
  Upload,
  Edit,
  User,
  Users,
  AlertTriangle,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { useAuth } from "@/contexts/AuthContext";
import { env } from "@/lib/env";
import { Separator } from "@/components/ui/separator";
import axios from "axios";
import { ComingSoon } from "@/components/ComingSoon";
import {
  IconFile,
  IconFileText,
  IconPhoto,
  IconTrophy,
  IconUpload,
  IconUserMinus,
  IconX,
} from "@tabler/icons-react";
import Image from "next/image";
import { FullLoader } from "@/components/Loader";
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

interface RegisteredTeamType {
  team_name: string;
  players: string; // Comma-separated list of player usernames
  status: "active" | "disqualified" | "withdrawn";
}

// Define EventFormType and other schemas (omitted for brevity, assume they are present)
const GroupSchema = z.object({
  group_name: z.string().min(1, "Group name required"),
  discordId: z.string().optional(),
  playing_date: z.string().min(1, "Playing date required"),
  playing_time: z.string().min(1, "Playing time required"),
  teams_qualifying: z.coerce.number().min(1, "Must qualify at least 1 team"),
});

const StageSchema = z.object({
  stage_name: z.string().min(1, "Stage name required"),
  discordId: z.string().optional(),
  seeding_method: z.string().optional(),
  start_date: z.string().min(1, "Start date required"),
  end_date: z.string().min(1, "End date required"),
  number_of_groups: z.coerce.number().min(1, "Must have at least 1 group"),
  stage_format: z.string().min(1, "Stage format required"),
  groups: z.array(GroupSchema).min(1, "At least one group required"),
  teams_qualifying_from_stage: z.coerce.number().min(0).optional(),
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
      // Logic: If 'save_to_drafts' is true, ALL publish options must be false.
      if (data.save_to_drafts) {
        return !data.publish_to_tournaments && !data.publish_to_news;
      }
      // Logic: If ANY publish option is true, 'save_to_drafts' must be false.
      if (data.publish_to_tournaments || data.publish_to_news) {
        return !data.save_to_drafts;
      }
      return true; // Allows all other combinations (e.g., all false)
    },
    {
      message:
        "An event cannot be saved as a draft and published simultaneously.",
      path: ["save_to_drafts"], // The error will be attached to the 'save_to_drafts' field
    }
  );

type EventFormType = z.infer<typeof EventFormSchema>;
type StageType = z.infer<typeof StageSchema>;
type GroupType = z.infer<typeof GroupSchema>;

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
  prize_distribution: { [key: string]: number }; // Object mapping position to amount
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
    status: string; // e.g., 'registered'
    // Assuming team_name/region/etc. might be missing for solo/individual registrations
  }>;
  tournament_teams: any[];
  stages: Array<{
    id: number;
    stage_name: string;
    discordId: string;
    seeding_method: string;
    start_date: string;
    end_date: string;
    number_of_groups: number;
    stage_format: string;
    teams_qualifying_from_stage: number;
    groups: Array<{
      id: number;
      group_name: string;
      discordId: string;
      playing_date: string;
      playing_time: string;
      teams_qualifying: number;
      matches: any[];
    }>;
  }>;
}

type Params = {
  id: string;
};

export default function EditEventPage({ params }: { params: Promise<Params> }) {
  const resolvedParams = use(params);
  const { id } = resolvedParams;
  const router = useRouter();
  const searchParams = useSearchParams();
  const eventId = searchParams.get("id");
  const [stageModalStep, setStageModalStep] = useState(1);
  const [tempGroups, setTempGroups] = useState<GroupType[]>([]);
  const [currentTab, setCurrentTab] = useState("basic_info");
  const [isPending, startTransition] = useTransition();
  const [rulesInputMethod, setRulesInputMethod] = useState<"type" | "upload">(
    "type"
  );

  const [isSeedModalOpen, setIsSeedModalOpen] = useState(false);
  const [activeGroup, setActiveGroup] = useState<any>(null);

  const [bannerPreview, setBannerPreview] = useState<string>("");
  const [initialLoading, setInitialLoading] = useState(true);
  const [eventTitle, setEventTitle] = useState("Loading Event...");

  const [stageNames, setStageNames] = useState<string[]>(["Stage 1"]);
  const [isStageModalOpen, setIsStageModalOpen] = useState(false);
  const [editingStageIndex, setEditingStageIndex] = useState<number | null>(
    null
  );
  const [eventDetails, setEventDetails] = useState<EventDetails>();
  const [stageModalData, setStageModalData] = useState({
    stage_name: "",
    start_date: "",
    end_date: "",
    stage_format: "",
    number_of_groups: 2,
    teams_qualifying_from_stage: 1,
    seeding_method: "automatic",
    discordId: "",
  });

  const { token } = useAuth();

  const [previewUrl, setPreviewUrl] = useState<string>(
    eventDetails?.event_banner_url ? eventDetails.event_banner_url : ""
  );

  const [isResultsModalOpen, setIsResultsModalOpen] = useState(false);
  const [selectedGroupForResult, setSelectedGroupForResult] = useState(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedRuleFile, setSelectedRuleFile] = useState<File | null>(null);

  const [previewRuleUrl, setPreviewRuleUrl] = useState<string>("");

  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const rulesFileInputRef = useRef<HTMLInputElement>(null);

  const [selectedGroupForSeed, setSelectedGroupForSeed] = useState(null);

  // 2. Define the confirmation handler
  const handleConfirmSeed = (groupId: number) => {
    console.log("Seeding teams for group:", groupId);
    // Add your API call here
    setIsSeedModalOpen(false);
    toast.success("Teams seeded successfully!");
  };

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
      stages: [],
      prizepool: "",
      prize_distribution: { "1": 0, "2": 0, "3": 0 }, // <-- FIXED SIMPLE KEYS      event_rules: "",
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

  useEffect(() => {
    if (!id) return;

    startTransition(async () => {
      try {
        const decodedId = decodeURIComponent(id);
        const res = await axios.post(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/get-event-details/`,
          { event_id: decodedId },
          {
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
          }
        );
        const fetchedDetails: EventDetails = res.data.event_details;

        if (fetchedDetails.stages) {
          const names = fetchedDetails.stages.map((s: any) => s.stage_name);
          setStageNames(names);
        }

        setEventDetails(fetchedDetails);
      } catch (error: any) {
        const errorMessage =
          error.response?.data?.message ||
          error.response?.data?.detail ||
          "Failed to fetch event details.";
        toast.error(errorMessage);
        router.push("/login");
      }
    });
  }, [id]);

  // Update form values when teamDetails changes
  useEffect(() => {
    if (eventDetails) {
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
        stages: eventDetails.stages || [],
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

  useEffect(() => {
    if (!eventId) {
      setInitialLoading(false);
      setEventTitle("Edit Event");
      return;
    }
  }, [eventId, form]); // eslint-disable-line react-hooks/exhaustive-deps

  const {
    fields: streamFields,
    append: appendStream,
    remove: removeStream,
  } = useFieldArray({
    control: form.control,
    name: "stream_channels",
  });

  const stages = form.watch("stages") || [];

  // --- START FIX: Synchronize stages array when count changes ---
  const handleStageCountChangeLogic = (count: number) => {
    const newCount = Math.max(0, count); // Allow 0 for clean typing

    // 1. Update form value for number_of_stages
    form.setValue("number_of_stages", newCount);

    // 2. Synchronize stageNames array (UI display list)
    const newNames = Array.from(
      { length: newCount },
      (_, i) => stageNames[i] || `Stage ${i + 1}`
    );
    setStageNames(newNames);

    // 3. CRITICAL: Synchronize the 'stages' data array
    const currentStages = form.getValues("stages") || [];

    // Truncate the array to the new count. This discards removed stage data.
    const newStages = currentStages.slice(0, newCount);

    // Update the stages array in RHF state
    form.setValue("stages", newStages, {
      shouldDirty: true,
      shouldValidate: true,
    });
  };
  // --- END FIX ---

  const handleStageNameChangeLogic = (index: number, name: string) => {
    const newNames = [...stageNames];
    newNames[index] = name;
    setStageNames(newNames);
  };

  const handleGroupCountChangeLogic = (count: number) => {
    const newCount = Math.max(0, count); // Allow 0 for clean typing

    const newTempGroups = Array.from({ length: newCount }, (_, i) => {
      if (tempGroups[i]) {
        return tempGroups[i];
      }
      return {
        group_name: `Group ${i + 1}`,
        playing_date: stageModalData.start_date || "",
        playing_time: "00:00",
        teams_qualifying: 1,
        discordId: "",
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
    value: string | number
  ) => {
    const newGroups = [...tempGroups];
    newGroups[index] = {
      ...newGroups[index],
      [field]: value,
    };
    setTempGroups(newGroups);
  };

  const eventType = form.watch("event_type") === "external";

  const handleSaveStageLogic = async () => {
    // 1. Stage/Group Validation (Keep this local validation)
    if (
      !stageModalData.stage_name ||
      !stageModalData.stage_format ||
      !stageModalData.start_date ||
      !stageModalData.end_date ||
      stageModalData.teams_qualifying_from_stage === undefined
    ) {
      toast.error("Please fill all required stage fields (Step 1)");
      return;
    }
    const invalidGroup = tempGroups.find(
      (g) =>
        !g.playing_date ||
        !g.playing_time ||
        !g.group_name.trim() ||
        g.teams_qualifying < 1
    );
    if (invalidGroup) {
      toast.error("Please complete all group details correctly (Step 2)");
      return;
    }
    // Final check on group count
    if (stageModalData.number_of_groups < 1) {
      toast.error("A stage must have at least one group.");
      return;
    }

    // 2. Prepare and Update Stage Data
    const newStage: StageType = {
      stage_name: stageModalData.stage_name,
      start_date: stageModalData.start_date,
      end_date: stageModalData.end_date,
      number_of_groups: stageModalData.number_of_groups,
      stage_format: stageModalData.stage_format,
      groups: tempGroups,
      seeding_method: stageModalData.seeding_method,
      discordId: stageModalData.discordId,
      teams_qualifying_from_stage: stageModalData.teams_qualifying_from_stage,
    };

    const currentStages = [...stages];
    currentStages[editingStageIndex!] = newStage;

    // A. Update form value
    form.setValue("stages", currentStages, { shouldDirty: true });

    // Ensure stage names are consistent
    const currentNames = [...stageNames];
    if (currentNames[editingStageIndex!] !== newStage.stage_name) {
      currentNames[editingStageIndex!] = newStage.stage_name;
      setStageNames(currentNames);
    }

    // 3. Trigger Full Form Validation (No need to submit immediately)
    await form.trigger(); // Trigger validation to show errors if other fields are bad

    // 4. Close Modal and Notify User
    setIsStageModalOpen(false);
    setStageModalStep(1);
    toast.success(
      "Stage configuration updated. Click 'Save Changes' to finalize."
    );
  };

  const moveStageLogic = (index: number, direction: "up" | "down") => {
    const currentStages = form.getValues("stages");
    const currentNames = [...stageNames];
    const newIndex = direction === "up" ? index - 1 : index + 1;

    if (newIndex >= 0 && newIndex < currentStages.length) {
      [currentStages[index], currentStages[newIndex]] = [
        currentStages[newIndex],
        currentStages[index],
      ];
      form.setValue("stages", currentStages, { shouldValidate: true });

      [currentNames[index], currentNames[newIndex]] = [
        currentNames[newIndex],
        currentNames[index],
      ];
      setStageNames(currentNames);
      toast.success(`Moved stage ${stageNames[index] || "Stage"} ${direction}`);
    }
  };

  const handleDeleteStageLogic = (index: number) => {
    const currentStages = form.getValues("stages");
    const currentNames = [...stageNames];

    if (currentStages.length > 1) {
      currentStages.splice(index, 1);
      form.setValue("stages", currentStages, { shouldValidate: true });

      currentNames.splice(index, 1);
      setStageNames(currentNames);
      form.setValue("number_of_stages", currentNames.length);
      toast.success("Stage deleted successfully");
    } else {
      toast.error("An event must have at least one stage.");
    }
  };

  const openAddStageModalLogic = (stageIndex: number) => {
    setEditingStageIndex(stageIndex);
    setStageModalStep(1);
    const existingStage = stages[stageIndex];

    if (existingStage) {
      setStageModalData({
        stage_name: existingStage.stage_name,
        start_date: existingStage.start_date,
        end_date: existingStage.end_date,
        stage_format: existingStage.stage_format,
        number_of_groups: existingStage.number_of_groups,
        seeding_method: existingStage.seeding_method || "automatic",
        discordId: existingStage.discordId || "",
        teams_qualifying_from_stage:
          existingStage.teams_qualifying_from_stage || 1,
      });
      setTempGroups(existingStage.groups);
    } else {
      setStageModalData({
        stage_name: stageNames[stageIndex] || `Stage ${stageIndex + 1}`,
        start_date: "",
        end_date: "",
        seeding_method: "automatic",
        discordId: "",
        stage_format: "",
        number_of_groups: 2,
        teams_qualifying_from_stage: 1,
      });
      setTempGroups(
        Array.from({ length: 2 }, (_, i) => ({
          group_name: `Group ${i + 1}`,
          playing_date: "",
          playing_time: "00:00",
          teams_qualifying: 1,
        }))
      );
    }
    setIsStageModalOpen(true);
  };

  // Prize Distribution Logic (Same as original)
  const prizeDistribution = form.watch("prize_distribution") || {};

  const addPrizePosition = () => {
    const current = { ...prizeDistribution };
    // Find next numeric key
    const numericKeys = Object.keys(current)
      .map((key) => parseInt(key.replace(/[^0-9]/g, "")))
      .filter((n) => !isNaN(n));
    const nextPos = (numericKeys.length > 0 ? Math.max(...numericKeys) : 0) + 1;

    form.setValue("prize_distribution", {
      ...current,
      [`${nextPos}`]: 0, // <-- USE SIMPLE KEY
    });
  };

  const addStreamChannel = () => appendStream("");
  const addPrizePositionLogic = () => {
    const current = { ...prizeDistribution };
    const nextPos = Object.keys(current).length + 1;
    const suffix =
      nextPos === 1 ? "st" : nextPos === 2 ? "nd" : nextPos === 3 ? "rd" : "th";
    form.setValue("prize_distribution", {
      ...current,
      [`${nextPos}${suffix} Place`]: 0, // Adjusted key to match image
    });
  };

  const removePrizePositionLogic = (key: string) => {
    if (Object.keys(prizeDistribution).length <= 1) return;
    const current = { ...prizeDistribution };
    delete current[key];
    form.setValue("prize_distribution", current);
  };

  const removeStreamChannelLogic = (index: number) => {
    if (streamFields.length <= 1) return;
    removeStream(index);
  };

  const handleBannerSelectLogic = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => setBannerPreview(reader.result as string);
      reader.readAsDataURL(file);
      form.setValue("banner", file.name);
    } else {
      form.setValue("banner", "");
      setBannerPreview("");
    }
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

  const onSubmit = async (data: EventFormType) => {
    if (!eventDetails?.event_id) return toast.error("Event ID is missing");

    const isValid = await form.trigger();
    if (!isValid) {
      toast.error("Please correct the errors in the form before saving.");
      return;
    }

    startTransition(async () => {
      try {
        const formData = new FormData();

        let finalEventStatus = data.event_status;
        if (data.save_to_drafts) {
          // If the user checked 'Save as Draft', override the status.
          // Assuming your backend recognizes 'draft'
          finalEventStatus = "draft";
        } else if (finalEventStatus === "draft") {
          // If the initial state was 'draft' and the user did NOT check 'Save as Draft',
          // but a different status hasn't been set, revert to 'upcoming' or keep original state.
          // For editing, let's keep the user-selected/default status unless 'Save as Draft' is explicitly checked.
          // We keep the logic simple: if 'save_to_drafts' is checked, it's a draft. Otherwise, use the form's status.
        }

        // NOTE: Many APIs use an explicit 'is_draft: true/false' flag for simplicity.
        // If your backend API expects an explicit 'is_draft' boolean field:
        formData.append("is_draft", data.save_to_drafts.toString());
        // If your backend API expects the status to be changed:
        formData.append("event_status", finalEventStatus);
        // =======================================================

        // Ensure Event ID is the first field and is required for POST/PATCH update logic
        formData.append("event_id", eventDetails.event_id.toString());

        // --- 1. HANDLE FILES ---
        if (selectedFile) {
          formData.append("event_banner", selectedFile);
        }
        if (selectedRuleFile) {
          formData.append("uploaded_rules", selectedRuleFile);
        }

        // --- 2. APPEND PRIMITIVE FIELDS (Non-Draft Related) ---
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
        // formData.append("event_status", finalEventStatus); // ALREADY HANDLED ABOVE
        formData.append("number_of_stages", data.number_of_stages.toString());
        formData.append("start_date", data.start_date);
        formData.append("end_date", data.end_date);
        formData.append("registration_open_date", data.registration_open_date);
        formData.append("registration_end_date", data.registration_end_date);
        formData.append("registration_link", data.registration_link || "");

        // Append Boolean fields as strings
        formData.append(
          "publish_to_tournaments",
          data.publish_to_tournaments.toString()
        );
        formData.append("publish_to_news", data.publish_to_news.toString());
        // formData.append("save_to_drafts", data.save_to_drafts.toString()); // Only use this if backend expects it. Prefer the dedicated 'is_draft' field or 'event_status' change.

        // Append Event Rules Text (CONDITIONAL)
        if (rulesInputMethod === "type") {
          formData.append("event_rules", data.event_rules || "");
          // If typed rules are used, explicitly clear the uploaded_rules field on the backend
          formData.append("uploaded_rules", "");
        } else {
          formData.append("event_rules", "");
        }

        // --- 3. APPEND COMPLEX JSON STRINGS ---
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

        // Stages: Must be stringified array
        formData.append("stages", JSON.stringify(data.stages));

        // --- 4. SUBMISSION ---
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

        // ... (rest of the response handling)
        const contentType = response.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
          const textResponse = await response.text();
          console.error("Non-JSON Response (Backend Error):", textResponse);
          toast.error("Server error: Received unexpected response format.");
          return;
        }

        const res = await response.json();

        if (response.ok) {
          toast.success(
            `Event saved as ${
              data.save_to_drafts ? "Draft" : "Finalized"
            } successfully!`
          );
        } else {
          console.error("Server Error:", res);
          toast.error(
            res.message ||
              res.detail ||
              "Failed to update event. Please check your inputs."
          );
        }
      } catch (error) {
        console.error("Error:", error);
        toast.error("An unexpected error occurred during submission.");
      }
    });
  };

  const saveToDraftsWatch = form.watch("save_to_drafts");
  const publishToTournamentsWatch = form.watch("publish_to_tournaments");
  const publishToNewsWatch = form.watch("publish_to_news");

  const isDraftChecked = saveToDraftsWatch;
  const isPublishChecked = publishToTournamentsWatch || publishToNewsWatch;

  // This effect enforces the mutual exclusivity by resetting the opposite field
  // when one state becomes true.
  useEffect(() => {
    // If draft is checked, uncheck all publish options
    if (isDraftChecked && isPublishChecked) {
      if (publishToTournamentsWatch) {
        form.setValue("publish_to_tournaments", false);
      }
      if (publishToNewsWatch) {
        form.setValue("publish_to_news", false);
      }
      // Show a message to the user that we corrected their choice
      toast.info(
        "Draft mode selected. Publishing options automatically unchecked."
      );
    }
    // If any publish is checked, uncheck draft
    else if (isPublishChecked && isDraftChecked) {
      form.setValue("save_to_drafts", false);
      // Show a message to the user that we corrected their choice
      toast.info("Publishing selected. Draft mode automatically unchecked.");
    }
  }, [
    isDraftChecked,
    isPublishChecked,
    publishToTournamentsWatch,
    publishToNewsWatch,
    form, // dependency for react-hook-form
  ]);

  if (initialLoading) {
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
      <div>
        <PageHeader back title={eventTitle} />
        <Form {...form}>
          {/* CRITICAL FIX: Removed onSubmit from the form tag to prevent Enter-key auto-submission */}
          <form className="space-y-6">
            <Tabs value={currentTab} onValueChange={setCurrentTab}>
              <TabsList className="w-full justify-start overflow-x-auto mb-2">
                <TabsTrigger value="basic_info" className="px-6">
                  Basic Info
                </TabsTrigger>
                <TabsTrigger value="registered_teams" className="px-6">
                  Registered Teams
                </TabsTrigger>
                <TabsTrigger value="stages_groups" className="px-6">
                  Stages & Groups
                </TabsTrigger>
                <TabsTrigger value="prize_rules" className="px-6">
                  Prize & Rules
                </TabsTrigger>
              </TabsList>

              {/* ======================= TAB 1: BASIC INFO ======================= */}
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
                                // Value must be string, map 0/undefined/null to "" for clean typing
                                value={
                                  field.value === undefined ||
                                  field.value === null ||
                                  field.value === 0
                                    ? ""
                                    : field.value.toString()
                                }
                                onChange={(e) => {
                                  const val = e.target.value;
                                  // Pass raw string to RHF/Zod for coercion on blur/submit
                                  field.onChange(val);
                                }}
                                placeholder="e.g., 128"
                                className=""
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
                                <SelectItem value={"tournament"}>
                                  Tournament
                                </SelectItem>
                                <SelectItem value={"scrims"}>Scrims</SelectItem>
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
                                <SelectItem value={"solo"}>Solo</SelectItem>
                                <SelectItem value={"duo"}>Duo</SelectItem>
                                <SelectItem value={"squad"}>Squad</SelectItem>
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
                                <SelectItem value={"virtual"}>
                                  Virtual
                                </SelectItem>
                                <SelectItem value={"physical"}>
                                  Physical (LAN)
                                </SelectItem>
                                <SelectItem value={"hybrid"}>Hybrid</SelectItem>
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
                                <SelectItem value={"internal"}>
                                  Internal event
                                </SelectItem>
                                <SelectItem value={"external"}>
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
                    {/* Dates */}
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

                    {/* Publish Options */}
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
                                // DISABLE if Draft is currently checked
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
                                // DISABLE if ANY publishing option is currently checked
                                disabled={
                                  publishToTournamentsWatch ||
                                  publishToNewsWatch
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

                    {/* CRITICAL FIX: Change to type="button" and manually call handleSubmit */}
                    <Button
                      type="button"
                      onClick={form.handleSubmit(onSubmit)}
                      disabled={isPending}
                    >
                      Save Changes
                    </Button>
                    {/* END CRITICAL FIX */}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* ======================= TAB 2: REGISTERED TEAMS ======================= */}
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
                            <TableHead>Players </TableHead>
                            <TableHead>Status </TableHead>
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
                              <TableCell>
                                <Button variant={"destructive"}>
                                  <IconUserMinus />
                                  Disqualify
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="stages_groups" className="space-y-4">
                {form.watch("stages").map((stage, sIdx) => (
                  <Card key={sIdx} className="bg-primary/10">
                    <CardHeader className="flex flex-row items-center justify-between">
                      <div className="space-y-1 w-full">
                        <CardTitle className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 md:gap-2">
                          <span>
                            <IconTrophy className="inline-block mr-2" />
                            {stage.stage_name}{" "}
                            <Badge className="capitalize">
                              {sIdx === 0 ? "completed" : "upcoming"}
                            </Badge>
                          </span>

                          <Button
                            type="button"
                            variant="outline"
                            className="w-full md:w-auto"
                            onClick={() => openAddStageModalLogic(sIdx)}
                          >
                            <Edit className="w-3 h-3 mr-1" />
                            Edit Details
                          </Button>
                        </CardTitle>
                        <p className="text-xs text-slate-400">
                          {formatDate(stage.start_date)} →{" "}
                          {formatDate(stage.end_date)} |{" "}
                          {formattedWord[stage.stage_format]} |{" "}
                          {stage.teams_qualifying_from_stage} teams qualify
                        </p>
                      </div>
                    </CardHeader>

                    <CardContent className="space-y-2">
                      {stage.groups.map((group, gIdx) => (
                        <Card key={gIdx} className="bg-primary/10 gap-0">
                          <CardHeader>
                            <CardTitle>{group.group_name}</CardTitle>
                          </CardHeader>
                          <CardContent className="pt-2 text-muted-foreground text-sm flex flex-col md:flex-row items-start justify-between gap-4 md:gap-2">
                            <div className="space-y-1">
                              <p>
                                {formatDate(group.playing_date)} at{" "}
                                {group.playing_time}
                              </p>
                              <p className="text-primary">
                                Maps: Bermuda, Kalahari, Purgatory
                              </p>
                              <p>8 teams | {group.teams_qualifying} qualify</p>
                            </div>
                            <div className="flex w-full md:w-auto items-start gap-2">
                              <Button
                                variant="secondary"
                                type="button"
                                size="md"
                                className="flex-1"
                                onClick={() => {
                                  setSelectedGroupForResult(group); // Set the specific group data
                                  setIsResultsModalOpen(true); // Open the modal
                                }}
                              >
                                View Results
                              </Button>
                              <Button
                                size="md"
                                type="button"
                                className="flex-1"
                                onClick={() => {
                                  setSelectedGroupForSeed(group); // Set the active group context
                                  setIsSeedModalOpen(true); // Show the modal
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
                ))}
                <Button
                  type="button"
                  onClick={form.handleSubmit(onSubmit)}
                  disabled={isPending}
                >
                  Save Changes
                </Button>
              </TabsContent>

              {/* <TabsContent value="stages_groups">
                <Card>
                  <CardHeader>
                    <CardTitle>Stages & Groups Configuration</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-3">
                      <h3 className="font-semibold text-lg">Stage Order</h3>

                      <FormField
                        control={form.control}
                        name="number_of_stages"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Number of Stages</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                min={1}
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

                                  const numericVal = Number(val);
                                  if (val !== "" && !isNaN(numericVal)) {
                                    handleStageCountChangeLogic(numericVal);
                                  } else {
                                    handleStageCountChangeLogic(0);
                                  }
                                }}
                                className=""
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {stageNames.map((name, index) => {
                        const stage = stages[index];
                        const isConfigured = !!stage;
                        const stageStatus = isConfigured
                          ? `${stage.groups.length} Groups • ${
                              formattedWord[stage.stage_format]
                            }`
                          : "Not Configured";

                        return (
                          <div
                            key={index}
                            className="flex items-center justify-between p-4 bg-primary/10 border border-primary/50 rounded-lg"
                          >
                            <div className="flex items-center gap-3">
                              <span className="text-zinc-500">
                                ::{index + 1}.
                              </span>
                              <div>
                                <div className="font-semibold">{name}</div>
                                <div className="text-sm text-zinc-400">
                                  {stageStatus}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 text-sm">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => moveStageLogic(index, "up")}
                                disabled={index === 0}
                              >
                                <ChevronUp className="w-4 h-4" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => moveStageLogic(index, "down")}
                                disabled={index === stageNames.length - 1}
                              >
                                <ChevronDown className="w-4 h-4" />
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => openAddStageModalLogic(index)}
                              >
                                {isConfigured ? "Edit" : "Add"}
                              </Button>
                              {isConfigured && stages.length > 1 && (
                                <Button
                                  type="button"
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => handleDeleteStageLogic(index)}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <Button
                      type="button"
                      onClick={form.handleSubmit(onSubmit)}
                      disabled={isPending}
                    >
                      Save Changes
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent> */}

              <TabsContent value="prize_rules">
                <Card>
                  <CardHeader>
                    <CardTitle>Prize Pool & Rules</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Prize Pool */}
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

                    {/* Prize Distribution */}
                    <div className="space-y-3">
                      <FormLabel>Prize Distribution</FormLabel>
                      {Object.entries(prizeDistribution).map(
                        (
                          [key, value] // key is now "1", "2", etc.
                        ) => (
                          <div key={key} className="grid grid-cols-4 gap-2">
                            {/* Display the formatted key */}
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
                                onClick={() => removePrizePosition(key)} // Pass the simple key
                                disabled={
                                  Object.keys(prizeDistribution).length <= 1
                                }
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        )
                      )}
                      <Button
                        type="button"
                        variant="outline"
                        onClick={addPrizePosition}
                      >
                        + Add Prize Position
                      </Button>
                    </div>

                    <Separator />

                    {/* Event Rules */}
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
                            rulesInputMethod === "upload"
                              ? "default"
                              : "outline"
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
                                    // --- Document Drop Area ---
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
                                          // NEW Validation List
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
                                          Supports: PDF, DOC, DOCX{" "}
                                        </p>
                                      </div>
                                    </div>
                                  ) : (
                                    // --- Document Preview Area ---
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
                                    // CHANGED ACCEPT ATTRIBUTE
                                    accept=".pdf,application/pdf,.doc,application/msword,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                                    className="hidden"
                                    onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      if (!file) return;

                                      // NEW Validation List
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

                    {/* CRITICAL FIX: Change to type="button" and manually call handleSubmit */}
                    <Button
                      type="button"
                      onClick={form.handleSubmit(onSubmit)}
                      disabled={isPending}
                    >
                      Save Changes
                    </Button>
                    {/* END CRITICAL FIX */}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </form>

          {/* ======================= STAGE CONFIG MODAL (FIXED) ======================= */}

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
              {/* MODAL STEP 1: Stage Basic Info */}
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

                  {/* FIX: teams_qualifying_from_stage controlled component for number input */}
                  <div>
                    <label className="text-sm font-medium mb-2 block">
                      Teams Qualifying from this Stage
                    </label>

                    <Input
                      type="number"
                      min={0}
                      // Value must be string, map 0/undefined/null to "" for clean typing
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
                            // Convert to number, but use 0 if input is empty string
                            val === "" ? 0 : Number(val),
                        });
                      }}
                    />
                  </div>
                  {/* END FIX */}

                  {/* FIX: number_of_groups controlled component for number input */}
                  <div>
                    <label className="text-sm font-medium mb-2 block">
                      Number of Groups
                    </label>

                    <Input
                      type="number"
                      min={1}
                      // Value must be string, map 0/undefined/null to "" for clean typing
                      value={
                        stageModalData.number_of_groups === 0
                          ? ""
                          : stageModalData.number_of_groups
                      }
                      onChange={(e) =>
                        handleGroupCountChangeLogic(
                          // Convert to number, but use 0 if input is empty string
                          e.target.value === "" ? 0 : Number(e.target.value)
                        )
                      }
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">
                      Stage Discord Role ID{" "}
                    </label>
                    <Input
                      value={stageModalData.discordId}
                      onChange={(e) =>
                        setStageModalData({
                          ...stageModalData,
                          discordId: e.target.value,
                        })
                      }
                      placeholder="e.g: 1234567890"
                      className=""
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
              {/* MODAL STEP 2: Groups Configuration */}
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
                    <div
                      key={index}
                      className="border rounded-lg p-4 space-y-4"
                    >
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

                      {/* FIX: teams_qualifying controlled component for number input */}
                      <div>
                        <label className="text-sm font-medium mb-2 block">
                          Teams Qualifying from this Group
                        </label>

                        <Input
                          type="number"
                          min={1}
                          // Value must be string, map 0/undefined/null to "" for clean typing
                          value={
                            group.teams_qualifying === 0
                              ? ""
                              : group.teams_qualifying
                          }
                          onChange={(e) =>
                            updateGroupDetailLogic(
                              index,
                              "teams_qualifying",
                              // Convert to number, but use 0 if input is empty string
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
                          value={group.discordId}
                          onChange={(e) =>
                            setGroup({
                              ...stageModalData,
                              discordId: e.target.value,
                            })
                          }
                          placeholder="e.g: 1234567890"
                          className=""
                        />
                      </div>
                      {/* END FIX */}
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
                          stageModalData.teams_qualifying_from_stage ===
                            undefined
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
        </Form>
      </div>
    </div>
  );
}
