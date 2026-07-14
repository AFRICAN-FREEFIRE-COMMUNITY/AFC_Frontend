"use client";

// TournamentStructure
// ───────────────────
// The graphical "Structure" view for a tournament's detail page (the Results⇄Structure
// toggle in EventDetailsWrapper renders this when "Structure" is active).
//
// It is 100% data-driven off the SAME payload the page already fetches
// (get-event-details-not-logged-in): one node per `stage`, the stage's real
// `stage_format` label, its `teams_qualifying_from_stage` ("top N advance"), and each
// group's `overall_leaderboard` standings with a green qualify line after
// `group.teams_qualifying`. No hardcoded stage count/format - add/remove a stage or
// change a format in admin and this re-renders correctly.
//
// Honest scope (matches the data model): we show stage ORDER + how many advance, not a
// wired "group A -> lobby 2" routing (the backend stores advancement as "top-N into the
// next stage", not per-group edges). Points-based formats (incl. "Knockout" labels) all
// render as their accurate standings, because that is how AFC records results.

import { Fragment, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
// i18n: tournament-section strings live in messages/en/tournaments.json under
// the "structure.*" keys; useTranslations("tournaments") resolves the active
// locale from the NEXT_LOCALE cookie (en fallback).
import { useTranslations } from "next-intl";
// i18n date/time: stage + group schedule dates render in the VIEWER's locale via <LocalTime
// mode="date"/>; the group's playing TIME renders dual-tz (viewer + host) via <LocalEventTime/>,
// since playing_time is a host wall-clock paired with the event's IANA timezone. (owner 2026-06-22)
import { LocalTime } from "@/components/LocalTime";
import { LocalEventTime } from "@/components/LocalEventTime";
import { CalendarDays } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Trophy, ChevronRight, ChevronDown, ArrowUp } from "lucide-react";
// IconArrowRight matches the LinkedEventsCard chip aesthetic (components/event-links.tsx).
import { IconArrowRight } from "@tabler/icons-react";
import { FORMAT_LABEL } from "@/lib/eventFormats";
// Public qualification-link client (lib/eventLinks.ts publicStructure -> GET
// events/<id>/links/structure/, no auth). Powers the "Qualification Links" section below.
import { eventLinksApi, type PublicLinksStructure } from "@/lib/eventLinks";
import { env } from "@/lib/env";
// Subtle clickable name -> public player/team profile (standings rows).
import { PlayerLink, TeamLink } from "@/components/ui/entity-link";
// Clash-Squad (head-to-head) stages have NO groups (the bracket owns the structure), so the public
// Structure view shows the SAME read-only bracket card the admin/organizer event pages mount. Its
// GET bracket endpoint (headToHeadApi.getBracket) is public, and isManager={false} strips every
// generate/report control, so spectators see the tree + standings without any edit affordance
// (CS remediation P1#5, owner 2026-07-13).
import { H2HBracketCard } from "@/components/h2h-bracket";

