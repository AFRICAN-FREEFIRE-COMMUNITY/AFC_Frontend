"use client";

import React, { useState, useTransition, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Form } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/PageHeader";
import { InfoTip } from "@/components/ui/info-tip";
import { useAuth } from "@/contexts/AuthContext";
import { env } from "@/lib/env";
// Draft auto-save (owner 2026-07-01): persist the in-progress wizard so Back/refresh doesn't lose work.
import { useEventCreateDraft } from "@/hooks/useEventCreateDraft";
import { EventDraftResumeDialog } from "@/components/events/EventDraftResumeDialog";

import {
  EventFormSchema,
  EventFormType,
  GroupType,
  StageType,
  type AdvancementRuleInput,
} from "./_components/types";
import { Step1EventDetails } from "./_components/Step1EventDetails";
import { Step2EventMode, Step3StageCount } from "./_components/Step2And3";
import { Step4StageOrdering } from "./_components/Step4StageOrdering";
import { Step5PrizePool } from "./_components/Step5PrizePool";
// Prize distribution must add up to the compulsory cash value (owner 2026-07-02).
import { validatePrizeDistribution } from "./_components/PrizeDistributionSummary";
import { Step6EventRules } from "./_components/Step6EventRules";
import { Step7PublishSave } from "./_components/Step7PublishSave";
import { StepSponsorRequirement } from "./_components/StepSponsorRequirement";
import { StepWaitlist } from "./_components/StepWaitlist";
import { StageModal, StageModalData } from "./_components/StageModal";
import { DEFAULT_ROUND_ROBIN_CONFIG } from "../_components/RoundRobinPanel";
// Stage-shape helpers: a Clash Squad stage has NO groups (it runs as a bracket) and a BR
// Round-Robin stage keeps its groups on round_robin.round_robin_groups, so the Step-4 gate
// below has to branch per shape instead of counting stage.groups. See lib/eventFormats.ts.
import {
  isClashSquadFormat,
  isRoundRobinBuilderFormat,
} from "@/lib/eventFormats";
// Upload size gate + honest failure messages (owner-reported 2026-08-05).
import { checkUploadSize, describeSubmitFailure } from "@/lib/upload-limits";
// ── Sponsor-system P2: post-create sponsor attach loop. ──
// StepSponsorRequirement's builder holds SponsorshipDraft rows in the `sponsorships`
// form field; after create-event returns the new event_id, onSubmit below attaches +
// configures each via sponsorsApi (see the "attach picked sponsors" block).
import { sponsorsApi } from "@/lib/sponsors";
import {
  SponsorshipDraft,
  sponsorshipIssues,
} from "@/components/sponsorship-builder";

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
  // ── Scoring-mode defaults (sub-project A): both modes off until toggled. ──
  champion_point_enabled: false,
  champion_point_threshold: undefined,
  point_rush_enabled: false,
  point_rush_reward: {},
  point_rush_target_index: undefined,
  // ── Branching advancement default (feature #9): no rules = legacy linear advance. ──
  advancement_rules: [],
  // ── Round-Robin default (sub-project B): two empty base groups, auto-schedule. ──
  round_robin: DEFAULT_ROUND_ROBIN_CONFIG,
};

