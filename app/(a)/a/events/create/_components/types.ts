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
    is_sponsored: z.boolean().default(false),
    sponsor_name: z.string().optional(),
    sponsor_username: z.string().optional(),
    sponsor_requirement_description: z.string().optional(),
    sponsor_field_label: z.string().optional(),
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
  );

export type EventFormType = z.infer<typeof EventFormSchema>;
export type StageType = z.infer<typeof StageSchema>;
export type GroupType = z.infer<typeof GroupSchema>;

export const STAGE_FORMATS = [
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

export const AVAILABLE_MAPS = [
  "Bermuda",
  "Kalahari",
  "Purgatory",
  "Nexterra",
  "Alpine",
  "Solara",
];

export const FORMATTED_WORD: Record<string, string> = {
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