// Local mirrors of the Stage/StageGroup shapes from EventDetailsWrapper (kept local so
// this component stays self-contained; `any` rows because leaderboard keys vary solo/squad).
interface StageGroup {
  group_id: number;
  group_name: string;
  teams_qualifying: number;
  // is_my_group (owner 2026-06-29): true for the group the signed-in viewer competes in
  // (echoed by get_event_details). Drives a "Your group" highlight so registered players
  // spot their own group instantly.
  is_my_group?: boolean;
  // Schedule (owner 2026-06-22): when this group plays. playing_date is a "YYYY-MM-DD"; playing_time
  // is a host wall-clock "HH:MM[:SS]" tied to the event's timezone. Both echoed by get_event_details.
  playing_date?: string | null;
  playing_time?: string | null;
  // Maps this group plays, in order (owner 2026-06-29). Straight off the get_event_details /
  // get_event_details_not_logged_in group payload (`match_maps` JSON list, e.g.
  // ["Bermuda","Purgatory"]). Rendered as badges on the group card below.
  match_maps?: string[] | null;
  // The group's point system (owner 2026-06-29): its leaderboard scoring config, echoed by the same
  // detail endpoints. `placement_points` is a {"1":12,"2":9,...} rank->points map; `kill_point` is
  // points awarded per kill. Rendered alongside the maps so users see HOW the group is scored.
  leaderboard?: {
    placement_points?: Record<string, number> | null;
    kill_point?: number | null;
  } | null;
  overall_leaderboard?: any[];
  matches?: any[];
}
// One branching-advancement rule echoed per stage (feature #9) by get_event_details(_not_logged_in)
// -> views._advancement_rules_echo. Each says positions [position_from..position_to] of this stage
// (whole stage when source_group_* is null, else that one group) advance into target_stage_name.
// Rendered as a chip under the source stage card; rule-less stages keep the plain "top N" chevron.
interface AdvancementRule {
  id: number;
  position_from: number;
  position_to: number;
  source_group_id: number | null;
  source_group_name: string | null;
  target_stage_id: number;
  target_stage_name: string | null;
}
interface Stage {
  stage_id: number;
  stage_name: string;
  stage_format: string;
  teams_qualifying_from_stage: number;
  // Branching advancement rules (feature #9). When present, the stage routes its finishers into
  // (possibly several) specific later stages; the chips below replace the single "top N" hint.
  advancement_rules?: AdvancementRule[];
  is_finals_stage?: boolean; // present on the model; fall back to "last stage" if absent
  // Schedule (owner 2026-06-22): the stage's start/end DATEs ("YYYY-MM-DD"), echoed by
  // get_event_details. Shown under each stage so users see when it runs.
  start_date?: string | null;
  end_date?: string | null;
  groups: StageGroup[];
}

interface Props {
  stages: Stage[];
  participantType: string; // "solo" | "duo" | "squad"
  // Event IANA timezone (Event.timezone), for the dual-tz group playing-time display. Optional:
  // legacy events / missing tz -> LocalEventTime shows the host wall-clock without conversion.
  timezone?: string | null;
  // OPTIONAL (owner 2026-06-15): this event's numeric id, used to fetch its qualification
  // links for the "Qualification Links" section. The parent (EventDetailsWrapper) renders
  // this component with only stages + participantType and must NOT be edited, so when eventId
  // is absent we resolve it ourselves from the URL slug (see useEffect below). Optional keeps
  // the existing 2-prop call site valid without touching the wrapper.
  eventId?: number;
  // Per-event results visibility (owner 2026-06-29): Event.results_published, echoed by the detail
  // endpoints. When explicitly false the organizer has HIDDEN the standings (social-reveal timing),
  // so each group card shows a "Results not published yet" state instead of its standings table. The
  // maps + point-system strip and the stage flow stay (that's config, not results). Absent/true =>
  // normal standings. The backend ALSO withholds overall_leaderboard server-side, so this is the
  // user-facing explanation for the now-empty standings, not the security boundary.
  resultsPublished?: boolean;
}

// Pull a competitor's display name from a leaderboard row regardless of solo/squad shape.
function rowName(row: any, idx: number): string {
  return (
    row.username ||
    row.team_name ||
    row.competitor__user__username ||
    row.tournament_team__team__team_name ||
    `#${row.placement ?? idx + 1}`
  );
}
// The team's country for a squad standings row, so TeamLink can show its flag (owner 2026-06-20).
// The backend adds `team_country` to the overall_leaderboard rows; the rows are raw Django .values()
// dicts, so we also accept the un-flattened `tournament_team__team__country` key (mirrors how rowName
// reads both shapes). Solo rows have no team, so this returns undefined and no flag renders. The value
// is an ISO-2 code OR a full country name; countryToIso2 (inside TeamLink) resolves either.
const rowCountry = (row: any): string | undefined =>
  row.team_country ?? row.tournament_team__team__country ?? undefined;
const rowKills = (row: any) => row.total_kills ?? row.kills ?? 0;
// Summed placement points for the row. Backend returns it as `placement_sum` on the overall
// standings (single-map stats expose `placement_points`); always renders a number, 0 when none.
const rowPlacementPts = (row: any) =>
  row.placement_sum ?? row.placement_points ?? 0;
