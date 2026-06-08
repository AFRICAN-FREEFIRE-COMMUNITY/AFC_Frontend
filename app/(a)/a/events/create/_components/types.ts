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
import { STAGE_FORMATS as SHARED_STAGE_FORMATS, FORMAT_LABEL } from "@/lib/eventFormats";

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

export const StageSchema = z.object({
  stage_name: z.string().min(1, "Stage name required"),
  stage_discord_role_id: z.string().optional(),
  start_date: z.string().min(1, "Start date required"),
  end_date: z.string().min(1, "End date required"),
  number_of_groups: z.coerce.number().min(1, "Must have at least 1 group"),
  stage_format: z.string().min(1, "Stage format required"),
  groups: z.array(GroupSchema).min(1, "At least one group required"),
  teams_qualifying_from_stage: z.coerce.number().min(0).optional(),
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
});

export const EventFormSchema = z
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
    prizepool_cash_value: z.coerce.number().optional(),
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
    is_waitlist_enabled: z.boolean().default(false),
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
];

// Currencies an organizer/admin can charge a paid registration fee in. Drives the
// registration_fee_currency Select in Step1EventDetails (create) + BasicInfoTab
// (edit). USD is the default; the value is the 3-letter ISO code sent to the backend
// (registration_fee_currency). Edit here to add/remove a supported currency.
export const REGISTRATION_FEE_CURRENCIES = [
  "USD",
  "NGN",
  "GHS",
  "KES",
  "ZAR",
  "GBP",
  "EUR",
];
