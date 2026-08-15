"use client";

/**
 * app/(user)/polls/[slug]/_components/TeamRollup.tsx
 * ─────────────────────────────────────────────────
 * Where the team stands on a TEAM poll: how many of the playing roles have answered, what the
 * members' tally is, and what the team is currently recorded as saying.
 *
 * THE THREE THINGS THIS PANEL EXISTS TO MAKE VISIBLE
 *
 *   1. THE QUORUM AS A FRACTION, and it counts PLAYERS. It reads "4 of 6 players", never "4 of 8
 *      members", because the quorum denominator is the playing roles only: counting the coach, the
 *      manager and the analyst would give the better-staffed team the harder quorum, and no team
 *      should fail a quorum because its analyst is on holiday. It is a fraction rather than a
 *      "quorum met" flag because a team that adds a member during an open poll RAISES ITS OWN
 *      QUORUM and can drop below it, and the only way anybody understands that is by seeing both
 *      numbers move.
 *
 *   2. `no_consensus` AS A REAL OUTCOME. A team that was SPLIT is not the same event as a team
 *      that was SILENT, and neither is the same as one whose captain never opened the poll. Three
 *      different follow-ups, so three different words here, never one shared "no result".
 *
 *   3. THE OVERRIDE, WHEN IT HAPPENS, WITH THE TALLY STILL BESIDE IT. An override the roster
 *      cannot see is a trust problem, not a feature: a captain who can quietly overturn five
 *      people's votes gets fewer answers on the next poll and fewer still on the one after.
 *
 * TALKS TO: GET /polls/<slug>/ (the `team` block) for the roll-up, and
 * POST /polls/<slug>/team-answer/ for the captain override. Backed by
 * backend/afc_polls/team_voting.py.
 */

import { useState } from "react";
import { toast } from "sonner";
import { IconCrown, IconUsers } from "@tabler/icons-react";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { pollsApi, type PollQuestion, type TeamBlock } from "@/lib/polls";

export function TeamRollup({
  slug,
  team,
  questions,
  onChanged,
}: {
  slug: string;
  team: TeamBlock;
  questions: PollQuestion[];
  onChanged: () => void;
}) {
  const t = useTranslations("polls");
  const [saving, setSaving] = useState<number | null>(null);

  const override = async (questionId: number, optionId: number) => {
    setSaving(questionId);
    try {
      await pollsApi.setTeamAnswer(slug, questionId, optionId);
      toast.success(t("team.overrideSaved"));
      onChanged();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || t("team.overrideFailed"));
    } finally {
      setSaving(null);
    }
  };

  return (
    <Card className="bg-card rounded-md border py-6 shadow-sm">
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2">
          <IconUsers className="h-4 w-4 shrink-0 text-primary" />
          <h2 className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
            {t("team.heading", { team: team.team_name })}
          </h2>
          {team.is_captain && (
            <Badge
              variant="outline"
              className="shrink-0 rounded-full border-gold/50 px-2 py-0.5 text-xs text-gold"
            >
              <IconCrown className="mr-1 h-3 w-3" />
              {t("team.captain")}
            </Badge>
          )}
        </div>

        {team.rollup.length === 0 ? (
          <p className="text-xs text-muted-foreground">{t("team.rollupHidden")}</p>
        ) : (
          <ul className="space-y-3">
            {team.rollup.map((row) => {
              const question = questions.find((q) => q.question_id === row.question_id);
              if (!question) return null;
              const winner = question.options.find((o) => o.option_id === row.winning_option_id);
              return (
                <li key={row.question_id} className="space-y-1.5 border-t border-border pt-3 first:border-0 first:pt-0">
                  <p className="text-xs font-medium text-foreground">{question.prompt}</p>

                  {/* The fraction, naming what it counts. "of 6 players", not "of 8 members". */}
                  <p className="text-xs text-muted-foreground">
                    {t("team.answered", {
                      answered: row.answered_count,
                      players: row.playing_roster_size,
                    })}
                    {row.full_roster_size > row.playing_roster_size && (
                      <> {t("team.staffNote", {
                        staff: row.full_roster_size - row.playing_roster_size,
                      })}</>
                    )}
                  </p>

                  <p className="text-xs">
                    <span className="text-muted-foreground">{t("team.teamAnswer")}: </span>
                    <span className="font-medium text-foreground">
                      {winner ? winner.label : t(`team.resolution.${row.resolution}`)}
                    </span>
                    {winner && row.resolution !== "plurality" && (
                      <span className="ml-1 text-muted-foreground">
                        ({t(`team.resolution.${row.resolution}`)}
                        {row.set_by_username ? `, ${row.set_by_username}` : ""})
                      </span>
                    )}
                  </p>

                  {/* The members' own tally, kept visible next to an override on purpose. */}
                  {Object.keys(row.tally).length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {question.options.map((option) => {
                        const count = row.tally[String(option.option_id)] || 0;
                        if (!count) return null;
                        return (
                          <Badge
                            key={option.option_id}
                            variant="outline"
                            className="rounded-full px-2 py-0.5 text-xs"
                          >
                            {option.label}: {count}
                          </Badge>
                        );
                      })}
                    </div>
                  )}

                  {team.is_captain && team.captain_override_allowed && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      <span className="w-full text-xs text-muted-foreground">
                        {t("team.overrideHint")}
                      </span>
                      {question.options.map((option) => (
                        <Button
                          key={option.option_id}
                          size="sm"
                          variant="outline"
                          disabled={saving === row.question_id}
                          onClick={() => override(row.question_id, option.option_id)}
                        >
                          {option.label}
                        </Button>
                      ))}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
