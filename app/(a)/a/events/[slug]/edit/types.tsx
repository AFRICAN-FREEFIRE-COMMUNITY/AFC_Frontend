import { z } from "zod";
import { toast } from "sonner";

// ============================================================================
// CONSTANTS
// ============================================================================

export const formattedWord: Record<string, string> = {
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

export const AVAILABLE_MAPS = [
  "Bermuda",
  "Kalahari",
  "Purgatory",
  "Nexterra",
  "Alpine",
  "Solara",
];

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

// ============================================================================
// SCHEMAS
// ============================================================================

export const GroupSchema = z.object({
  group_id: z.number().optional(),
  group_name: z.string().min(1, "Group name required"),
  group_discord_role_id: z.string().min(1, "Discord Role ID required"),
  room_id: z.string().optional(),
  room_name: z.string().optional(),
  room_password: z.string().optional(),
  playing_date: z.string().min(1, "Playing date required"),
  playing_time: z.string().min(1, "Playing time required"),
  teams_qualifying: z.coerce.number().min(1, "Must qualify at least 1 team"),
  match_count: z.coerce.number().min(1, "Must play at least 1 match"),
  match_maps: z.array(z.string()).min(1, "At least one map must be selected"),
});

export const StageSchema = z.object({
  stage_id: z.number().optional(),
  stage_name: z.string().min(1, "Stage name required"),
  stage_discord_role_id: z.string().min(1, "Discord Role ID required"),
  start_date: z.string().min(1, "Start date required"),
  end_date: z.string().min(1, "End date required"),
  number_of_groups: z.coerce.number().min(1, "Must have at least 1 group"),
  stage_format: z.string().min(1, "Stage format required"),
  groups: z.array(GroupSchema).min(1, "At least one group required"),
  teams_qualifying_from_stage: z.coerce.number().min(0).default(0),
  total_teams_in_stage: z.coerce.number().min(0).default(0),
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

// ============================================================================
// TYPES
// ============================================================================

export type EventFormType = z.infer<typeof EventFormSchema>;
export type StageType = z.infer<typeof StageSchema>;
export type GroupType = z.infer<typeof GroupSchema>;

export interface EventDetails {
  event_id: number;
  competition_type: string;
  participant_type: string;
  event_type: string;
  is_public: string;
  max_teams_or_players: number;
  event_name: string;
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
      !stage.stage_discord_role_id ||
      stage.stage_discord_role_id.trim() === ""
    ) {
      errors.push({
        field: `stages.${sIdx}.stage_discord_role_id`,
        message: `Stage ${sIdx + 1}: Discord Role ID is required`,
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

    if (!stage.groups || stage.groups.length === 0) {
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

    // Validate groups
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

        if (
          !group.group_discord_role_id ||
          group.group_discord_role_id.trim() === ""
        ) {
          errors.push({
            field: `stages.${sIdx}.groups.${gIdx}.group_discord_role_id`,
            message: `Stage ${sIdx + 1}, Group ${
              gIdx + 1
            }: Discord Role ID is required`,
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
