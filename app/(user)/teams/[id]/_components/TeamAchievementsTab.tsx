"use client";

// ──────────────────────────────────────────────────────────────────────────────
// TeamAchievementsTab
// ───────────────────
// The body of the new "Achievements" tab on a team's public detail page
// (app/(user)/teams/[id]/page.tsx). It is the TEAM mirror of the player profile's
// AchievementsPanel (app/(user)/profile/_components/ProfileContent.tsx) and reuses
// the same look + structure one-for-one so both read as one designer's work.
//
// WHAT IT RENDERS:
//   - a headline tally of REAL "team achievement points earned" (sum of earned
//     lifetime tiers only, never goals) out of the catalog total;
//   - a muted note that points will later boost rankings/tiers ("coming soon"),
//     since the boost mechanism itself is an explicit FUTURE feature not built here;
//   - section pill tabs: Lifetime / Monthly / Daily;
//   - per ladder, the tiers in ascending order: earned ones highlighted
//     (green/gold), the NEXT locked tier emphasized with a progress bar toward its
//     threshold ("740 / 1000 team kills"), the rest muted with their how-to-earn
//     text. Goals (scrims / monthly / daily) render as "not tracked yet".
//
// DATA (no second fetch):
//   The parent page already fetched the team object from POST /team/get-team-details/
//   and passes it in via the `team` prop. We project it once into a
//   TeamAchievementContext with buildTeamAchievementContext() (teamAchievements.ts),
//   which derives total team kills / tournaments played / booyahs and reads the real
//   total_wins + members. Lifetime tiers light up from that real context; monthly /
//   daily / scrims are honest goals (no fake earned).
//
// VISIBILITY: rendered for anyone who can already see the team page. No new gating is
// added here (team-stats privacy is handled by a separate change).
//
// CONSUMES: teamAchievements.ts (catalog + helpers). CONSUMED BY: teams/[id]/page.tsx.
// ──────────────────────────────────────────────────────────────────────────────

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  IconTrophy,
  IconCircleCheckFilled,
  IconLock,
  IconClock,
} from "@tabler/icons-react";
// Team achievements catalog + earned-status helpers (display only; the
// points->rankings boost is an explicit FUTURE feature and is NOT implemented here).
import {
  TEAM_ACHIEVEMENTS,
  TEAM_ACHIEVEMENT_SECTIONS,
  buildTeamAchievementContext,
  earnedPointsTotal,
  isEarned,
  isGoal,
  groupByCategory,
  metricValue,
  TOTAL_POINTS_AVAILABLE,
  IconShieldCheck,
  type TeamAchievement,
  type TeamAchievementCategory,
  type TeamAchievementContext,
} from "./teamAchievements";

// The team object the parent passes (the full get-team-details payload, typed `any`
// upstream). We only read the few fields buildTeamAchievementContext() needs.
type TeamAchievementsTabProps = {
  team: any;
};

