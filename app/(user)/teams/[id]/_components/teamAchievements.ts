// ──────────────────────────────────────────────────────────────────────────────
// teamAchievements.ts
// ───────────────────
// The Achievements CATALOG that powers the new "Achievements" tab on a team's
// public detail page (app/(user)/teams/[id]/page.tsx -> TeamAchievementsTab.tsx).
//
// This is the TEAM mirror of the player catalog at
// app/(user)/profile/_components/achievements.ts. It follows the exact same
// data-driven, tiered model so the two surfaces read as one designer's work. Read
// that file first if you are touching this one.
//
// WHAT THIS IS (and is NOT):
//   - DISPLAY catalog only. Every achievement carries a title, a how-to-earn line,
//     a point value, an icon, and the rule that decides whether THIS team has
//     EARNED it. Entries are grouped into three buckets: lifetime, monthly, daily.
//   - It is NOT a points-to-rankings/tiers BOOST mechanism. The boost is an
//     explicit FUTURE feature, deliberately out of scope here (same stance as the
//     player version). We only SHOW the point values + an earned total, plus a
//     small "coming soon" note that points will later boost rankings and tiers.
//
// DATA SOURCE (no second fetch):
//   The team detail page already fetches the team object from
//   POST /team/get-team-details/ (afc_team/views.py -> get_team_details) and holds
//   it in `teamDetails`. TeamAchievementsTab receives that same object and projects
//   the few fields the ladders need into a TeamAchievementContext (see
//   buildTeamAchievementContext below). NOTHING is invented: every earned status
//   traces to a real field on that payload.
//
// REAL FIELDS WE COMPUTE AGAINST (confirmed against get_team_details' response):
//   - total_wins        (top-level int)  -> Team Wins ladder.
//   - tournament_performance[]           -> we DERIVE:
//        * total team kills   = sum of each event's total_kills
//        * tournaments played = number of events in the array
//        * booyahs (1st)      = number of events whose best_placement === 1
//   - members[]         (top-level list) -> Full Squad milestone (>= 4 members).
//   - creation_date     (top-level)      -> Founded milestone (team exists).
//
// FIELD-NAME NOTES (honest mapping):
//   - The brief asked for `total_kills`, `total_tournaments_played`,
//     `total_scrims_played`, and a team booyah/placement count as metrics. The
//     get-team-details payload does NOT expose those as flat scalars (there is no
//     team `stats` sub-object on this response; the Overview tab's
//     teamDetails.stats.* reads resolve to undefined -> 0). So we DERIVE the real
//     equivalents from the data that IS present:
//        total_team_kills        <- sum(tournament_performance[].total_kills)
//        total_tournaments_played<- tournament_performance.length
//        total_booyahs           <- count(best_placement === 1) == 1st-place finishes
//     total_team_wins uses the real top-level `total_wins` directly.
//   - SCRIMS: get-team-details returns NO scrim data (no scrim count, no scrim
//     match stats). Rather than fake a zero ladder that can never light up, the
//     Scrims ladder is published as GOALS ("not tracked yet") with its how-to-earn
//     text, exactly like the monthly/daily goals. The moment the backend exposes a
//     team scrim count, switch SCRIMS to a metric ladder (one-line change) and it
//     lights up automatically. This keeps the catalog honest: no fake earned, and
//     no ladder that is silently un-earnable while pretending to be computed.
//
// CONSUMED BY: TeamAchievementsTab.tsx (the new Achievements tab body).
// ──────────────────────────────────────────────────────────────────────────────

import {
  IconTrophy,
  IconMedal,
  IconCrosshair,
  IconFlame,
  IconSwords,
  IconShieldCheck,
  IconUsers,
  IconCalendarStats,
  IconDeviceGamepad2,
  IconClipboardCheck,
  IconSkull,
  IconBuildingCommunity,
  type Icon,
} from "@tabler/icons-react";

// The three buckets the catalog is grouped into (drives the section tabs).
export type TeamAchievementCategory = "lifetime" | "monthly" | "daily";

