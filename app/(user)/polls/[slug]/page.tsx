"use client";

/**
 * app/(user)/polls/[slug]/page.tsx - one poll: the requirements, the ballot, and the results.
 *
 * WHAT IT TALKS TO (all through lib/polls.ts)
 *   GET  {BACKEND}/polls/<slug>/            -> afc_polls.views.poll_detail
 *   POST {BACKEND}/polls/<slug>/responses/  -> afc_polls.views.submit_response
 *   POST {BACKEND}/polls/<slug>/team-answer/-> afc_polls.views.captain_override (via TeamRollup)
 *   POST {BACKEND}/polls/watch/             -> afc_polls.views.watch
 *
 * THE PAGE IS THREE THINGS AT ONCE, and which one you see depends on the poll, not on a route:
 *   1. A BALLOT, when the poll is open and this viewer is eligible.
 *   2. A RESULTS page, when results are visible to this viewer. A closed poll is still a page:
 *      the imported NFCA 2025 award ballots are exactly this, and they must stay readable forever.
 *   3. A REFUSAL that explains itself, when the viewer is not eligible. There is no fourth
 *      "greyed out button" state, because that is the thing this feature exists to remove. The
 *      refusal also offers the one thing that person can still do: be told if it changes.
 *
 * THE SUBMIT BUTTON IS NOT THE GATE. The server re-checks eligibility on every POST and answers a
 * 403 carrying the same verdict shape this page already renders, so a refusal arriving at submit
 * time is displayed by the code that was already here. Hiding the button is a courtesy, nothing
 * more.
 *
 * BRANCHING IS EVALUATED HERE AND AGAIN ON THE SERVER. lib/pollBranching.ts decides live which
 * questions to render, so a tap changes the form with no round trip. The server recomputes the
 * canonical path at submit and DISCARDS anything off it, which is what stops somebody who answered
 * Q3 and then changed their mind on Q1 from contributing a Q3 answer nobody meant to ask for.
 *
 * PUBLISHED AWARD RESULTS are not a tally. `published_winner_option_id` carries the claim the site
 * has been making since 2025, transcribed from the old page file rather than recomputed from
 * votes, so QuestionCard renders those fields and never max(votes).
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { IconArrowLeft, IconAward, IconBell, IconCheck } from "@tabler/icons-react";
import { useTranslations } from "next-intl";

import { PageHeader } from "@/components/PageHeader";
import { NewBadge } from "@/components/NewBadge";
import { FullLoader } from "@/components/Loader";
import { LocalTime } from "@/components/LocalTime";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { pollsApi, type PollDetail, type PostedAnswer } from "@/lib/polls";
import { visibleQuestionIds } from "@/lib/pollBranching";

import { QuestionCard } from "./_components/QuestionCard";
import { RequirementsPanel } from "./_components/RequirementsPanel";
import { TeamRollup } from "./_components/TeamRollup";

export default function PollDetailPage() {
  const t = useTranslations("polls");
  const { slug } = useParams<{ slug: string }>();
  const { token } = useAuth();

  const [detail, setDetail] = useState<PollDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [selections, setSelections] = useState<Record<number, number[]>>({});
  const [values, setValues] = useState<Record<number, { rating?: number; text?: string }>>({});
  const [submitting, setSubmitting] = useState(false);
  const [watching, setWatching] = useState(false);
  // Set when the viewer presses "change my answer", so an already-answered poll can go back to
  // being a ballot without a page reload.
  const [editing, setEditing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await pollsApi.getPoll(slug);
      setDetail(data);
      // Pre-select what this person already answered, so an editable poll opens on their own
      // answers rather than on a blank form they have to fill in again.
      if (data.your_response?.answers) {
        const restored: Record<number, number[]> = {};
        for (const [questionId, optionIds] of Object.entries(data.your_response.answers)) {
          restored[Number(questionId)] = optionIds;
        }
        setSelections(restored);
      }
      if (data.your_response?.values) {
        const restored: Record<number, { rating?: number; text?: string }> = {};
        for (const [questionId, value] of Object.entries(data.your_response.values)) {
          restored[Number(questionId)] = { rating: value.rating, text: value.text };
        }
        setValues(restored);
      }
    } catch {
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    load();
  }, [load, token]);

  // ── which questions are ON this person's path right now ────────────────────────────────────
  // Recomputed on every selection change, which is what makes a branching form react to a tap.
  const ratings = useMemo(() => {
    const map: Record<number, number> = {};
    for (const [questionId, value] of Object.entries(values)) {
      if (typeof value.rating === "number") map[Number(questionId)] = value.rating;
    }
    return map;
  }, [values]);

  const visibleQuestions = useMemo(() => {
    if (!detail) return [];
    const onPath = new Set(
      visibleQuestionIds(detail.questions, detail.branch_rules, selections, ratings),
    );
    return detail.questions.filter((question) => onPath.has(question.question_id));
  }, [detail, selections, ratings]);

  const pick = (questionId: number, optionId: number) => {
    const question = detail?.questions.find((q) => q.question_id === questionId);
    if (!question) return;
    setSelections((previous) => {
      const current = previous[questionId] || [];
      if (question.answer_type === "multiple_choice" || question.answer_type === "ranking") {
        if (current.includes(optionId)) {
          return { ...previous, [questionId]: current.filter((id) => id !== optionId) };
        }
        // The client stops at the cap for the reader's benefit; the server enforces it for real.
        const max =
          question.answer_type === "ranking" ? 5 : question.config?.max_choices ?? Infinity;
        if (current.length >= max) return previous;
        return { ...previous, [questionId]: [...current, optionId] };
      }
      // Tapping your pick again clears it. Nobody should be trapped by a mis-tap before they have
      // submitted.
      if (current.includes(optionId)) return { ...previous, [questionId]: [] };
      return { ...previous, [questionId]: [optionId] };
    });
  };

  const reorder = (questionId: number, optionId: number, direction: -1 | 1) => {
    setSelections((previous) => {
      const current = [...(previous[questionId] || [])];
      const index = current.indexOf(optionId);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= current.length) return previous;
      [current[index], current[target]] = [current[target], current[index]];
      return { ...previous, [questionId]: current };
    });
  };

  const submit = async () => {
    if (!detail) return;
    // Only what is ON the path is sent. The server would discard the rest anyway, but sending an
    // off-path answer and having it silently dropped is a worse thing to debug than not sending it.
    const onPath = new Set(visibleQuestions.map((question) => question.question_id));
    const answers: PostedAnswer[] = [];
    for (const question of detail.questions) {
      if (!onPath.has(question.question_id)) continue;
      const optionIds = selections[question.question_id] || [];
      const value = values[question.question_id] || {};
      if (question.answer_type === "rating") {
        if (value.rating != null) answers.push({ question_id: question.question_id, rating: value.rating });
      } else if (question.answer_type === "short_text" || question.answer_type === "long_text") {
        if (value.text?.trim()) answers.push({ question_id: question.question_id, text: value.text });
      } else if (optionIds.length > 0) {
        answers.push({ question_id: question.question_id, option_ids: optionIds });
      }
    }
    if (answers.length === 0) {
      toast.error(t("ballot.selectSomething"));
      return;
    }

    setSubmitting(true);
    try {
      await pollsApi.submitResponse(slug, answers);
      toast.success(t("ballot.saved"));
      setEditing(false);
      await load();
    } catch (error: any) {
      const data = error?.response?.data || {};
      toast.error(data.message || t("ballot.failed"));
      // A 403 from the server's own re-check carries the full verdict. Swapping it in re-renders
      // the panel with the failing line, so the reason arrives with the refusal.
      if (data.eligibility && detail) setDetail({ ...detail, eligibility: data.eligibility });
    } finally {
      setSubmitting(false);
    }
  };

  const toggleWatch = async () => {
    try {
      if (watching) {
        await pollsApi.unwatch({ poll_slug: slug, reason: "eligibility" });
        setWatching(false);
        toast.success(t("ballot.watchOff"));
      } else {
        await pollsApi.watch({ poll_slug: slug, reason: "eligibility" });
        setWatching(true);
        toast.success(t("ballot.watchOn"));
      }
    } catch (error: any) {
      toast.error(error?.response?.data?.message || t("ballot.failed"));
    }
  };

  if (loading) return <FullLoader />;
  if (!detail) {
    return (
      <div className="py-10">
        <Card className="bg-card rounded-md border py-6 shadow-sm">
          <CardContent className="text-center text-sm text-muted-foreground">
            {t("detail.notFound")}
          </CardContent>
        </Card>
      </div>
    );
  }

  const { poll, eligibility, your_response, results_visible } = detail;
  const answered = Boolean(your_response?.submitted_at);
  const showBallot = poll.accepting_answers && eligibility.eligible && (!answered || editing);

  return (
    <div className="py-8">
      <Link
        href="/polls"
        className="mb-4 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <IconArrowLeft className="h-3.5 w-3.5" />
        {t("detail.back")}
      </Link>

      <PageHeader
        title={
          <span className="flex items-center gap-2">
            {poll.title}
            <NewBadge since="2026-08-08" />
          </span>
        }
        description={poll.description}
      />

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {poll.awards_edition && (
          <Badge variant="outline" className="rounded-full px-2 py-0.5 text-xs">
            <IconAward className="mr-1 h-3 w-3" />
            {poll.awards_edition}
          </Badge>
        )}
        <Badge
          variant="outline"
          className={cn(
            "rounded-full px-2 py-0.5 text-xs",
            poll.is_open ? "border-primary/50 text-primary" : "text-muted-foreground",
          )}
        >
          {poll.is_open ? t("card.open") : poll.is_closed ? t("card.closed") : t("card.results")}
        </Badge>
        {poll.closes_at && (
          <span className="text-xs text-muted-foreground">
            {poll.is_closed ? t("detail.closedOn") : t("detail.closesOn")}{" "}
            <LocalTime value={poll.closes_at} mode="datetime" />
          </span>
        )}
      </div>

      {/* What the voter is TOLD about this poll, and no more than is true. The anonymous copy
          carries the honest qualifier when the poll also allows editing (backend spec 1.7). */}
      <div className="mt-4 space-y-1 text-xs text-muted-foreground">
        {poll.anonymous && <p>{t("detail.anonymousNote")}</p>}
        {poll.anonymous && poll.allow_edit_until_close && <p>{t("detail.anonymousEditableNote")}</p>}
        {poll.anonymous && !poll.allow_edit_until_close && <p>{t("detail.anonymousFinalNote")}</p>}
        {poll.accepting_answers && !poll.anonymous && (
          <p>{poll.allow_edit_until_close ? t("detail.editableNote") : t("detail.finalNote")}</p>
        )}
        {poll.visibility === "preview_only" && <p>{t("detail.previewOnly")}</p>}
      </div>

      {/* On a phone this column stacks ABOVE the ballot, so the requirements are read first. */}
      <div className="mt-6 grid gap-6 lg:grid-cols-[320px_1fr]">
        <div className="space-y-4">
          <RequirementsPanel verdict={eligibility} />

          {/* The one thing a refused person can still do. Offered instead of a dead end, which is
              what the requirements panel exists to replace. */}
          {token && !eligibility.eligible && poll.accepting_answers && (
            <Button variant="outline" size="sm" className="w-full" onClick={toggleWatch}>
              <IconBell className="mr-1.5 h-3.5 w-3.5" />
              {watching ? t("ballot.watchingOn") : t("ballot.notifyMe")}
            </Button>
          )}

          {detail.team && (
            <TeamRollup
              slug={slug}
              team={detail.team}
              questions={detail.questions}
              onChanged={load}
            />
          )}

          {answered && (
            <Card className="bg-card rounded-md border py-6 shadow-sm">
              <CardContent className="space-y-2">
                <p className="flex items-center gap-1.5 text-xs font-medium text-primary">
                  <IconCheck className="h-4 w-4" />
                  {t("ballot.answered")}
                </p>
                {your_response?.submitted_at && (
                  <p className="text-xs text-muted-foreground">
                    {t("ballot.answeredOn")}{" "}
                    <LocalTime value={your_response.submitted_at} mode="datetime" />
                  </p>
                )}
                {your_response?.can_edit && !editing && (
                  <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
                    {t("ballot.changeAnswer")}
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          {detail.results_suppressed_small_cell && (
            <Card className="bg-card rounded-md border py-6 shadow-sm">
              <CardContent className="text-xs text-muted-foreground">
                {t("results.tooFew")}
              </CardContent>
            </Card>
          )}

          {visibleQuestions.map((question) => (
            <QuestionCard
              key={question.question_id}
              question={question}
              selected={selections[question.question_id] || []}
              value={values[question.question_id] || {}}
              interactive={showBallot}
              showResults={results_visible}
              onPick={(optionId) => pick(question.question_id, optionId)}
              onValue={(patch) =>
                setValues((previous) => ({
                  ...previous,
                  [question.question_id]: { ...previous[question.question_id], ...patch },
                }))
              }
              onReorder={(optionId, direction) =>
                reorder(question.question_id, optionId, direction)
              }
            />
          ))}

          {showBallot && (
            <div className="flex justify-end">
              <Button onClick={submit} disabled={submitting} className="min-w-[180px]">
                {submitting
                  ? t("ballot.submitting")
                  : answered
                    ? t("ballot.update")
                    : t("ballot.submit")}
              </Button>
            </div>
          )}

          {poll.accepting_answers && !eligibility.eligible && !token && (
            <div className="flex justify-end">
              <Button asChild>
                <Link href="/login">{t("ballot.signInToVote")}</Link>
              </Button>
            </div>
          )}

          {!results_visible && !poll.accepting_answers && (
            <Card className="bg-card rounded-md border py-6 shadow-sm">
              <CardContent className="text-xs text-muted-foreground">
                {t("results.hidden")}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
