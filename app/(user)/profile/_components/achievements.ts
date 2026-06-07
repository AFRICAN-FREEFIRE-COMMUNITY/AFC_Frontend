// ──────────────────────────────────────────────────────────────────────────────
// achievements.ts
// ────────────────
// The Achievements CATALOG that powers the "Achievements" tab on the user's own
// player profile (app/(user)/profile/_components/ProfileContent.tsx).
//
// WHAT THIS IS (and is NOT):
//   - DISPLAY catalog only. Every achievement carries a title, how-to-earn text,
//     point value, icon, and the rule that decides whether the logged-in user has
//     EARNED it. Grouped into three buckets: lifetime, monthly, daily.
//   - It is NOT a points-to-rankings/tiers BOOST mechanism. That is an explicit
//     FUTURE feature, deliberately out of scope. We only SHOW the point values +
//     an earned total, plus a small "coming soon" note that points will later
//     boost rankings and tiers.
//
// DATA-DRIVEN + TIERED MODEL:
//   Lifetime achievements come in two flavours:
//     1. METRIC LADDERS  -> { metric, threshold }. A whole ladder (Kills, Wins,
//        Tournaments, Scrims, MVPs, Booyahs) is just a list of rows that share a
//        `metric` and a `group`, each with an ascending `threshold`. Earned =
//        (user.stats[metric] ?? 0) >= threshold. Adding a new tier is one row.
//     2. MILESTONE / PROFILE one-offs -> { group: "Profile", condition }. A
//        boolean predicate over the real `user`/account context (uid set, on a
//        team, Discord connected, profile complete, voted in awards). When the
//        underlying fact is not available the predicate returns false and the UI
//        renders it as a GOAL rather than a fake win.
//   MONTHLY + DAILY achievements are GOALS: they need time-bucketed counters
//   (kills this month, kills today, ...) the client does not have yet. They carry
//   no earned rule and render as "not tracked yet" with their how-to-earn hint.
//
// EARNED STATUS uses the AuthContext `user` object (contexts/AuthContext.tsx ->
// User / UserStats): the metric scalars live on `user.stats`, the profile facts on
// `user` + a couple of fetched flags (Discord connection). Stats tables may be
// empty in this DB clone, so missing values degrade truthfully (a ladder simply
// shows everything locked), never a false "earned".
//
// CONSUMED BY: ProfileContent.tsx (the Achievements tab).
// ──────────────────────────────────────────────────────────────────────────────

import {
  IconTrophy,
  IconAward,
  IconMedal,
  IconCrosshair,
  IconTarget,
  IconFlame,
  IconSwords,
  IconShieldCheck,
  IconUsers,
  IconBrandDiscord,
  IconUserCheck,
  IconCalendarStats,
  IconCalendarMonth,
  IconLogin2,
  IconDeviceGamepad2,
  IconClipboardCheck,
  IconChartBar,
  IconStar,
  IconId,
  IconThumbUp,
  IconSkull,
  type Icon,
} from "@tabler/icons-react";

// The three buckets the catalog is grouped into (drives the section tabs).
export type AchievementCategory = "lifetime" | "monthly" | "daily";

// The stat metrics the lifetime ladders count against. These map 1:1 onto fields
// of UserStats (contexts/AuthContext.tsx), so the ladder reads user.stats[metric].
export type StatMetric =
  | "total_kills"
  | "total_wins"
  | "total_tournaments_played"
  | "total_scrims_played"
  | "total_mvps"
  | "total_booyahs";

// The real-data context an achievement's earned rule reads. `stats` mirrors the
// metric fields of UserStats; the rest are optional profile/account facts. Every
// field beyond `stats` is optional so a missing value degrades to a GOAL rather
// than a false positive (we never guess "earned" from absent data).
export interface AchievementContext {
  stats: Record<StatMetric, number>;
  // user.uid is present/non-empty.
  uidSet?: boolean;
  // user.team is a non-empty team name.
  hasTeam?: boolean;
  // Discord connected (from /auth/is-discord-account-connected/).
  discordConnected?: boolean;
  // Profile has a picture, a country, and at least one in-game role.
  profileComplete?: boolean;
  // User has voted in the community awards. Not exposed on the client yet, so this
  // stays undefined and the achievement shows as a goal (never faked).
  votedInAwards?: boolean;
}