// The DERIVED team metrics the lifetime ladders count against. These map 1:1 onto
// fields of TeamAchievementContext.stats (built in buildTeamAchievementContext).
// NOTE: there is no `total_scrims_played` metric here on purpose; scrims are not in
// the get-team-details payload, so the Scrims ladder ships as goals (see header).
export type TeamStatMetric =
  | "total_team_kills"
  | "total_team_wins"
  | "total_tournaments_played"
  | "total_booyahs";

// The real-data context an achievement's earned rule reads. `stats` mirrors the
// derived metric fields above; the rest are optional roster/team facts. Every field
// beyond `stats` is optional so a missing value degrades to a GOAL rather than a
// false positive (we never guess "earned" from absent data).
export interface TeamAchievementContext {
  stats: Record<TeamStatMetric, number>;
  // The team row exists (creation_date present). Drives the "Founded" milestone.
  founded?: boolean;
  // The team has at least 4 active members. Drives the "Full Squad" milestone.
  fullSquad?: boolean;
  // Live member count, used only to render "3 / 4 members" progress on Full Squad.
  memberCount?: number;
}

// One catalog entry. The shape carries BOTH ladder fields (metric/threshold) and
// the milestone field (condition); a given entry uses one or the other:
//   - metric + threshold  -> a ladder tier (lifetime). Earned via the metric.
//   - condition           -> a milestone one-off (lifetime). Earned via the bool.
//   - neither             -> a goal (scrims / monthly / daily). Never auto-earned.
export interface TeamAchievement {
  id: string;
  title: string;
  // "How to earn" copy. NO em/en dashes (AFC hard rule) -> plain sentences.
  description: string;
  category: TeamAchievementCategory;
  // Sub-section the entry renders under (e.g. "Team Kills", "Team Wins", "Team").
  group: string;
  points: number;
  icon: Icon;
  // Ladder fields (present together on metric ladders only).
  metric?: TeamStatMetric;
  threshold?: number;
  // Milestone one-off predicate (present on team milestones only).
  condition?: (ctx: TeamAchievementContext) => boolean;
}

// ──────────────────────────────────────────────────────────────────────────────
// LADDER BUILDER
// A ladder is a shared group/metric/icon plus a list of [threshold, title, points]
// tiers. ladder() turns each into a catalog row. Points scale roughly with the
// threshold (bigger tier = more points), hand-tuned per ladder for a sensible feel.
// Identical idea to the player catalog's ladder() so both stay in lockstep.
// ──────────────────────────────────────────────────────────────────────────────
function ladder(
  group: string,
  metric: TeamStatMetric,
  icon: Icon,
  // `unit` is the lowercase noun used in the how-to-earn copy + progress label
  // (e.g. "team kills"). Kept separate from `group` so the label reads naturally.
  unit: string,
  tiers: { threshold: number; title: string; points: number }[],
): TeamAchievement[] {
  return tiers.map((t) => ({
    id: `${metric}_${t.threshold}`,
    title: t.title,
    description: `Reach ${t.threshold.toLocaleString()} ${unit}.`,
    category: "lifetime" as const,
    group,
    points: t.points,
    icon,
    metric,
    threshold: t.threshold,
  }));
}

// ── TEAM WINS ladder (metric total_team_wins) ──
// total_team_wins is the real top-level `total_wins` from get-team-details (count of
// match stats with placement == 1 across all the team's tournament entries).
const TEAM_WINS = ladder(
  "Team Wins",
  "total_team_wins",
  IconMedal,
  "team wins",
  [
    { threshold: 1, title: "First Victory", points: 50 },
    { threshold: 5, title: "Rising Squad", points: 100 },
    { threshold: 10, title: "Established", points: 200 },
    { threshold: 25, title: "Powerhouse", points: 400 },
    { threshold: 50, title: "Juggernaut", points: 700 },
    { threshold: 100, title: "Dynasty", points: 1200 },
    { threshold: 250, title: "Legendary Dynasty", points: 2000 },
  ],
);

