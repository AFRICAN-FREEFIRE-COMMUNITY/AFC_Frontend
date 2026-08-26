// import { z } from "zod";

// export const GroupSchema = z.object({
//   group_name: z.string().min(1, "Group name required"),
//   group_discord_role_id: z.string().optional(),
//   room_id: z.string().optional(),
//   room_name: z.string().optional(),
//   room_password: z.string().optional(),
//   playing_date: z.string().min(1, "Playing date required"),
//   playing_time: z.string().min(1, "Playing time required"),
//   teams_qualifying: z.coerce.number().min(1, "Must qualify at least 1 team"),
//   match_count: z.coerce.number().min(1, "Must play at least 1 match"),
//   match_maps: z.array(z.string()).min(1, "At least one map must be selected"),
// });

// export const StageSchema = z.object({
//   stage_name: z.string().min(1, "Stage name required"),
//   stage_discord_role_id: z.string().optional(),
//   start_date: z.string().min(1, "Start date required"),
//   end_date: z.string().min(1, "End date required"),
//   number_of_groups: z.coerce.number().min(1, "Must have at least 1 group"),
//   stage_format: z.string().min(1, "Stage format required"),
//   groups: z.array(GroupSchema).min(1, "At least one group required"),
//   teams_qualifying_from_stage: z.coerce.number().min(0).optional(),
// });

// export const EventFormSchema = z
//   .object({
//     event_name: z.string().min(1, "Event name required"),
//     competition_type: z.string().min(1, "Competition type required"),
//     participant_type: z.string().min(1, "Participant type required"),
//     event_type: z.string().min(1, "Event type required"),
//     is_public: z.string().default("True"),
//     max_teams_or_players: z.coerce
//       .number()
//       .min(1, "Max teams/players required"),
//     banner: z.string().optional(),
//     stream_channels: z.array(z.string()).optional(),
//     event_mode: z.string().min(1, "Event mode required"),
//     number_of_stages: z.coerce.number().min(1, "At least 1 stage required"),
//     stages: z.array(StageSchema).min(1, "At least one stage required"),
//     prizepool: z.string().min(1, "Prize pool required"),
//     prize_distribution: z.record(
//       z.string(),
//       z.string().min(1, "Prize amount required"),
//     ),
//     event_rules: z.string().optional(),
//     rules_document: z.any().optional(),
//     start_date: z.string().min(1, "Start date required"),
//     end_date: z.string().min(1, "End date required"),
//     registration_open_date: z
//       .string()
//       .min(1, "Registration open date required"),
//     registration_end_date: z.string().min(1, "Registration end date required"),
//     registration_link: z.string().optional().or(z.literal("")),
//     event_status: z.string().default("upcoming"),
//     publish_to_tournaments: z.boolean().default(false),
//     publish_to_news: z.boolean().default(false),
//     save_to_drafts: z.boolean().default(false),
//     registration_restriction: z
//       .enum(["none", "by_region", "by_country"])
//       .default("none")
//       .optional(),
//     restriction_mode: z.enum(["allow_only", "block_selected"]).optional(),
//     selected_locations: z.array(z.string()).optional(),
//   })
//   .refine(
//     (data) => {
//       if (data.save_to_drafts) {
//         return !data.publish_to_tournaments && !data.publish_to_news;
//       }
//       if (data.publish_to_tournaments || data.publish_to_news) {
//         return !data.save_to_drafts;
//       }
//       return true;
//     },
//     {
//       message:
//         "An event cannot be saved as a draft and published simultaneously.",
//       path: ["save_to_drafts"],
//     },
//   );

// export type EventFormType = z.infer<typeof EventFormSchema>;
// export type StageType = z.infer<typeof StageSchema>;
// export type GroupType = z.infer<typeof GroupSchema>;

// export const STAGE_FORMATS = [
//   "br - normal",
//   "br - roundrobin",
//   "br - point rush",
//   "br - champion rush",
//   "cs - normal",
//   "cs - league",
//   "cs - knockout",
//   "cs - double elimination",
//   "cs - round robin",
// ];

// export const AVAILABLE_MAPS = [
//   "Bermuda",
//   "Kalahari",
//   "Purgatory",
//   "Nexterra",
//   "Alpine",
//   "Solara",
// ];

// export const FORMATTED_WORD: Record<string, string> = {
//   "br - normal": "Battle Royale - Normal",
//   "br - roundrobin": "Battle Royale - Round Robin",
//   "br - point rush": "Battle Royale - Point Rush",
//   "br - champion rush": "Battle Royale - Champion Rush",
//   "cs - normal": "Clash Squad - Normal",
//   "cs - league": "Clash Squad - League",
//   "cs - knockout": "Clash Squad - Knockout",
//   "cs - double elimination": "Clash Squad - Double Elimination",
//   "cs - round robin": "Clash Squad - Round Robin",
// };

