import { z } from "zod";
import { toast } from "sonner";
// Shared bracket-types + labels (see lib/eventFormats.ts). Re-exported below under the
// historic formattedWord / STAGE_FORMATS names so existing importers keep working - the
// point-rush / champion-rush pseudo-formats were dropped (now per-stage toggles).
import {
  STAGE_FORMATS as SHARED_STAGE_FORMATS,
  FORMAT_LABEL,
  isClashSquadFormat,
  isRoundRobinBuilderFormat,
} from "@/lib/eventFormats";

// ============================================================================
// CONSTANTS
// ============================================================================

export const formattedWord = FORMAT_LABEL;

export const AVAILABLE_MAPS = [
  "Bermuda",
  "Kalahari",
  "Purgatory",
  "Nexterra",
  "Alpine",
  "Solara",
  // "Random" lets admins/organizers leave the map unfixed (decided at match time).
  // Owner 2026-06-13. Stored as a normal map string; the backend treats it like any other.
  "Random",
];

export const STAGE_FORMATS = SHARED_STAGE_FORMATS;

// ============================================================================
// SCHEMAS
// ============================================================================

export const GroupSchema = z.object({
  group_id: z.number().optional(),
  // Manual display order (drag-to-reorder). Echoed from get-event-details and re-submitted on Save
  // so a plain Save doesn't reset the dragged order to auto-by-date (zod would otherwise STRIP an
  // unknown key). 0 = auto-arrange by date. (bug fix 2026-06-15)
  group_order: z.coerce.number().optional(),
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
  // A Clash Squad group runs a BRACKET, and this is its mode (owner item 21, 2026-08-13).
  // Blank/absent for every Battle Royale lobby. Declared for the same reason group_order above
  // is: zod STRIPS an unknown key, which is how the mode was getting lost between the API and
  // the stage modal, so a round-robin group opened the editor showing "Knockout".
  bracket_format: z.string().optional(),
});

// ── Round-Robin config schema (sub-project B) - mirrors the create-flow schema. ──
// Permissive on purpose: the shared RoundRobinPanel owns the editing UX and the
// backend enforces the structural rules. team_ids hold TEAM PKs.
export const RoundRobinConfigSchema = z.object({
  round_robin_groups: z.array(
    z.object({
      label: z.string(),
      order: z.coerce.number(),
      team_ids: z.array(z.coerce.number()),
    }),
  ),
  generate_schedule: z.boolean(),
  games_per_day: z.coerce.number(),
  game_days: z.array(
    z.object({
      game_day: z.coerce.number(),
      source_group_indices: z.array(z.coerce.number()),
      match_count: z.coerce.number(),
      match_maps: z.array(z.string()),
      // Per-match-day date + time (owner 2026-06-15): when each match day plays. Optional so an
      // unscheduled day still validates; the backend (_materialise_round_robin_lobby) honours them
      // and falls back to the stage start when blank. MUST be in the schema or zod strips them on
      // Save and the schedule reverts to the stage default.
      playing_date: z.string().optional(),
      playing_time: z.string().optional(),
    }),
  ),
});

// ── Branching advancement rule (feature #9) - mirrors the create-flow schema. ──
// positions [position_from..position_to] of this stage (source_group_index null = the whole
// stage) advance into the stage at target_stage_index (0-based into the submitted stages array).
// Resolved to StageAdvancementRule rows in the backend edit second pass.
export const AdvancementRuleSchema = z.object({
  position_from: z.coerce.number().min(1),
  position_to: z.coerce.number().min(1),
  source_group_index: z.coerce.number().nullable(),
  target_stage_index: z.coerce.number(),
});