// ── TEAM KILLS ladder (metric total_team_kills) ──
// Derived: sum of tournament_performance[].total_kills across every event played.
const TEAM_KILLS = ladder(
  "Team Kills",
  "total_team_kills",
  IconCrosshair,
  "team kills",
  [
    { threshold: 500, title: "Aggressive", points: 100 },
    { threshold: 1000, title: "Bloodthirsty", points: 200 },
    { threshold: 2500, title: "Ruthless", points: 400 },
    { threshold: 5000, title: "Devastating", points: 700 },
    { threshold: 10000, title: "Annihilators", points: 1200 },
    { threshold: 25000, title: "Apex Squad", points: 2000 },
  ],
);

// ── TOURNAMENTS PLAYED ladder (metric total_tournaments_played) ──
// Derived: tournament_performance.length (one row per event the team entered).
const TEAM_TOURNAMENTS = ladder(
  "Tournaments Played",
  "total_tournaments_played",
  IconTrophy,
  "tournaments played",
  [
    { threshold: 1, title: "Debut", points: 50 },
    { threshold: 5, title: "Regulars", points: 120 },
    { threshold: 10, title: "Veterans", points: 250 },
    { threshold: 25, title: "Seasoned", points: 450 },
    { threshold: 50, title: "Circuit Legends", points: 800 },
  ],
);

// ── BOOYAHS ladder (metric total_booyahs) ──
// Derived: number of events whose best_placement === 1 (a team first-place finish,
// the team-level equivalent of a Booyah). Same definition the Statistics tab uses
// for its "Wins (1st)" card, so the two surfaces agree.
const TEAM_BOOYAHS = ladder(
  "Booyahs",
  "total_booyahs",
  IconFlame,
  "first place finishes",
  [
    { threshold: 1, title: "First Booyah", points: 75 },
    { threshold: 5, title: "Booyah Streak", points: 150 },
    { threshold: 25, title: "Booyah Hunters", points: 400 },
    { threshold: 50, title: "Booyah Kings", points: 700 },
    { threshold: 100, title: "Booyah Dynasty", points: 1200 },
  ],
);

// ──────────────────────────────────────────────────────────────────────────────
// SCRIMS ladder (GOALS, not a metric ladder).
// get-team-details exposes NO scrim data, so we cannot honestly compute these. They
// ship as goals (no metric/condition -> isGoal() true) with their how-to-earn text
// and a neutral "not tracked yet" state, never a fake earned. When a team scrim
// count is added to the payload, convert this to ladder("Scrims", "total_scrims_
// played", ...) and add total_scrims_played to TeamStatMetric + the context.
// ──────────────────────────────────────────────────────────────────────────────
const TEAM_SCRIMS: TeamAchievement[] = [
  {
    id: "scrim_1",
    title: "First Scrim",
    description: "Play 1 scrim as a team.",
    category: "lifetime",
    group: "Scrims",
    points: 50,
    icon: IconSwords,
  },
  {
    id: "scrim_10",
    title: "Grinders",
    description: "Play 10 scrims as a team.",
    category: "lifetime",
    group: "Scrims",
    points: 120,
    icon: IconSwords,
  },
  {
    id: "scrim_25",
    title: "Practice Pros",
    description: "Play 25 scrims as a team.",
    category: "lifetime",
    group: "Scrims",
    points: 250,
    icon: IconSwords,
  },
  {
    id: "scrim_50",
    title: "Scrim Machine",
    description: "Play 50 scrims as a team.",
    category: "lifetime",
    group: "Scrims",
    points: 450,
    icon: IconSwords,
  },
];

// ──────────────────────────────────────────────────────────────────────────────
// TEAM / ROSTER milestones (lifetime, group "Team"). Each is a boolean `condition`
// over the real team context. Where the fact is unavailable the predicate returns
// false and the UI shows the entry as a goal (never faked).
// ──────────────────────────────────────────────────────────────────────────────
const TEAM_MILESTONES: TeamAchievement[] = [
  {
    id: "founded",
    title: "Founded",
    description: "Create the team.",
    category: "lifetime",
    group: "Team",
    points: 25,
    icon: IconBuildingCommunity,
    condition: (c) => c.founded === true,
  },
  {
    id: "full_squad",
    title: "Full Squad",
    description: "Have at least 4 active members on the roster.",
    category: "lifetime",
    group: "Team",
    points: 75,
    icon: IconUsers,
    condition: (c) => c.fullSquad === true,
  },
];

