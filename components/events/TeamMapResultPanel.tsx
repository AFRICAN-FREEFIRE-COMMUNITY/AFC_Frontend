"use client";

// ── TeamMapResultPanel ─────────────────────────────────────────────────────────
// The TEAM's half of team-submitted map results (owner backlog item 6).
//
// A player on the roster files their OWN team's row for one map. It is a CLAIM, not a result:
// nothing reaches the standings until an organizer approves it on
// app/(a)/a/events/[slug]/_components/TeamResultQueue.tsx. That distinction is the single most
// important thing this component communicates, and it is stated twice on purpose (a notice above
// the form, and the status wording on every submission below it). A team that reads its own
// numbers as final will argue about the standings later.
//
// WHY ONLY THIS TEAM'S ROW: a team has first-hand knowledge of where it finished and second-hand
// knowledge of everyone else. A lobby-wide form would invite reporting a rival down a place, and
// it would make the permission question fuzzy. Own-row-only keeps it total: are you on this team,
// and is this team in this match. The backend takes the team from the submitter's membership and
// ignores any team id in the body, so this is enforced server side, not merely by the form shape.
//
// WHAT IS ABSENT, DELIBERATELY: bonus and penalty. A sanction is a ruling, not a claim, so they
// are organizer-only and are not even in TeamResultPayload (lib/teamMapResults.ts).
//
// RESUBMITTING replaces the team's pending row rather than queueing a second one, so an organizer
// always sees one current answer per team. That happens server side in one transaction; this
// component simply reloads afterwards.
//
// API: lib/teamMapResults.ts -> events/team-map-results/{submit,mine}/
// i18n: `teamResults` namespace, group "team". Times through LocalTime (backend is UTC).

import React, { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { IconSend } from "@tabler/icons-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LocalTime } from "@/components/LocalTime";
import {
  teamMapResultsApi,
  type TeamMapSubmission,
} from "@/lib/teamMapResults";

export type RosterPlayer = { user_id: number; name: string };

export function TeamMapResultPanel({
  matchId,
  roster,
}: {
  matchId: number;
  /** The player's own team-mates. Supplied by the caller because the event page already has the
   *  roster loaded; refetching it here would be a second request for data on the screen. */
  roster: RosterPlayer[];
}) {
  const t = useTranslations("teamResults");

  const [submissions, setSubmissions] = useState<TeamMapSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [placement, setPlacement] = useState("");
  const [didNotPlay, setDidNotPlay] = useState(false);
  const [kills, setKills] = useState<Record<number, string>>({});

  const load = useCallback(async () => {
    try {
      const res = await teamMapResultsApi.mine(matchId);
      setSubmissions(res.submissions ?? []);
    } catch {
      // A team that is not on this match, or an event not accepting submissions, gets a 403 here.
      // That is not an error worth shouting about: the panel simply shows nothing to send.
      setSubmissions([]);
    } finally {
      setLoading(false);
    }
  }, [matchId]);

  useEffect(() => { load(); }, [load]);

  const hasPending = submissions.some((s) => s.status === "pending");

  const send = async () => {
    if (!didNotPlay && !(Number(placement) > 0)) {
      toast.error(t("team.placementHint"));
      return;
    }
    setSending(true);
    try {
      await teamMapResultsApi.submit(matchId, {
        placement: didNotPlay ? 0 : Number(placement),
        played: !didNotPlay,
        players: roster.map((p) => ({
          user_id: p.user_id,
          kills: Number(kills[p.user_id]) || 0,
          played: !didNotPlay,
        })),
      });
      toast.success(t("team.sent"));
      await load();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t("team.failed"));
    } finally {
      setSending(false);
    }
  };

  if (loading) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("team.title")}</CardTitle>
        <p className="text-xs text-muted-foreground">{t("team.subtitle")}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Said before the form, not after it: the team should know what they are doing while
            they type, not once they have pressed send. */}
        <p className="rounded-md border border-primary/30 bg-primary/5 p-2 text-xs">
          {t("team.claimNotice")}
        </p>

        <div className="flex items-center gap-2">
          <Checkbox
            id="dnp" checked={didNotPlay}
            onCheckedChange={(v) => setDidNotPlay(v === true)}
          />
          <Label htmlFor="dnp" className="text-xs">{t("team.didNotPlay")}</Label>
        </div>

        {!didNotPlay && (
          <div className="space-y-1">
            <Label className="text-xs">{t("team.placement")}</Label>
            <Input
              type="number" min={1} className="h-10 max-w-32"
              value={placement}
              onChange={(e) => setPlacement(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">{t("team.placementHint")}</p>
          </div>
        )}

        {!didNotPlay && roster.length > 0 && (
          <div className="space-y-2">
            <Label className="text-xs">{t("team.players")}</Label>
            {roster.map((p) => (
              <div key={p.user_id} className="flex items-center justify-between gap-2">
                <span className="min-w-0 truncate text-xs">{p.name}</span>
                <Input
                  type="number" min={0}
                  aria-label={`${p.name} ${t("team.kills")}`}
                  className="h-10 w-24"
                  value={kills[p.user_id] ?? ""}
                  onChange={(e) =>
                    setKills((prev) => ({ ...prev, [p.user_id]: e.target.value }))}
                />
              </div>
            ))}
          </div>
        )}

        <Button onClick={send} disabled={sending} className="min-h-11 w-full sm:w-auto">
          <IconSend className="size-4" />
          {sending ? t("team.submitting") : hasPending ? t("team.resubmit") : t("team.submit")}
        </Button>

        <div className="space-y-2">
          <Label className="text-xs">{t("team.yourSubmissions")}</Label>
          {submissions.length === 0 && (
            <p className="text-xs text-muted-foreground">{t("team.none")}</p>
          )}
          {submissions.map((s) => (
            <div key={s.submission_id} className="rounded-md border p-2 space-y-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Badge variant="outline" className="rounded-full px-2 py-0.5 text-xs">
                  {t(`team.status.${s.status}` as any)}
                </Badge>
                {s.submitted_at && (
                  <span className="text-xs text-muted-foreground">
                    {t("team.submittedAt")} <LocalTime value={s.submitted_at} />
                  </span>
                )}
              </div>
              {/* A rejection without its reason makes the team resubmit the same numbers, so the
                  organizer's note is shown here rather than only in a notification. */}
              {s.status === "rejected" && s.review_note && (
                <p className="text-xs text-muted-foreground">
                  {t("team.organizerNote")}: {s.review_note}
                </p>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default TeamMapResultPanel;