// ──────────────────────────────────────────────────────────────────────────────
// TeamAchievementsTab: top-level panel (mirrors player AchievementsPanel).
// ──────────────────────────────────────────────────────────────────────────────
const TeamAchievementsTab = ({ team }: TeamAchievementsTabProps) => {
  // Which section is showing (lifetime is the substantive, computable one first).
  const [section, setSection] = useState<TeamAchievementCategory>("lifetime");

  // Build the real-data context ONCE from the already-fetched team object. No extra
  // network request: lifetime ladders read derived stats, milestones read roster facts.
  const ctx = buildTeamAchievementContext(team);

  // Real earned-points tally (lifetime wins only) + catalog total.
  const earnedPoints = earnedPointsTotal(ctx);
  // How many achievements are actually unlocked (for the "x of y" count).
  const earnedCount = TEAM_ACHIEVEMENTS.filter((a) => isEarned(a, ctx)).length;

  // The active section grouped into its ladders / sub-sections, in catalog order.
  const groups = groupByCategory(section);

  return (
    <div>
      {/* ── headline tally + coming-soon note ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div>
          <p className="text-sm text-muted-foreground">
            Team achievement points earned
          </p>
          <p className="text-2xl font-bold text-primary">
            {earnedPoints}
            <span className="text-sm font-normal text-muted-foreground">
              {" "}
              / {TOTAL_POINTS_AVAILABLE} pts
            </span>
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {earnedCount} of {TEAM_ACHIEVEMENTS.length} achievements unlocked
          </p>
        </div>
        {/* Trophy badge mirrors the gold accent used across AFC stat surfaces. */}
        <Badge
          variant="outline"
          className="border-gold/60 text-gold self-start sm:self-auto"
        >
          <IconTrophy className="h-4 w-4 mr-1" />
          {earnedPoints} pts
        </Badge>
      </div>

      {/* Honest note: the boost itself is a FUTURE feature, so we only promise it is
          coming, we do not apply it. Same copy stance as the player version. */}
      <p className="text-xs text-muted-foreground bg-muted/40 border rounded-md px-3 py-2 mb-4">
        Team achievement points will be usable to boost your team rankings and
        tiers. Coming soon.
      </p>

      {/* ── section tabs (AFC pill segment style) ── */}
      <div className="inline-flex gap-1 bg-muted rounded-lg p-[3px] mb-4">
        {TEAM_ACHIEVEMENT_SECTIONS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setSection(s.id)}
            className={`h-8 px-3 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
              section === s.id
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Per-section intro: lifetime ladders are computed; monthly/daily are goals. */}
      {section !== "lifetime" && (
        <p className="text-xs text-muted-foreground mb-4 flex items-center gap-1">
          <IconClock className="h-3.5 w-3.5" />
          {section === "monthly" ? "Monthly" : "Daily"} goals are not tracked
          yet. They will light up automatically once time based team stats are
          recorded.
        </p>
      )}

      {/* ── grouped ladders / sub-sections ── */}
      <div className="space-y-6">
        {groups.map((g) => (
          <TeamAchievementGroup
            key={g.group}
            group={g.group}
            items={g.items}
            ctx={ctx}
          />
        ))}
      </div>
    </div>
  );
};

// ──────────────────────────────────────────────────────────────────────────────
// TeamAchievementGroup: one ladder / sub-section (e.g. "Team Kills") rendered as a
// header + its tiers in ascending order. It computes the "next locked tier" for the
// group: the first tier (in order) the team has NOT yet earned. That tier gets the
// progress emphasis ("740 / 1000 team kills"). Mirrors the player AchievementGroup.
// ──────────────────────────────────────────────────────────────────────────────
function TeamAchievementGroup({
  group,
  items,
  ctx,
}: {
  group: string;
  items: TeamAchievement[];
  ctx: TeamAchievementContext;
}) {
  // The id of the next tier to chase: the first NOT-earned tier in catalog order.
  // For metric ladders this is the next threshold; once all are earned it is null.
  const nextLockedId = items.find((a) => !isEarned(a, ctx))?.id ?? null;

  // How many of this group's tiers are earned (small "x / y" group progress).
  const earnedInGroup = items.filter((a) => isEarned(a, ctx)).length;

  return (
    <div>
      {/* group header: label + earned count for the ladder */}
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-semibold text-foreground">{group}</h4>
        <span className="text-xs text-muted-foreground">
          {earnedInGroup} / {items.length}
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {items.map((a) => (
          <TeamAchievementCard
            key={a.id}
            achievement={a}
            ctx={ctx}
            // emphasize this card when it is the next tier to chase in its ladder
            isNext={a.id === nextLockedId}
          />
        ))}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// TeamAchievementCard: a single catalog entry (one ladder tier or one milestone /
// goal). Mirrors the player AchievementCard treatment one-for-one:
//   - Earned                     -> green/filled treatment + check + gold pts badge.
//   - Next locked metric tier    -> primary-emphasized border + progress bar +
//                                    "740 / 1000 team kills" toward the threshold.
//   - Other locked lifetime tier -> muted, lock icon, how-to-earn hint.
//   - Goal (scrims/monthly/daily)-> muted, clock icon, "Not tracked yet".
// The point value always shows as a badge so the catalog reads as a points map.
// ──────────────────────────────────────────────────────────────────────────────
function TeamAchievementCard({
  achievement,
  ctx,
  isNext = false,
}: {
  achievement: TeamAchievement;
  ctx: TeamAchievementContext;
  isNext?: boolean;
}) {
  const Icon = achievement.icon;
  const earned = isEarned(achievement, ctx);
  const goal = isGoal(achievement);

  // Progress numbers for the next locked tier of a metric ladder. metricValue is
  // null for milestones/goals (no numeric progress), so the bar only shows on the
  // ladder tier we are actively chasing.
  const value = metricValue(achievement, ctx);
  const showProgress =
    isNext &&
    !earned &&
    value != null &&
    achievement.threshold != null &&
    achievement.threshold > 0;
  const pct = showProgress
    ? Math.min(
        100,
        Math.round(((value as number) / achievement.threshold!) * 100),
      )
    : 0;

  // The unit noun for the progress label. The how-to-earn copy says "Reach N <unit>"
  // so we re-derive the unit from the group for the progress line ("740 / 1000 team
  // kills"). Lowercased group reads naturally for every ladder name we ship.
  const progressUnit = achievement.group.toLowerCase();

  // Card container treatment: earned (green), next-to-chase (primary ring), else a
  // plain muted card. Identical class set to the player card.
  const containerClass = earned
    ? "border-primary/40 bg-primary/5"
    : isNext && !goal
      ? "border-primary/60 bg-primary/[0.03] ring-1 ring-primary/30"
      : "border-border bg-card hover:bg-muted/30";

  return (
    <div
      className={`flex items-start gap-3 rounded-md border px-3 py-3 transition-colors ${containerClass}`}
    >
      {/* icon chip: green when earned, muted otherwise */}
      <div
        className={`shrink-0 rounded-md p-2 ${
          earned
            ? "bg-primary/15 text-primary"
            : "bg-muted text-muted-foreground"
        }`}
      >
        <Icon className="h-5 w-5" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p
            className={`text-sm font-semibold truncate ${
              earned || isNext ? "text-foreground" : "text-muted-foreground"
            }`}
          >
            {achievement.title}
          </p>
          {/* point value badge (gold when earned, outline-muted otherwise) */}
          <Badge
            variant="outline"
            className={`shrink-0 text-xs ${
              earned ? "border-gold/60 text-gold" : "text-muted-foreground"
            }`}
          >
            {achievement.points} pts
          </Badge>
        </div>

        {/* how-to-earn text (always shown so the catalog explains itself) */}
        <p className="text-xs text-muted-foreground mt-0.5">
          {achievement.description}
        </p>

        {/* progress toward the next locked tier's threshold (metric ladders only) */}
        {showProgress && (
          <div className="mt-2">
            <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="text-xs text-primary font-medium mt-1">
              {(value as number).toLocaleString()} /{" "}
              {achievement.threshold!.toLocaleString()} {progressUnit}
            </p>
          </div>
        )}

        {/* status line: earned / next / locked / goal */}
        <div className="mt-1.5 flex items-center gap-1 text-xs">
          {earned ? (
            <span className="inline-flex items-center gap-1 text-primary font-medium">
              <IconCircleCheckFilled className="h-3.5 w-3.5" />
              Unlocked
            </span>
          ) : goal ? (
            <span className="inline-flex items-center gap-1 text-muted-foreground">
              <IconClock className="h-3.5 w-3.5" />
              Not tracked yet
            </span>
          ) : isNext ? (
            <span className="inline-flex items-center gap-1 text-primary font-medium">
              <IconShieldCheck className="h-3.5 w-3.5" />
              Up next
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-muted-foreground">
              <IconLock className="h-3.5 w-3.5" />
              Locked
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default TeamAchievementsTab;
