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
// `group.teams_qualifying`. No hardcoded stage count/format — add/remove a stage or
// change a format in admin and this re-renders correctly.
//
// Honest scope (matches the data model): we show stage ORDER + how many advance, not a
// wired "group A -> lobby 2" routing (the backend stores advancement as "top-N into the
// next stage", not per-group edges). Points-based formats (incl. "Knockout" labels) all
// render as their accurate standings, because that is how AFC records results.

import { Fragment, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Trophy, ChevronRight, ArrowUp } from "lucide-react";
import { FORMAT_LABEL } from "@/lib/eventFormats";

// Local mirrors of the Stage/StageGroup shapes from EventDetailsWrapper (kept local so
// this component stays self-contained; `any` rows because leaderboard keys vary solo/squad).
interface StageGroup {
  group_id: number;
  group_name: string;
  teams_qualifying: number;
  overall_leaderboard?: any[];
  matches?: any[];
}
interface Stage {
  stage_id: number;
  stage_name: string;
  stage_format: string;
  teams_qualifying_from_stage: number;
  is_finals_stage?: boolean; // present on the model; fall back to "last stage" if absent
  groups: StageGroup[];
}

interface Props {
  stages: Stage[];
  participantType: string; // "solo" | "duo" | "squad"
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
const rowKills = (row: any) => row.total_kills ?? row.kills ?? 0;
const rowPoints = (row: any) => {
  const p = row.total_points ?? row.total_pts ?? 0;
  const n = parseFloat(p);
  return Number.isFinite(n) ? n : 0;
};
const fmtLabel = (f: string) => FORMAT_LABEL[f] || f;

export function TournamentStructure({ stages, participantType }: Props) {
  const [sel, setSel] = useState(0);

  if (!stages || stages.length === 0) {
    return (
      <div className="p-10 text-center border-2 border-dashed border-border rounded-md text-muted-foreground">
        No stages configured for this tournament yet.
      </div>
    );
  }

  // Finals = the stage flagged is_finals_stage, else the last stage in order.
  const finalsIdx = (() => {
    const flagged = stages.findIndex((s) => s.is_finals_stage);
    return flagged >= 0 ? flagged : stages.length - 1;
  })();
  const competitorWord = participantType === "solo" ? "Player" : "Team";
  const stage = stages[sel];

  return (
    <div className="space-y-10">
      {/* ── 1. Stage-flow spine ── */}
      <section>
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-4">
          Tournament Flow
        </p>
        <div className="flex items-stretch overflow-x-auto pb-2">
          {stages.map((s, i) => {
            const isFinals = i === finalsIdx;
            const advancing = s.teams_qualifying_from_stage;
            return (
              <div key={s.stage_id} className="flex items-stretch">
                <button
                  type="button"
                  onClick={() => setSel(i)}
                  className={`text-left min-w-[230px] flex-1 bg-card rounded-md border p-5 transition-colors
                    ${i === sel ? "ring-1 ring-primary/40 border-primary/50" : "hover:border-primary/40"}
                    ${isFinals ? "border-gold/50" : ""}`}
                >
                  <div
                    className={`text-[0.7rem] font-bold uppercase tracking-wider ${
                      isFinals ? "text-gold" : "text-muted-foreground"
                    }`}
                  >
                    {isFinals ? "Finals" : `Stage ${i + 1}`}
                  </div>
                  <div className="text-lg font-bold mt-1 mb-3 flex items-center gap-1.5">
                    {isFinals && <Trophy className="size-4 text-gold" />}
                    {s.stage_name}
                  </div>
                  <Badge variant="outline" className="rounded-full font-medium">
                    {fmtLabel(s.stage_format)}
                  </Badge>
                  <div className="flex items-center gap-2 mt-4 text-sm text-muted-foreground flex-wrap">
                    {isFinals ? (
                      <span>Champion crowned</span>
                    ) : (
                      <>
                        <Badge className="rounded-full gap-1 bg-primary/10 text-primary border border-primary/50">
                          <ArrowUp className="size-3" /> Top {advancing}
                        </Badge>
                        <span>
                          advance · {s.groups?.length || 0}{" "}
                          {s.groups?.length === 1 ? "group" : "groups"}
                        </span>
                      </>
                    )}
                  </div>
                </button>
                {/* arrow between stages */}
                {i < stages.length - 1 && (
                  <div className="flex flex-col items-center justify-center min-w-[54px] text-muted-foreground">
                    <ChevronRight className="size-6" />
                    {!isFinals && (
                      <span className="text-[0.6rem] mt-0.5">top {advancing}</span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* ── 2. Standings & qualification for the selected stage ── */}
      <section>
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
          Standings &amp; Qualification — {stage.stage_name}
        </p>
        <div className="flex gap-5 flex-wrap text-sm text-muted-foreground mb-5">
          <span className="inline-flex items-center gap-2">
            <span className="size-2.5 rounded-[3px] bg-primary" /> Qualified for next stage
          </span>
          {sel !== finalsIdx && (
            <span>
              Top{" "}
              <b className="text-primary">{stage.teams_qualifying_from_stage}</b>{" "}
              advance per group
            </span>
          )}
        </div>

        {!stage.groups || stage.groups.length === 0 ? (
          <div className="p-10 text-center border-2 border-dashed border-border rounded-md text-muted-foreground">
            No groups defined for this stage yet.
          </div>
        ) : (
          <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(380px,1fr))]">
            {stage.groups.map((g) => {
              const rows = Array.isArray(g.overall_leaderboard)
                ? g.overall_leaderboard
                : [];
              const qN = g.teams_qualifying ?? 0;
              return (
                <div key={g.group_id} className="bg-card rounded-md border overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-3.5 border-b">
                    <span className="font-bold">{g.group_name}</span>
                    <span className="text-xs text-muted-foreground">
                      {g.matches?.length || 0}{" "}
                      {g.matches?.length === 1 ? "match" : "matches"}
                      {qN > 0 && ` · Top ${qN} advance`}
                    </span>
                  </div>
                  {rows.length === 0 ? (
                    <div className="px-5 py-8 text-center text-sm text-muted-foreground italic">
                      Results pending.
                    </div>
                  ) : (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-[0.68rem] uppercase tracking-wide text-muted-foreground">
                          <th className="text-left font-semibold px-5 py-2.5 w-10">#</th>
                          <th className="text-left font-semibold px-5 py-2.5">
                            {competitorWord}
                          </th>
                          <th className="text-center font-semibold px-3 py-2.5">Kills</th>
                          <th className="text-right font-semibold px-5 py-2.5">Pts</th>
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
                                  {rowName(row, idx)}
                                </td>
                                <td className="px-3 py-2.5 text-center border-t border-border/60">
                                  {rowKills(row)}
                                </td>
                                <td className="px-5 py-2.5 text-right font-bold border-t border-border/60">
                                  {rowPoints(row).toFixed(1)}
                                </td>
                              </tr>
                              {showLine && (
                                <tr key={`${g.group_id}-qline`}>
                                  <td colSpan={4} className="p-0">
                                    <div className="flex items-center gap-2 px-5 py-1.5 text-[0.62rem] font-bold uppercase tracking-wider text-primary bg-primary/[0.08]">
                                      <span className="h-px flex-1 bg-primary/30" />
                                      Qualification line
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
          Built from the data this tournament already records — stages, groups, standings
          and “top-N advance”. Stage formats (including “Knockout”) show their accurate
          standings, since that is how results are entered.
        </p>
      </section>
    </div>
  );
}
