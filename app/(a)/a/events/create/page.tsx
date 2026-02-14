"use client";

import React, { useState, useTransition, useRef, useEffect } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { optional, z } from "zod";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
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

import {
  Trash2,
  ChevronUp,
  ChevronDown,
  Upload,
  X,
  EyeIcon,
  EyeOffIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { useAuth } from "@/contexts/AuthContext";
import { env } from "@/lib/env";
import {
  IconFile,
  IconFileText,
  IconPhoto,
  IconUpload,
  IconX,
} from "@tabler/icons-react";
import Image from "next/image";
import { formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { countries, REGIONS_MAP } from "@/constants";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

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

// Available maps for Free Fire
const AVAILABLE_MAPS = [
  "Bermuda",
  "Kalahari",
  "Purgatory",
  "Nexterra",
  "Alpine",
  "Solara",
];

/* ========== SCHEMAS ========== */
const GroupSchema = z.object({
  group_name: z.string().min(1, "Group name required"),
  group_discord_role_id: z.string().optional(),
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
  stage_name: z.string().min(1, "Stage name required"),
  stage_discord_role_id: z.string().optional(),
  start_date: z.string().min(1, "Start date required"),
  end_date: z.string().min(1, "End date required"),
  number_of_groups: z.coerce.number().min(1, "Must have at least 1 group"),
  stage_format: z.string().min(1, "Stage format required"),
  // seeding_method: z.string().min(1, "Seeding method required"),
  groups: z.array(GroupSchema).min(1, "At least one group required"),
  teams_qualifying_from_stage: z.coerce.number().min(0).optional(),
});

const EventFormSchema = z
  .object({
    event_name: z.string().min(1, "Event name required"),
    competition_type: z.string().min(1, "Competition type required"),
    participant_type: z.string().min(1, "Participant type required"),
    event_type: z.string().min(1, "Event type required"),
    is_public: z.string().default("True"),
    max_teams_or_players: z.coerce
      .number()
      .min(1, "Max teams/players required"),
    banner: z.string().optional(),
    stream_channels: z.array(z.string()).optional(),
    event_mode: z.string().min(1, "Event mode required"),
    number_of_stages: z.coerce.number().min(1, "At least 1 stage required"),
    stages: z.array(StageSchema).min(1, "At least one stage required"),
    prizepool: z.string().min(1, "Prize pool required"),
    prize_distribution: z.record(
      z.string(),
      z.string().min(1, "Prize amount required"),
    ),
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
    registration_restriction: z
      .enum(["none", "by_region", "by_country"])
      .default("none")
      .optional(),
    restriction_mode: z.enum(["allow_only", "block_selected"]).optional(),
    selected_locations: z.array(z.string()).optional(),
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
    },
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

export default function Page() {
  const router = useRouter();
  const [stageModalStep, setStageModalStep] = useState(1);
  const [tempGroups, setTempGroups] = useState<GroupType[]>([]);
  const [currentStep, setCurrentStep] = useState(1);
  const [isPending, startTransition] = useTransition();
  const [rulesInputMethod, setRulesInputMethod] = useState<"type" | "upload">(
    "type",
  );
  const [bannerPreview, setBannerPreview] = useState<string>("");

  const [stageNames, setStageNames] = useState<string[]>(["Stage 1"]);

  const [isStageModalOpen, setIsStageModalOpen] = useState(false);
  const [editingStageIndex, setEditingStageIndex] = useState<number | null>(
    null,
  );

  // ADD: State for password visibility for each group
  const [passwordVisibility, setPasswordVisibility] = useState<
    Record<number, boolean>
  >({});

  const [stageModalData, setStageModalData] = useState({
    stage_name: "",
    start_date: "",
    end_date: "",
    // seeding_method: "automatic",
    stage_format: "",
    number_of_groups: 2,
    teams_qualifying_from_stage: 1,
    stage_discord_role_id: "",
  });

  const { user, token } = useAuth();

  const form = useForm<EventFormType>({
    // @ts-ignore
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
      registration_restriction: "none",
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
  const selectedCountries = form.watch("selected_locations") || [];

  const toggleCountry = (country: string) => {
    const current = new Set(selectedCountries);
    if (current.has(country)) {
      current.delete(country);
    } else {
      current.add(country);
    }
    form.setValue("selected_locations", Array.from(current));
  };

  const toggleRegion = (regionName: string, regionCountries: string[]) => {
    const current = new Set(selectedCountries);
    const allInRegionSelected = regionCountries.every((c) => current.has(c));

    regionCountries.forEach((c) => {
      if (allInRegionSelected) {
        current.delete(c); // Unselect all if all were selected
      } else {
        current.add(c); // Select all if some or none were selected
      }
    });
    form.setValue("selected_locations", Array.from(current));
  };

  // ADD: Function to toggle password visibility for a specific group
  const toggleVisibility = (groupIndex: number) => {
    setPasswordVisibility((prev) => ({
      ...prev,
      [groupIndex]: !prev[groupIndex],
    }));
  };

  const handleStageCountChange = (count: number) => {
    // Allows 0 only temporarily for better typing UX, final validation will check min(1)
    const newCount = Math.max(0, count);
    form.setValue("number_of_stages", newCount);

    const newNames = Array.from(
      { length: newCount },
      (_, i) => stageNames[i] || `Stage ${i + 1}`,
    );
    setStageNames(newNames);
  };

  const handleStageNameChange = (index: number, name: string) => {
    const newNames = [...stageNames];
    newNames[index] = name;
    setStageNames(newNames);
  };

  const openAddStageModal = (stageIndex: number) => {
    setEditingStageIndex(stageIndex);
    setStageModalStep(1); // Reset to first step
    const existingStage = stages[stageIndex];

    if (existingStage) {
      setStageModalData({
        stage_name: existingStage.stage_name,
        stage_discord_role_id: existingStage.stage_discord_role_id || "",
        // seeding_method: existingStage.seeding_method || "",
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
        stage_discord_role_id: "",
        start_date: "",
        // seeding_method: "automatic",
        end_date: "",
        stage_format: "",
        number_of_groups: 2,
        teams_qualifying_from_stage: 1,
      });
      // Initialize groups based on default count
      setTempGroups(
        Array.from({ length: 2 }, (_, i) => ({
          group_name: `Group ${i + 1}`,
          playing_date: "",
          playing_time: "00:00",
          teams_qualifying: 1,
          match_count: 1,
          group_discord_role_id: "",
          room_id: "",
          room_name: "",
          room_password: "",
          match_maps: [], // Initialize with empty maps array
        })),
      );
    }
    // Reset password visibility when opening modal
    setPasswordVisibility({});
    setIsStageModalOpen(true);
  };

  const eventType = form.watch("event_type") === "external";

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedRuleFile, setSelectedRuleFile] = useState<File | null>(null);

  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [previewRuleUrl, setPreviewRuleUrl] = useState<string>("");

  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const rulesFileInputRef = useRef<HTMLInputElement>(null);

  const handleGroupCountChange = (count: number) => {
    const newCount = Math.max(0, count); // Allowing 0 temporarily for typing fix

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
        room_id: "",
        room_name: "",
        room_password: "",
        match_maps: [], // Initialize with empty maps array
      };
    });

    setTempGroups(newTempGroups);
    setStageModalData({
      ...stageModalData,
      number_of_groups: newCount,
    });
  };

  const updateGroupDetail = (
    index: number,
    field: keyof GroupType,
    value: string | number | string[],
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
      // Remove map if already selected
      newGroups[groupIndex].match_maps = currentMaps.filter((m) => m !== map);
    } else {
      // Add map if not selected
      newGroups[groupIndex].match_maps = [...currentMaps, map];
    }

    setTempGroups(newGroups);
  };

  const handleSaveStage = () => {
    // Basic Stage info validation
    if (
      !stageModalData.stage_name ||
      !stageModalData.stage_format ||
      !stageModalData.start_date ||
      !stageModalData.end_date ||
      stageModalData.teams_qualifying_from_stage === undefined
    ) {
      toast.error("Please fill all required stage fields");
      return;
    }

    // Group info validation (including maps)
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
      toast.error(
        "Please complete all group details correctly, including selecting at least one map per group",
      );
      return;
    }

    // Validation for minimum number of groups (since handleGroupCountChange allows 0 temporarily)
    if (stageModalData.number_of_groups < 1) {
      toast.error("A stage must have at least one group.");
      return;
    }

    const newStage: StageType = {
      stage_name: stageModalData.stage_name,
      stage_discord_role_id: stageModalData.stage_discord_role_id,
      start_date: stageModalData.start_date,
      end_date: stageModalData.end_date,
      number_of_groups: stageModalData.number_of_groups,
      stage_format: stageModalData.stage_format,
      groups: tempGroups,
      teams_qualifying_from_stage: stageModalData.teams_qualifying_from_stage,
    };

    const currentStages = [...stages];
    currentStages[editingStageIndex!] = newStage;
    form.setValue("stages", currentStages);

    // Ensure stage names are consistent
    const currentNames = [...stageNames];
    if (currentNames[editingStageIndex!] !== newStage.stage_name) {
      currentNames[editingStageIndex!] = newStage.stage_name;
      setStageNames(currentNames);
    }

    toast.success("Stage saved successfully");
    setIsStageModalOpen(false);
    setStageModalStep(1);
  };

  const moveStage = (index: number, direction: "up" | "down") => {
    const currentStages = form.getValues("stages");
    const currentNames = [...stageNames];
    const newIndex = direction === "up" ? index - 1 : index + 1;

    if (newIndex >= 0 && newIndex < currentStages.length) {
      // Swap stages in form values
      [currentStages[index], currentStages[newIndex]] = [
        currentStages[newIndex],
        currentStages[index],
      ];
      form.setValue("stages", currentStages, { shouldValidate: true });

      // Swap stage names for display
      [currentNames[index], currentNames[newIndex]] = [
        currentNames[newIndex],
        currentNames[index],
      ];
      setStageNames(currentNames);
      toast.success(`Moved stage ${stageNames[index] || "Stage"} ${direction}`);
    }
  };

  const handleDeleteStage = (index: number) => {
    const currentStages = form.getValues("stages");
    const currentNames = [...stageNames];

    if (currentStages.length > 1) {
      // Remove stage from form values
      currentStages.splice(index, 1);
      form.setValue("stages", currentStages, { shouldValidate: true });

      // Remove stage name
      currentNames.splice(index, 1);
      setStageNames(currentNames);
      form.setValue("number_of_stages", currentNames.length); // Update count
      toast.success("Stage deleted successfully");
    } else {
      toast.error("An event must have at least one stage.");
    }
  };

  const prizeDistribution = form.watch("prize_distribution") || {};
  const addPrizePosition = () => {
    const current = { ...prizeDistribution };
    const nextPos = Object.keys(current).length + 1;
    const suffix =
      nextPos === 1 ? "st" : nextPos === 2 ? "nd" : nextPos === 3 ? "rd" : "th";
    form.setValue("prize_distribution", {
      ...current,
      [`${nextPos}${suffix}`]: 0,
    });
  };

  const removePrizePosition = (key: string) => {
    if (Object.keys(prizeDistribution).length <= 1) return;
    const current = { ...prizeDistribution };
    delete current[key];
    form.setValue("prize_distribution", current);
  };

  const addStreamChannel = () => appendStream("");
  const removeStreamChannel = (index: number) => {
    if (streamFields.length <= 1) return;
    removeStream(index);
  };

  const handleBannerSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => setBannerPreview(reader.result as string);
      reader.readAsDataURL(file);
      // Store the filename in the form state
      form.setValue("banner", file.name);
    } else {
      form.setValue("banner", "");
      setBannerPreview("");
    }
  };

  // --- Step Validation Logic ---
  const handleNextStep = async () => {
    let isValid = false;
    let fieldsToValidate: (keyof EventFormType)[] = [];

    switch (currentStep) {
      case 1: // Event Details
        fieldsToValidate = [
          "event_name",
          "competition_type",
          "participant_type",
          "event_type",
          "is_public",
          "registration_open_date",
          "registration_end_date",
          "start_date",
          "end_date",
          "max_teams_or_players",
        ];
        isValid = await form.trigger(fieldsToValidate, { shouldFocus: true });
        break;
      case 2: // Event Mode
        fieldsToValidate = ["event_mode"];
        isValid = await form.trigger(fieldsToValidate, { shouldFocus: true });
        break;
      case 3: // Number of Stages
        fieldsToValidate = ["number_of_stages"];
        isValid = await form.trigger(fieldsToValidate, { shouldFocus: true });
        if (isValid && form.getValues("number_of_stages") < 1) {
          toast.error("Number of stages must be at least 1.");
          isValid = false;
        }
        break;
      case 4: // Stage Details & Ordering
        const numStages = form.getValues("number_of_stages");
        const configuredStages = form.getValues("stages").length;

        if (configuredStages < numStages) {
          toast.error(
            `Please configure all ${numStages} stages before proceeding. Only ${configuredStages} configured.`,
          );
          return;
        }

        const allStagesValid = form
          .getValues("stages")
          .every((stage) => stage.groups && stage.groups.length > 0);
        if (!allStagesValid) {
          toast.error(
            "One or more stages have not been fully configured with groups.",
          );
          return;
        }

        isValid = true;
        break;
      case 5: // Prize Pool & Distribution
        fieldsToValidate = ["prizepool"];
        isValid = await form.trigger(fieldsToValidate, { shouldFocus: true });
        break;
      case 6: // Event Rules (Custom Conditional Check)
        if (rulesInputMethod === "type") {
          const rules = form.getValues("event_rules")?.trim();
          if (!rules) {
            toast.error("Please enter the event rules.");
            return;
          }
          form.setValue("rules_document", "");
        } else if (rulesInputMethod === "upload") {
          const fileName = form.getValues("rules_document");
          if (!fileName) {
            toast.error("Please upload the rules document.");
            return;
          }
          form.setValue("event_rules", "");
        }
        isValid = true;
        break;
      case 7: // Publish & Save - NOTE: This case will typically not be reached by the Next button now
        isValid = true;
        break;
      default:
        return;
    }

    if (isValid) {
      setCurrentStep(currentStep + 1);
    }
  };
  // --- END Step Validation Logic ---

  const restrictionMode = form.watch("restriction_mode");
  const registration_restriction = form.watch("registration_restriction");

  const onSubmit = (data: EventFormType) => {
    startTransition(async () => {
      try {
        // --- USE PURE FORMDATA APPROACH ---
        const formData = new FormData();

        if (selectedFile) {
          formData.append("event_banner", selectedFile);
        }

        if (selectedRuleFile) {
          formData.append("uploaded_rules", selectedRuleFile);
        }

        // 2. Append STRING/TEXT Fields (matching Postman root fields)
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
        formData.append(
          "is_draft",
          data.save_to_drafts.toString() === "true" ? "True" : "False",
        );
        // If your backend API expects the status to be changed:
        formData.append("event_status", finalEventStatus);
        formData.append("number_of_stages", data.number_of_stages.toString());
        formData.append("start_date", data.start_date);
        formData.append("end_date", data.end_date);
        formData.append("registration_open_date", data.registration_open_date);
        formData.append("registration_end_date", data.registration_end_date);
        formData.append("registration_link", data.registration_link || "");
        formData.append(
          "registration_restriction",
          data?.registration_restriction,
        );

        formData.append("restriction_mode", restrictionMode);

        if (data?.selected_locations?.length !== 0) {
          // Option A: JSON string
          formData.append(
            "restricted_countries",
            JSON.stringify(data.selected_locations),
          );
        }

        // Append Boolean fields as strings
        formData.append(
          "publish_to_tournaments",
          data.publish_to_tournaments.toString(),
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
          JSON.stringify(data.prize_distribution),
        );

        // Stream Channels: Must be stringified array
        formData.append(
          "stream_channels",
          JSON.stringify(
            data.stream_channels?.filter((s) => s.trim() !== "") || [],
          ),
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
          },
        );

        // --- Server Response Handling ---
        const contentType = response.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
          const textResponse = await response.text();

          toast.error(
            "Server error: Received unexpected response format. Check console for details.",
          );
          return;
        }

        const res = await response.json();

        if (response.ok) {
          toast.success(res.message || "Event created successfully!");
          router.push(`/a/events`);
        } else {
          toast.error(
            res.message ||
              res.detail ||
              "Failed to create event. Please check your inputs.",
          );
        }
      } catch (error) {
        console.log(error);
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
        "Draft mode selected. Publishing options automatically unchecked.",
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

  const hasFinalAction =
    saveToDraftsWatch || publishToTournamentsWatch || publishToNewsWatch;

  return (
    <div>
      <div>
        <PageHeader title={"Create New Event"} back />

        <Form {...form}>
          {/* @ts-ignore */}
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* STEP 1 */}
            {currentStep === 1 && (
              <Card className="">
                <CardHeader>
                  <CardTitle>Step 1: Event Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <FormField
                    // @ts-ignore
                    control={form.control}
                    name="event_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Event Name</FormLabel>
                        <Input placeholder="Enter event name" {...field} />
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      // @ts-ignore
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
                      // @ts-ignore
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
                      // @ts-ignore
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
                    <FormField
                      // @ts-ignore
                      control={form.control}
                      name="is_public"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Event Privacy</FormLabel>
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
                              <SelectItem value={"True"}>Public</SelectItem>
                              <SelectItem value={"False"}>Private</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>{" "}
                  <FormField
                    // @ts-ignore
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
                  {eventType && (
                    <FormField
                      // @ts-ignore
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
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      // @ts-ignore
                      control={form.control}
                      name="registration_open_date"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Registration Opens</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} className="" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      // @ts-ignore
                      control={form.control}
                      name="registration_end_date"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Registration Closes</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} className="" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      // @ts-ignore
                      control={form.control}
                      name="start_date"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Event Start Date</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} className="" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      // @ts-ignore
                      control={form.control}
                      name="end_date"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Event End Date</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} className="" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    // @ts-ignore
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
                                        "Only PNG, JPG, JPEG, or WEBP files are supported.",
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
                                    "Only PNG, JPG, JPEG, or WEBP files are supported.",
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
                  <div className="space-y-3">
                    <FormLabel>Streaming Channel Links</FormLabel>
                    {streamFields.map((field, index) => (
                      <div key={field.id} className="flex gap-2">
                        <FormField
                          // @ts-ignore
                          control={form.control}
                          name={`stream_channels.${index}`}
                          render={({ field }) => (
                            <Input
                              {...field}
                              className=" flex-1"
                              placeholder="https://..."
                            />
                          )}
                        />
                        {streamFields.length > 1 && (
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            onClick={() => removeStreamChannel(index)}
                          >
                            Remove
                          </Button>
                        )}
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
                  <Separator />
                  <FormField
                    // @ts-ignore
                    control={form.control}
                    name="registration_restriction"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Registration Restrictions</FormLabel>
                        <FormDescription>
                          Control who can register for this event based on their
                          location
                        </FormDescription>
                        <FormControl>
                          <div className="space-y-6">
                            {/* TOP TOGGLES */}
                            <div className="flex flex-col gap-4">
                              <RadioGroup
                                defaultValue="none"
                                onValueChange={(val) =>
                                  form.setValue("registration_restriction", val)
                                }
                                className="flex gap-4"
                              >
                                {["none", "by_region", "by_country"].map(
                                  (type) => (
                                    <div
                                      key={type}
                                      className="flex items-center space-x-2"
                                    >
                                      <RadioGroupItem value={type} id={type} />
                                      <Label
                                        htmlFor={type}
                                        className="capitalize"
                                      >
                                        {type.replace("_", " ")}
                                      </Label>
                                    </div>
                                  ),
                                )}
                              </RadioGroup>
                            </div>

                            {form.watch("registration_restriction") !==
                              "none" && (
                              <div className="p-4 border rounded-lg bg-card space-y-4">
                                <Label className="text-destructive">
                                  Restriction Mode
                                </Label>
                                <RadioGroup
                                  defaultValue="allow_only"
                                  className="flex gap-4"
                                  onValueChange={(val) =>
                                    form.setValue("restriction_mode", val)
                                  }
                                >
                                  <div className="flex items-center space-x-2">
                                    <RadioGroupItem
                                      value="allow_only"
                                      id="allow_only"
                                    />
                                    <Label
                                      htmlFor="allow_only"
                                      className="text-green-500"
                                    >
                                      Allow Only Selected
                                    </Label>
                                  </div>
                                  <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="block" id="block" />
                                    <Label
                                      htmlFor="block"
                                      className="text-red-500"
                                    >
                                      Block Selected
                                    </Label>
                                  </div>
                                </RadioGroup>

                                {/* CONDITIONAL RENDERING */}
                                {form.watch("registration_restriction") ===
                                "by_region" ? (
                                  <Accordion type="multiple" className="w-full">
                                    {Object.entries(REGIONS_MAP).map(
                                      ([region, regionCountries]) => (
                                        <AccordionItem
                                          value={region}
                                          key={region}
                                        >
                                          <AccordionTrigger className="hover:no-underline">
                                            <div className="flex items-center gap-3">
                                              <Checkbox
                                                checked={regionCountries.every(
                                                  (c) =>
                                                    selectedCountries.includes(
                                                      c,
                                                    ),
                                                )}
                                                onCheckedChange={() =>
                                                  toggleRegion(
                                                    region,
                                                    regionCountries,
                                                  )
                                                }
                                              />
                                              <span>
                                                {region} (
                                                {regionCountries.length}{" "}
                                                countries)
                                              </span>
                                            </div>
                                          </AccordionTrigger>
                                          <AccordionContent className="flex flex-wrap gap-2 pt-2">
                                            {regionCountries.map((c) => (
                                              <Badge
                                                key={c}
                                                variant={
                                                  selectedCountries.includes(c)
                                                    ? "default"
                                                    : "outline"
                                                }
                                                className="cursor-pointer"
                                                onClick={() => toggleCountry(c)}
                                              >
                                                {c}
                                              </Badge>
                                            ))}
                                          </AccordionContent>
                                        </AccordionItem>
                                      ),
                                    )}
                                  </Accordion>
                                ) : (
                                  <div className="flex flex-wrap gap-2">
                                    {countries.map((c) => (
                                      <Badge
                                        key={c}
                                        variant={
                                          selectedCountries.includes(c)
                                            ? "default"
                                            : "outline"
                                        }
                                        className={`cursor-pointer ${selectedCountries.includes(c) ? "bg-green-600" : ""}`}
                                        onClick={() => toggleCountry(c)}
                                      >
                                        {c}
                                      </Badge>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </FormControl>
                        <FormMessage />
                        {form.watch("registration_restriction") !== "none" && (
                          <div className="flex flex-wrap gap-1 mt-2.5">
                            <span className="text-muted-foreground text-sm">
                              Selected locations:
                            </span>{" "}
                            {selectedCountries.map((country) => (
                              <Badge variant="secondary">{country}</Badge>
                            ))}
                          </div>
                        )}
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>
            )}

            {/* STEP 2 */}
            {currentStep === 2 && (
              <Card className="">
                <CardHeader>
                  <CardTitle>Step 2: Event Mode</CardTitle>
                </CardHeader>
                <CardContent>
                  <FormField
                    // @ts-ignore
                    control={form.control}
                    name="event_mode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Select Event Mode</FormLabel>
                        <FormControl>
                          <RadioGroup
                            onValueChange={field.onChange}
                            value={field.value}
                          >
                            {["virtual", "physical", "hybrid"].map((mode) => (
                              <div
                                key={mode}
                                className="flex items-center gap-2 p-4 border border-input rounded-md"
                              >
                                <RadioGroupItem value={mode} />
                                <span className="capitalize text-sm">
                                  {mode === "physical"
                                    ? "Physical (LAN)"
                                    : mode}
                                </span>
                              </div>
                            ))}
                          </RadioGroup>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>
            )}

            {/* STEP 3 */}
            {currentStep === 3 && (
              <Card className="">
                <CardHeader>
                  <CardTitle>Step 3: Select Number of Stages</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    // @ts-ignore
                    control={form.control}
                    name="number_of_stages"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>How many stages?</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            // Keep the value as the string representation of the field's current number value.
                            value={
                              field.value === undefined ||
                              field.value === null ||
                              field.value === 0
                                ? ""
                                : field.value.toString()
                            }
                            onChange={(e) => {
                              const val = e.target.value;
                              field.onChange(val); // Update RHF state with raw string/empty string

                              const numericVal = Number(val);
                              // Call the custom handler only if a numeric value is present/valid
                              if (val !== "" && !isNaN(numericVal)) {
                                handleStageCountChange(numericVal);
                              } else {
                                // If cleared or invalid, assume 0 for UI logic, validation checks min 1
                                handleStageCountChange(0);
                              }
                            }}
                            className=""
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="space-y-3">
                    <FormLabel>Stage Names</FormLabel>
                    {stageNames.map((name, index) => (
                      <Input
                        key={index}
                        value={name}
                        onChange={(e) =>
                          handleStageNameChange(index, e.target.value)
                        }
                        className=""
                        placeholder={`Stage ${index + 1}`}
                      />
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* STEP 4 */}
            {currentStep === 4 && (
              <Card className="">
                <CardHeader>
                  <CardTitle>Step 4: Stage Details & Ordering</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <h3 className="font-semibold">Stage Order</h3>
                    {stageNames.map((name, index) => {
                      const stage = stages[index];
                      const stageStatus = stage
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
                            <span className="text-zinc-500">::</span>
                            <div>
                              <div className="font-semibold">{name}</div>
                              {stage && (
                                <div className="text-sm text-zinc-400">
                                  {stageStatus}
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 text-sm">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => moveStage(index, "up")}
                              disabled={index === 0}
                            >
                              <ChevronUp className="w-4 h-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => moveStage(index, "down")}
                              disabled={index === stageNames.length - 1}
                            >
                              <ChevronDown className="w-4 h-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => openAddStageModal(index)}
                            >
                              {stage ? "Edit" : "Add"}
                            </Button>
                            {stage && stages.length > 1 && (
                              <Button
                                type="button"
                                variant="destructive"
                                size="sm"
                                onClick={() => handleDeleteStage(index)}
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
            )}

            {/* STEP 5 */}
            {currentStep === 5 && (
              <Card className="">
                <CardHeader>
                  <CardTitle>Step 5: Prize Pool & Distribution</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <FormField
                    // @ts-ignore
                    control={form.control}
                    name="prizepool"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Total Prize Pool</FormLabel>
                        <FormControl>
                          <Input
                            type="text" // Keeping this as text input
                            // Value must be string, map undefined/null/empty string to "" for clean typing
                            value={
                              field.value === undefined || field.value === null
                                ? ""
                                : field.value.toString()
                            }
                            onChange={(e) => {
                              const val = e.target.value;
                              // Pass raw string to RHF/Zod for coercion on blur/submit
                              field.onChange(val);
                            }}
                            placeholder="e.g., 5000 USD"
                            className=""
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="space-y-3">
                    <FormLabel>Prize Distribution</FormLabel>
                    {Object.entries(prizeDistribution).map(([key, value]) => (
                      <div key={key} className="grid grid-cols-4 gap-2">
                        <Input value={key} disabled className="col-span-1" />
                        <div className="col-span-3 flex items-center justify-end gap-1">
                          <Input
                            type="text"
                            value={value || ""}
                            onChange={(e) => {
                              const inputVal = e.target.value;
                              const updated = { ...prizeDistribution };
                              updated[key] = inputVal;
                              form.setValue("prize_distribution", updated, {
                                shouldDirty: true,
                              });
                            }}
                            placeholder="e.g., $2,000 or 2000 Diamonds"
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
                </CardContent>
              </Card>
            )}

            {/* STEP 6 */}
            {currentStep === 6 && (
              <Card className="">
                <CardHeader>
                  <CardTitle>Step 6: Event Rules</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <FormLabel>Rules Input Method</FormLabel>
                    <RadioGroup
                      value={rulesInputMethod}
                      onValueChange={(v: "type" | "upload") =>
                        setRulesInputMethod(v)
                      }
                      className="flex gap-6 mt-2"
                    >
                      <div className="flex items-center gap-2 text-sm">
                        <RadioGroupItem value="type" />
                        <span>Type Rules</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <RadioGroupItem value="upload" />
                        <span>Upload Document</span>
                      </div>
                    </RadioGroup>
                  </div>

                  {rulesInputMethod === "type" ? (
                    <FormField
                      // @ts-ignore
                      control={form.control}
                      name="event_rules"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Event Rules</FormLabel>
                          <FormControl>
                            <Textarea
                              {...field}
                              rows={10}
                              placeholder="Enter event rules..."
                              className=""
                              onFocus={() =>
                                form.setValue("rules_document", "")
                              }
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  ) : (
                    <FormField
                      // @ts-ignore
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
                                      if (!supportedTypes.includes(file.type)) {
                                        toast.error(
                                          "Only PDF, DOC, or DOCX files are supported.",
                                        );
                                        return;
                                      }
                                      setSelectedRuleFile(file);
                                      setPreviewRuleUrl(
                                        URL.createObjectURL(file),
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
                                          rulesFileInputRef.current.value = "";
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
                                      <IconUpload size={16} className="mr-2" />
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
                                      "Only PDF, DOC, or DOCX files are supported.",
                                    );
                                    return;
                                  }

                                  setSelectedRuleFile(file);
                                  field.onChange(file);
                                  setPreviewRuleUrl(URL.createObjectURL(file));
                                }}
                              />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </CardContent>
              </Card>
            )}
            {/* STEP 7 */}
            {currentStep === 7 && (
              <Card className="">
                <CardHeader>
                  <CardTitle>Step 7: Publish & Save</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Publishing Options */}
                  <div className="space-y-2 pt-4 border-t">
                    <p className="text-sm font-medium">
                      Where would you like to publish this event?
                    </p>

                    <FormField
                      // @ts-ignore
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
                      // @ts-ignore
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
                </CardContent>
              </Card>
            )}
            {/* Step Navigation - MODIFIED LOGIC */}
            <div className="flex justify-between items-center">
              {currentStep > 1 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCurrentStep(currentStep - 1)}
                  disabled={isPending}
                >
                  Previous
                </Button>
              )}

              <div className="ml-auto flex gap-3">
                {/* Condition: Steps 1 through 5 - Generic "Next" */}
                {currentStep < 6 ? (
                  <Button
                    type="button"
                    onClick={handleNextStep}
                    disabled={isPending}
                  >
                    Next
                  </Button>
                ) : currentStep === 6 ? (
                  // Condition: Step 6 - Validates and moves to final step (7), DOES NOT SUBMIT
                  <Button
                    type="button"
                    onClick={handleNextStep} // This calls validation and sets step to 7
                    disabled={isPending}
                  >
                    Review & Finalize
                  </Button>
                ) : (
                  // Condition: Step 7 - Only displays the final "Create Event" submit button
                  <Button
                    type="button"
                    // @ts-ignore
                    onClick={form.handleSubmit(onSubmit)}
                    disabled={
                      // Disable if NOT on the final step
                      currentStep !== 7 ||
                      // Disable if submission is pending
                      isPending ||
                      // Disable if the user has NOT selected any final action (Draft or Publish)
                      !hasFinalAction
                    }
                  >
                    {isPending ? "Creating..." : "Create Event"}
                  </Button>
                )}
              </div>
            </div>
            {/* END MODIFIED LOGIC */}
          </form>
          {/* Stage Configuration Modal */}
          <Dialog open={isStageModalOpen} onOpenChange={setIsStageModalOpen}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-xl">
                  {stageModalStep === 1 ? "Stage Details" : "Configure Groups"}
                </DialogTitle>
                <p className="text-sm text-zinc-400">
                  Step {stageModalStep} of 2
                </p>
              </DialogHeader>

              {/* MODAL STEP 1: Stage Basic Info */}
              {stageModalStep === 1 && (
                <div className="space-y-4 py-4">
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
                      className=""
                      placeholder="e.g., Group Stage, Finals"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                        className=""
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
                        className=""
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
                      <SelectTrigger className="">
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

                  {/* FIXED: teams_qualifying_from_stage controlled component for number input */}
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
                      className=""
                    />
                  </div>

                  {/* FIXED: number_of_groups controlled component for number input */}
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
                        handleGroupCountChange(
                          // Convert to number, but use 0 if input is empty string
                          e.target.value === "" ? 0 : Number(e.target.value),
                        )
                      }
                      className=""
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">
                      Stage Discord Role ID{" "}
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
                      className=""
                    />
                  </div>

                  <div className="pt-4 border-t">
                    <p className="text-xs text-muted-foreground mb-2">
                      You will configure {stageModalData.number_of_groups}{" "}
                      group(s) in the next step
                    </p>
                    <div className="flex gap-2 flex-wrap">
                      {tempGroups
                        .slice(0, stageModalData.number_of_groups)
                        .map((group, i) => (
                          <div
                            key={i}
                            className="px-3 py-1 bg-primary/10 rounded-md border border-primary text-xs"
                          >
                            {group.group_name}
                          </div>
                        ))}
                    </div>
                  </div>
                </div>
              )}

              {/* MODAL STEP 2: Groups Configuration WITH MAP SELECTION AND PASSWORD VISIBILITY */}
              {stageModalStep === 2 && (
                <div className="space-y-3">
                  <div className="bg-primary/10 border rounded-md p-4">
                    <p className="text-sm">
                      <span className="font-semibold">Stage:</span>{" "}
                      {stageModalData.stage_name}
                    </p>
                    <p className="text-sm text-zinc-400">
                      {formatDate(stageModalData.start_date)} to{" "}
                      {formatDate(stageModalData.end_date)} |{" "}
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
                            updateGroupDetail(
                              index,
                              "group_name",
                              e.target.value,
                            )
                          }
                          className=""
                          placeholder={`Group ${index + 1}`}
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="text-sm font-medium mb-2 block">
                            Playing Date
                          </label>
                          <Input
                            type="date"
                            value={group.playing_date}
                            onChange={(e) =>
                              updateGroupDetail(
                                index,
                                "playing_date",
                                e.target.value,
                              )
                            }
                            className=""
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
                              updateGroupDetail(
                                index,
                                "playing_time",
                                e.target.value,
                              )
                            }
                            className=""
                          />
                        </div>
                      </div>

                      {/* FIXED: teams_qualifying controlled component for number input */}
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
                            updateGroupDetail(
                              index,
                              "teams_qualifying",
                              // Convert to number, but use 0 if input is empty string
                              e.target.value === ""
                                ? 0
                                : Number(e.target.value),
                            )
                          }
                          className=""
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-2 block">
                          Match count
                        </label>
                        <Input
                          type="number"
                          min={1}
                          // Value must be string, map 0/undefined/null to "" for clean typing
                          value={
                            group.match_count === 0 ? "" : group.match_count
                          }
                          onChange={(e) =>
                            updateGroupDetail(
                              index,
                              "match_count",
                              // Convert to number, but use 0 if input is empty string
                              e.target.value === ""
                                ? 0
                                : Number(e.target.value),
                            )
                          }
                          className=""
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-2 block">
                          Discord Role ID
                        </label>
                        <Input
                          value={group.group_discord_role_id}
                          onChange={(e) =>
                            updateGroupDetail(
                              index,
                              "group_discord_role_id",
                              e.target.value,
                            )
                          }
                          placeholder="e.g: 1234567890"
                          className=""
                        />
                      </div>

                      {/* MAP SELECTION SECTION */}
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
                                className={`cursor-pointer
                                  ${
                                    isSelected
                                      ? "border-primary bg-primary/10 text-primary"
                                      : "border-gray-300 bg-muted text-black dark:text-white hover:border-primary/50"
                                  }
                                `}
                              >
                                {map}
                                {isSelected && <span>✓</span>}
                              </Badge>
                            );
                          })}
                        </div>
                        {(!group.match_maps ||
                          group.match_maps.length === 0) && (
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
                    </div>
                  ))}
                </div>
              )}

              <DialogFooter className="flex justify-between">
                <div>
                  {stageModalStep === 2 && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setStageModalStep(1)}
                    >
                      Back
                    </Button>
                  )}
                </div>
                <div className="flex items-center justify-between gap-2">
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
                            "Please fill all required stage fields (Step 1)",
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
                    <Button type="button" onClick={handleSaveStage}>
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