export const StageSchema = z.object({
  stage_id: z.number().optional(),
  // Manual display order (drag-to-reorder). Echoed from get-event-details and re-submitted on Save
  // so a plain Save doesn't reset the dragged order to auto-by-date (zod strips unknown keys). 0 =
  // auto-arrange by date. (bug fix 2026-06-15)
  stage_order: z.coerce.number().optional(),
  stage_name: z.string().min(1, "Stage name required"),
  stage_discord_role_id: z.string().optional(),
  start_date: z.string().min(1, "Start date required"),
  end_date: z.string().min(1, "End date required"),
  // NOT min(1): the group requirement is format-dependent, enforced by the superRefine at
  // the bottom of this schema (Clash Squad runs as a bracket with no groups; BR Round-Robin
  // keeps its groups on round_robin.round_robin_groups). Mirrors the create schema.
  number_of_groups: z.coerce.number().min(0),
  stage_format: z.string().min(1, "Stage format required"),
  groups: z.array(GroupSchema),
  teams_qualifying_from_stage: z.coerce.number().min(0).default(0),
  total_teams_in_stage: z.coerce.number().min(0).default(0),
  // ── Scoring-mode config (sub-project A). Both modes are independent + combinable. ──
  // Champion-Point: first competitor to Booyah while already at/above the threshold wins.
  champion_point_enabled: z.boolean().default(false),
  champion_point_threshold: z.coerce.number().optional(), // required when enabled
  // Point-Rush: this stage's per-lobby placement bonus is banked into a LATER stage.
  point_rush_enabled: z.boolean().default(false),
  point_rush_reward: z.record(z.string(), z.coerce.number()).optional(), // {"1":10,"2":7,...}
  point_rush_target_index: z.coerce.number().optional(), // 0-based index of the target stage
  // ── Branching advancement rules (feature #9). Optional; rehydrated from stage.advancement_rules
  //    (target_stage_id -> index, source_group_id -> index) and threaded into the FormData. ──
  advancement_rules: z.array(AdvancementRuleSchema).optional(),
  // ── Round-Robin config (sub-project B). Present only for "br - round robin"
  //    stages; rehydrated from stage.round_robin and threaded into the FormData. ──
  round_robin: RoundRobinConfigSchema.optional(),
  // Clash Squad room settings drafted for a stage that does not exist yet (owner 2026-08-13).
  // Same reasoning as the create schema: validated by the backend against the catalogue, and
  // declared here only so the resolver does not strip the key. A stage that already exists edits
  // its room settings through the API instead and never sends this.
  cs_room_settings: z.any().optional().nullable(),
  // Clash Squad mode + the optional split into groups (owner item 21, 2026-08-13). Validated by
  // the backend against the real bracket engines; declared here only so the resolver does not
  // strip the keys - zod drops what it does not know about.
  cs_bracket_format: z.string().optional(),
  cs_groups: z.any().optional(),
})
  // ── Format-aware group requirement (owner 2026-08-12) ────────────────────────────
  // Same fix as the create schema: the blanket groups.min(1) / number_of_groups.min(1)
  // rejected the two GROUPLESS stage shapes, so saving an edit on a Clash Squad event
  // failed at the resolver with "At least one group required" before validateEventData
  // (which already branches correctly, below) ever ran. Keep the two in agreement.
  .superRefine((stage, ctx) => {
    if (isClashSquadFormat(stage.stage_format)) return; // bracket: no groups by design
    if (isRoundRobinBuilderFormat(stage.stage_format)) {
      if ((stage.round_robin?.round_robin_groups?.length ?? 0) === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["round_robin"],
          message: "At least one round-robin base group is required",
        });
      }
      return;
    }
    if (stage.groups.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["groups"],
        message: "At least one group required",
      });
    }
    if (stage.number_of_groups < 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["number_of_groups"],
        message: "Must have at least 1 group",
      });
    }
  });