const rowPoints = (row: any) => {
  const p = row.total_points ?? row.total_pts ?? 0;
  const n = parseFloat(p);
  return Number.isFinite(n) ? n : 0;
};
const fmtLabel = (f: string) => FORMAT_LABEL[f] || f;

export function TournamentStructure({ stages, participantType, eventId, timezone, resultsPublished }: Props) {
  const t = useTranslations("tournaments");
  const [sel, setSel] = useState(0);
  // Tapping a stage scrolls its groups (standings + schedule + room IDs) into view, so the
  // stage spine reads as an interactive selector rather than static cards (owner 2026-06-29).
  const groupsRef = useRef<HTMLElement>(null);
  const selectStage = (i: number) => {
    setSel(i);
    // Defer one frame so the newly-selected stage's groups render before we scroll to them.
    requestAnimationFrame(() =>
      groupsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
    );
  };
  // Explicit false only (undefined/true => standings render normally) so legacy callers + events
  // without the flag are unaffected. When hidden, each group card swaps its standings table for the
  // "Results not published yet" state below; config (maps / point system) is untouched.
  const resultsHidden = resultsPublished === false;

  // ── Qualification Links (owner 2026-06-15) ──
  // This event's place in the season: events that qualify INTO it (inbound) and events its
  // stages qualify INTO (outbound), as clickable chips. Source: lib/eventLinks.ts
  // publicStructure() -> GET events/<id>/links/structure/ (public, no auth).
  //
  // We need this event's numeric id. The parent EventDetailsWrapper renders us with only
  // stages + participantType (and must not be edited), and the stages payload carries no
  // event_id, so when the eventId prop is absent we resolve it from the route slug via the
  // SAME public endpoint the page already uses (get-event-details-not-logged-in).
  const params = useParams();
  const routeSlug = typeof params?.slug === "string" ? params.slug : undefined;
  const [linkEventId, setLinkEventId] = useState<number | null>(eventId ?? null);
  const [links, setLinks] = useState<PublicLinksStructure | null>(null);

  // Resolve the event id from the slug only when it was not passed in as a prop.
  useEffect(() => {
    if (eventId != null) {
      setLinkEventId(eventId);
      return;
    }
    if (!routeSlug) return;
    let cancelled = false;
    (async () => {
      try {
        // get-event-details-not-logged-in: the same public detail endpoint page.tsx fetches;
        // we only read event_id off the top of the payload.
        const res = await fetch(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/get-event-details-not-logged-in/`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ slug: decodeURIComponent(routeSlug) }),
          },
        );
        if (!res.ok) return;
        const json = await res.json();
        const id = json?.event_details?.event_id;
        if (!cancelled && typeof id === "number") setLinkEventId(id);
      } catch {
        /* non-critical enhancement: silently skip the section if resolution fails */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [eventId, routeSlug]);

  // Fetch the qualification links once we know the event id.
  useEffect(() => {
    if (linkEventId == null) return;
    let cancelled = false;
    eventLinksApi
      .publicStructure(linkEventId)
      .then((data) => {
        if (!cancelled) setLinks(data);
      })
      .catch(() => {
        /* non-critical: leave links null so the section stays hidden on error */
      });
    return () => {
      cancelled = true;
    };
  }, [linkEventId]);

  if (!stages || stages.length === 0) {
    return (
      <div className="p-10 text-center border-2 border-dashed border-border rounded-md text-muted-foreground">
        {t("structure.noStages")}
      </div>
    );
  }

  // Finals = the stage flagged is_finals_stage, else the last stage in order.
  const finalsIdx = (() => {
    const flagged = stages.findIndex((s) => s.is_finals_stage);
    return flagged >= 0 ? flagged : stages.length - 1;
  })();
  const competitorWord =
    participantType === "solo"
      ? t("structure.playerWord")
      : t("structure.teamWord");
  const stage = stages[sel];

  return (
    <div className="space-y-10">
      {/* ── 1. Stage-flow spine ── */}
      <section>
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
          {t("structure.tournamentFlow")}
        </p>
        {/* Discoverability hint: makes it obvious the stage cards below are tappable and that
            tapping drives the groups/schedule/room IDs shown underneath (owner 2026-06-29). */}
        <p className="mb-4 text-xs text-muted-foreground">{t("structure.tapHint")}</p>
        <div className="flex items-stretch overflow-x-auto pb-2">
          {stages.map((s, i) => {
            const isFinals = i === finalsIdx;
            const advancing = s.teams_qualifying_from_stage;
            // Branching advancement (feature #9): when this stage has explicit routing rules, the
            // chips below carry where each cut goes, so we suppress the single "top N" chevron hint.
            const branchRules = s.advancement_rules ?? [];
            const hasBranching = branchRules.length > 0;
            return (
              <div key={s.stage_id} className="flex items-stretch">
                <button
                  type="button"
                  onClick={() => selectStage(i)}
                  className={`text-left min-w-[230px] flex-1 bg-card rounded-md border p-5 transition-colors
                    ${i === sel ? "ring-1 ring-primary/40 border-primary/50" : "hover:border-primary/40"}
                    ${isFinals ? "border-gold/50" : ""}`}
                >
                  <div
                    className={`text-[0.7rem] font-bold uppercase tracking-wider ${
                      isFinals ? "text-gold" : "text-muted-foreground"
                    }`}
                  >
                    {isFinals
                      ? t("structure.finals")
                      : t("structure.stage", { number: i + 1 })}
                  </div>
                  <div className="text-lg font-bold mt-1 mb-3 flex items-center gap-1.5">
                    {isFinals && <Trophy className="size-4 text-gold" />}
                    {s.stage_name}
                  </div>
                  <Badge variant="outline" className="rounded-full font-medium">
                    {fmtLabel(s.stage_format)}
                  </Badge>
                  {/* Stage schedule (owner 2026-06-22): the dates this stage runs, in the viewer's
                      locale. Shows a range when start/end differ, a single date when they match. */}
                  {s.start_date && (
                    <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <CalendarDays className="size-3.5 shrink-0" />
                      {s.end_date && s.end_date !== s.start_date ? (
                        <span>
                          <LocalTime value={s.start_date} mode="date" />
                          {" "}
                          {t("structure.dateTo")}{" "}
                          <LocalTime value={s.end_date} mode="date" />
                        </span>
                      ) : (
                        <LocalTime value={s.start_date} mode="date" />
                      )}
                    </div>
                  )}
                  <div className="flex items-center gap-2 mt-4 text-sm text-muted-foreground flex-wrap">
                    {isFinals ? (
                      <span>{t("structure.championCrowned")}</span>
                    ) : (
                      <>
                        <Badge className="rounded-full gap-1 bg-primary/10 text-primary border border-primary/50">
                          <ArrowUp className="size-3" />{" "}
                          {t("structure.topAdvance", { count: advancing })}
                        </Badge>
                        <span>
                          {t("structure.advanceGroups", {
                            count: s.groups?.length || 0,
                            groupWord:
                              s.groups?.length === 1
                                ? t("structure.groupSingular")
                                : t("structure.groupPlural"),
                          })}
                        </span>
                      </>
                    )}
                  </div>
                  {/* Branching advancement chips (feature #9): one per rule, "Top {from}-{to} ->
                      {targetStage}" (with a group prefix when the rule is scoped to one group). Only
                      shown when the stage has routing rules; mirrors the LinkedEventsCard chip look
                      (rounded-full outline Badge + IconArrowRight) already used above. */}
                  {hasBranching && !isFinals && (
                    <div className="mt-3 space-y-1.5">
                      <p className="text-[0.6rem] font-bold uppercase tracking-wider text-muted-foreground">
                        {t("structure.branchHeading")}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {branchRules.map((r) => {
                          const range =
                            r.position_from === r.position_to
                              ? t("structure.branchPos", { pos: r.position_from })
                              : t("structure.branchRange", {
                                  from: r.position_from,
                                  to: r.position_to,
                                });
                          const prefix = r.source_group_name
                            ? `${r.source_group_name} `
                            : "";
                          return (
                            <Badge
                              key={r.id}
                              variant="outline"
                              className="rounded-full gap-1 px-2 py-0.5 text-xs border-primary/50 text-primary"
                            >
                              <span>
                                {prefix}
                                {range}
                              </span>
                              <IconArrowRight className="size-3 shrink-0" />
                              <span>
                                {r.target_stage_name ||
                                  t("structure.branchTargetFallback")}
                              </span>
                            </Badge>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {/* Tappable affordance: a clear caret + label so the card obviously opens its
                      groups below. The selected card reads "Viewing groups" with the caret down;
                      the others read "View groups" with the caret pointing right. */}
                  <div
                    className={`mt-3 flex items-center gap-1 text-xs font-medium ${
                      i === sel ? "text-primary" : "text-muted-foreground"
                    }`}
                  >
                    <ChevronDown
                      className={`size-3.5 transition-transform ${
                        i === sel ? "" : "-rotate-90"
                      }`}
                    />
                    {i === sel
                      ? t("structure.viewingGroups")
                      : t("structure.viewGroups")}
                  </div>
                </button>
                {/* arrow between stages */}
                {i < stages.length - 1 && (
                  <div className="flex flex-col items-center justify-center min-w-[54px] text-muted-foreground">
                    <ChevronRight className="size-6" />
                    {/* Suppress the single "top N" hint when branching rules carry the routing
                        detail in the chips above (feature #9). */}
                    {!isFinals && !hasBranching && (
                      <span className="text-[0.6rem] mt-0.5">
                        {t("structure.topN", { count: advancing })}
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* ── 1b. Qualification Links (owner 2026-06-15) ──
          This event's place in the season cascade: inbound = events that qualify INTO this
          event, outbound = events this event's stages qualify INTO. Each is a clickable chip
          to /tournaments/<event_slug>. Data: lib/eventLinks.ts publicStructure() -> GET
          events/<id>/links/structure/. Aesthetic mirrors LinkedEventsCard (components/
          event-links.tsx): rounded-full Badge + IconArrowRight + primary/green accents.
          The whole section is hidden when both directions are empty. */}
      {links && (links.inbound.length > 0 || links.outbound.length > 0) && (
        <section>
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-4">
            {t("structure.qualificationLinks")}
          </p>
          <div className="space-y-5">
            {/* inbound: events that feed INTO this one ("Qualifies from") */}
            {links.inbound.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground">
                  {t("structure.qualifiesFrom")}
                </p>
                <div className="flex flex-wrap gap-2">
                  {links.inbound.map((row) => {
                    // chip text: "Qualifies from: <event_name> - <stage> top N"
                    const label = t("structure.qualifiesFromChip", {
                      eventName: row.event_name,
                      stageName: row.stage_name,
                      count: row.qualify_count,
                    });
                    // Navigate to the feeder event by its slug; if a slug is missing (older
                    // event), render a non-clickable badge rather than a broken link.
                    const chip = (
                      <Badge
                        variant="outline"
                        className="rounded-full gap-1.5 px-3 py-1 text-xs border-primary/50 text-primary transition-colors hover:bg-primary/10"
                      >
                        <IconArrowRight className="size-3.5 shrink-0" />
                        {label}
                      </Badge>
                    );
                    return row.event_slug ? (
                      <Link key={row.link_id} href={`/tournaments/${row.event_slug}`}>
                        {chip}
                      </Link>
                    ) : (
                      <span key={row.link_id} className="opacity-70">{chip}</span>
                    );
                  })}
                </div>
              </div>
            )}

            {/* outbound: events THIS one qualifies into ("Qualifies into") */}
            {links.outbound.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground">
                  {t("structure.qualifiesInto")}
                </p>
                <div className="flex flex-wrap gap-2">
                  {links.outbound.map((row) => {
                    // chip text: "Top N of <stage> qualifies into: <event_name>"
                    const label = t("structure.qualifiesIntoChip", {
                      count: row.qualify_count,
                      stageName: row.stage_name,
                      eventName: row.event_name,
                    });
                    const chip = (
                      <Badge
                        variant="outline"
                        className="rounded-full gap-1.5 px-3 py-1 text-xs border-primary/50 text-primary transition-colors hover:bg-primary/10"
                      >
                        {label}
                        <IconArrowRight className="size-3.5 shrink-0" />
                      </Badge>
                    );
                    return row.event_slug ? (
                      <Link key={row.link_id} href={`/tournaments/${row.event_slug}`}>
                        {chip}
                      </Link>
                    ) : (
                      <span key={row.link_id} className="opacity-70">{chip}</span>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── 2. Standings & qualification for the selected stage ── */}
      {/* groupsRef: selectStage() scrolls here so a stage tap visibly reveals its groups. */}
      <section ref={groupsRef} className="scroll-mt-4">
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
          {t("structure.standingsHeading", { stageName: stage.stage_name })}
        </p>
        <div className="flex gap-5 flex-wrap text-sm text-muted-foreground mb-5">
          <span className="inline-flex items-center gap-2">
            <span className="size-2.5 rounded-[3px] bg-primary" />{" "}
            {t("structure.qualifiedLegend")}
          </span>
          {sel !== finalsIdx && (
            <span>
              {/* teams_qualifying_from_stage is the STAGE TOTAL that advances (e.g. 15), NOT a
                  per-group number; per-group quotas show as "Top N advance" on each group card
                  below (group.teams_qualifying). Bug fix 2026-06-29: this legend used to read
                  "Top 15 advance per group", which was wrong (15 was the stage total). */}
              {t.rich("structure.advanceFromStage", {
                count: stage.teams_qualifying_from_stage,
                stageName: stage.stage_name,
                b: (chunks) => <b className="text-primary">{chunks}</b>,
              })}
            </span>
          )}
        </div>

        {String(stage.stage_format || "").startsWith("cs") ? (
          // Clash-Squad stage: show the read-only head-to-head bracket instead of the group grid
          // (a CS stage has no groups). registeredTeams=[] because the public viewer never seeds/
          // generates — that control is manager-only and hidden by isManager={false}.
          <H2HBracketCard
            stageId={stage.stage_id}
            stageName={stage.stage_name}
            stageFormat={stage.stage_format}
            isManager={false}
            registeredTeams={[]}
          />
        ) : !stage.groups || stage.groups.length === 0 ? (
          <div className="p-10 text-center border-2 border-dashed border-border rounded-md text-muted-foreground">
            {t("structure.noGroups")}
          </div>
        ) : (
          <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(380px,1fr))]">
            {stage.groups.map((g) => {
              const rows = Array.isArray(g.overall_leaderboard)
                ? g.overall_leaderboard
                : [];
              const qN = g.teams_qualifying ?? 0;
              return (
                <div
                  key={g.group_id}
                  className={`bg-card rounded-md border overflow-hidden ${
                    g.is_my_group ? "ring-1 ring-primary/50 border-primary/50" : ""
                  }`}
                >
                  <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b">
                    <div className="min-w-0">
                      <span className="font-bold">{g.group_name}</span>
                      {/* "Your group" highlight so a registered player spots their group instantly. */}
                      {g.is_my_group && (
                        <Badge className="ml-2 rounded-full border border-primary/40 bg-primary/15 px-2 py-0.5 text-[0.65rem] text-primary">
                          {t("structure.yourGroup")}
                        </Badge>
                      )}
                      {/* Group schedule (owner 2026-06-22): when this group plays. The date is in the
                          viewer's locale; the time is dual-tz (viewer + host) since playing_time is a
                          host wall-clock paired with the event timezone. */}
                      {g.playing_date && (
                        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                          <CalendarDays className="size-3.5 shrink-0" />
                          <LocalTime value={g.playing_date} mode="date" />
                          {g.playing_time && (
                            <>
                              <span aria-hidden>·</span>
                              <LocalEventTime
                                date={g.playing_date}
                                startTime={g.playing_time}
                                tz={timezone}
                              />
                            </>
                          )}
                        </div>
                      )}
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground text-right">
                      {t("structure.matchCount", {
                        count: g.matches?.length || 0,
                        matchWord:
                          g.matches?.length === 1
                            ? t("structure.matchSingular")
                            : t("structure.matchPlural"),
                      })}
                      {qN > 0 && t("structure.topNAdvance", { count: qN })}
                    </span>
                  </div>

                  {/* Maps + point system for this group (owner 2026-06-29). Both are read straight off
                      the get_event_details(_not_logged_in) group payload: match_maps (the maps this
                      group plays, in order) and leaderboard (placement_points map + kill_point). Shown
                      here, mirroring how they're configured per group, so users can see what each group
                      plays and how it is scored. The whole strip is hidden when neither is present. */}
                  {((Array.isArray(g.match_maps) && g.match_maps.length > 0) ||
                    (g.leaderboard &&
                      (g.leaderboard.kill_point != null ||
                        (g.leaderboard.placement_points &&
                          Object.keys(g.leaderboard.placement_points).length > 0)))) && (
                    <div className="border-b px-5 py-3 space-y-2">
                      {/* maps the group plays, in order (capitalize: stored lowercase e.g. "bermuda") */}
                      {Array.isArray(g.match_maps) && g.match_maps.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="mr-1 text-[0.68rem] font-semibold uppercase tracking-wide text-muted-foreground">
                            {t("structure.mapsLabel")}
                          </span>
                          {g.match_maps.map((m, i) => (
                            <Badge
                              key={`${g.group_id}-map-${i}`}
                              variant="outline"
                              className="rounded-full px-2 py-0.5 text-xs capitalize"
                            >
                              {m}
                            </Badge>
                          ))}
                        </div>
                      )}
                      {/* point system: per-kill value (badge) + the placement-points map (compact line) */}
                      {g.leaderboard && (
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="mr-1 text-[0.68rem] font-semibold uppercase tracking-wide text-muted-foreground">
                            {t("structure.pointSystemLabel")}
                          </span>
                          {g.leaderboard.kill_point != null && (
                            <Badge variant="outline" className="rounded-full px-2 py-0.5 text-xs">
                              {t("structure.perKill", { pts: g.leaderboard.kill_point })}
                            </Badge>
                          )}
                          {g.leaderboard.placement_points &&
                            Object.keys(g.leaderboard.placement_points).length > 0 && (
                              <span className="text-xs text-muted-foreground">
                                {t("structure.placementPointsLabel")}{" "}
                                {Object.entries(g.leaderboard.placement_points)
                                  .sort((a, b) => Number(a[0]) - Number(b[0]))
                                  .map(([place, pts]) => `#${place}: ${pts}`)
                                  .join(", ")}
                              </span>
                            )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Room details (owner 2026-06-17): the backend only fills room_id/name/password on
                      these match rows for the group's registered competitors AND only after the
                      organizer posts them, so this block simply renders whatever creds arrived. Anon
                      viewers / non-members / pre-release get nulls -> nothing shows. */}
                  {(() => {
                    const withRoom = (g.matches || []).filter((m: any) => m.room_id || m.room_name || m.room_password);
                    if (withRoom.length === 0) return null;
                    return (
                      <div className="border-b bg-primary/[0.05] px-5 py-3">
                        <p className="mb-2 text-[0.68rem] font-semibold uppercase tracking-wide text-primary">
                          {t("structure.roomDetails")}
                        </p>
                        <div className="space-y-2">
                          {withRoom.map((m: any) => (
                            <div key={m.match_id} className="rounded-md border bg-card px-3 py-2 text-xs">
                              <span className="font-medium">
                                {t("structure.roomMatch", { n: m.match_number })}
                                {m.match_map ? ` · ${m.match_map}` : ""}
                              </span>
                              <div className="mt-1 grid gap-1 sm:grid-cols-3">
                                {m.room_id && (
                                  <span>
                                    <span className="text-muted-foreground">{t("structure.roomId")}: </span>
                                    <span className="font-mono font-semibold">{m.room_id}</span>
                                  </span>
                                )}
                                {m.room_name && (
                                  <span>
                                    <span className="text-muted-foreground">{t("structure.roomName")}: </span>
                                    <span className="font-semibold">{m.room_name}</span>
                                  </span>
                                )}
                                {m.room_password && (
                                  <span>
                                    <span className="text-muted-foreground">{t("structure.roomPassword")}: </span>
                                    <span className="font-mono font-semibold">{m.room_password}</span>
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                  {/* Results hidden by the organizer (owner 2026-06-29): show a clean "not published
                      yet" state instead of standings. The maps + point-system strip above stays
                      (config, not results). Falls through to the normal pending/standings otherwise. */}
                  {resultsHidden ? (
                    <div className="px-5 py-8 text-center text-sm text-muted-foreground">
                      <p className="font-medium not-italic">
                        {t("structure.resultsNotPublished")}
                      </p>
                      <p className="mt-1 text-xs">
                        {t("structure.resultsNotPublishedDesc")}
                      </p>
                    </div>
                  ) : rows.length === 0 ? (
                    <div className="px-5 py-8 text-center text-sm text-muted-foreground italic">
                      {t("structure.resultsPending")}
                    </div>
                  ) : (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-[0.68rem] uppercase tracking-wide text-muted-foreground">
                          <th className="text-left font-semibold px-5 py-2.5 w-10">
                            {t("structure.rank")}
                          </th>
                          <th className="text-left font-semibold px-5 py-2.5">
                            {competitorWord}
                          </th>
                          <th className="text-center font-semibold px-3 py-2.5">
                            {t("structure.kills")}
                          </th>
                          <th className="text-center font-semibold px-3 py-2.5">
                            {t("structure.placePts")}
                          </th>
                          <th className="text-right font-semibold px-5 py-2.5">
                            {t("structure.points")}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((row: any, idx: number) => {
                          const placement = row.placement ?? idx + 1;
                          const qualified = qN > 0 && placement <= qN;
                          // green qualify-line divider, drawn once right after the last qualifier
                          const showLine =
                            qN > 0 && placement === qN && idx < rows.length - 1;
                          return (
                            <Fragment key={`${g.group_id}-r${idx}`}>
                              <tr
                                key={`${g.group_id}-${idx}`}
                                className={qualified ? "bg-primary/[0.07]" : ""}
                              >
                                <td
                                  className={`px-5 py-2.5 font-bold border-t border-border/60 ${
                                    qualified
                                      ? "text-primary shadow-[inset_3px_0_0_var(--primary)]"
                                      : "text-muted-foreground"
                                  }`}
                                >
                                  {placement}
                                </td>
                                <td className="px-5 py-2.5 font-semibold border-t border-border/60">
                                  {/* Competitor name links to the public profile:
                                      solo events list players, squad events list teams. */}
                                  {participantType === "solo" ? (
                                    <PlayerLink name={rowName(row, idx)} />
                                  ) : (
                                    // Squad rows show the team's country flag before the name
                                    // (owner 2026-06-20); TeamLink renders it when rowCountry resolves.
                                    <TeamLink
                                      name={rowName(row, idx)}
                                      country={rowCountry(row)}
                                    />
                                  )}
                                </td>
                                <td className="px-3 py-2.5 text-center border-t border-border/60">
                                  {rowKills(row)}
                                </td>
                                <td className="px-3 py-2.5 text-center border-t border-border/60">
                                  {rowPlacementPts(row)}
                                </td>
                                <td className="px-5 py-2.5 text-right font-bold border-t border-border/60">
                                  {rowPoints(row).toFixed(1)}
                                </td>
                              </tr>
                              {showLine && (
                                <tr key={`${g.group_id}-qline`}>
                                  <td colSpan={5} className="p-0">
                                    <div className="flex items-center gap-2 px-5 py-1.5 text-[0.62rem] font-bold uppercase tracking-wider text-primary bg-primary/[0.08]">
                                      <span className="h-px flex-1 bg-primary/30" />
                                      {t("structure.qualificationLine")}
                                      <span className="h-px flex-1 bg-primary/30" />
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* honest note: this is built from stored data, no invented brackets */}
        <p className="mt-8 text-xs text-muted-foreground bg-card border border-dashed border-border rounded-md px-4 py-3.5 leading-relaxed">
          {t("structure.footnote")}
        </p>
      </section>
    </div>
  );
}