// ──────────────────────────────────────────────────────────────────────────────
// MONTHLY (goals, reset monthly). No month-bucketed team counters on the client yet,
// so these carry no earned rule and render as goals ("not tracked yet").
// ──────────────────────────────────────────────────────────────────────────────
const MONTHLY: TeamAchievement[] = [
  {
    id: "monthly_wins",
    title: "Monthly Winners",
    description: "Win 3 matches as a team this month.",
    category: "monthly",
    group: "Monthly",
    points: 150,
    icon: IconMedal,
  },
  {
    id: "monthly_tournament",
    title: "Monthly Competitors",
    description: "Play a tournament as a team this month.",
    category: "monthly",
    group: "Monthly",
    points: 100,
    icon: IconCalendarStats,
  },
  {
    id: "monthly_kills",
    title: "Monthly Onslaught",
    description: "Rack up 500 team kills this month.",
    category: "monthly",
    group: "Monthly",
    points: 200,
    icon: IconSkull,
  },
];

// ──────────────────────────────────────────────────────────────────────────────
// DAILY (goals). Same as monthly: no per-day team counters on the client yet, so
// these render as goals with their how-to-earn hint and a neutral "not tracked yet".
// ──────────────────────────────────────────────────────────────────────────────
const DAILY: TeamAchievement[] = [
  {
    id: "daily_match",
    title: "Daily Match",
    description: "Play a match as a team today.",
    category: "daily",
    group: "Daily",
    points: 20,
    icon: IconDeviceGamepad2,
  },
  {
    id: "daily_register",
    title: "Daily Sign-Up",
    description: "Register the team for an event today.",
    category: "daily",
    group: "Daily",
    points: 15,
    icon: IconClipboardCheck,
  },
];

// The full ordered catalog: lifetime ladders + team milestones first (the
// substantive, computable ones), then scrims (goals), then monthly, then daily.
export const TEAM_ACHIEVEMENTS: TeamAchievement[] = [
  ...TEAM_WINS,
  ...TEAM_KILLS,
  ...TEAM_TOURNAMENTS,
  ...TEAM_BOOYAHS,
  ...TEAM_MILESTONES,
  ...TEAM_SCRIMS,
  ...MONTHLY,
  ...DAILY,
];

// Ordered list of the section buckets + their display labels (drives the section
// tabs in the Achievements panel).
export const TEAM_ACHIEVEMENT_SECTIONS: {
  id: TeamAchievementCategory;
  label: string;
}[] = [
  { id: "lifetime", label: "Lifetime" },
  { id: "monthly", label: "Monthly" },
  { id: "daily", label: "Daily" },
];

// Re-export the earned/locked marker icon so callers can reuse it without a second
// import (mirrors the player catalog's re-export).
export { IconShieldCheck };

