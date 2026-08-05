// ─────────────────────────────────────────────────────────────────────────────
// Organizer › Events › Create.
//
// FULL feature-parity with the AFC-admin create-event wizard
// (app/(a)/a/events/create/page.tsx), MINUS every Discord-role input. An organizer
// now gets the SAME rich capabilities AFC admins have: a multi-step wizard with
// event details + banner + registration window + restrictions, event mode, a real
// multi-stage builder (stage formats, scoring modes - Champion-Point / Point-Rush -
// round-robin base groups, per-stage + per-group prize pools and maps), a top-level
// prize pool + distribution, type-or-upload event rules, a sponsor requirement, a
// waitlist, and publish/draft.
//
// REUSE (Approach A - reuse the admin Step components):
//   The admin Step components are cleanly composable (each takes the shared
//   `form: UseFormReturn<EventFormType>` plus a few callbacks), so this page REUSES
//   them verbatim rather than re-implementing the wizard:
//     • Step1EventDetails  - name, types, dates/times, banner, streams, restrictions
//     • Step2EventMode / Step3StageCount - event mode + stage count/names
//     • Step4StageOrdering - reorder/add/edit/delete stages, opens the StageModal
//     • StageModal         - per-stage config (formats, scoring modes, round-robin,
//                            groups, maps, prizes); passed hideDiscord
//     • Step5PrizePool     - top-level prize pool + distribution
//     • Step6EventRules    - typed or uploaded rules
//     • StepSponsorRequirement - sponsor gating + sponsor accounts
//     • StepWaitlist       - waitlist capacity; passed hideDiscord
//     • Step7PublishSave   - publish-to-tournaments vs save-as-draft
//   The stage-editing STATE + handlers (stageNames, openStageModal, handleSaveStage,
//   moveStage, …) are page-level in the admin page too, so they are ported here 1:1;
//   they drive the reused StageModal exactly as on the admin page.
//
// DISCORD OMISSION (the only intentional divergence from the admin wizard):
//   AFC's Discord-role automation is an admin-only concern for now, so EVERY Discord
//   input is hidden for organizers:
//     • Stage Discord Role ID  → StageModal hideDiscord hides it (payload still sends
//                                an empty stage_discord_role_id, so the shape matches).
//     • Group Discord Role ID  → StageModal hideDiscord hides it (empty
//                                group_discord_role_id in the payload).
//     • Waitlist Discord Role ID → StepWaitlist hideDiscord hides it (empty
//                                waitlist_discord_role_id in the payload).
//   No "connect Discord" / Discord-role UI is rendered anywhere in this flow.
//
// GATING: rendered only when the caller can create events
//   (membership.permissions.can_create_events OR isOwner) - same gate the events list
//   page uses for its "Create event" CTA. Otherwise a read-only notice + a link back.
//
// SUBMIT (org-scoping preserved): POST multipart FormData to /events/create-event/
//   with a Bearer token from AuthContext (mirrors the admin page). The ONE
//   organizer-specific bit is `organization_id`, which homes the event to the selected
//   org - the backend's create_event reads it, checks org_can(user, "can_create_events",
//   org), and sets event.organization=org (see afc_tournament_and_scrims/views.py).
//   Every other field name + the JSON-stringified stages array match the admin submit
//   exactly, so the backend accepts the payload unchanged (no backend change needed -
//   create_event already supports org-scoped, fully-featured events).
// ─────────────────────────────────────────────────────────────────────────────

"use client";

import React, { useState, useTransition, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { Form } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/PageHeader";
import { IconLock } from "@tabler/icons-react";
import { env } from "@/lib/env";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganizer } from "../../_components/OrganizerContext";
// Draft auto-save (owner 2026-07-01): persist the in-progress wizard so Back/refresh doesn't lose work.
import { useEventCreateDraft } from "@/hooks/useEventCreateDraft";
import { EventDraftResumeDialog } from "@/components/events/EventDraftResumeDialog";