// One catalog entry. The shape carries BOTH ladder fields (metric/threshold) and
// the milestone field (condition); a given entry uses one or the other:
//   - metric + threshold  -> a ladder tier (lifetime). Earned via the metric.
//   - condition           -> a milestone one-off (lifetime). Earned via the bool.
//   - neither             -> a goal (monthly/daily). Never auto-earned.
export interface Achievement {
  id: string;
  title: string;
  // "How to earn" copy. NO em/en dashes (AFC hard rule) -> plain sentences.
  description: string;
  category: AchievementCategory;
  // Sub-section the entry renders under (e.g. "Kills", "Wins", "Profile").
  group: string;
  points: number;
  icon: Icon;
  // Ladder fields (present together on metric ladders only).
  metric?: StatMetric;
  threshold?: number;
  // Milestone one-off predicate (present on profile milestones only).
  condition?: (ctx: AchievementContext) => boolean;
}

// ──────────────────────────────────────────────────────────────────────────────
// LADDER BUILDER
// A ladder is a shared group/metric/icon plus a list of [threshold, title, points]
// tiers. ladder() turns each into a catalog row. Points scale roughly with the
// threshold (bigger tier = more points), hand-tuned per ladder for a sensible feel.
// ──────────────────────────────────────────────────────────────────────────────
function ladder(
  group: string,
  metric: StatMetric,
  icon: Icon,
  tiers: { threshold: number; title: string; points: number }[],
): Achievement[] {
  return tiers.map((t) => ({
    id: `${metric}_${t.threshold}`,
    title: t.title,
    description: `Reach ${t.threshold.toLocaleString()} ${group.toLowerCase()}.`,
    category: "lifetime" as const,
    group,
    points: t.points,
    icon,
    metric,
    threshold: t.threshold,
  }));
}

// ── KILLS ladder (metric total_kills) ──
const KILLS = ladder("Kills", "total_kills", IconCrosshair, [
  { threshold: 100, title: "Sharpshooter", points: 50 },
  { threshold: 250, title: "Deadshot", points: 100 },
  { threshold: 500, title: "Marksman", points: 200 },
  { threshold: 1000, title: "Killing Machine", points: 400 },
  { threshold: 2500, title: "Executioner", points: 750 },
  { threshold: 5000, title: "Warlord", points: 1200 },
  { threshold: 10000, title: "Apex Predator", points: 2000 },
]);

// ── WINS ladder (metric total_wins) ──
const WINS = ladder("Wins", "total_wins", IconMedal, [
  { threshold: 1, title: "First Win", points: 50 },
  { threshold: 5, title: "Contender", points: 100 },
  { threshold: 10, title: "Champion", points: 200 },
  { threshold: 25, title: "Conqueror", points: 400 },
  { threshold: 50, title: "Dominator", points: 700 },
  { threshold: 100, title: "Unstoppable", points: 1200 },
  { threshold: 250, title: "Immortal", points: 2000 },
]);

// ── TOURNAMENTS ladder (metric total_tournaments_played) ──
const TOURNAMENTS = ladder(
  "Tournaments",
  "total_tournaments_played",
  IconTrophy,
  [
    { threshold: 1, title: "First Tournament", points: 50 },
    { threshold: 5, title: "Competitor", points: 120 },
    { threshold: 10, title: "Tournament Veteran", points: 250 },
    { threshold: 25, title: "Seasoned Pro", points: 450 },
    { threshold: 50, title: "Tournament Legend", points: 800 },
    { threshold: 100, title: "Hall of Famer", points: 1500 },
  ],
);

// ── SCRIMS ladder (metric total_scrims_played) ──
const SCRIMS = ladder("Scrims", "total_scrims_played", IconSwords, [
  { threshold: 1, title: "Scrim Starter", points: 50 },
  { threshold: 10, title: "Scrim Regular", points: 120 },
  { threshold: 25, title: "Scrim Grinder", points: 250 },
  { threshold: 50, title: "Scrim Master", points: 450 },
  { threshold: 100, title: "Scrim Machine", points: 800 },
]);

// ── MVPS ladder (metric total_mvps) ──
const MVPS = ladder("MVPs", "total_mvps", IconStar, [
  { threshold: 1, title: "MVP", points: 75 },
  { threshold: 5, title: "Star Player", points: 150 },
  { threshold: 10, title: "Most Valuable", points: 300 },
  { threshold: 25, title: "Carry", points: 550 },
  { threshold: 50, title: "GOAT", points: 1000 },
]);

