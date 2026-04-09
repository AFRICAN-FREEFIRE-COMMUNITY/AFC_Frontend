"use client";

import React, { useState, useTransition, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { useRouter, useSearchParams } from "next/navigation";
import { Form } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/PageHeader";
import { useAuth } from "@/contexts/AuthContext";
import { env } from "@/lib/env";

import {
  EventFormSchema,
  EventFormType,
  GroupType,
  StageType,
} from "./_components/types";
import { Step1EventDetails } from "./_components/Step1EventDetails";
import { Step2EventMode, Step3StageCount } from "./_components/Step2And3";
import { Step4StageOrdering } from "./_components/Step4StageOrdering";
import { Step5PrizePool } from "./_components/Step5PrizePool";
import { Step6EventRules } from "./_components/Step6EventRules";
import { Step7PublishSave } from "./_components/Step7PublishSave";
import { StepSponsorRequirement } from "./_components/StepSponsorRequirement";
import { StepWaitlist } from "./_components/StepWaitlist";
import { StageModal, StageModalData } from "./_components/StageModal";

const DEFAULT_STAGE_MODAL_DATA: StageModalData = {
  stage_name: "",
  start_date: "",
  end_date: "",
  stage_format: "",
  number_of_groups: 2,
  teams_qualifying_from_stage: 1,
  stage_discord_role_id: "",
  prizepool: "",
  prizepool_cash_value: "",
  prize_distribution: {},
};

export default function CreateEventPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const duplicateSlug = searchParams.get("duplicate");
  const { token } = useAuth();
  const [isPending, startTransition] = useTransition();

  // ── Step state ──────────────────────────────────────────────────────────────
  const [currentStep, setCurrentStep] = useState(1);

  // ── File state ──────────────────────────────────────────────────────────────
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [selectedRuleFile, setSelectedRuleFile] = useState<File | null>(null);
  const [previewRuleUrl, setPreviewRuleUrl] = useState("");
  const [rulesInputMethod, setRulesInputMethod] = useState<"type" | "upload">(
    "type",
  );

  // ── Stage state ─────────────────────────────────────────────────────────────
  const [stageNames, setStageNames] = useState<string[]>(["Stage 1"]);
  const [isStageModalOpen, setIsStageModalOpen] = useState(false);
  const [stageModalStep, setStageModalStep] = useState(1);
  const [editingStageIndex, setEditingStageIndex] = useState<number | null>(
    null,
  );
  const [stageModalData, setStageModalData] = useState<StageModalData>(
    DEFAULT_STAGE_MODAL_DATA,
  );
  const [tempGroups, setTempGroups] = useState<GroupType[]>([]);

  // ── Form ────────────────────────────────────────────────────────────────────
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
      prizepool_cash_value: undefined,
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
      restriction_mode: "allow_only",
      is_sponsored: false,
      sponsor_name: "",
      sponsor_usernames: [],
      sponsor_requirement_description: "",
      sponsor_field_label: "",
      is_waitlist_enabled: false,
      waitlist_capacity: undefined,
      waitlist_discord_role_id: "",
    },
  });

  const stages = form.watch("stages") || [];
  const saveToDraftsWatch = form.watch("save_to_drafts");
  const publishToTournamentsWatch = form.watch("publish_to_tournaments");
  const publishToNewsWatch = form.watch("publish_to_news");
  const registration_restriction = form.watch("registration_restriction");
  const hasFinalAction =
    saveToDraftsWatch || publishToTournamentsWatch || publishToNewsWatch;

  // ── Effects ─────────────────────────────────────────────────────────────────

  // Enforce draft/publish mutual exclusivity
  useEffect(() => {
    const isDraft = saveToDraftsWatch;
    const isPublish = publishToTournamentsWatch || publishToNewsWatch;

    if (isDraft && isPublish) {
      form.setValue("publish_to_tournaments", false);
      form.setValue("publish_to_news", false);
      toast.info(
        "Draft mode selected. Publishing options automatically unchecked.",
      );
    } else if (isPublish && isDraft) {
      form.setValue("save_to_drafts", false);
      toast.info("Publishing selected. Draft mode automatically unchecked.");
    }
  }, [saveToDraftsWatch, publishToTournamentsWatch, publishToNewsWatch]);

  // Auto-set restriction_mode when restriction type is first picked
  useEffect(() => {
    if (
      registration_restriction !== "none" &&
      !form.getValues("restriction_mode")
    ) {
      form.setValue("restriction_mode", "allow_only");
    }
  }, [registration_restriction]);

  // ── Duplicate pre-fill ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!duplicateSlug || !token) return;

    const prefillFromEvent = async () => {
      try {
        const res = await fetch(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/get-event-details/`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ slug: duplicateSlug }),
          },
        );
        if (!res.ok) throw new Error();
        const json = await res.json();
        const d = json.event_details;

        const mappedStages: StageType[] = (d.stages ?? []).map((stage: any) => ({
          stage_name: stage.stage_name,
          stage_discord_role_id: stage.stage_discord_role_id || "",
          start_date: stage.start_date,
          end_date: stage.end_date,
          stage_format: stage.stage_format,
          number_of_groups: stage.groups?.length ?? 1,
          teams_qualifying_from_stage: stage.teams_qualifying_from_stage ?? 0,
          prizepool: stage.prizepool?.toString() || "",
          prizepool_cash_value: stage.prizepool_cash_value?.toString() || "",
          prize_distribution: stage.prize_distribution || {},
          groups: (stage.groups ?? []).map((group: any) => ({
            group_name: group.group_name,
            group_discord_role_id: "",
            room_id: "",
            room_name: "",
            room_password: "",
            playing_date: group.playing_date,
            playing_time: group.playing_time?.slice(0, 5) || "00:00",
            teams_qualifying: group.teams_qualifying,
            match_count: group.match_count,
            match_maps: group.match_maps || [],
            prizepool: group.prizepool?.toString() || "",
            prizepool_cash_value: group.prizepool_cash_value?.toString() || "",
            prize_distribution: group.prize_distribution || {},
          })),
        }));

        form.reset({
          event_name: d.event_name,
          competition_type: d.competition_type,
          participant_type: d.participant_type,
          event_type: d.event_type,
          is_public: d.is_public ? "True" : "False",
          max_teams_or_players: d.max_teams_or_players,
          event_mode: d.event_mode,
          number_of_stages: mappedStages.length,
          stages: mappedStages,
          prizepool: d.prizepool?.toString() || "",
          prizepool_cash_value: d.prizepool_cash_value ?? undefined,
          prize_distribution: d.prize_distribution || {},
          event_rules: d.event_rules || "",
          rules_document: "",
          start_date: d.start_date,
          end_date: d.end_date,
          registration_open_date: d.registration_open_date,
          registration_end_date: d.registration_end_date,
          registration_link: d.registration_link || "",
          event_status: "upcoming",
          publish_to_tournaments: false,
          publish_to_news: false,
          save_to_drafts: false,
          registration_restriction: d.registration_restriction || "none",
          restriction_mode: d.restriction_mode || "allow_only",
          selected_locations: d.restricted_countries || [],
          stream_channels: d.stream_channels?.length ? d.stream_channels : [""],
          is_sponsored: d.is_sponsored || false,
          sponsor_name: d.sponsor_name || "",
          sponsor_usernames:
            d.sponsors?.map((s: any) => s.sponsor_username) || [],
          sponsor_requirement_description:
            d.sponsor_requirement_description || "",
          sponsor_field_label: d.sponsor_field_label || "",
          is_waitlist_enabled: d["is_waitlist enabled"] || false,
          waitlist_capacity: d.waitlist_capacity ?? undefined,
          waitlist_discord_role_id: d["waitlist discord_ role_id"] || "",
        });

        setStageNames(mappedStages.map((s) => s.stage_name));

        if (d.event_banner_url) {
          setPreviewUrl(d.event_banner_url);
        }
        if (d.event_rules?.trim()) {
          setRulesInputMethod("type");
        } else if (d.uploaded_rules_url) {
          setRulesInputMethod("upload");
          setPreviewRuleUrl(d.uploaded_rules_url);
        }

        toast.success(`Duplicating "${d.event_name}" — edit the details then create.`);
      } catch {
        toast.error("Failed to load event for duplication.");
      }
    };

    prefillFromEvent();
  }, [duplicateSlug, token]);

  // ── Stage handlers ───────────────────────────────────────────────────────────

  const handleStageCountChange = (count: number) => {
    const newCount = Math.max(0, count);
    form.setValue("number_of_stages", newCount);
    setStageNames(
      Array.from(
        { length: newCount },
        (_, i) => stageNames[i] || `Stage ${i + 1}`,
      ),
    );
  };

  const handleStageNameChange = (index: number, name: string) => {
    const updated = [...stageNames];
    updated[index] = name;
    setStageNames(updated);
  };

  const openStageModal = (stageIndex: number) => {
    setEditingStageIndex(stageIndex);
    setStageModalStep(1);
    const existing = stages[stageIndex];

    if (existing) {
      setStageModalData({
        stage_name: existing.stage_name,
        stage_discord_role_id: existing.stage_discord_role_id || "",
        start_date: existing.start_date,
        end_date: existing.end_date,
        stage_format: existing.stage_format,
        number_of_groups: existing.number_of_groups,
        teams_qualifying_from_stage: existing.teams_qualifying_from_stage || 1,
        prizepool: existing.prizepool || "",
        prizepool_cash_value: existing.prizepool_cash_value || "",
        prize_distribution: existing.prize_distribution || {},
      });
      setTempGroups(existing.groups);
    } else {
      setStageModalData({
        ...DEFAULT_STAGE_MODAL_DATA,
        stage_name: stageNames[stageIndex] || `Stage ${stageIndex + 1}`,
      });
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
          match_maps: [],
        })),
      );
    }
    setIsStageModalOpen(true);
  };

  const handleGroupCountChange = (count: number) => {
    const newCount = Math.max(0, count);
    setTempGroups(
      Array.from(
        { length: newCount },
        (_, i) =>
          tempGroups[i] || {
            group_name: `Group ${i + 1}`,
            playing_date: stageModalData.start_date || "",
            playing_time: "00:00",
            teams_qualifying: 1,
            match_count: 1,
            group_discord_role_id: "",
            room_id: "",
            room_name: "",
            room_password: "",
            match_maps: [],
            prizepool: "",
            prizepool_cash_value: "",
            prize_distribution: {},
          },
      ),
    );
    setStageModalData({ ...stageModalData, number_of_groups: newCount });
  };

  const updateGroupDetail = (
    index: number,
    field: keyof GroupType,
    value: string | number | string[] | Record<string, string>,
  ) => {
    const updated = [...tempGroups];
    updated[index] = { ...updated[index], [field]: value };
    setTempGroups(updated);
  };

  const addMapToGroup = (groupIndex: number, map: string) => {
    const updated = [...tempGroups];
    updated[groupIndex].match_maps = [
      ...(updated[groupIndex].match_maps || []),
      map,
    ];
    setTempGroups(updated);
  };

  const removeOneMapFromGroup = (groupIndex: number, map: string) => {
    const updated = [...tempGroups];
    const current: string[] = updated[groupIndex].match_maps || [];
    const idx = current.lastIndexOf(map);
    if (idx !== -1) {
      updated[groupIndex].match_maps = current.filter((_, i) => i !== idx);
    }
    setTempGroups(updated);
  };

  const handleSaveStage = () => {
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
      prizepool: stageModalData.prizepool,
      prizepool_cash_value: stageModalData.prizepool_cash_value,
      prize_distribution: stageModalData.prize_distribution,
    };

    const currentStages = [...stages];
    currentStages[editingStageIndex!] = newStage;
    form.setValue("stages", currentStages);

    const updatedNames = [...stageNames];
    if (updatedNames[editingStageIndex!] !== newStage.stage_name) {
      updatedNames[editingStageIndex!] = newStage.stage_name;
      setStageNames(updatedNames);
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

  const handleDeleteStage = (index: number) => {
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

  // ── Step validation ──────────────────────────────────────────────────────────

  const handleNextStep = async () => {
    let isValid = false;

    switch (currentStep) {
      case 1:
        isValid = await form.trigger(
          [
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
          ],
          { shouldFocus: true },
        );
        break;

      case 2:
        isValid = await form.trigger(["event_mode"], { shouldFocus: true });
        break;

      case 3:
        isValid = await form.trigger(["number_of_stages"], {
          shouldFocus: true,
        });
        if (isValid && form.getValues("number_of_stages") < 1) {
          toast.error("Number of stages must be at least 1.");
          isValid = false;
        }
        break;

      case 4: {
        const numStages = form.getValues("number_of_stages");
        const configuredStages = form.getValues("stages").length;
        if (configuredStages < numStages) {
          toast.error(
            `Please configure all ${numStages} stages before proceeding. Only ${configuredStages} configured.`,
          );
          return;
        }
        const allValid = form
          .getValues("stages")
          .every((s) => s.groups && s.groups.length > 0);
        if (!allValid) {
          toast.error(
            "One or more stages have not been fully configured with groups.",
          );
          return;
        }
        isValid = true;
        break;
      }

      case 5:
        isValid = await form.trigger(["prizepool"], { shouldFocus: true });
        break;

      case 6:
        if (rulesInputMethod === "type") {
          if (!form.getValues("event_rules")?.trim()) {
            toast.error("Please enter the event rules.");
            return;
          }
          form.setValue("rules_document", "");
        } else {
          if (!form.getValues("rules_document")) {
            toast.error("Please upload the rules document.");
            return;
          }
          form.setValue("event_rules", "");
        }
        isValid = true;
        break;

      case 7:
        isValid = true;
        break;

      case 8:
        isValid = true;
        break;

      default:
        isValid = true;
    }

    if (isValid) setCurrentStep((s) => s + 1);
  };

  // ── Submit ───────────────────────────────────────────────────────────────────

  const onSubmit = (data: EventFormType) => {
    startTransition(async () => {
      try {
        const formData = new FormData();

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
        formData.append(
          "prizepool_cash_value",
          (data.prizepool_cash_value ?? "").toString(),
        );

        const finalEventStatus = data.save_to_drafts
          ? "draft"
          : data.event_status;
        formData.append("is_draft", data.save_to_drafts ? "True" : "False");
        formData.append("event_status", finalEventStatus);
        formData.append("number_of_stages", data.number_of_stages.toString());
        formData.append("start_date", data.start_date);
        formData.append("end_date", data.end_date);
        formData.append("registration_open_date", data.registration_open_date);
        formData.append("registration_end_date", data.registration_end_date);
        formData.append("registration_link", data.registration_link || "");
        formData.append(
          "registration_restriction",
          data?.registration_restriction ?? "none",
        );
        formData.append(
          "restriction_mode",
          form.getValues("restriction_mode") ?? "allow_only",
        );

        if (data?.selected_locations?.length) {
          formData.append(
            "restricted_countries",
            JSON.stringify(data.selected_locations),
          );
        }

        formData.append(
          "publish_to_tournaments",
          data.publish_to_tournaments.toString(),
        );
        formData.append("publish_to_news", data.publish_to_news.toString());
        formData.append("save_to_drafts", data.save_to_drafts.toString());
        formData.append(
          "event_rules",
          rulesInputMethod === "type" ? data.event_rules || "" : "",
        );
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
        const stagesToSend = data.stages.map((stage) => ({
          ...stage,
          prizepool: stage.prizepool || 0,
          prizepool_cash_value: stage.prizepool_cash_value || 0,
          groups: stage.groups.map((group) => ({
            ...group,
            prizepool: group.prizepool || 0,
            prizepool_cash_value: group.prizepool_cash_value || 0,
          })),
        }));
        formData.append("stages", JSON.stringify(stagesToSend));
        formData.append(
          "is_sponsored",
          (data.is_sponsored ?? false).toString(),
        );
        if (data.is_sponsored) {
          formData.append("sponsor_name", data.sponsor_name || "");
          formData.append(
            "sponsor_usernames",
            // @ts-ignore
            JSON.stringify(data.sponsor_usernames ?? []),
          );
          formData.append(
            "sponsor_requirement_description",
            data.sponsor_requirement_description || "",
          );
          formData.append(
            "sponsor_field_label",
            data.sponsor_field_label || "Player UUID",
          );
        }

        // @ts-ignore
        formData.append("is_waitlist_enabled", (data.is_waitlist_enabled ?? false).toString());
        // @ts-ignore
        if (data.is_waitlist_enabled) {
          // @ts-ignore
          formData.append("waitlist_capacity", (data.waitlist_capacity ?? "").toString());
          // @ts-ignore
          formData.append("waitlist_discord_role_id", data.waitlist_discord_role_id || "");
        }

        const response = await fetch(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/create-event/`,
          {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
            body: formData,
          },
        );

        const contentType = response.headers.get("content-type");
        if (!contentType?.includes("application/json")) {
          toast.error("Server error: Received unexpected response format.");
          return;
        }

        const res = await response.json();
        if (response.ok) {
          toast.success(res.message || "Event created successfully!");
          router.push("/a/events");
        } else {
          toast.error(
            res.message ||
              res.detail ||
              "Failed to create event. Please check your inputs.",
          );
        }
      } catch {
        toast.error("An unexpected error occurred during submission.");
      }
    });
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div>
      <PageHeader title={duplicateSlug ? "Duplicate Event" : "Create New Event"} back />
      {duplicateSlug && (
        <div className="mb-4 rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
          You&apos;re duplicating an existing event. All details have been pre-filled — update what you need, then create.
        </div>
      )}

      <Form {...form}>
        {/* @ts-ignore */}
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {currentStep === 1 && (
            <Step1EventDetails
              form={form}
              selectedFile={selectedFile}
              setSelectedFile={setSelectedFile}
              previewUrl={previewUrl}
              setPreviewUrl={setPreviewUrl}
            />
          )}
          {currentStep === 2 && <Step2EventMode form={form} />}
          {currentStep === 3 && (
            <Step3StageCount
              form={form}
              stageNames={stageNames}
              onStageCountChange={handleStageCountChange}
              onStageNameChange={handleStageNameChange}
            />
          )}
          {currentStep === 4 && (
            <Step4StageOrdering
              form={form}
              stageNames={stageNames}
              onMoveStage={moveStage}
              onDeleteStage={handleDeleteStage}
              onOpenStageModal={openStageModal}
            />
          )}
          {currentStep === 5 && <Step5PrizePool form={form} />}
          {currentStep === 6 && (
            <Step6EventRules
              form={form}
              rulesInputMethod={rulesInputMethod}
              setRulesInputMethod={setRulesInputMethod}
              selectedRuleFile={selectedRuleFile}
              setSelectedRuleFile={setSelectedRuleFile}
              previewRuleUrl={previewRuleUrl}
              setPreviewRuleUrl={setPreviewRuleUrl}
            />
          )}
          {currentStep === 7 && <StepSponsorRequirement form={form} />}
          {/* @ts-ignore */}
          {currentStep === 8 && <StepWaitlist form={form} />}
          {currentStep === 9 && <Step7PublishSave form={form} />}

          {/* Navigation */}
          <div className="flex justify-between items-center">
            {currentStep > 1 && (
              <Button
                type="button"
                variant="outline"
                onClick={() => setCurrentStep((s) => s - 1)}
                disabled={isPending}
              >
                Previous
              </Button>
            )}

            <div className="ml-auto flex gap-3">
              {currentStep < 9 ? (
                <Button
                  type="button"
                  onClick={handleNextStep}
                  disabled={isPending}
                >
                  {currentStep === 6 ? "Review & Finalize" : "Next"}
                </Button>
              ) : (
                <Button
                  type="button"
                  // @ts-ignore
                  onClick={form.handleSubmit(onSubmit)}
                  disabled={currentStep !== 9 || isPending || !hasFinalAction}
                >
                  {isPending ? "Creating..." : "Create Event"}
                </Button>
              )}
            </div>
          </div>
        </form>

        {/* Stage Modal */}
        <StageModal
          open={isStageModalOpen}
          onOpenChange={setIsStageModalOpen}
          modalStep={stageModalStep}
          setModalStep={setStageModalStep}
          stageModalData={stageModalData}
          setStageModalData={setStageModalData}
          tempGroups={tempGroups}
          onGroupCountChange={handleGroupCountChange}
          onUpdateGroupDetail={updateGroupDetail}
          onAddMap={addMapToGroup}
          onRemoveMap={removeOneMapFromGroup}
          onSaveStage={handleSaveStage}
        />
      </Form>
    </div>
  );
}