export default function CreateEventPage() {
  // i18n (evCreatePage ns): mirrors the organizer create twin's wiring. Covers this page's own
  // chrome (header, duplicate hint, draft-resume dialog, nav buttons) and every step-validation /
  // submit toast authored here. The reused wizard step components own their own strings via their
  // own namespaces; this translator only covers strings authored in THIS file.
  const t = useTranslations("evCreatePage");
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
      // Discord registration gate defaults OFF (no behaviour change for events that
      // don't opt in). See Step1EventDetails' toggle + the require_discord append below.
      require_discord: false,
      discord_server_id: "",
      // Discord invite link defaults empty; required only when require_discord is ON
      // (enforced in onSubmit + by the backend). See DiscordRegistrationGate.
      discord_invite_link: "",
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
      // Paid-vs-free registration defaults to FREE (no fee collected). See
      // Step1EventDetails' Registration block + the EventFormSchema refine.
      registration_type: "free",
      registration_fee: null,
      registration_fee_currency: "USD",
      country_payment_rules: null,
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
      // Sponsor-system P2: builder rows (SponsorshipDraft[]), attached post-create.
      sponsorships: [],
      is_waitlist_enabled: false,
      waitlist_capacity: undefined,
      waitlist_discord_role_id: "",
      waitlist_mode: "first_registered",
      event_start_time: "",
      event_end_time: "",
      registration_start_time: "",
      registration_end_time: "",
    },
  });

  const stages = form.watch("stages") || [];
  const saveToDraftsWatch = form.watch("save_to_drafts");
  const publishToTournamentsWatch = form.watch("publish_to_tournaments");
  const publishToNewsWatch = form.watch("publish_to_news");
  const registration_restriction = form.watch("registration_restriction");
  const hasFinalAction =
    saveToDraftsWatch || publishToTournamentsWatch || publishToNewsWatch;

  // ── Draft auto-save (owner 2026-07-01) ──────────────────────────────────────
  // Persist the whole in-progress wizard to localStorage (debounced) so navigating Back / a refresh
  // does NOT wipe an organizer's work. `draftWatch` subscribes to every field so any edit re-arms the
  // save; currentStep/stageNames/rulesInputMethod are the wizard's extra state. Files (banner/rules
  // doc) can't be JSON-serialized, so they're re-attached after a resume. See useEventCreateDraft.
  const draftWatch = form.watch();
  const {
    savedDraft: eventDraft,
    clear: clearEventDraft,
    discard: discardEventDraft,
    markResumed: markEventDraftResumed,
  } = useEventCreateDraft({
    storageKey: "afc:event-create-draft:admin",
    active: !duplicateSlug, // don't restore/collide while the ?duplicate= prefill runs
    snapshot: () => ({
      values: form.getValues(),
      currentStep,
      stageNames,
      rulesInputMethod,
    }),
    deps: [draftWatch, currentStep, stageNames, rulesInputMethod],
    // Only treat it as a real draft once an event name has been typed (avoids prompting for a blank form).
    shouldSave: (b) => !!String((b.values as { event_name?: string })?.event_name || "").trim(),
  });

  const resumeEventDraft = () => {
    if (!eventDraft) return;
    // @ts-ignore - saved values were produced by this same form's getValues().
    form.reset(eventDraft.values);
    setStageNames(eventDraft.stageNames?.length ? eventDraft.stageNames : ["Stage 1"]);
    setCurrentStep(eventDraft.currentStep || 1);
    setRulesInputMethod(eventDraft.rulesInputMethod === "upload" ? "upload" : "type");
    markEventDraftResumed();
    toast.info(t("toast.draftRestored"));
  };

  // ── Invalid-submit surfacing (owner 2026-07-01) ─────────────────────────────────
  // "Create event" / "Save to draft" used form.handleSubmit(onSubmit, onInvalidSubmit) with NO invalid handler, so a
  // failing validation silently did nothing (dead button). Jump to the erroring step + toast which
  // fields are wrong so the admin always sees WHY it didn't submit.
  const FIELD_STEP: Record<string, number> = {
    event_name: 1, competition_type: 1, participant_type: 1, event_type: 1, is_public: 1,
    registration_open_date: 1, registration_end_date: 1, start_date: 1, end_date: 1,
    max_teams_or_players: 1, registration_type: 1, registration_fee: 1,
    event_mode: 2, number_of_stages: 3, stages: 4,
    prizepool: 5, prizepool_cash_value: 5, prize_distribution: 5, prize_currency: 5,
    event_rules: 6, rules_document: 6,
  };
  const onInvalidSubmit = (errors: Record<string, unknown>) => {
    // Walk the RHF error tree down to leaf messages. Fields nest (stages[i].groups[j].<field>), so a
    // top-level "stages" error is useless - this pinpoints the EXACT stage/group/field + its message.
    const leaves: { path: string; message: string }[] = [];
    const walk = (node: any, path: string) => {
      if (!node || typeof node !== "object") return;
      if (typeof node.message === "string" && node.message) {
        leaves.push({ path, message: node.message });
        return;
      }
      for (const k of Object.keys(node)) {
        if (k === "ref" || k === "type") continue;
        walk(node[k], path ? `${path}.${k}` : k);
      }
    };
    walk(errors, "");
    const topField = (leaves[0]?.path || Object.keys(errors || {})[0] || "").split(".")[0];
    if (topField) setCurrentStep(FIELD_STEP[topField] ?? 1);
    if (!leaves.length) {
      toast.error(t("toast.someFieldsMissing"));
      return;
    }
    // "stages.2.groups.1.match_maps" -> "Stage 3 > Group 2 > Match Maps".
    const humanizePath = (p: string) => {
      const segs = p.split(".");
      const parts: string[] = [];
      for (let i = 0; i < segs.length; i++) {
        if (/^\d+$/.test(segs[i])) continue;
        const idx = /^\d+$/.test(segs[i + 1]) ? ` ${Number(segs[i + 1]) + 1}` : "";
        const base = idx ? segs[i].replace(/s$/, "") : segs[i];
        parts.push(base.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) + idx);
      }
      return parts.join(" › ");
    };
    // Replace Zod's raw "Invalid input: expected string, received undefined" with a plain "required".
    // NOTE: humanizePath() derives the field label from the schema field path (e.g. "Match Maps")
    // and stays English - those are structural field identifiers, not authored copy (see report).
    const clean = (m: string) =>
      /invalid input|expected .* received (undefined|nan|null)|^required$/i.test(m)
        ? t("toast.fieldRequired")
        : m;
    const lines = leaves.slice(0, 4).map((l) => `${humanizePath(l.path)}: ${clean(l.message)}`);
    toast.error(t("toast.pleaseFix", { details: lines.join("   •   ") }), { duration: 9000 });
  };

  // ── Round-robin schedule backfill (owner 2026-07-01) ────────────────────────────
  // A round-robin stage keeps its schedule on the game-day meetings (round_robin.game_days), so its
  // base groups have no date/maps and would FAIL the per-group validation. The backend ignores group
  // date/maps for a round-robin stage, so just before submit we copy the meetings' date/time/maps onto
  // the base groups to satisfy the validator. Non-round-robin stages are untouched. Then submit.
  const handleFinalSubmit = () => {
    // Compulsory prizes (owner 2026-07-02): a real (non-draft) event needs a cash value AND a
    // distribution that adds up to it. Tells the admin exactly how far over/under they are + jumps
    // to the prize step. Drafts can be saved incomplete.
    const _pv = form.getValues();
    if (!_pv.save_to_drafts) {
      const _pe = validatePrizeDistribution(
        _pv.prize_distribution,
        _pv.prizepool_cash_value,
        (_pv.prize_currency as string) || "USD",
      );
      if (_pe) {
        // validatePrizeDistribution returns a {code, values} descriptor now (i18n); localize it here
        // with this page's evCreatePage translator. Key: prizeValidate.required|over|under.
        toast.error(t(_pe.code, _pe.values), { duration: 9000 });
        setCurrentStep(5);
        return;
      }
    }

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
    // @ts-ignore - resolver widens the form's internal TFieldValues generic (same cast the original
    // button used on form.handleSubmit(onSubmit)).
    form.handleSubmit(onSubmit, onInvalidSubmit)();
  };

  // ── Effects ─────────────────────────────────────────────────────────────────

  // Enforce draft/publish mutual exclusivity
  useEffect(() => {
    const isDraft = saveToDraftsWatch;
    const isPublish = publishToTournamentsWatch || publishToNewsWatch;

    if (isDraft && isPublish) {
      form.setValue("publish_to_tournaments", false);
      form.setValue("publish_to_news", false);
      toast.info(t("toast.draftModeSelected"));
    } else if (isPublish && isDraft) {
      form.setValue("save_to_drafts", false);
      toast.info(t("toast.publishingSelected"));
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

        // Map each source stage_id to its 0-based position so a duplicated event's
        // Point-Rush carry-over target (echoed as a stage_id) becomes a target_index.
        const dupStageIndexById = new Map<number, number>(
          (d.stages ?? []).map((s: any, i: number) => [
            s.stage_id ?? s.id,
            i,
          ]),
        );

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
          // ── Scoring-mode config carried over when duplicating an event. ──
          champion_point_enabled: stage.champion_point_enabled ?? false,
          champion_point_threshold: stage.champion_point_threshold ?? undefined,
          point_rush_enabled: stage.point_rush_enabled ?? false,
          point_rush_reward: stage.point_rush_reward || {},
          point_rush_target_index:
            stage.point_rush_target_stage_id != null
              ? dupStageIndexById.get(stage.point_rush_target_stage_id)
              : undefined,
          // ── Branching advancement rules carried over when duplicating (feature #9). ──
          // Remap each echoed rule's target_stage_id -> target_stage_index (dupStageIndexById) and
          // source_group_id -> source_group_index (its position in this stage's groups). Rules whose
          // target stage no longer resolves are dropped (defensive; shouldn't happen).
          advancement_rules: (stage.advancement_rules ?? [])
            .map((r: any) => {
              const groupIdx =
                r.source_group_id != null
                  ? (stage.groups ?? []).findIndex(
                      (g: any) => (g.group_id ?? g.id) === r.source_group_id,
                    )
                  : -1;
              const targetIdx = dupStageIndexById.get(r.target_stage_id);
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
          // Carry the Discord gate over when duplicating an event.
          require_discord: d.require_discord ?? false,
          discord_server_id: d.discord_server_id ?? "",
          discord_invite_link: d.discord_invite_link ?? "",
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
          // Carry the paid-vs-free config over when duplicating an event.
          registration_type: d.registration_type || "free",
          registration_fee: d.registration_fee ?? null,
          registration_fee_currency: d.registration_fee_currency || "USD",
          country_payment_rules: d.country_payment_rules ?? null,
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
          event_start_time: d.event_start_time?.slice(0, 5) || "",
          event_end_time: d.event_end_time?.slice(0, 5) || "",
          registration_start_time: d.registration_start_time?.slice(0, 5) || "",
          registration_end_time: d.registration_end_time?.slice(0, 5) || "",
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

        toast.success(t("toast.duplicating", { name: d.event_name }));
      } catch {
        toast.error(t("toast.duplicateLoadFailed"));
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
        // ── Scoring-mode config carried back into the modal for re-editing. ──
        champion_point_enabled: existing.champion_point_enabled ?? false,
        champion_point_threshold: existing.champion_point_threshold,
        point_rush_enabled: existing.point_rush_enabled ?? false,
        point_rush_reward: existing.point_rush_reward ?? {},
        point_rush_target_index: existing.point_rush_target_index,
        // ── Branching advancement rules carried back into the modal (feature #9). The form
        //    already stores them as indices (StageType), so pass them straight through. ──
        advancement_rules: existing.advancement_rules ?? [],
        // ── Round-Robin config carried back (default if the stage had none). ──
        round_robin: existing.round_robin ?? DEFAULT_ROUND_ROBIN_CONFIG,
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

  // Match count is DERIVED from the maps selected (owner 2026-06-13): one match per map,
  // so the admin never types a separate count - selecting N maps = N matches. Both
  // handlers keep match_count in sync with match_maps.length.
  const addMapToGroup = (groupIndex: number, map: string) => {
    const updated = [...tempGroups];
    const maps = [...(updated[groupIndex].match_maps || []), map];
    updated[groupIndex].match_maps = maps;
    updated[groupIndex].match_count = maps.length;
    setTempGroups(updated);
  };

  const removeOneMapFromGroup = (groupIndex: number, map: string) => {
    const updated = [...tempGroups];
    const current: string[] = updated[groupIndex].match_maps || [];
    const idx = current.lastIndexOf(map);
    if (idx !== -1) {
      const maps = current.filter((_, i) => i !== idx);
      updated[groupIndex].match_maps = maps;
      updated[groupIndex].match_count = maps.length;
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
      toast.error(t("toast.fillRequiredStageFields"));
      return;
    }

    // Round-robin stages are validated on their BASE GROUPS, not the classic per-group
    // config (which the backend ignores for this format, and which the modal no longer
    // shows). A round-robin needs at least two base groups to form a pairing.
    const isRoundRobinStage = stageModalData.stage_format === "br - round robin";
    // Clash Squad (cs - *) runs as a head-to-head BRACKET seeded from the registered teams on
    // the event page - it has no groups/maps to validate and sends groups: [] (P1#2, owner
    // 2026-07-13). Without this it fell into the BR `else` and the default tempGroups failed.
    const isClashSquadStage = isClashSquadFormat(stageModalData.stage_format);
    if (isRoundRobinStage) {
      const baseGroups = stageModalData.round_robin?.round_robin_groups ?? [];
      if (baseGroups.length < 2) {
        toast.error(t("toast.roundRobinTwoGroups"));
        return;
      }
      if (baseGroups.some((g) => !g.label.trim())) {
        toast.error(t("toast.baseGroupLabel"));
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
        toast.error(t("toast.completeGroupDetails"));
        return;
      }

      if (stageModalData.number_of_groups < 1) {
        toast.error(t("toast.stageAtLeastOneGroup"));
        return;
      }
    }

    const newStage: StageType = {
      stage_name: stageModalData.stage_name,
      stage_discord_role_id: stageModalData.stage_discord_role_id,
      start_date: stageModalData.start_date,
      end_date: stageModalData.end_date,
      number_of_groups: stageModalData.number_of_groups,
      stage_format: stageModalData.stage_format,
      // A round-robin stage's lobbies come from its base groups (the round_robin config below),
      // NOT the classic per-group list. tempGroups can still hold leftover classic groups (e.g. the
      // default "Group A" from before the format was switched to round-robin); sending those makes
      // the backend's normal group loop (afc_tournament_and_scrims.views.create_event) create a
      // STRAY extra group alongside the round-robin lobbies. Bug fix 2026-06-29: send [] for
      // round-robin so only the base groups + game-day lobbies are created.
      groups: isRoundRobinStage || isClashSquadStage ? [] : tempGroups,
      teams_qualifying_from_stage: stageModalData.teams_qualifying_from_stage,
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
      //    resolved to StageAdvancementRule rows in the backend create second pass. ──
      advancement_rules: stageModalData.advancement_rules ?? [],
      // ── Round-Robin config (sub-project B) - only meaningful for the BR
      //    Round-Robin format; sent only when that format is selected so other
      //    bracket types don't carry a stray round_robin payload. ──
      ...(stageModalData.stage_format === "br - round robin"
        ? { round_robin: stageModalData.round_robin }
        : {}),
      // ── Clash Squad room settings (owner 2026-08-13) - optional ────────────────
      // Sent only when the organizer actually filled it in, and only for a CS stage. Absent means
      // no room configuration is created, which is how every Clash Squad stage behaved before.
      // create_event turns it into a CSRoomConfig scoped to the new stage.
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

    const currentStages = [...stages];
    currentStages[editingStageIndex!] = newStage;
    form.setValue("stages", currentStages);

    const updatedNames = [...stageNames];
    if (updatedNames[editingStageIndex!] !== newStage.stage_name) {
      updatedNames[editingStageIndex!] = newStage.stage_name;
      setStageNames(updatedNames);
    }

    toast.success(t("toast.stageSaved"));
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
      // direction is strictly "up" | "down"; guard the dynamic key defensively so a missing
      // translation can never throw MISSING_MESSAGE at render (mirrors the organizer twin).
      const directionLabel = t.has(`toast.direction.${direction}`)
        ? t(`toast.direction.${direction}`)
        : direction;
      toast.success(
        t("toast.stageMoved", {
          name: stageNames[index] || t("misc.stageFallback"),
          direction: directionLabel,
        }),
      );
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
      toast.success(t("toast.stageDeleted"));
    } else {
      toast.error(t("toast.eventAtLeastOneStage"));
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
          toast.error(t("toast.numStagesMin"));
          isValid = false;
        }
        break;

      case 4: {
        const numStages = form.getValues("number_of_stages");
        const configuredStages = form.getValues("stages").length;
        if (configuredStages < numStages) {
          toast.error(
            t("toast.configureAllStages", {
              total: numStages,
              configured: configuredStages,
            }),
          );
          return;
        }
        // Shape-aware "is this stage finished?" check (owner 2026-08-12). The old blanket
        // `s.groups.length > 0` blocked Next for the two GROUPLESS stage shapes and pointed the
        // admin at a groups UI that does not exist for them:
        //   • Clash Squad ("cs - *")   -> runs as a bracket, generated later from the event page,
        //                                 so it is complete with just name/dates/qualifiers.
        //   • BR Round-Robin           -> its groups are the base groups A/B/C in the round-robin
        //                                 panel, so check THOSE instead of stage.groups.
        // Mirrors the edit flow's validateEventData (app/(a)/a/events/[slug]/edit/types.tsx).
        const allValid = form.getValues("stages").every((s) => {
          if (isClashSquadFormat(s.stage_format)) return true;
          if (isRoundRobinBuilderFormat(s.stage_format)) {
            return (s.round_robin?.round_robin_groups?.length ?? 0) > 0;
          }
          return !!s.groups && s.groups.length > 0;
        });
        if (!allValid) {
          toast.error(t("toast.stagesNotConfigured"));
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
            toast.error(t("toast.enterEventRules"));
            return;
          }
          form.setValue("rules_document", "");
        } else {
          if (!form.getValues("rules_document")) {
            toast.error(t("toast.uploadRulesDocument"));
            return;
          }
          form.setValue("event_rules", "");
        }
        isValid = true;
        break;

      case 7: {
        // Sponsor-system P2: block Next while a builder engagement is missing a
        // server-required field (client mirror of afc_sponsors/engagements.py).
        const issues = sponsorshipIssues(
          // @ts-ignore - sponsorships is z.array(z.any()) in the schema.
          (form.getValues("sponsorships") as SponsorshipDraft[] | undefined) ?? [],
        );
        if (issues.length > 0) {
          // issues[0] text comes from the shared sponsorshipIssues() helper (own ns/source);
          // only the "+N more" counter suffix is authored + translated here.
          toast.error(
            issues[0] +
              (issues.length > 1
                ? " " + t("toast.moreIssues", { count: issues.length - 1 })
                : ""),
          );
          return;
        }
        isValid = true;
        break;
      }

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
    // Distribution-vs-cash-value guard (owner 2026-07-02): block create when the prize
    // distribution does not add up to the cash value, with the exact difference in the message.
    {
      const cash = Number(data.prizepool_cash_value);
      if (cash && !Number.isNaN(cash)) {
        const sum = Object.values(data.prize_distribution || {}).reduce(
          (acc: number, v) => acc + (Number(String(v).replace(/[^0-9.]/g, "")) || 0),
          0,
        );
        if (sum !== cash) {
          const diff = Math.abs(cash - sum);
          const ccy = (data.prize_currency || "USD").toString();
          // Values passed as strings so the ICU placeholders render the raw amounts verbatim
          // (no locale number-reformatting), matching the previous hardcoded template output.
          toast.error(
            sum > cash
              ? t("toast.prizeDistributionOver", {
                  sum: String(sum),
                  diff: String(diff),
                  cash: String(cash),
                  currency: ccy,
                })
              : t("toast.prizeDistributionUnder", {
                  sum: String(sum),
                  diff: String(diff),
                  cash: String(cash),
                  currency: ccy,
                }),
          );
          return;
        }
      }
    }

    // Mirror the backend 400: require_discord=true demands a non-empty invite link.
    if (data.require_discord && !data.discord_invite_link?.trim()) {
      toast.error(t("toast.discordInviteRequired"));
      setCurrentStep(1);
      return;
    }
    startTransition(async () => {
      try {
        // Size gate before the request is built - same reason as the organizer create page:
        // nginx 413s an over-sized body with no CORS headers, which surfaces as an
        // unreadable fetch rejection. See lib/upload-limits.ts.
        const tooBig =
          checkUploadSize(selectedFile, "The event banner") ??
          checkUploadSize(selectedRuleFile, "The rules file");
        if (tooBig) {
          toast.error(tooBig);
          return;
        }

        const formData = new FormData();

        if (selectedFile) formData.append("event_banner", selectedFile);
        if (selectedRuleFile)
          formData.append("uploaded_rules", selectedRuleFile);

        formData.append("event_name", data.event_name);
        formData.append("competition_type", data.competition_type);
        formData.append("participant_type", data.participant_type);
        formData.append("event_type", data.event_type);
        formData.append("is_public", data.is_public);
        // Discord registration gate (mirrors the is_sponsored boolean append): always
        // send the flag; only send the Guild ID when the gate is ON (blank = main AFC
        // server). create_event reads both keys (see MINTROUTE/backend contract).
        formData.append(
          "require_discord",
          (data.require_discord ?? false).toString(),
        );
        if (data.require_discord) {
          formData.append("discord_server_id", data.discord_server_id || "");
          // Required when the gate is ON (guarded above + backend 400s without it).
          formData.append(
            "discord_invite_link",
            data.discord_invite_link || "",
          );
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
        // Currency the prize amounts are in (owner 2026-07-01) so the backend converts FROM the right
        // one; default USD (the platform base). Read by create_event -> Event.prize_currency.
        formData.append("prize_currency", (data.prize_currency || "USD").toString());

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
        // ── Paid-vs-free registration (non-payment phase). ──
        // AFC-admin events never need the paid-event terms gate (that's organizer
        // only), so we just send the three fields. The backend defaults
        // registration_type to "free"; fee/currency only matter when "paid".
        formData.append("registration_type", data.registration_type || "free");
        if (data.registration_type === "paid" && data.registration_fee != null) {
          formData.append(
            "registration_fee",
            data.registration_fee.toString(),
          );
          formData.append(
            "registration_fee_currency",
            data.registration_fee_currency || "USD",
          );
          // Per-country payment rules (owner 2026-06-24): only sent for paid events. JSON-encoded;
          // the backend parses + validates via _parse_country_payment_rules. Null/absent => everyone
          // pays the base fee (no per-country config).
          if (data.country_payment_rules) {
            formData.append(
              "country_payment_rules",
              JSON.stringify(data.country_payment_rules),
            );
          }
        }
        // Times are now compulsory (owner 2026-06-21) so always send the four of them
        // (the Zod schema guarantees they're non-empty) plus the creator's IANA timezone,
        // so the backend can store the times paired with the tz they were entered in.
        formData.append("event_start_time", data.event_start_time);
        formData.append("event_end_time", data.event_end_time);
        formData.append("registration_start_time", data.registration_start_time);
        formData.append("registration_end_time", data.registration_end_time);
        formData.append(
          "timezone",
          Intl.DateTimeFormat().resolvedOptions().timeZone || "",
        );
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
          // @ts-ignore - slot-assignment mode (owner 2026-06-17)
          formData.append("waitlist_mode", data.waitlist_mode || "first_registered");
        }

        // Media registration criteria (owner 2026-06-12). Read straight off the form (NOT the
        // zod-parsed `data` - the schema strips these shared optional toggles from StepWaitlist).
        formData.append(
          "require_team_logo",
          String((form.getValues("require_team_logo" as never) as unknown as boolean) ?? false),
        );
        formData.append(
          "require_esport_images",
          String((form.getValues("require_esport_images" as never) as unknown as boolean) ?? false),
        );
        // F3 (owner 2026-06-19): two more per-player registration gates, same hand-append pattern.
        formData.append(
          "require_player_profile_image",
          String((form.getValues("require_player_profile_image" as never) as unknown as boolean) ?? false),
        );
        formData.append(
          "require_player_uid",
          String((form.getValues("require_player_uid" as never) as unknown as boolean) ?? false),
        );
        // WhatsApp number gate (owner 2026-08-03), same hand-append pattern: create_event reads it
        // into Event.require_whatsapp, register_for_event then blocks any player with no number.
        formData.append(
          "require_whatsapp",
          String((form.getValues("require_whatsapp" as never) as unknown as boolean) ?? false),
        );
        // Required connected accounts (owner 2026-08-26), same hand-append pattern as the
        // require_* toggles above. A LIST, so it travels as JSON: multipart FormData can only
        // carry strings, and create_event coerces it back with the repo's existing _as_list.
        formData.append(
          "required_connections",
          JSON.stringify(
            (form.getValues("required_connections" as never) as unknown as string[]) ?? [],
          ),
        );
        // Letter-avatars registration gate (feature #7, owner 2026-06-29). UNLIKE the require_*
        // toggles above this is a NUMBER (0-26, 0 = off), written into RHF by Step1EventDetails'
        // "Require letter avatars" Switch + count input. create_event re-parses + clamps it
        // (_parse_min_letter_avatars) into Event.min_letter_avatars, which register_for_event then
        // enforces. Without this append the toggle never reached the backend.
        formData.append(
          "min_letter_avatars",
          String(
            Number((form.getValues("min_letter_avatars" as never) as unknown as number) ?? 0) || 0,
          ),
        );

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
          toast.error(t("toast.serverError"));
          return;
        }

        const res = await response.json();
        if (response.ok) {
          // ── Sponsor-system P2: attach the builder's picked sponsors. ──
          // create_event returns {message, event_id} (afc_tournament_and_scrims/
          // views.py); the sponsorship endpoints key on that event_id. Loop the
          // wizard's `sponsorships` rows: attach, then patch the engagement config.
          // Partial failures only toast (the event itself was created) - the admin
          // can re-add the failed sponsor from the event's Sponsor tab. Navigation
          // is never blocked.
          const newEventId: number | undefined = res.event_id;
          const sponsorships: SponsorshipDraft[] =
            // @ts-ignore - sponsorships is z.array(z.any()) in the schema.
            (data.sponsorships as SponsorshipDraft[] | undefined) ?? [];
          if (newEventId && sponsorships.length > 0) {
            const failedSponsors: string[] = [];
            for (const s of sponsorships) {
              try {
                await sponsorsApi.attachEvent(s.sponsor_id, newEventId);
                await sponsorsApi.configureSponsorship(s.sponsor_id, newEventId, {
                  requires_approval: s.requires_approval,
                  engagements: s.engagements,
                });
              } catch {
                failedSponsors.push(s.sponsor_name);
              }
            }
            if (failedSponsors.length > 0) {
              toast.error(
                t("toast.sponsorAttachFailed", {
                  names: failedSponsors.join(", "),
                }),
              );
            }
          }
          toast.success(res.message || t("toast.eventCreated"));
          clearEventDraft(); // wizard submitted -> drop the saved localStorage draft
          router.push("/a/events");
        } else {
          toast.error(
            res.message || res.detail || t("toast.createFailed"),
          );
        }
      } catch {
        // See the organizer create page: a thrown fetch carries no status, so name the
        // likely cause from the attached files rather than showing a blanket apology.
        toast.error(describeSubmitFailure([selectedFile, selectedRuleFile]));
      }
    });
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Resume-or-start-fresh prompt when a saved draft exists (owner 2026-07-01). */}
      <EventDraftResumeDialog
        open={!!eventDraft}
        savedAt={eventDraft?.savedAt}
        title={t("resume.title")}
        description={t("resume.description")}
        resumeLabel={t("resume.resume")}
        discardLabel={t("resume.startFresh")}
        onResume={resumeEventDraft}
        onDiscard={discardEventDraft}
      />
      <PageHeader
        // Wrap the title so the page-level ⓘ sits right after it (PageHeader takes a ReactNode).
        // data-tour anchor: admin tour "Create new event" step (events-lb area, create sub-page).
        title={
          <span data-tour="event-create-title" className="inline-flex flex-wrap items-center">
            {duplicateSlug ? t("header.titleDuplicate") : t("header.title")}
            <InfoTip id="events.create._page" className="ml-1.5" />
          </span>
        }
        back
      />
      {duplicateSlug && (
        <div className="mb-4 rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
          {t("header.duplicateHint")}
        </div>
      )}

      <Form {...form}>
        {/* @ts-ignore */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleFinalSubmit();
          }}
          className="space-y-6"
        >
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
                {t("nav.previous")}
              </Button>
            )}

            {/* data-tour anchor (event-create-next-button): wraps the wizard Next /
                Create action. The same slot renders "Next" on steps 1-8 and the final
                "Create Event" button on step 9, so the tour can point at step navigation
                regardless of which step is open. */}
            <div data-tour="event-create-next-button" className="ml-auto flex gap-3">
              {currentStep < 9 ? (
                <Button
                  type="button"
                  onClick={handleNextStep}
                  disabled={isPending}
                >
                  {currentStep === 6 ? t("nav.reviewFinalize") : t("nav.next")}
                </Button>
              ) : (
                <Button
                  type="button"
                  // data-tour anchor (event-create-save): final-step "Create Event" submit.
                  data-tour="event-create-save"
                  // @ts-ignore
                  onClick={handleFinalSubmit}
                  disabled={currentStep !== 9 || isPending || !hasFinalAction}
                >
                  {isPending ? t("nav.creating") : t("nav.createEvent")}
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
          stageNames={stageNames}
          editingStageIndex={editingStageIndex}
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