import { z } from "zod";
// Shared bracket-types + labels live in one module now (see lib/eventFormats.ts) so the
// create flow, edit flow, and organizer flow can't drift. Re-exported below under the
// historic STAGE_FORMATS / FORMATTED_WORD names so existing importers keep working.
import {
  STAGE_FORMATS as SHARED_STAGE_FORMATS,
  FORMAT_LABEL,
  isClashSquadFormat,
  isRoundRobinBuilderFormat,
} from "@/lib/eventFormats";
import { CHARGEABLE_CURRENCY_CODES } from "@/lib/currencies";

export const GroupSchema = z.object({
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
  prizepool: z.string().optional(),
  prizepool_cash_value: z.string().optional(),
  prize_distribution: z.record(z.string(), z.string()).optional(),
  // A Clash Squad group runs a BRACKET, and this is its mode (owner item 21, 2026-08-13).
  // Blank/absent for every Battle Royale lobby. Declared so the key survives the resolver -
  // zod strips what it does not know about, which is how the mode was getting lost between
  // the API and the stage modal.
  bracket_format: z.string().optional(),
});

// ── Round-Robin config schema (sub-project B). ───────────────────────────────────
// Kept deliberately permissive: the RoundRobinPanel drives the editing UX and the
// backend enforces the real structural rules (one base group per team, etc.). We only
// shape it enough so it survives the form + serialises cleanly into the stages array.
export const RoundRobinConfigSchema = z.object({
  round_robin_groups: z.array(
    z.object({
      label: z.string(),
      order: z.coerce.number(),
      team_ids: z.array(z.coerce.number()), // TEAM PKs
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
    }),
  ),
});

// ── Branching advancement rule (feature #9). ─────────────────────────────────────
// One authoring row: positions [position_from..position_to] of THIS stage (optionally
// scoped to source_group_index, null = the whole stage) advance into the stage at
// target_stage_index (0-based into the submitted stages array, same convention as
// point_rush_target_index). The backend resolves the indices to StageAdvancementRule FK
// rows in the create/edit second pass and runs them via advance-stage-by-rules/. Validated
// loosely here; the backend (_validate_advancement_rules) is the authority on overlap/cycles.
export const AdvancementRuleSchema = z.object({
  position_from: z.coerce.number().min(1),
  position_to: z.coerce.number().min(1),
  source_group_index: z.coerce.number().nullable(), // null = stage-wide
  target_stage_index: z.coerce.number(),            // 0-based later-stage index
});