// Reuse the admin schema + every admin step component (Approach A). Importing from the
// admin _components/ folder keeps a single source of truth - the organizer flow can't
// drift from the admin flow's validation, field set, or UI.
import {
  EventFormSchema,
  EventFormType,
  GroupType,
  StageType,
} from "@/app/(a)/a/events/create/_components/types";
import { Step1EventDetails } from "@/app/(a)/a/events/create/_components/Step1EventDetails";
import {
  Step2EventMode,
  Step3StageCount,
} from "@/app/(a)/a/events/create/_components/Step2And3";
import { Step4StageOrdering } from "@/app/(a)/a/events/create/_components/Step4StageOrdering";
import { Step5PrizePool } from "@/app/(a)/a/events/create/_components/Step5PrizePool";
// Prize distribution must add up to the compulsory cash value (owner 2026-07-02).
import { validatePrizeDistribution } from "@/app/(a)/a/events/create/_components/PrizeDistributionSummary";
import { Step6EventRules } from "@/app/(a)/a/events/create/_components/Step6EventRules";
import { Step7PublishSave } from "@/app/(a)/a/events/create/_components/Step7PublishSave";
import { StepSponsorRequirement } from "@/app/(a)/a/events/create/_components/StepSponsorRequirement";
import { StepWaitlist } from "@/app/(a)/a/events/create/_components/StepWaitlist";
import {
  StageModal,
  StageModalData,
} from "@/app/(a)/a/events/create/_components/StageModal";
import { DEFAULT_ROUND_ROBIN_CONFIG } from "@/app/(a)/a/events/_components/RoundRobinPanel";
// ── Sponsor-system P2: post-create sponsor attach loop (mirrors the admin page). ──
// StepSponsorRequirement's builder holds SponsorshipDraft rows in the `sponsorships`
// form field; after create-event returns the new event_id, onSubmit attaches +
// configures each via sponsorsApi (the endpoints allow the event's organizer too).
import { sponsorsApi } from "@/lib/sponsors";
import {
  SponsorshipDraft,
  sponsorshipIssues,
} from "@/components/sponsorship-builder";
// One-time paid-event terms gate. Organizer-only: shown before submitting a PAID org
// event, and re-opened if the backend returns 400 {code:"paid_terms_required"}.
import { PaidEventTermsModal } from "@/app/(a)/a/events/_components/PaidEventTermsModal";
// Upload size gate + honest failure messages (owner-reported 2026-08-05).
import { checkUploadSize, describeSubmitFailure } from "@/lib/upload-limits";