// ── BOOYAHS ladder (metric total_booyahs) ──
const BOOYAHS = ladder("Booyahs", "total_booyahs", IconFlame, [
  { threshold: 1, title: "Booyah", points: 75 },
  { threshold: 5, title: "Booyah Hunter", points: 150 },
  { threshold: 25, title: "Booyah King", points: 400 },
  { threshold: 50, title: "Booyah Legend", points: 700 },
  { threshold: 100, title: "Booyah God", points: 1200 },
]);

// ──────────────────────────────────────────────────────────────────────────────
// PROFILE / MILESTONE one-offs (lifetime, group "Profile"). Each is a boolean
// `condition` over the real account context. Where the fact is unavailable the
// predicate returns false and the UI shows the entry as a goal (never faked).
// ──────────────────────────────────────────────────────────────────────────────
const PROFILE: Achievement[] = [
  {
    id: "add_uid",
    title: "Identity Set",
    description: "Add your in-game UID to your profile.",
    category: "lifetime",
    group: "Profile",
    points: 50,
    icon: IconId,
    condition: (c) => c.uidSet === true,
  },
  {
    id: "team_player",
    title: "Team Player",
    description: "Join a team.",
    category: "lifetime",
    group: "Profile",
    points: 50,
    icon: IconUsers,
    condition: (c) => c.hasTeam === true,
  },
  {
    id: "verified",
    title: "Verified",
    description: "Connect your Discord account.",
    category: "lifetime",
    group: "Profile",
    points: 50,
    icon: IconBrandDiscord,
    condition: (c) => c.discordConnected === true,
  },
  {
    id: "profile_complete",
    title: "Profile Complete",
    description: "Add a profile picture, a country, and your in-game roles.",
    category: "lifetime",
    group: "Profile",
    points: 75,
    icon: IconUserCheck,
    condition: (c) => c.profileComplete === true,
  },
  {
    id: "community_voice",
    title: "Community Voice",
    description: "Vote in the community awards.",
    category: "lifetime",
    group: "Profile",
    points: 50,
    icon: IconThumbUp,
    // Not exposed on the client yet -> stays a goal until votedInAwards is wired.
    condition: (c) => c.votedInAwards === true,
  },
];

// ──────────────────────────────────────────────────────────────────────────────
// MONTHLY (goals, smaller tiers, reset monthly). No month-bucketed counters on the
// client yet, so these carry no earned rule and render as goals ("not tracked
// yet"). Grouped so the kills/wins ladders read as mini-ladders too.
// ──────────────────────────────────────────────────────────────────────────────
const MONTHLY: Achievement[] = [
  {
    id: "monthly_marksman",
    title: "Monthly Marksman",
    description: "Get 100 kills this month.",
    category: "monthly",
    group: "Monthly Kills",
    points: 100,
    icon: IconCrosshair,
  },
  {
    id: "monthly_sniper",
    title: "Monthly Sniper",
    description: "Get 250 kills this month.",
    category: "monthly",
    group: "Monthly Kills",
    points: 200,
    icon: IconTarget,
  },
  {
    id: "monthly_slayer",
    title: "Monthly Slayer",
    description: "Get 500 kills this month.",
    category: "monthly",
    group: "Monthly Kills",
    points: 350,
    icon: IconSkull,
  },
  {
    id: "monthly_winner",
    title: "Monthly Winner",
    description: "Win 3 matches this month.",
    category: "monthly",
    group: "Monthly Wins",
    points: 150,
    icon: IconMedal,
  },
  {
    id: "monthly_dominator",
    title: "Monthly Dominator",
    description: "Win 10 matches this month.",
    category: "monthly",
    group: "Monthly Wins",
    points: 300,
    icon: IconAward,
  },
  {
    id: "monthly_competitor",
    title: "Monthly Competitor",
    description: "Register for a tournament this month.",
    category: "monthly",
    group: "Monthly Activity",
    points: 50,
    icon: IconCalendarStats,
  },
  {
    id: "monthly_grind",
    title: "Monthly Grind",
    description: "Play 5 matches this month.",
    category: "monthly",
    group: "Monthly Activity",
    points: 75,
    icon: IconCalendarMonth,
  },
  {
    id: "monthly_scrimmer",
    title: "Monthly Scrimmer",
    description: "Play 5 scrims this month.",
    category: "monthly",
    group: "Monthly Activity",
    points: 75,
    icon: IconSwords,
  },
];

