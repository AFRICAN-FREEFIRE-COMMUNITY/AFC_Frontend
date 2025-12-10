"use client";

import React, {
  useState,
  useTransition,
  useRef,
  useEffect,
  useCallback,
  use,
} from "react";
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"; // New Tab Imports!
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
import { useRouter, useSearchParams } from "next/navigation"; // Changed to useSearchParams
import { PageHeader } from "@/components/PageHeader";
import { useAuth } from "@/contexts/AuthContext";
import { env } from "@/lib/env";
import { Separator } from "@/components/ui/separator";
import axios from "axios";
import { ComingSoon } from "@/components/ComingSoon";
import { IconPhoto, IconUpload, IconX } from "@tabler/icons-react";
import Image from "next/image";
import { FullLoader } from "@/components/Loader";

/* =================================================================
 * NOTE: The Schemas (GroupSchema, StageSchema, EventFormSchema)
 * remain the same as they define the data structure.
 * ================================================================= */

const formattedWord = {
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

// Define EventFormType and other schemas (omitted for brevity, assume they are present)
const GroupSchema = z.object({
  group_name: z.string().min(1, "Group name required"),
  playing_date: z.string().min(1, "Playing date required"),
  playing_time: z.string().min(1, "Playing time required"),
  teams_qualifying: z.coerce.number().min(1, "Must qualify at least 1 team"),
});

const StageSchema = z.object({
  stage_name: z.string().min(1, "Stage name required"),
  start_date: z.string().min(1, "Start date required"),
  end_date: z.string().min(1, "End date required"),
  number_of_groups: z.coerce.number().min(1, "Must have at least 1 group"),
  stage_format: z.string().min(1, "Stage format required"),
  groups: z.array(GroupSchema).min(1, "At least one group required"),
  teams_qualifying_from_stage: z.coerce.number().min(0).optional(),
});

const EventFormSchema = z.object({
  event_name: z.string().min(1, "Event name required"),
  competition_type: z.string().min(1, "Competition type required"),
  participant_type: z.string().min(1, "Participant type required"),
  event_type: z.string().min(1, "Event type required"),
  max_teams_or_players: z.coerce.number().min(1, "Max teams/players required"),
  banner: z.string().optional(),
  stream_channels: z.array(z.string()).optional(),
  event_mode: z.string().min(1, "Event mode required"),
  number_of_stages: z.coerce.number().min(1, "At least 1 stage required"),
  stages: z.array(StageSchema).min(1, "At least one stage required"),
  prizepool: z.string().min(1, "Prize pool required"),
  prize_distribution: z.record(z.string(), z.coerce.number()),
  event_rules: z.string().optional(),
  rules_document: z.string().optional(),
  start_date: z.string().min(1, "Start date required"),
  end_date: z.string().min(1, "End date required"),
  registration_open_date: z.string().min(1, "Registration open date required"),
  registration_end_date: z.string().min(1, "Registration end date required"),
  registration_link: z.string().optional().or(z.literal("")),
  event_status: z.string().default("upcoming"),
  publish_to_tournaments: z.boolean().default(false),
  publish_to_news: z.boolean().default(false),
  save_to_drafts: z.boolean().default(false),
});

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

// --- Mock Data for Registered Teams (based on image_4ecf24.png) ---
const MOCK_REGISTERED_TEAMS = [
  {
    team_name: "Team Alpha",
    players: "Player1, Player2, Player3, Player4",
    status: "active",
  },
  {
    team_name: "Team Beta",
    players: "PlayerA, PlayerB, PlayerC, PlayerD",
    status: "active",
  },
  {
    team_name: "Team Gamma",
    players: "PlayerX, PlayerY, PlayerZ, PlayerW",
    status: "active",
  },
  {
    team_name: "Team Delta",
    players: "User1, User2, User3, User4",
    status: "active",
  },
  {
    team_name: "Team Epsilon",
    players: "Pro1, Pro2, Pro3, Pro4",
    status: "disqualified",
  },
];

interface EventDetails {
  event_id: number;
  event_name: string;
  competition_type: string;
  participant_type: string;
  event_type: string;
  max_teams_or_players: number;
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
  number_of_stages: number;
  uploaded_rules_url: string | null;
  created_at: string;
  stream_channels: string[];
  stages: any[];
}

type Params = {
  id: string;
};

export default function EditEventPage({ params }: { params: Promise<Params> }) {
  const resolvedParams = use(params);
  const { id } = resolvedParams;
  const router = useRouter();
  const searchParams = useSearchParams();
  // Assume eventId is passed as a query parameter
  const eventId = searchParams.get("id");
  const [stageModalStep, setStageModalStep] = useState(1);
  const [tempGroups, setTempGroups] = useState<GroupType[]>([]);
  const [currentTab, setCurrentTab] = useState("basic_info"); // Use tab state instead of step
  const [isPending, startTransition] = useTransition();
  const [rulesInputMethod, setRulesInputMethod] = useState<"type" | "upload">(
    "type"
  );

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
  });

  const { token } = useAuth();

  const [previewUrl, setPreviewUrl] = useState<string>(
    eventDetails?.event_banner_url ? eventDetails.event_banner_url : ""
  );

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedRuleFile, setSelectedRuleFile] = useState<File | null>(null);

  const [previewRuleUrl, setPreviewRuleUrl] = useState<string>("");

  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const rulesFileInputRef = useRef<HTMLInputElement>(null);

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
      prize_distribution: { "1st": 0, "2nd": 0, "3rd": 0 },
      event_rules: "",
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
          { event_id: decodedId }
        );
        // Ensure data path is correct based on your API response structure
        const fetchedDetails: EventDetails = res.data.event_details;

        // --- ADDED LOGIC: Sync stage names from fetched data ---
        if (fetchedDetails.stages) {
          const names = fetchedDetails.stages.map((s: any) => s.stage_name);
          setStageNames(names);
        }
        // --- END ADDED LOGIC ---

        setEventDetails(fetchedDetails);
      } catch (error: any) {
        // Handle error response structure
        const errorMessage =
          error.response?.data?.message ||
          error.response?.data?.detail ||
          "Failed to fetch event details.";
        toast.error(errorMessage);
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
    }
  }, [eventDetails, form]);

  // Placeholder Initial Data
  const getMockInitialData = (): EventFormType => ({
    event_name: "Summer Championship",
    competition_type: "tournament",
    participant_type: "squad",
    event_type: "internal",
    max_teams_or_players: 128,
    banner: "",
    stream_channels: ["https://twitch.tv/afc", "https://youtube.com/afc"],
    event_mode: "hybrid",
    number_of_stages: 2,
    stages: [
      {
        stage_name: "Qualifiers",
        start_date: "2024-01-15",
        end_date: "2024-01-16",
        number_of_groups: 4,
        stage_format: "br - normal",
        teams_qualifying_from_stage: 16,
        groups: Array.from({ length: 4 }, (_, i) => ({
          group_name: `Group ${String.fromCharCode(65 + i)}`,
          playing_date: "2024-01-15",
          playing_time: "20:00",
          teams_qualifying: 4,
        })),
      },
      {
        stage_name: "Semi-finals",
        start_date: "2024-01-22",
        end_date: "2024-01-23",
        number_of_groups: 2,
        stage_format: "cs - normal",
        teams_qualifying_from_stage: 8,
        groups: [
          {
            group_name: "Upper Bracket",
            playing_date: "2024-01-22",
            playing_time: "19:00",
            teams_qualifying: 4,
          },
          {
            group_name: "Lower Bracket",
            playing_date: "2024-01-23",
            playing_time: "19:00",
            teams_qualifying: 4,
          },
        ],
      },
    ],
    prizepool: "50000",
    prize_distribution: {
      "1st Place": 25000,
      "2nd Place": 15000,
      "3rd Place": 10000,
    },
    event_rules: "Sample tournament rules",
    rules_document: "",
    start_date: "2023-07-15",
    end_date: "2023-07-16",
    registration_open_date: "2023-07-01",
    registration_end_date: "2023-07-14",
    registration_link: "https://external.example.com",
    event_status: "upcoming",
    publish_to_tournaments: true,
    publish_to_news: false,
    save_to_drafts: false,
  });
  // --- FETCH INITIAL DATA (MOCK) ---
  useEffect(() => {
    if (!eventId) {
      setInitialLoading(false);
      setEventTitle("Create New Event");
      return;
    }

    // In a real app, this would be your fetch call:
    // fetch(`/api/events/${eventId}`)...

    // MOCKING DATA LOADING
    const mockLoad = setTimeout(() => {
      const data = getMockInitialData();
      form.reset(data); // Populate form with fetched data
      setEventTitle(`Edit Event: ${data.event_name}`);
      setRulesInputMethod(data.event_rules ? "type" : "upload"); // Set rules method based on data

      // Populate stage names for Step 4
      const names = data.stages.map((s) => s.stage_name);
      setStageNames(names);

      setInitialLoading(false);
      toast.info(`Event ${eventId} loaded.`);
    }, 1000);

    return () => clearTimeout(mockLoad);
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

  // --- Stage/Group Management Functions (Same as original) ---
  const handleStageCountChange = (count: number) => {
    /* ... (same logic) ... */
  };
  const handleStageNameChange = (index: number, name: string) => {
    /* ... (same logic) ... */
  };
  const openAddStageModal = (stageIndex: number) => {
    /* ... (same logic) ... */
  };
  const handleGroupCountChange = (count: number) => {
    /* ... (same logic) ... */
  };
  const updateGroupDetail = (
    index: number,
    field: keyof GroupType,
    value: string | number
  ) => {
    /* ... (same logic) ... */
  };

  const eventType = form.watch("event_type") === "external";

  const handleStageCountChangeLogic = (count: number) => {
    const newCount = Math.max(1, count);
    form.setValue("number_of_stages", newCount);

    const newNames = Array.from(
      { length: newCount },
      (_, i) => stageNames[i] || `Stage ${i + 1}`
    );
    setStageNames(newNames);
  };

  const handleStageNameChangeLogic = (index: number, name: string) => {
    const newNames = [...stageNames];
    newNames[index] = name;
    setStageNames(newNames);
  };

  const handleGroupCountChangeLogic = (count: number) => {
    const newCount = Math.max(1, count);

    const newTempGroups = Array.from({ length: newCount }, (_, i) => {
      if (tempGroups[i]) {
        return tempGroups[i];
      }
      return {
        group_name: `Group ${i + 1}`,
        playing_date: stageModalData.start_date || "",
        playing_time: "00:00",
        teams_qualifying: 1,
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

  // ... existing code

  const handleSaveStageLogic = async () => {
    // 1. Stage/Group Validation (Keep this local validation)
    // ... (Your existing validation checks here) ...
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

    // 2. Prepare and Update Stage Data
    const newStage: StageType = {
      stage_name: stageModalData.stage_name,
      start_date: stageModalData.start_date,
      end_date: stageModalData.end_date,
      number_of_groups: stageModalData.number_of_groups,
      stage_format: stageModalData.stage_format,
      groups: tempGroups,
      teams_qualifying_from_stage: stageModalData.teams_qualifying_from_stage,
    };

    const currentStages = [...stages];
    currentStages[editingStageIndex!] = newStage;

    // A. Update form value (must happen before validation)
    form.setValue("stages", currentStages, { shouldDirty: true });

    // 3. Trigger Full Form Validation
    const isValid = await form.trigger(); // Trigger validation for the ENTIRE form

    // 4. Close Modal and Notify User
    setIsStageModalOpen(false);
    setStageModalStep(1);
    toast.success("Stage configuration updated. Attempting event save...");

    // B. Only call onSubmit if the entire form is valid
    if (isValid) {
      // Get the current valid form data
      const data = form.getValues();

      await onSubmit(data);
    } else {
      // If validation fails (e.g., event name is empty), show an error
      toast.error(
        "Overall form validation failed. Check 'Basic Info' and 'Prize & Rules' tabs."
      );
    }
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
        teams_qualifying_from_stage:
          existingStage.teams_qualifying_from_stage || 1,
      });
      setTempGroups(existingStage.groups);
    } else {
      setStageModalData({
        stage_name: stageNames[stageIndex] || `Stage ${stageIndex + 1}`,
        start_date: "",
        end_date: "",
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

  const onSubmit = (data: EventFormType) => {
    if (!eventDetails?.event_id) return toast.error("Event ID is missing");
    startTransition(async () => {
      try {
        const bannerFile = fileInputRef.current?.files?.[0];
        const rulesFile = rulesFileInputRef.current?.files?.[0];
        const hasFiles =
          !!bannerFile || (rulesInputMethod === "upload" && !!rulesFile);

        const formData = new FormData();

        if (selectedFile) {
          formData.append("event_banner", selectedFile);
        }

        if (selectedRuleFile) {
          formData.append("uploaded_rules", selectedRuleFile);
        }

        // 2. Append STRING/TEXT Fields (matching Postman root fields)
        formData.append("event_name", data.event_name);
        formData.append(
          "event_id",
          eventDetails?.event_id?.toString() || "" // Ensure event_id is a string
        );
        formData.append("competition_type", data.competition_type);
        formData.append("participant_type", data.participant_type);
        formData.append("event_type", data.event_type);
        formData.append(
          "max_teams_or_players",
          data.max_teams_or_players.toString()
        );
        formData.append("event_mode", data.event_mode);
        formData.append("prizepool", data.prizepool);
        formData.append("event_status", data.event_status);
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
        formData.append("save_to_drafts", data.save_to_drafts.toString());

        // Append Event Rules Text (only if typed)
        if (rulesInputMethod === "type") {
          formData.append("event_rules", data.event_rules || "");
        } else {
          // Append a placeholder or empty string if a file was uploaded but a string is expected
          formData.append("event_rules", "");
        }

        // 3. Append COMPLEX JSON STRINGS
        // Prize Distribution: Must be stringified if complex object is expected on backend
        formData.append(
          "prize_distribution",
          JSON.stringify(data.prize_distribution)
        );

        // Stream Channels: Must be stringified array
        formData.append(
          "stream_channels",
          JSON.stringify(
            data.stream_channels?.filter((s) => s.trim() !== "") || []
          )
        );

        // Stages: Must be stringified array
        formData.append("stages", JSON.stringify(data.stages));

        const response = await fetch(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/create-event/`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              // NOTE: DO NOT set Content-Type header for FormData!
            },
            body: formData,
          }
        );

        // --- Server Response Handling ---
        const contentType = response.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
          const textResponse = await response.text();
          console.error("Non-JSON Response:", textResponse);
          toast.error(
            "Server error: Received unexpected response format. Check console for details."
          );
          return;
        }

        const res = await response.json();

        if (response.ok) {
          toast.success("Event updated successfully!");
          //   router.push(`/a/events`);
        } else {
          console.error("Server Error:", res);
          toast.error(
            res.message ||
              res.detail ||
              "Failed to create event. Please check your inputs."
          );
        }
      } catch (error) {
        console.error("Error:", error);
        toast.error("An unexpected error occurred during submission.");
      }
    });
  };

  if (initialLoading) {
    return <FullLoader />;
  }

  if (eventTitle)
    return (
      <div>
        <PageHeader back title={`Edit Event: ${eventDetails?.event_name}`} />
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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

              {/* ======================= TAB 1: BASIC INFO (image_4ecf7a.png) ======================= */}
              <TabsContent value="basic_info">
                <Card>
                  <CardContent className="space-y-6">
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
                      name="competition_type"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Competition Type</FormLabel>
                          <RadioGroup
                            onValueChange={field.onChange}
                            value={field.value}
                            className="flex gap-6"
                          >
                            <div className="flex items-center gap-2 text-sm">
                              <RadioGroupItem value="tournament" />
                              <span>Tournament</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm">
                              <RadioGroupItem value="scrims" />
                              <span>Scrim</span>
                            </div>
                          </RadioGroup>
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
                          <RadioGroup
                            onValueChange={field.onChange}
                            value={field.value}
                            className="flex gap-6"
                          >
                            <div className="flex items-center gap-2 text-sm">
                              <RadioGroupItem value="solo" />
                              <span>Solo</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm">
                              <RadioGroupItem value="duo" />
                              <span>Duo</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm">
                              <RadioGroupItem value="squad" />
                              <span>Squad</span>
                            </div>
                          </RadioGroup>
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
                          <RadioGroup
                            onValueChange={field.onChange}
                            value={field.value}
                            className="flex gap-6"
                          >
                            <div className="flex items-center gap-2 text-sm">
                              <RadioGroupItem value="internal" />
                              <span>Internal Event</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm">
                              <RadioGroupItem value="external" />
                              <span>External Event</span>
                            </div>
                          </RadioGroup>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

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

                    <FormField
                      control={form.control}
                      name="max_teams_or_players"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Max Teams/Players</FormLabel>
                          <Input
                            type="number"
                            {...field}
                            placeholder="e.g., 128"
                          />
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
                          <RadioGroup
                            onValueChange={field.onChange}
                            value={field.value}
                            className="flex gap-6"
                          >
                            {["virtual", "physical", "hybrid"].map((mode) => (
                              <div
                                key={mode}
                                className="flex items-center gap-2 text-sm"
                              >
                                <RadioGroupItem value={mode} />
                                <span className="capitalize">
                                  {mode === "physical"
                                    ? "Physical (LAN)"
                                    : mode}
                                </span>
                              </div>
                            ))}
                          </RadioGroup>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Stream Channels */}
                    <div className="space-y-3">
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
                            size="sm"
                            onClick={() => removeStreamChannelLogic(index)}
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
                    <div className="grid grid-cols-2 gap-4">
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
                    </div>
                    <div className="grid grid-cols-2 gap-4">
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
                        name="publish_to_news"
                        render={({ field }) => (
                          <FormItem className="flex items-center gap-3 p-4 border rounded-lg">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                            <FormLabel className="!mt-0 cursor-pointer">
                              Publish to News & Updates
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
                              />
                            </FormControl>
                            <FormLabel className="!mt-0 cursor-pointer">
                              Save as Draft
                            </FormLabel>
                          </FormItem>
                        )}
                      />
                    </div>

                    <Button type="submit" disabled={isPending}>
                      Save Basic Info
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* ======================= TAB 2: REGISTERED TEAMS (image_4ecf24.png) ======================= */}
              <TabsContent value="registered_teams">
                <Card>
                  <CardHeader>
                    <CardTitle>
                      Registered Teams/Players ({MOCK_REGISTERED_TEAMS.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="relative">
                    <ComingSoon />
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-700">
                        <thead>
                          <tr className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                            <th className="px-4 py-2">Team Name</th>
                            <th className="px-4 py-2">Players</th>
                            <th className="px-4 py-2">Status</th>
                            <th className="px-4 py-2 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-800">
                          {MOCK_REGISTERED_TEAMS.map((team, index) => (
                            <tr key={index}>
                              <td className="px-4 py-3 whitespace-nowrap text-sm font-medium">
                                {team.team_name}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-400">
                                {team.players}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-xs">
                                <span
                                  className={`px-2 py-1 rounded-full font-semibold ${
                                    team.status === "active"
                                      ? "bg-green-900/50 text-green-400"
                                      : "bg-red-900/50 text-red-400"
                                  }`}
                                >
                                  {team.status}
                                </span>
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-right">
                                {team.status === "active" ? (
                                  <Button
                                    variant="destructive"
                                    size="sm"
                                    className="space-x-1"
                                  >
                                    <Trash2 className="w-4 h-4" />{" "}
                                    <span>Disqualify</span>
                                  </Button>
                                ) : (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="space-x-1"
                                  >
                                    <span>Reactivate</span>
                                  </Button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* ======================= TAB 3: STAGES & GROUPS (image_4ecbff.png, image_4ecbdb.png) ======================= */}
              <TabsContent value="stages_groups">
                <Card>
                  <CardHeader>
                    <CardTitle>Stages & Groups Configuration</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Stage List and Ordering */}
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
                                {...field}
                                onChange={(e) => {
                                  field.onChange(e);
                                  handleStageCountChangeLogic(
                                    Number(e.target.value)
                                  );
                                }}
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
                  </CardContent>
                </Card>
              </TabsContent>

              {/* ======================= TAB 4: PRIZE & RULES (image_4ecb9f.png) ======================= */}
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
                          <Input {...field} placeholder="e.g., 50000" />
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <Separator />

                    {/* Prize Distribution */}
                    <div className="space-y-3">
                      <FormLabel>Prize Distribution</FormLabel>
                      {Object.entries(prizeDistribution).map(([key, value]) => (
                        <div key={key} className="grid grid-cols-4 gap-2">
                          <Input value={key} disabled className="col-span-1" />
                          <div className="col-span-3 flex items-center justify-end gap-1">
                            <Input
                              type="number"
                              value={value}
                              onChange={(e) => {
                                const updated = { ...prizeDistribution };
                                updated[key] = Number(e.target.value);
                                form.setValue("prize_distribution", updated);
                              }}
                              placeholder="Earnings"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => removePrizePositionLogic(key)}
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
                        onClick={addPrizePositionLogic}
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
                                          src={previewRuleUrl}
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

                    <Button type="submit" disabled={isPending}>
                      Save Changes
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </form>
          {/* ======================= STAGE CONFIG MODAL (Same as original) ======================= */}

          <Dialog open={isStageModalOpen} onOpenChange={setIsStageModalOpen}>
            <DialogContent className="flex max-h-[70vh] overflow-auto justify-start flex-col gap-0">
              <DialogHeader>
                <DialogTitle>
                  {stageModalStep === 1 ? "Stage Details" : "Configure Groups"} 
                </DialogTitle>

                <p className="text-sm text-muted-foreground">
                  Step {stageModalStep} of 2 Lorem ipsum dolor sit amet,
                  consectetur adipisicing elit. Similique asperiores dolores
                  perspiciatis reprehenderit, quo non nobis ab necessitatibus
                  officia corporis.
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

                  <div>
                    <label className="text-sm font-medium mb-2 block">
                      Teams Qualifying from this Stage
                    </label>

                    <Input
                      type="number"
                      min={0}
                      value={stageModalData.teams_qualifying_from_stage}
                      onChange={(e) =>
                        setStageModalData({
                          ...stageModalData,
                          teams_qualifying_from_stage: Number(e.target.value),
                        })
                      }
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-2 block">
                      Number of Groups
                    </label>

                    <Input
                      type="number"
                      min={1}
                      value={stageModalData.number_of_groups}
                      onChange={(e) =>
                        handleGroupCountChangeLogic(Number(e.target.value))
                      }
                    />
                  </div>

                  <div className="pt-4 border-t">
                    <p className="text-sm text-zinc-400 mb-3">
                      You will configure {stageModalData.number_of_groups}{" "}
                      group(s) in the next step
                    </p>

                    <div className="flex gap-2 flex-wrap">
                      {tempGroups
                        .slice(0, stageModalData.number_of_groups)
                        .map((group, i) => (
                          <div
                            key={i}
                            className="px-3 py-1 bg-blue-950/30 border border-blue-900 rounded text-sm"
                          >
                            {group.group_name}
                          </div>
                        ))}
                    </div>
                  </div>
                </div>
              )}
              {/* MODAL STEP 2: Groups Configuration */} {" "}
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

                      <div>
                        <label className="text-sm font-medium mb-2 block">
                          Teams Qualifying from this Group
                        </label>

                        <Input
                          type="number"
                          min={1}
                          value={group.teams_qualifying}
                          onChange={(e) =>
                            updateGroupDetailLogic(
                              index,
                              "teams_qualifying",
                              Number(e.target.value)
                            )
                          }
                        />
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
                      Next: Configure Groups{" "}
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
        </Form>{" "}
      </div>
    );
}