export const EventFormSchema = z
  .object({
    event_name: z.string().min(1, "Event name required"),
    // What the tournament IS, in the organizer's words (owner 2026-08-05, item 26). Optional, so
    // every event that predates it stays valid and the public About block just does not render.
    event_description: z.string().optional(),
    competition_type: z.string().min(1, "Competition type required"),
    participant_type: z.string().min(1, "Participant type required"),
    event_type: z.string().min(1, "Event type required"),
    is_public: z.string().default("True"),
    // ── Discord registration gate (per-event) - mirrors the create schema. ────────
    // BasicInfoTab pre-fills these from the fetched event detail and re-sends them on
    // save. When require_discord is ON, register-for-event/ rejects participants who
    // aren't Discord-connected + in the event's server (code "discord_required");
    // discord_server_id is the target Guild ID (blank = main AFC server). Optional so
    // editing an existing event with no Discord gate is unchanged.
    require_discord: z.boolean().optional(),
    discord_server_id: z.string().optional(),
    // Discord invite link (REQUIRED when require_discord is ON). BasicInfoTab pre-fills it
    // from the fetched event and the save handlers re-send it + block submitting a gated
    // event with no link (mirrors the backend 400). Optional in the schema so an existing
    // event with the gate off still validates. See DiscordRegistrationGate.
    discord_invite_link: z.string().optional(),
    max_teams_or_players: z.coerce
      .number()
      .min(1, "Max teams/players required"),
    banner: z.string().optional(),
    stream_channels: z.array(z.string()).optional(),
    event_mode: z.string().min(1, "Event mode required"),
    number_of_stages: z.coerce.number().min(1, "At least 1 stage required"),
    stages: z.array(StageSchema).min(1, "At least one stage required"),
    prizepool: z.string().min(1, "Prize pool required"),
    prizepool_cash_value: z.coerce.number().optional(),
    // Prize currency (owner 2026-07-01): what the prize amounts are in, so the backend converts FROM
    // the right one. Matches the create schema. Default USD.
    prize_currency: z.string().optional(),
    // prize_distribution: z.record(z.string(), z.coerce.number()),
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
    // ── Paid vs free registration (non-payment phase) - mirrors the create schema. ──
    // BasicInfoTab pre-fills these from the fetched event detail and re-sends them on
    // save. FREE is the default so editing an existing free event is unchanged. The
    // keys map 1:1 onto the backend edit-event contract (registration_type / fee /
    // currency). The actual charge is a later phase; here we only collect + validate.
    registration_type: z.enum(["free", "paid"]).default("free"),
    registration_fee: z.coerce.number().positive().optional().nullable(),
    registration_fee_currency: z.string().default("USD"),
    // Per-country payment rules (owner 2026-06-24); see CountryPaymentRulesEditor / backend
    // Event.country_payment_rules. z.any(): the editor owns the shape, backend re-validates.
    country_payment_rules: z.any().optional().nullable(),
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
    is_sponsored: z.boolean().optional(),
    sponsor_name: z.string().optional(),
    sponsor_usernames: z.array(z.string()).optional(),
    requirement_description: z.string().optional(),
    uuid_label: z.string().optional(),
    is_waitlist_enabled: z.boolean().optional(),
    waitlist_capacity: z.coerce.number().optional(),
    waitlist_discord_role_id: z.string().optional(),
    event_start_time: z.string().optional(),
    event_end_time: z.string().optional(),
    registration_start_time: z.string().optional(),
    registration_end_time: z.string().optional(),
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
    },
  )
  // Paid events must carry a positive entry fee. Surfaced on the registration_fee
  // field so the message lands right under the fee input in BasicInfoTab.
  .refine(
    (data) =>
      data.registration_type !== "paid" ||
      (data.registration_fee != null && data.registration_fee > 0),
    {
      message: "Enter an entry fee greater than 0 for a paid event.",
      path: ["registration_fee"],
    },
  );

// ============================================================================
// TYPES
// ============================================================================

export type EventFormType = z.infer<typeof EventFormSchema>;
export type StageType = z.infer<typeof StageSchema>;
export type GroupType = z.infer<typeof GroupSchema>;
// Branching advancement (feature #9): one authoring row shape, shared by the stage modal +
// the edit page mapper (and re-exported for the organizer edit page, which reuses both).
export type AdvancementRuleInput = z.infer<typeof AdvancementRuleSchema>;

// The shape get_event_details echoes per stage (advancement_rules). Carries resolved ids +
// display names so the public chips render without a lookup, plus the ids the edit form maps
// back to indices on rehydration. See views._advancement_rules_echo.
export interface AdvancementRuleEcho {
  id: number;
  position_from: number;
  position_to: number;
  source_group_id: number | null;
  source_group_name: string | null;
  target_stage_id: number;
  target_stage_name: string | null;
  order: number;
}