// ──────────────────────────────────────────────────────────────────────────────
// CONTEXT BUILDER
// Projects the raw get-team-details `team` object into the lean
// TeamAchievementContext the catalog computes against. This is the single place
// that knows the real field names / derivations, so the rest of the catalog and the
// UI stay decoupled from the payload shape.
//
//   total_team_wins         <- team.total_wins (real top-level scalar)
//   total_team_kills        <- sum(tournament_performance[].total_kills)
//   total_tournaments_played<- tournament_performance.length
//   total_booyahs           <- count(tournament_performance.best_placement === 1)
//   founded                 <- a creation_date / team_id is present
//   fullSquad               <- members.length >= 4
//
// `team` is typed loosely (the page passes the full object as `any`); we read only
// the fields above and tolerate any of them being missing (degrade to 0 / false).
// ──────────────────────────────────────────────────────────────────────────────
export function buildTeamAchievementContext(
  team: any,
): TeamAchievementContext {
  const perf: any[] = Array.isArray(team?.tournament_performance)
    ? team.tournament_performance
    : [];

  // Derive total team kills by summing each event's total_kills.
  const totalTeamKills = perf.reduce(
    (sum, p) => sum + (Number(p?.total_kills) || 0),
    0,
  );

  // Tournaments played = number of events the team entered.
  const totalTournamentsPlayed = perf.length;

  // Booyahs = number of events the team won outright (best_placement === 1). This
  // matches the Statistics tab's "Wins (1st)" definition.
  const totalBooyahs = perf.filter((p) => p?.best_placement === 1).length;

  // Real, populated top-level win count (count of placement==1 match stats).
  const totalTeamWins = Number(team?.total_wins) || 0;

  // Active member count for the Full Squad milestone + its progress label.
  const memberCount: number = Array.isArray(team?.members)
    ? team.members.length
    : 0;

  return {
    stats: {
      total_team_wins: totalTeamWins,
      total_team_kills: totalTeamKills,
      total_tournaments_played: totalTournamentsPlayed,
      total_booyahs: totalBooyahs,
    },
    // A real team object always carries a creation_date / team_id, so seeing the
    // payload at all means the team is founded.
    founded: !!(team?.creation_date || team?.team_id),
    fullSquad: memberCount >= 4,
    memberCount,
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// Helpers consumed by TeamAchievementsTab (mirror the player catalog's helpers).
// ──────────────────────────────────────────────────────────────────────────────

// The current value of an achievement's metric, or null when the entry is not a
// metric ladder (milestones/goals have no numeric progress). Used to drive the
// "740 / 1000 team kills" progress label on the next locked tier.
export function metricValue(
  a: TeamAchievement,
  ctx: TeamAchievementContext,
): number | null {
  if (!a.metric) return null;
  return ctx.stats[a.metric] ?? 0;
}

// Is this achievement earned given the current real-data context?
//   - metric ladder  -> value >= threshold
//   - milestone      -> condition(ctx)
//   - goal           -> always false (unverifiable client-side; never a fake win)
export function isEarned(
  a: TeamAchievement,
  ctx: TeamAchievementContext,
): boolean {
  if (a.metric && a.threshold != null) {
    return (ctx.stats[a.metric] ?? 0) >= a.threshold;
  }
  if (a.condition) return a.condition(ctx);
  return false;
}

// True when an achievement is an unverifiable GOAL (no metric ladder and no
// milestone condition): the scrims / monthly / daily ones. Drives "not tracked yet".
export function isGoal(a: TeamAchievement): boolean {
  return !a.metric && !a.condition;
}

// Total achievement points the team has actually earned (sum over earned ones).
// Only real, computed lifetime wins count; goals never inflate it.
export function earnedPointsTotal(ctx: TeamAchievementContext): number {
  return TEAM_ACHIEVEMENTS.reduce(
    (sum, a) => (isEarned(a, ctx) ? sum + a.points : sum),
    0,
  );
}

// Total points available across the whole catalog (for an "x of y" style tally).
export const TOTAL_POINTS_AVAILABLE: number = TEAM_ACHIEVEMENTS.reduce(
  (sum, a) => sum + a.points,
  0,
);

// Group the achievements of one category into ordered { group, items } sections,
// preserving first-seen group order. Items inside a group keep catalog order, so a
// ladder's tiers stay ascending. Drives the grouped sub-section rendering.
export function groupByCategory(
  category: TeamAchievementCategory,
): { group: string; items: TeamAchievement[] }[] {
  const order: string[] = [];
  const map = new Map<string, TeamAchievement[]>();
  for (const a of TEAM_ACHIEVEMENTS) {
    if (a.category !== category) continue;
    if (!map.has(a.group)) {
      map.set(a.group, []);
      order.push(a.group);
    }
    map.get(a.group)!.push(a);
  }
  return order.map((g) => ({ group: g, items: map.get(g)! }));
}