// ──────────────────────────────────────────────────────────────────────────────
// DAILY (goals). Same as monthly: no per-day counters on the client yet, so these
// render as goals with their how-to-earn hint and a neutral "not tracked yet".
// ──────────────────────────────────────────────────────────────────────────────
const DAILY: Achievement[] = [
  {
    id: "daily_login",
    title: "Daily Login",
    description: "Log in today.",
    category: "daily",
    group: "Daily",
    points: 10,
    icon: IconLogin2,
  },
  {
    id: "daily_match",
    title: "Daily Match",
    description: "Play a match today.",
    category: "daily",
    group: "Daily",
    points: 20,
    icon: IconDeviceGamepad2,
  },
  {
    id: "daily_hunter",
    title: "Daily Hunter",
    description: "Get 10 kills today.",
    category: "daily",
    group: "Daily",
    points: 15,
    icon: IconCrosshair,
  },
  {
    id: "daily_register",
    title: "Daily Register",
    description: "Register for any event today.",
    category: "daily",
    group: "Daily",
    points: 15,
    icon: IconClipboardCheck,
  },
  {
    id: "daily_check",
    title: "Stay Informed",
    description: "Check the leaderboard or rankings today.",
    category: "daily",
    group: "Daily",
    points: 10,
    icon: IconChartBar,
  },
];

// The full ordered catalog: lifetime ladders + profile milestones first (the
// substantive, computable ones), then monthly, then daily.
export const ACHIEVEMENTS: Achievement[] = [
  ...KILLS,
  ...WINS,
  ...TOURNAMENTS,
  ...SCRIMS,
  ...MVPS,
  ...BOOYAHS,
  ...PROFILE,
  ...MONTHLY,
  ...DAILY,
];

// Ordered list of the section buckets + their display labels (drives the section
// tabs in the Achievements panel).
export const ACHIEVEMENT_SECTIONS: {
  id: AchievementCategory;
  label: string;
}[] = [
  { id: "lifetime", label: "Lifetime" },
  { id: "monthly", label: "Monthly" },
  { id: "daily", label: "Daily" },
];

// Re-export the earned/locked marker icon so callers can reuse it without a
// second import.
export { IconShieldCheck };

// ──────────────────────────────────────────────────────────────────────────────
// Helpers consumed by ProfileContent.
// ──────────────────────────────────────────────────────────────────────────────

// The current value of an achievement's metric, or null when the entry is not a
// metric ladder (milestones/goals have no numeric progress). Used to drive the
// "740 / 1000 kills" progress label on the next locked tier.
export function metricValue(
  a: Achievement,
  ctx: AchievementContext,
): number | null {
  if (!a.metric) return null;
  return ctx.stats[a.metric] ?? 0;
}

// Is this achievement earned given the current real-data context?
//   - metric ladder  -> value >= threshold
//   - milestone      -> condition(ctx)
//   - goal           -> always false (unverifiable client-side; never a fake win)
export function isEarned(a: Achievement, ctx: AchievementContext): boolean {
  if (a.metric && a.threshold != null) {
    return (ctx.stats[a.metric] ?? 0) >= a.threshold;
  }
  if (a.condition) return a.condition(ctx);
  return false;
}

// True when an achievement is an unverifiable GOAL (no metric ladder and no
// milestone condition): the monthly/daily ones. Drives the "not tracked yet" state.
export function isGoal(a: Achievement): boolean {
  return !a.metric && !a.condition;
}

// Total achievement points the user has actually earned (sum over earned ones).
// Only real, computed lifetime wins count; goals never inflate it.
export function earnedPointsTotal(ctx: AchievementContext): number {
  return ACHIEVEMENTS.reduce(
    (sum, a) => (isEarned(a, ctx) ? sum + a.points : sum),
    0,
  );
}

// Total points available across the whole catalog (for an "x of y" style tally).
export const TOTAL_POINTS_AVAILABLE: number = ACHIEVEMENTS.reduce(
  (sum, a) => sum + a.points,
  0,
);

// Group the achievements of one category into ordered { group, items } sections,
// preserving first-seen group order. Items inside a group keep catalog order, so a
// ladder's tiers stay ascending. Drives the grouped sub-section rendering.
export function groupByCategory(
  category: AchievementCategory,
): { group: string; items: Achievement[] }[] {
  const order: string[] = [];
  const map = new Map<string, Achievement[]>();
  for (const a of ACHIEVEMENTS) {
    if (a.category !== category) continue;
    if (!map.has(a.group)) {
      map.set(a.group, []);
      order.push(a.group);
    }
    map.get(a.group)!.push(a);
  }
  return order.map((g) => ({ group: g, items: map.get(g)! }));
}