// Fresh stage-modal seed (mirrors the admin page's DEFAULT_STAGE_MODAL_DATA). Discord
// role ids start empty and stay empty - the organizer UI never exposes them, but they
// ride in the payload so the backend stage shape is identical to the admin one.
const DEFAULT_STAGE_MODAL_DATA: StageModalData = {
  stage_name: "",
  start_date: "",
  end_date: "",
  stage_format: "",
  number_of_groups: 2,
  teams_qualifying_from_stage: 1,
  stage_discord_role_id: "", // never edited in the organizer flow (Discord omitted)
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

export default function OrganizerCreateEventPage() {
  // i18n (evCreatePage ns): this orchestrator's own chrome - page header, permission
  // gate, draft-resume dialog, nav buttons, and every step-validation / submit toast.
  // The reused wizard step components (Step1EventDetails, StageModal, ...) own their
  // own strings via their own namespaces; this only covers strings authored here.
  const t = useTranslations("evCreatePage");
  const router = useRouter();
  const { membership, isOwner } = useOrganizer();
  const { token } = useAuth();
  const [isPending, startTransition] = useTransition();

  // Org context: id homes the event, the permission gates the whole surface.
  const organizationId = membership.organization.organization_id;
  const canCreateEvents = membership.permissions.can_create_events || isOwner;

  // ── Step state (same 9-step machine as the admin wizard) ──────────────────────
  const [currentStep, setCurrentStep] = useState(1);

  // ── File state (banner + rules document) ──────────────────────────────────────
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [selectedRuleFile, setSelectedRuleFile] = useState<File | null>(null);
  const [previewRuleUrl, setPreviewRuleUrl] = useState("");
  const [rulesInputMethod, setRulesInputMethod] = useState<"type" | "upload">(
    "type",
  );

  // ── Stage state (drives the reused Step4StageOrdering + StageModal) ────────────
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

  // ── Paid-event terms gate (organizer-only) ───────────────────────────────────
  // showPaidTermsModal controls PaidEventTermsModal. termsAcceptedRef tracks whether
  // the organizer accepted in THIS session so a re-submit (e.g. after the 400
  // paid_terms_required) carries paid_terms_accepted: true. A ref (not state) avoids a
  // re-render race between "accept" and the immediate resubmit.
  const [showPaidTermsModal, setShowPaidTermsModal] = useState(false);
  const termsAcceptedRef = React.useRef(false);

  // ── Form ────────────────────────────────────────────────────────────────────
  // Same EventFormSchema as the admin wizard. Defaults seed the organizer-sensible
  // starting point (internal event, one stage, a 3-position prize distribution).
  const form = useForm<EventFormType>({
    // @ts-ignore - the admin wizard uses the same cast; the resolver widens the type here.
    resolver: zodResolver(EventFormSchema),
    defaultValues: {
      event_name: "",
      competition_type: "",
      participant_type: "",
      // Organizer events are ALWAYS internal: registration happens on-platform (AFC's own
      // flow), never via an off-platform "external" link. The internal/external Event Type
      // selector is AFC-admin-only and hidden here (Step1EventDetails hideEventType), so we
      // hard-default to "internal". (Previously this defaulted to "external", which made the
      // user-facing event page render a "Register (External Link)" button for organizer
      // events. The backend also forces org events to internal as the source of truth.)
      event_type: "internal",
      is_public: "True",
      // Discord registration gate defaults OFF (parity with the admin create wizard).
      // Collected by the shared Step1EventDetails toggle; sent below next to is_public.
      require_discord: false,
      discord_server_id: "",
      // Discord invite link defaults empty; required only when require_discord is ON
      // (enforced in onSubmit + by the backend). Collected by DiscordRegistrationGate.
      discord_invite_link: "",
      max_teams_or_players: 1,
      banner: "",
      stream_channels: [""],
      event_mode: "",
      number_of_stages: 1,
      stages: [],
      prizepool: "",
      prizepool_cash_value: undefined,
      // Seed three empty positions (string values per the schema's Record<string,string>).
      // The admin wizard seeds the same three positions; empty strings keep the prize
      // inputs blank and avoid a number-vs-string default mismatch.
      prize_distribution: { "1st": "", "2nd": "", "3rd": "" },
      event_rules: "",
      rules_document: "",
      start_date: "",
      end_date: "",
      registration_open_date: "",
      registration_end_date: "",
      registration_link: "",
      // Paid-vs-free registration defaults to FREE. When an organizer flips this to
      // "paid", the create flow gates submit behind PaidEventTermsModal (below).
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
      waitlist_discord_role_id: "", // never edited in the organizer flow (Discord omitted)
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

  // ── Draft auto-save (owner 2026-07-01) ──────────────────────────────────────
  // Persist the in-progress wizard to localStorage (debounced), keyed per ORG, so navigating Back /
  // refreshing doesn't wipe the organizer's work. Files (banner/rules) aren't serialized -> re-attach
  // after a resume. Mirrors the admin create page. See useEventCreateDraft.
  const draftWatch = form.watch();
  const {
    savedDraft: eventDraft,
    clear: clearEventDraft,
    discard: discardEventDraft,
    markResumed: markEventDraftResumed,
  } = useEventCreateDraft({
    storageKey: `afc:event-create-draft:org:${organizationId}`,
    active: true,
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
  const hasFinalAction =
    saveToDraftsWatch || publishToTournamentsWatch || publishToNewsWatch;

  // ── Effects (ported 1:1 from the admin wizard) ────────────────────────────────

  // Enforce draft/publish mutual exclusivity (a draft can't also be published).
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saveToDraftsWatch, publishToTournamentsWatch, publishToNewsWatch]);

  // Auto-set restriction_mode the first time a restriction type is picked.
  useEffect(() => {
    if (
      registration_restriction !== "none" &&
      !form.getValues("restriction_mode")
    ) {
      form.setValue("restriction_mode", "allow_only");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registration_restriction]);

  // ── Stage handlers (ported 1:1 from the admin wizard) ─────────────────────────
  // These own the stage-builder state that the reused Step4StageOrdering + StageModal
  // render against. Group/stage Discord role ids are seeded empty and never edited
  // (the StageModal's Discord inputs are hidden via hideDiscord).

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
        // ── Branching advancement rules carried back (feature #9; StageType stores indices). ──
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
          group_discord_role_id: "", // omitted in UI; empty in payload
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
            group_discord_role_id: "", // omitted in UI; empty in payload
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

  // Match count is DERIVED from the maps selected (owner 2026-06-13): one match per map.
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

    // Round-robin stages validate their BASE GROUPS, not the classic per-group config
    // the backend ignores for this format (mirrors the admin create page).
    const isRoundRobinStage = stageModalData.stage_format === "br - round robin";
    // Clash Squad (cs - *) runs as a head-to-head BRACKET seeded from the registered teams on
    // the event page - no groups/maps to validate; sends groups: [] (P1#2, owner 2026-07-13).
    const isClashSquadStage = (stageModalData.stage_format || "").startsWith("cs - ");
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
      stage_discord_role_id: stageModalData.stage_discord_role_id, // empty (omitted)
      start_date: stageModalData.start_date,
      end_date: stageModalData.end_date,
      number_of_groups: stageModalData.number_of_groups,
      stage_format: stageModalData.stage_format,
      // Clash Squad has no groups (a bracket) - send [] so the backend creates no phantom BR group.
      groups: isClashSquadStage ? [] : tempGroups,
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
      // ── Branching advancement (feature #9). Bug fix 2026-06-29: the organizer create page dropped
      //    these on save while the shared StageModal authored them (admin create already threaded
      //    them), so organizer events lost all branching rules. Index-based; resolved to
      //    StageAdvancementRule rows in the backend create second pass. ──
      advancement_rules: stageModalData.advancement_rules ?? [],
      // ── Round-Robin config (sub-project B) - only for the BR Round-Robin format. ──
      ...(stageModalData.stage_format === "br - round robin"
        ? { round_robin: stageModalData.round_robin }
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
      // direction is strictly "up" | "down"; guard the dynamic key defensively so a
      // missing translation can never throw MISSING_MESSAGE at render.
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

  // ── Step validation (ported 1:1 from the admin wizard) ────────────────────────
  // Each "Next" validates only the fields the current step owns, so an organizer gets
  // the same per-step feedback the admin gets - no silent dead buttons.
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
        const allValid = form
          .getValues("stages")
          .every((s) => s.groups && s.groups.length > 0);
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

  // ── Submit (mirrors the admin submit; org-scoping is the only addition) ────────
  // Builds the SAME multipart FormData the admin page sends, then appends
  // organization_id so the backend homes the event to this organizer's org.
  const onSubmit = (data: EventFormType) => {
    // Mirror the backend 400: require_discord=true demands a non-empty invite link.
    if (data.require_discord && !data.discord_invite_link?.trim()) {
      toast.error(t("toast.discordInviteRequired"));
      setCurrentStep(1);
      return;
    }
    startTransition(async () => {
      try {
        // ── Size gate BEFORE the request is built (owner-reported 2026-08-05) ──
        // nginx rejects an over-sized body itself, with a 413 that carries no CORS headers,
        // which makes fetch reject with an unreadable error - that is where "An unexpected
        // error occurred during submission" came from. Catch it here so the organizer is
        // told the real size and the real limit while they can still swap the file.
        // See lib/upload-limits.ts for the measurements behind this.
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
        // Discord registration gate (parity with the admin create page): always send the
        // flag; only send the Guild ID when ON (blank = main AFC server). create_event
        // reads require_discord + discord_server_id unchanged for org-scoped events.
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
        // Always send registration_type. For a PAID event, also send the fee + currency
        // and (when the organizer has accepted the terms this session) the one-time
        // paid_terms_accepted flag the backend requires the first time for an org.
        formData.append("registration_type", data.registration_type || "free");
        if (data.registration_type === "paid") {
          if (data.registration_fee != null) {
            formData.append(
              "registration_fee",
              data.registration_fee.toString(),
            );
          }
          formData.append(
            "registration_fee_currency",
            data.registration_fee_currency || "USD",
          );
          // Per-country payment rules (owner 2026-06-24): only for paid events. JSON-encoded;
          // backend re-validates via _parse_country_payment_rules. Absent => everyone pays base.
          if (data.country_payment_rules) {
            formData.append(
              "country_payment_rules",
              JSON.stringify(data.country_payment_rules),
            );
          }
          if (termsAcceptedRef.current) {
            formData.append("paid_terms_accepted", "true");
          }
        }
        // Times are compulsory (owner 2026-06-21): always send all four + the creator's
        // IANA timezone so the backend stores the times paired with their tz.
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
        // Normalise optional prize fields to 0 (same as the admin page) so the backend
        // never sees an empty string where it expects a number. Each stage still carries
        // its (empty) Discord ids - the UI just never let the organizer set them.
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

        // ── Sponsor requirement (parity with admin) ──
        formData.append(
          "is_sponsored",
          (data.is_sponsored ?? false).toString(),
        );
        if (data.is_sponsored) {
          formData.append("sponsor_name", data.sponsor_name || "");
          formData.append(
            "sponsor_usernames",
            // @ts-ignore - sponsor_usernames is on the schema but widened by the resolver.
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

        // ── Waitlist (parity with admin, MINUS the Discord role id) ──
        // We deliberately DON'T send waitlist_discord_role_id - the field is hidden in
        // the organizer flow and stays empty; the backend treats it as optional.
        // @ts-ignore
        formData.append(
          "is_waitlist_enabled",
          (data.is_waitlist_enabled ?? false).toString(),
        );
        // @ts-ignore
        if (data.is_waitlist_enabled) {
          formData.append(
            "waitlist_capacity",
            // @ts-ignore
            (data.waitlist_capacity ?? "").toString(),
          );
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

        // ── ORGANIZER-SPECIFIC: home the event to the selected organization. ──
        // The backend's create_event reads this, verifies org_can(user,
        // "can_create_events", org), and sets event.organization=org. Without it the
        // event would be a native AFC event (org=None) - so this line is what preserves
        // org attribution for organizer-created events.
        formData.append("organization_id", organizationId.toString());

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
          // create_event returns {message, event_id}; the sponsorship endpoints key
          // on that event_id. Loop the wizard's `sponsorships` rows: attach, then
          // patch the engagement config. Partial failures only toast (the event
          // itself was created) - the organizer can re-add the failed sponsor from
          // the event's Sponsor tab. Navigation is never blocked.
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
          router.push("/organizer/events");
        } else if (response.status === 400 && res.code === "paid_terms_required") {
          // Backend says this org must accept the paid-event terms first. Open the
          // modal; on accept we set termsAcceptedRef + resubmit (this same onSubmit),
          // which then carries paid_terms_accepted: true.
          setShowPaidTermsModal(true);
        } else {
          toast.error(
            res.message ||
              res.detail ||
              res.error ||
              t("toast.createFailed"),
          );
        }
      } catch {
        // A thrown fetch means the response was never readable: an nginx 413 with no CORS
        // headers, a dropped connection, or the browser being offline. None of those carry
        // a status we can inspect, so describeSubmitFailure names the most likely cause
        // from what we do know (the attached files and navigator.onLine) instead of the old
        // blanket "unexpected error", which told the organizer nothing they could act on.
        toast.error(describeSubmitFailure([selectedFile, selectedRuleFile]));
      }
    });
  };

  // ── Invalid-submit surfacing (owner 2026-07-01) ─────────────────────────────────
  // "Create event" / "Save to draft" used form.handleSubmit(onSubmit) with NO invalid handler, so a
  // failing Zod validation just... did nothing (silent dead button). Map each field to its wizard step
  // so we can JUMP the user to the problem AND toast exactly which fields are wrong.
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
    // top-level "stages" error is useless: this pinpoints the EXACT stage/group/field + its message.
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
    toast.error(t("toast.pleaseFix", { details: lines.join("   •   ") }), {
      duration: 9000,
    });
  };

  // ── Paid-event submit gate ─────────────────────────────────────────────────────
  // Wraps the create action. For a PAID org event that hasn't been accepted yet this
  // session, show the terms modal BEFORE submitting (the spec's "show on submit of a
  // paid org event and let the backend dedupe"). Free events submit straight through.
  // AFC-admin events never reach this page, so the gate is organizer-only by location.
  // ── Round-robin schedule backfill (owner 2026-07-01) ────────────────────────────
  // A ROUND-ROBIN stage keeps its schedule (dates + maps) on the game-day MEETINGS
  // (round_robin.game_days), so its base groups (A/B/C) have no playing_date/match_maps and would
  // FAIL the per-group GroupSchema ("Group N: Playing Date required") even though the meetings are
  // fully set. The backend ignores group date/maps for a round-robin stage (it reads the meetings),
  // so just before submitting we copy the meetings' date/time/maps onto the base groups to satisfy
  // the form validator. Non-round-robin stages are untouched.
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

  const handleCreateClick = () => {
    const isPaid = form.getValues("registration_type") === "paid";
    if (isPaid && !termsAcceptedRef.current) {
      setShowPaidTermsModal(true);
      return;
    }
    // Compulsory prizes (owner 2026-07-02): a real (non-draft) event needs a cash value AND a
    // distribution that adds up to it; tells the organizer the exact over/under + jumps to step 5.
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
    backfillRoundRobinGroups();
    // @ts-ignore - resolver widens the form's internal TFieldValues generic (same
    // cast the original "Create Event" button used on form.handleSubmit(onSubmit)).
    form.handleSubmit(onSubmit, onInvalidSubmit)();
  };

  // Organizer accepted the paid-event terms: remember it for this session, close the
  // modal, then submit (or resubmit) with paid_terms_accepted: true now flowing in.
  const handleAcceptPaidTerms = () => {
    termsAcceptedRef.current = true;
    setShowPaidTermsModal(false);
    backfillRoundRobinGroups();
    // @ts-ignore - resolver widens the form's internal TFieldValues generic.
    form.handleSubmit(onSubmit, onInvalidSubmit)();
  };

  // ── Permission gate ───────────────────────────────────────────────────────────
  // No create permission → a read-only notice instead of the wizard (mirrors the
  // owner-only notice on the organizer Profile page + the events list CTA gate).
  if (!canCreateEvents) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeader title={t("gate.title")} back />
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <div className="flex size-12 items-center justify-center rounded-md bg-muted text-muted-foreground">
              <IconLock className="size-6" />
            </div>
            <p className="text-sm text-muted-foreground">
              {t("gate.noPermission")}
            </p>
            <Button asChild variant="outline" size="sm">
              <Link href="/organizer/events">{t("gate.backToEvents")}</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Render (same 9-step wizard layout as the admin page) ──────────────────────

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
      <div data-tour="org-event-create-title">
        <PageHeader
          title={t("header.title")}
          description={t("header.description")}
          back
        />
      </div>

      <Form {...form}>
        {/* @ts-ignore - resolver widens the form's internal TFieldValues generic. */}
        <form
          data-tour="org-event-create-form"
          onSubmit={(e) => {
            e.preventDefault();
            handleCreateClick();
          }}
          className="space-y-6"
        >
          {currentStep === 1 && (
            <Step1EventDetails
              // @ts-ignore - reused admin step expects the stricter UseFormReturn.
              form={form}
              selectedFile={selectedFile}
              setSelectedFile={setSelectedFile}
              previewUrl={previewUrl}
              setPreviewUrl={setPreviewUrl}
              // AFC-only internal/external Event Type is hidden for organizers.
              hideEventType
              // Registration link is an AFC-only concern; NOT applied to organizer events at all
              // (owner reverted 2026-06-20: organizers do not get the external registration link).
              hideRegistrationLink
            />
          )}
          {/* @ts-ignore */}
          {currentStep === 2 && <Step2EventMode form={form} />}
          {currentStep === 3 && (
            <Step3StageCount
              // @ts-ignore
              form={form}
              stageNames={stageNames}
              onStageCountChange={handleStageCountChange}
              onStageNameChange={handleStageNameChange}
            />
          )}
          {currentStep === 4 && (
            <Step4StageOrdering
              // @ts-ignore
              form={form}
              stageNames={stageNames}
              onMoveStage={moveStage}
              onDeleteStage={handleDeleteStage}
              onOpenStageModal={openStageModal}
            />
          )}
          {/* @ts-ignore */}
          {currentStep === 5 && <Step5PrizePool form={form} />}
          {currentStep === 6 && (
            <Step6EventRules
              // @ts-ignore
              form={form}
              rulesInputMethod={rulesInputMethod}
              setRulesInputMethod={setRulesInputMethod}
              selectedRuleFile={selectedRuleFile}
              setSelectedRuleFile={setSelectedRuleFile}
              previewRuleUrl={previewRuleUrl}
              setPreviewRuleUrl={setPreviewRuleUrl}
            />
          )}
          {/* @ts-ignore */}
          {currentStep === 7 && <StepSponsorRequirement form={form} />}
          {currentStep === 8 && (
            // hideDiscord: organizers don't manage AFC's Discord automation, so the
            // waitlist Discord-role input is omitted (the rest of the waitlist UI stays).
            // @ts-ignore
            <StepWaitlist form={form} hideDiscord />
          )}
          {/* @ts-ignore */}
          {currentStep === 9 && <Step7PublishSave form={form} />}

          {/* Navigation (same prev/next + final create button as the admin wizard) */}
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

            <div className="ml-auto flex gap-3">
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
                  data-tour="org-event-create-submit"
                  type="button"
                  // handleCreateClick gates a PAID org event behind the terms modal
                  // before submitting; free events submit straight through.
                  onClick={handleCreateClick}
                  disabled={currentStep !== 9 || isPending || !hasFinalAction}
                >
                  {isPending ? t("nav.creating") : t("nav.createEvent")}
                </Button>
              )}
            </div>
          </div>
        </form>

        {/* Stage Modal - reused admin modal. hideDiscord hides the stage + group
            Discord Role ID inputs; everything else (formats, scoring modes,
            round-robin, groups, maps, prizes) is identical to the admin flow. */}
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
          hideDiscord
        />

        {/* Paid-event terms gate (organizer-only). Opened by handleCreateClick before
            submitting a paid event, or reactively when the backend returns 400
            {code:"paid_terms_required"}. On accept it submits with
            paid_terms_accepted: true; on cancel it just closes (no submit). */}
        <PaidEventTermsModal
          open={showPaidTermsModal}
          onOpenChange={setShowPaidTermsModal}
          onAccept={handleAcceptPaidTerms}
          onCancel={() => setShowPaidTermsModal(false)}
          pending={isPending}
        />
      </Form>
    </div>
  );
}