export const StageSchema = z.object({
  stage_name: z.string().min(1, "Stage name required"),
  stage_discord_role_id: z.string().optional(),
  start_date: z.string().min(1, "Start date required"),
  end_date: z.string().min(1, "End date required"),
  // NOT min(1) here: the group requirement is format-dependent and is enforced by the
  // superRefine at the bottom of this schema. A Clash Squad stage legitimately carries
  // 0 groups (it runs as a bracket) and a BR Round-Robin stage keeps its groups on
  // round_robin.round_robin_groups. See lib/eventFormats.ts for the three shapes.
  number_of_groups: z.coerce.number().min(0),
  stage_format: z.string().min(1, "Stage format required"),
  groups: z.array(GroupSchema),
  teams_qualifying_from_stage: z.coerce.number().min(0).optional(),
  // ── Branching advancement rules (feature #9). Optional: a stage with rules is in
  //    "branching mode" (rules OVERRIDE the single teams_qualifying_from_stage at advance
  //    time); a stage with none keeps the legacy linear advance. Rides into the FormData
  //    stages array; resolved to StageAdvancementRule rows in the backend second pass. ──
  advancement_rules: z.array(AdvancementRuleSchema).optional(),
  prizepool: z.string().optional(),
  prizepool_cash_value: z.string().optional(),
  prize_distribution: z.record(z.string(), z.string()).optional(),
  // ── Scoring-mode config (sub-project A). Both modes are independent + combinable. ──
  // Champion-Point: first competitor to Booyah while already at/above the threshold wins.
  champion_point_enabled: z.boolean().default(false),
  champion_point_threshold: z.coerce.number().optional(), // required when enabled
  // Point-Rush: this stage's per-lobby placement bonus is banked into a LATER stage.
  point_rush_enabled: z.boolean().default(false),
  point_rush_reward: z.record(z.string(), z.coerce.number()).optional(), // {"1":10,"2":7,...}
  point_rush_target_index: z.coerce.number().optional(), // 0-based index of the target stage
  // ── Round-Robin config (sub-project B). Present only for "br - round robin" stages. ──
  // Threaded verbatim into the FormData stages array; the backend reads
  // round_robin_groups (team_ids = TEAM PKs) + generate_schedule (+ games_per_day) OR
  // a manual game_days list. Validated loosely (passthrough) - the round-robin panel
  // owns the editing UX; the backend is the source of truth for structural rules.
  round_robin: RoundRobinConfigSchema.optional(),
  // ── Clash Squad ROOM SETTINGS (owner 2026-08-13) ──────────────────────────────────────────
  // OPTIONAL, and deliberately unvalidated here: the whole document (rounds, map, the ~110-item
  // store, per-round economy, per-round areas) is validated by the backend against the catalogue,
  // which is the single source of truth for what Free Fire offers. Re-declaring that shape in zod
  // would be a second copy to keep in step with every Garena patch. Typed loosely so the key
  // SURVIVES the resolver - zod strips unknown keys, so without this line the settings an
  // organizer filled in would silently never reach create_event.
  cs_room_settings: z.any().optional().nullable(),
  // Clash Squad mode + the optional split into groups (owner item 21, 2026-08-13). Validated by
  // the backend against the real bracket engines; declared here only so the resolver does not
  // strip the keys - zod drops what it does not know about.
  cs_bracket_format: z.string().optional(),
  cs_groups: z.any().optional(),
})
  // ── Format-aware group requirement (owner 2026-08-12) ────────────────────────────
  // The old schema demanded `groups.min(1)` + `number_of_groups.min(1)` for EVERY stage,
  // so the final "Create Event" submit rejected the two groupless shapes with
  // "Stage 1 > Groups: At least one group required" even though their own builders were
  // complete. Clash Squad events could not be created at all; BR Round-Robin only got
  // through because its base groups live elsewhere. Branch on the shape instead, matching
  // the Step-4 gate in the create pages and validateEventData in the edit flow.
  .superRefine((stage, ctx) => {
    // Clash Squad: a head-to-head bracket, generated later from the event page. No groups,
    // no lobby config, nothing to require here.
    if (isClashSquadFormat(stage.stage_format)) return;

    // BR Round-Robin: lobbies are derived from the base groups A/B/C in the round-robin
    // panel, so require at least one of THOSE rather than a classic group.
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

    // Classic Battle Royale: the Step-2 per-group lobby wizard must have produced a group.
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
    // What the tournament IS, in the organizer's words (owner 2026-08-05, item 26; missing from
    // the CREATE wizard until 2026-08-26, so a description could only be added by creating the
    // event and then editing it). Optional, exactly as on the edit form: an event with no
    // description simply does not render the public About block. Deliberately NOT event_rules,
    // which answers a different question and is capped at 200 characters.
    event_description: z.string().optional(),
    competition_type: z.string().min(1, "Competition type required"),
    participant_type: z.string().min(1, "Participant type required"),
    event_type: z.string().min(1, "Event type required"),
    is_public: z.string().default("True"),
    // ── Discord registration gate (per-event). ───────────────────────────────────
    // When require_discord is ON, register-for-event/ rejects any participant who is
    // not Discord-connected AND a member of the event's Discord server (403 code
    // "discord_required"). discord_server_id is the Discord Guild ID to check against;
    // blank means "use the main AFC server" (the backend's default guild). Mirrors the
    // is_sponsored boolean-toggle pattern: collected in Step1EventDetails, sent on
    // create as require_discord + discord_server_id (see admin/organizer create pages).
    require_discord: z.boolean().default(false),
    discord_server_id: z.string().optional(),
    // The Discord invite link players use to join the event's server. REQUIRED whenever
    // require_discord is ON (the backend 400s a save with require_discord=true + no link);
    // the create/edit save handlers enforce the same before submitting. Collected by the
    // shared DiscordRegistrationGate and shown on the public event page's "Join Discord".
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
    // Which currency the entered prize amounts are in, so the backend knows what to convert FROM
    // (owner 2026-07-01). Default USD (the platform base). See Step5PrizePool + get_total_prize_pool.
    prize_currency: z.string().optional(),
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
    // ── Paid vs free registration (non-payment phase). ──────────────────────────
    // Consumed by Step1EventDetails' "Registration" sub-block (Free/Paid toggle + the
    // fee/currency inputs). FREE is the default so the existing create/edit flows are
    // unchanged when an organizer/admin doesn't opt into a paid event. The three keys
    // map 1:1 onto the backend create-event / edit-event contract:
    //   • registration_type   → "free" | "paid"
    //   • registration_fee    → the entry fee, required > 0 when paid (null/omitted free)
    //   • registration_fee_currency → 3-letter ISO code the fee is charged in
    // The actual charge is a later phase; here we only collect + validate the values.
    registration_type: z.enum(["free", "paid"]).default("free"),
    registration_fee: z.coerce.number().positive().optional().nullable(),
    registration_fee_currency: z.string().default("USD"),
    // Per-country payment rules (owner 2026-06-24). Optional JSON; only meaningful on a paid event.
    // Shape { default_pays, countries: { <Country>: { pays, amount?, currency? } } } (see
    // CountryPaymentRulesEditor / backend Event.country_payment_rules). z.any() because the shared
    // editor owns the shape + the backend re-validates via _parse_country_payment_rules.
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
    is_sponsored: z.boolean().default(false),
    sponsor_name: z.string().optional(),
    sponsor_usernames: z.array(z.string()).optional(),
    sponsor_requirement_description: z.string().optional(),
    sponsor_field_label: z.string().optional(),
    // ── Sponsor-system P2: the wizard's sponsorship builder rows. ────────────────
    // Array of SponsorshipDraft ({sponsor_id, sponsor_name, requires_approval,
    // engagements[]} - see components/sponsorship-builder.tsx). Held loosely (z.any)
    // like the other wizard passthrough fields because the event doesn't exist yet at
    // step 7: the rows are NOT part of the create-event FormData. After
    // /events/create-event/ returns the new event_id, the create pages (admin +
    // organizer) loop these and call sponsorsApi.attachEvent + configureSponsorship.
    // The legacy sponsor_* fields above stay for the old free-text flow.
    sponsorships: z.array(z.any()).optional(),
    is_waitlist_enabled: z.boolean().default(false),
    waitlist_capacity: z.coerce.number().optional(),
    waitlist_discord_role_id: z.string().optional(),
    // Slot-assignment mode (owner 2026-06-17): how a no-show's slot is filled.
    waitlist_mode: z.string().optional(),
    // Event + registration start/end TIMES are compulsory for both admins and organizers
    // (owner 2026-06-21). HH:MM strings from the <input type="time"> in the creator's tz.
    event_start_time: z.string().min(1, "Event start time required"),
    event_end_time: z.string().min(1, "Event end time required"),
    registration_start_time: z.string().min(1, "Registration start time required"),
    registration_end_time: z.string().min(1, "Registration end time required"),
    // IANA timezone of whoever creates/edits the event (e.g. "Africa/Lagos"). Not a
    // user-typed field: the create/edit pages set it at submit from
    // Intl.DateTimeFormat().resolvedOptions().timeZone so the times above can be shown
    // in both the viewer's local tz and the host's tz on the public event page.
    timezone: z.string().optional(),
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
  // field so the message lands right under the fee input in Step1EventDetails.
  .refine(
    (data) =>
      data.registration_type !== "paid" ||
      (data.registration_fee != null && data.registration_fee > 0),
    {
      message: "Enter an entry fee greater than 0 for a paid event.",
      path: ["registration_fee"],
    },
  );

export type EventFormType = z.infer<typeof EventFormSchema>;
export type StageType = z.infer<typeof StageSchema>;
export type GroupType = z.infer<typeof GroupSchema>;
// Branching advancement (feature #9): one authoring row shape, shared by the stage modals
// (StageModal / StageConfigModal) and the create/edit page mappers.
export type AdvancementRuleInput = z.infer<typeof AdvancementRuleSchema>;

// Re-exported from the shared module so existing importers (StageModal, etc.) keep the
// same names. The point-rush / champion-rush pseudo-formats were dropped here - they are
// now per-stage toggles, not bracket types (see lib/eventFormats.ts).
export const STAGE_FORMATS = SHARED_STAGE_FORMATS;
export const FORMATTED_WORD = FORMAT_LABEL;

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

// Currencies an organizer/admin can charge a paid registration fee in. Drives the
// registration_fee_currency Select in Step1EventDetails (create) + BasicInfoTab (edit). USD is the
// default; the value is the 3-letter ISO code sent to the backend (registration_fee_currency).
//
// Owner backlog item 28 (2026-08-03): this used to be its own 7-code array and was one of four
// currency lists that had drifted apart. It is now derived from lib/currencies.ts. DO NOT add codes
// here - add them there, and to the backend twin afc_auth/currencies.py. Kept as a named export so
// the existing importers (Step1EventDetails, BasicInfoTab) keep working unchanged.
//
// CHARGEABLE, not the full menu (item 28 follow-up). A registration fee is the one currency field on
// the site that becomes a real Stripe charge, so it is restricted to the currencies AFC can actually
// bill in, exactly as the per-country override editor already was. Pointing it at the full 48-code
// menu would let an organizer pick a three-decimal currency (TND, LYD) and be billed a tenth of the
// fee, or a zero-decimal one (DJF, KMF, ...) and be billed a hundred times it, because Stripe takes
// amounts in minor units. Prize pools, announcements and tier thresholds are only ever CONVERTED,
// never charged, so those keep the full menu. Rationale in full: CHARGEABLE_CURRENCIES in
// lib/currencies.ts; the backend enforces the same seven codes via afc_auth.currencies.
export const REGISTRATION_FEE_CURRENCIES = CHARGEABLE_CURRENCY_CODES;