export interface EventDetails {
  /**
   * IANA timezone the event's wall-clock times belong to (Event.timezone), e.g. "Africa/Lagos".
   * NULL on legacy events created before the field existed: 13 of 35 on the production clone.
   *
   * The times are stored NAIVE and only mean something paired with this, which is why the edit form
   * shows it (components/events/EventTimezoneNote.tsx). It is deliberately NOT sent back on save:
   * the form used to stamp it from the editor's browser, so an assistant in Lagos fixing a typo
   * silently re-labelled a Johannesburg event and moved it an hour for everyone.
   */
  timezone?: string | null;
  /**
   * Results provenance (owner 2026-08-20). True when this event's results came from an external
   * organiser's published standings via afc_results_import, rather than from matches played on AFC.
   * Derived on the backend from Event.results_imported_at, so it needs no switch of its own and
   * cannot drift out of step with whether an import actually happened.
   *
   * Read by: the Results Import tab dot on this page, and the provenance notice on the public
   * event page (EventDetailsWrapper).
   */
  results_imported?: boolean;
  results_imported_at?: string | null;
  event_id: number;
  competition_type: string;
  participant_type: string;
  event_type: string;
  is_public: string;
  // ── Discord registration gate echo (from get-event-details-for-admin/). ──
  // require_discord drives the BasicInfoTab toggle; discord_server_id pre-fills the
  // Guild ID input shown when the toggle is ON. Optional so older payloads still type.
  require_discord?: boolean;
  discord_server_id?: string | null;
  // Discord invite link echo (from get-event-details-for-admin/). Pre-fills the
  // DiscordRegistrationGate's required invite-link input and lets the edit form treat an
  // event that already has a link as already-verified (no forced re-verify to keep it on).
  discord_invite_link?: string | null;
  max_teams_or_players: number;
  event_name: string;
  event_description?: string;
  event_mode: string;
  start_date: string;
  end_date: string;
  registration_open_date: string;
  registration_end_date: string;
  prizepool: string;
  prizepool_cash_value?: number;
  prize_distribution: { [key: string]: number };
  event_rules: string;
  event_status: string;
  registration_link: string | null;
  // ── Paid vs free registration echo (non-payment phase). ──
  // Returned by the event-detail endpoints; BasicInfoTab pre-fills the Free/Paid
  // toggle + fee/currency inputs from these. Optional so older payloads still type.
  registration_type?: "free" | "paid";
  registration_fee?: number | null;
  registration_fee_currency?: string | null;
  // Per-country payment rules echo (owner 2026-06-24); BasicInfoTab rehydrates the editor from this.
  country_payment_rules?: {
    default_pays: boolean;
    countries: Record<
      string,
      { pays: boolean; amount?: string; currency?: string }
    >;
  } | null;
  tournament_tier: string;
  event_banner_url: string | null;
  uploaded_rules_url: string | null;
  number_of_stages: number;
  created_at: string;
  is_registered: boolean;
  stream_channels: string[];
  registration_restriction?: string;
  restriction_mode?: string;
  restricted_countries?: string[];
  registered_competitors: Array<{
    player_id: number;
    username: string;
    status: string;
  }>;
  tournament_teams: any[];
  is_sponsored?: boolean;
  sponsor_name?: string;
  sponsor_usernames?: string[];
  sponsors?: Array<{
    sponsor_id: number;
    sponsor_name: string;
    sponsor_username: string;
  }>;
  sponsor_field_label?: string;
  sponsor_requirement_description?: string | null;
  is_waitlist_enabled?: boolean;
  waitlist_capacity?: number | null;
  waitlist_discord_role_id?: string | null;
  // Waitlist slot-assignment mode + roster (owner 2026-06-17).
  waitlist_mode?: string;
  waitlist_competitors?: Array<{
    position?: number;
    name?: string;
    registration_date?: string | null;
    registered_competitor_id?: number;
    tournament_team_id?: number;
  }>;
  event_start_time?: string | null;
  event_end_time?: string | null;
  registration_start_time?: string | null;
  registration_end_time?: string | null;
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
    // ── Scoring-mode config echoed by get-event-details (sub-project A). ──
    // point_rush_target_stage_id is a STAGE id; the form needs it mapped to a 0-based
    // index (point_rush_target_index) on rehydration - done in edit/page.tsx.
    champion_point_enabled?: boolean;
    champion_point_threshold?: number | null;
    point_rush_enabled?: boolean;
    point_rush_reward?: Record<string, number>;
    point_rush_target_stage_id?: number | null;
    // ── Branching advancement rules echoed by get-event-details (feature #9). ──
    // The edit form maps target_stage_id -> target_stage_index and source_group_id ->
    // source_group_index when rehydrating the authoring rows. [] / absent for a rule-less stage.
    advancement_rules?: AdvancementRuleEcho[];
    // ── Round-Robin structure echoed by get-event-details (sub-project B). ──
    // round_robin_groups carry server group_ids + team_ids (TEAM PKs); game_days
    // carry the materialised lobbies. Rehydrated into the form's round_robin
    // config in edit/page.tsx (lobbies → source_group_indices via a group lookup).
    round_robin?: {
      // Stage-level mode echoed by the backend (owner 2026-06-17) so the editor rehydrates the
      // toggle + per-meeting match count from the saved stage instead of guessing from lobby 1.
      generate_schedule?: boolean;
      games_per_day?: number;
      round_robin_groups: Array<{
        group_id: number;
        label: string;
        order: number;
        team_ids: number[];
        team_names?: string[];
      }>;
      game_days: Array<{
        game_day: number;
        lobbies: Array<{
          group_id: number;
          source_group_ids: number[];
          match_count?: number;
          match_maps?: string[];
          // Per-match-day date/time echoed by the backend (owner 2026-06-15) so the edit form
          // rehydrates the saved schedule instead of blanks.
          playing_date?: string;
          playing_time?: string;
        }>;
      }>;
    };
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

export type Params = {
  slug: string;
};

// ============================================================================
// VALIDATION HELPER FUNCTIONS
// ============================================================================

export interface ValidationError {
  field: string;
  message: string;
  tab: string;
  stageIndex?: number;
  groupIndex?: number;
}

export const validateStageData = (
  stages: StageType[],
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

    // Clash Squad (cs - *) stages run as a head-to-head BRACKET generated from the event page
    // (H2HBracketCard), NOT as BR lobbies, so they carry NO stage.groups and NO round-robin base
    // groups - requiring "at least one group" wrongly blocked saving a CS stage (P1#2, owner
    // 2026-07-13). Detect CS FIRST and skip the group-count requirement entirely for it. The
    // per-group schedule checks further down are already guarded by `stage.groups.length > 0`.
    const isCsForGroupCount = /^cs\s*-/i.test(stage.stage_format || "");
    // Round-robin stages keep their groups in round_robin.round_robin_groups (base groups A/B/C),
    // NOT in stage.groups - checking stage.groups here wrongly failed every RR stage with
    // "At least one group is required" (owner 2026-07-03). Detect RR FIRST, then count the right list.
    const isRRForGroupCount =
      /round.?robin/i.test(stage.stage_format || "") ||
      ((stage.round_robin?.round_robin_groups?.length ?? 0) > 0);
    if (isCsForGroupCount) {
      // No group requirement: the bracket is seeded from the registered teams on the event page.
    } else if (isRRForGroupCount) {
      if ((stage.round_robin?.round_robin_groups?.length ?? 0) === 0) {
        errors.push({
          field: `stages.${sIdx}.round_robin`,
          message: `Stage ${sIdx + 1}: At least one round-robin base group (A/B/C) is required`,
          tab: "stages_groups",
          stageIndex: sIdx,
        });
      }
    } else if (!stage.groups || stage.groups.length === 0) {
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

    // Validate groups. A ROUND-ROBIN stage keeps its schedule (dates + maps) on the game-day MEETINGS
    // (round_robin.game_days), NOT its base groups A/B/C, so only the base-group NAME is required for
    // it. The per-group date/time/maps/teams checks below apply to non-round-robin stages (owner
    // 2026-07-01: round-robin events could not be created/edited - "Group N: Playing Date required").
    const isRoundRobinStage =
      /round.?robin/i.test(stage.stage_format || "") ||
      ((stage.round_robin?.round_robin_groups?.length ?? 0) > 0);
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

        // Round-robin base groups carry no schedule (it lives on the meetings) - name is enough.
        if (isRoundRobinStage) return;

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

export const showValidationErrors = (
  errors: ValidationError[],
  onFixClick: (stageIndex?: number) => void,
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
    },
  );
};
