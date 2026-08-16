"use client";

/**
 * app/(user)/awards/_components/AwardsExperience.tsx
 * ─────────────────────────────────────────────────
 * The grand awards surface: ONE component that renders whichever of the four moments an edition
 * is actually in. Design: WEBSITE/tasks/awards-grand-design.md, mockup mockups/awards-grand.html,
 * approved by the owner.
 *
 * WHY ONE COMPONENT AND NOT FOUR PAGES
 *   The moment is a property of the DATA (AwardsEdition.phase, derived from its dates on every
 *   read), not of the URL. Four routes would mean four places that could disagree with the clock,
 *   and a page that says "voting opens in 3 days" over a live ballot. One route, four states:
 *
 *     announced  nominees are up, voting has not opened: countdown, timeline, the nominee wall
 *     voting     your ballot, with the requirements above it and a category rail beside it
 *     counting   closed, being counted, here is when to come back. NOT the same as "closed"
 *     winners    the reveal: one winner per full-width band, then the archive
 *
 * WHERE THE GRANDEUR COMES FROM, and it is deliberately only six levers, all of them things the
 * site already has:
 *   1. SCALE, rationed. The marquee and the winner name are the only two things set above 60px.
 *      Everything else stays at the site's compact defaults, because occasion reads as the
 *      CONTRAST between the two, not as everything getting bigger.
 *   2. AIR. A winner band is alone across the full column width with 2rem of internal padding.
 *   3. GOLD, rationed harder. Gold appears on a winner band exactly twice: the ring and the
 *      category eyebrow. Nowhere else. Nominees stay neutral. (It was three until the vote counts
 *      came off - owner, 2026-08-16: the award is the story, not the margin.)
 *   4. FACES. Player photos and team logos carry the wall, the ballot and the reveal.
 *   5. TIME. A ticking countdown and a four-stage timeline. Nothing says "event" like a clock.
 *   6. SEQUENCE. Ceremony mode, because the difference between a results page and an awards night
 *      is whether the winners arrive one at a time.
 *
 * THE PART THAT IS EASY TO GET WRONG: a nominee with no photo. The monogram is the ELEMENT and
 * the photo is a layer on top of it, so a nominee without a picture is not a degraded card, it is
 * the same card with a different fill. That is why the API sends `avatar_url: null` rather than a
 * placeholder.
 *
 * TALKS TO GET /polls/editions/<slug>/ (afc_polls.views.edition_detail) through lib/polls.ts, and
 * POST /polls/<slug>/responses/ to submit a ballot. Every date renders through LocalTime, in the
 * viewer's own timezone, because the backend is UTC.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  IconBell,
  IconCheck,
  IconChevronRight,
  IconPlayerPause,
  IconPlayerPlay,
  IconSearch,
  IconTrophy,
  IconX,
} from "@tabler/icons-react";
import { useLocale, useTranslations } from "next-intl";

import { FullLoader } from "@/components/Loader";
import { LocalTime } from "@/components/LocalTime";
import { NewBadge } from "@/components/NewBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import {
  pollsApi,
  type EditionDetail,
  type PollOption,
  type PollQuestion,
  type PostedAnswer,
} from "@/lib/polls";

import { RequirementsPanel } from "../../polls/[slug]/_components/RequirementsPanel";

// ── the monogram, shared by every surface below ──────────────────────────────
// Three ON-PALETTE tints picked deterministically from the name, so a grid of monograms reads as
// one palette rather than confetti, and the same nominee keeps their colour between page loads.
const TINTS = ["bg-primary/15 text-primary", "bg-gold/15 text-gold", "bg-muted text-muted-foreground"];

export function Portrait({
  option,
  size,
  gold,
}: {
  option: PollOption;
  size: number;
  gold?: boolean;
}) {
  const name = option.linked?.display_name || option.label || "?";
  const initials = name.split(/\s+/).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
  const tint = TINTS[[...name].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % 3];
  const src = option.linked?.avatar_url || option.image_url || "";

  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-full font-bold",
        tint,
        // The gold RING is one of exactly three uses of gold on a winner band.
        gold && "ring-2 ring-gold ring-offset-2 ring-offset-background",
      )}
      style={{ width: size, height: size, fontSize: Math.max(12, size / 3) }}
      aria-hidden
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- API-host media, not in the
        // next/image remote allow-list.
        <img src={src} alt="" className="h-full w-full object-cover" />
      ) : (
        initials || "?"
      )}
    </span>
  );
}

export function AwardsExperience({ editionSlug }: { editionSlug: string }) {
  const t = useTranslations("awards");
  const locale = useLocale();
  const { token } = useAuth();

  const [data, setData] = useState<EditionDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setData(await pollsApi.getEdition(editionSlug));
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [editionSlug]);

  useEffect(() => {
    load();
  }, [load, token]);

  if (loading) return <FullLoader />;
  if (!data) {
    return (
      <div className="py-10">
        <Card className="bg-card rounded-md border py-6 shadow-sm">
          <CardContent className="text-center text-sm text-muted-foreground">
            {t("notFound")}
          </CardContent>
        </Card>
      </div>
    );
  }

  const { edition } = data;
  const phase = edition.phase;

  return (
    <div className="py-8">
      <Marquee edition={edition} />

      {phase === "winners" || phase === "archived" ? (
        <WinnersReveal data={data} onChanged={load} />
      ) : phase === "counting" ? (
        <CountingScreen data={data} />
      ) : phase === "voting" ? (
        <BallotScreen data={data} onChanged={load} />
      ) : (
        <NomineesAnnounced data={data} />
      )}
    </div>
  );
}

// ── the marquee, the countdown and the four-stage timeline ───────────────────

function Marquee({ edition }: { edition: EditionDetail["edition"] }) {
  const t = useTranslations("awards");
  return (
    <header className="text-center">
      {/* THE ONE DELIBERATE DEVIATION from the site's text-3xl md:text-4xl heading rule, and it is
          a precedent rather than a new idea: the previous awards page already ran a 60px
          gradient-gold hero. 47px at 390, 92px at 1440. */}
      <h1
        className="font-extrabold tracking-tight text-gold"
        style={{ fontSize: "clamp(2.75rem, 12vw, 5.75rem)", lineHeight: 1.02 }}
      >
        {edition.title}
      </h1>
      {edition.tagline && (
        <p className="mx-auto mt-3 max-w-2xl text-sm text-muted-foreground">{edition.tagline}</p>
      )}

      {/* The entire decoration budget: one hairline with a small gold lozenge, once per screen. */}
      <div className="mx-auto my-6 flex max-w-md items-center gap-3" aria-hidden>
        <span className="h-px flex-1 bg-border" />
        <span className="h-1.5 w-1.5 rotate-45 bg-gold" />
        <span className="h-px flex-1 bg-border" />
      </div>

      <div className="flex justify-center">
        <NewBadge since="2026-08-16" />
      </div>

      <Countdown edition={edition} />
      <PhaseTimeline edition={edition} />
      <p className="sr-only">{t("phaseLabel", { phase: edition.phase })}</p>
    </header>
  );
}

/** The next moment this edition is counting down TO, or null once the winners are out. */
function nextMoment(edition: EditionDetail["edition"]) {
  if (edition.phase === "announced" && edition.voting_opens_at) {
    return { key: "votingOpens", at: edition.voting_opens_at };
  }
  if (edition.phase === "voting" && edition.voting_closes_at) {
    return { key: "votingCloses", at: edition.voting_closes_at };
  }
  if (edition.phase === "counting" && edition.winners_announced_at) {
    return { key: "winnersAnnounced", at: edition.winners_announced_at };
  }
  return null;
}

function Countdown({ edition }: { edition: EditionDetail["edition"] }) {
  const t = useTranslations("awards");
  const moment = nextMoment(edition);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!moment) return;
    // A countdown that does not tick is a label.
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [moment]);

  if (!moment) return null;
  const remaining = Math.max(0, new Date(moment.at).getTime() - now);
  const days = Math.floor(remaining / 86400000);
  const hours = Math.floor((remaining % 86400000) / 3600000);
  const minutes = Math.floor((remaining % 3600000) / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);

  return (
    <section className="mt-2">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">
        {t(`countdown.${moment.key}`)}
      </p>
      <div className="mt-2 flex flex-wrap justify-center gap-2">
        {[
          { value: days, unit: "days" },
          { value: hours, unit: "hours" },
          { value: minutes, unit: "minutes" },
          { value: seconds, unit: "seconds" },
        ].map((block) => (
          <div key={block.unit} className="rounded-md border bg-card px-3 py-2 shadow-sm">
            <p className="text-xl font-bold tabular-nums text-foreground">{block.value}</p>
            {/* ICU plurals, not string concatenation: "1 days" has bitten this project before. */}
            <p className="text-xs text-muted-foreground">
              {t(`countdown.unit.${block.unit}`, { count: block.value })}
            </p>
          </div>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        <LocalTime value={moment.at} mode="datetime" />
      </p>
    </section>
  );
}

const PHASES = ["announced", "voting", "counting", "winners"] as const;

function PhaseTimeline({ edition }: { edition: EditionDetail["edition"] }) {
  const t = useTranslations("awards");
  const current = PHASES.indexOf(edition.phase as (typeof PHASES)[number]);
  return (
    <ol className="mt-6 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-xs">
      {PHASES.map((phase, index) => (
        <li key={phase} className="flex items-center gap-2">
          <span
            className={cn(
              "rounded-full border px-2 py-0.5",
              index === current
                ? "border-gold/60 bg-gold/10 font-medium text-gold"
                : index < current
                  ? "border-primary/40 text-primary"
                  : "border-border text-muted-foreground",
            )}
          >
            {t(`phase.${phase}`)}
          </span>
          {index < PHASES.length - 1 && (
            <IconChevronRight className="h-3 w-3 text-muted-foreground" aria-hidden />
          )}
        </li>
      ))}
    </ol>
  );
}

// ── 1. nominees announced ────────────────────────────────────────────────────

function NomineesAnnounced({ data }: { data: EditionDetail }) {
  const t = useTranslations("awards");
  const { token } = useAuth();
  const [watching, setWatching] = useState(false);

  const watch = async () => {
    try {
      await pollsApi.watch({ edition_slug: data.edition.slug, reason: "opens" });
      setWatching(true);
      toast.success(t("watchOn"));
    } catch (error: any) {
      toast.error(error?.response?.data?.message || t("watchFailed"));
    }
  };

  return (
    <div className="mt-10 space-y-8">
      {/* Eligibility is EXPLAINED here and not enforced here, so somebody who cannot vote finds
          out calmly two weeks early rather than by hitting a dead button on the night. */}
      {data.polls[0] && (
        <div className="mx-auto max-w-xl">
          <RequirementsPanel verdict={data.polls[0].eligibility} />
        </div>
      )}

      {token && (
        <div className="flex justify-center">
          <Button variant="outline" size="sm" onClick={watch} disabled={watching}>
            <IconBell className="mr-1.5 h-3.5 w-3.5" />
            {watching ? t("watchingOn") : t("notifyMeOpens")}
          </Button>
        </div>
      )}

      {data.polls.map((poll) => (
        <section key={poll.slug} className="space-y-4">
          <h2 className="text-3xl font-bold text-primary md:text-4xl">{poll.title}</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {poll.questions.map((question) => (
              <Card key={question.question_id} className="bg-card rounded-md border py-6 shadow-sm">
                <CardContent className="space-y-2">
                  <p className="text-sm font-semibold text-foreground">{question.prompt}</p>
                  {/* Stacked nominee faces. The whole point of revealing nominees early is that
                      people can see who is up, so this is faces and not a list of strings. */}
                  <div className="flex flex-wrap items-center gap-1">
                    {question.options.slice(0, 8).map((option) => (
                      <Portrait key={option.option_id} option={option} size={28} />
                    ))}
                    {question.options.length > 8 && (
                      <span className="text-xs text-muted-foreground">
                        +{question.options.length - 8}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t("nomineeCount", { count: question.options.length })}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

// ── 2. voting open: the ballot ───────────────────────────────────────────────

function BallotScreen({ data, onChanged }: { data: EditionDetail; onChanged: () => void }) {
  const t = useTranslations("awards");
  const [selections, setSelections] = useState<Record<number, number>>({});
  const [submitting, setSubmitting] = useState<string | null>(null);

  // Seed from what this person already answered, so the rail's ticks and the progress line are
  // right on first paint rather than after a click.
  useEffect(() => {
    const seeded: Record<number, number> = {};
    for (const poll of data.polls) {
      for (const question of poll.questions) {
        if (poll.answered_question_ids.includes(question.question_id)) {
          seeded[question.question_id] = -1; // answered, option unknown until the poll page loads
        }
      }
    }
    setSelections((previous) => ({ ...seeded, ...previous }));
  }, [data]);

  const totalQuestions = data.totals.questions;
  const answeredCount = useMemo(
    () => Object.values(selections).filter((value) => value !== undefined).length,
    [selections],
  );

  const submitPoll = async (pollSlug: string, questions: PollQuestion[]) => {
    const answers: PostedAnswer[] = questions
      .filter((question) => (selections[question.question_id] ?? -1) > 0)
      .map((question) => ({
        question_id: question.question_id,
        option_ids: [selections[question.question_id]],
      }));
    if (answers.length === 0) {
      toast.error(t("pickSomething"));
      return;
    }
    setSubmitting(pollSlug);
    try {
      await pollsApi.submitResponse(pollSlug, answers);
      toast.success(t("ballotSaved"));
      onChanged();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || t("ballotFailed"));
    } finally {
      setSubmitting(null);
    }
  };

  return (
    <div className="mt-10 space-y-10">
      {/* Progress stated in WORDS as well as a bar, and the copy says you do not have to fill in
          all of them. 28 categories is exactly the number where an unstated total feels endless. */}
      <div className="mx-auto max-w-xl space-y-2 text-center">
        <p className="text-sm text-foreground">
          {t("progress", { answered: answeredCount, total: totalQuestions })}
        </p>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${totalQuestions ? (answeredCount / totalQuestions) * 100 : 0}%` }}
          />
        </div>
        <p className="text-xs text-muted-foreground">{t("progressHint")}</p>
      </div>

      {data.polls.map((poll) => (
        <section key={poll.slug} className="space-y-4">
          <h2 className="text-3xl font-bold text-primary md:text-4xl">{poll.title}</h2>

          {/* Requirements sit ABOVE the ballot at every screen size, so they are read first. */}
          <div className="mx-auto max-w-xl">
            <RequirementsPanel verdict={poll.eligibility} />
          </div>

          {poll.questions.map((question) => (
            <Card
              key={question.question_id}
              id={question.slug || undefined}
              className="bg-card rounded-md border py-6 shadow-sm"
              style={{ scrollMarginTop: "6rem" }}
            >
              <CardContent className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground">{question.prompt}</h3>
                <div className="grid gap-2 sm:grid-cols-2">
                  {question.options.map((option) => {
                    const chosen = selections[question.question_id] === option.option_id;
                    return (
                      <button
                        key={option.option_id}
                        type="button"
                        disabled={!poll.eligibility.eligible || !poll.accepting_answers}
                        aria-pressed={chosen}
                        onClick={() =>
                          // Tapping your pick again clears it: nobody should be trapped by a
                          // mis-tap before they have submitted.
                          setSelections((previous) => ({
                            ...previous,
                            [question.question_id]: chosen ? 0 : option.option_id,
                          }))
                        }
                        className={cn(
                          "flex min-h-16 items-center gap-3 rounded-md border px-3 py-2 text-left transition-colors",
                          chosen ? "border-primary bg-primary/10" : "border-input",
                          poll.eligibility.eligible ? "hover:bg-muted" : "cursor-default",
                        )}
                      >
                        <Portrait option={option} size={44} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-foreground">
                            {option.label}
                          </span>
                          {option.linked?.team_name && (
                            <span className="block truncate text-xs text-muted-foreground">
                              {option.linked.team_name}
                            </span>
                          )}
                          {option.description && (
                            <span className="block truncate text-xs text-muted-foreground">
                              {option.description}
                            </span>
                          )}
                        </span>
                        {chosen && <IconCheck className="h-4 w-4 shrink-0 text-primary" />}
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ))}

          {poll.eligibility.eligible && poll.accepting_answers && (
            <div className="flex justify-end">
              <Button
                disabled={submitting === poll.slug}
                onClick={() => submitPoll(poll.slug, poll.questions)}
              >
                {submitting === poll.slug ? t("saving") : t("submitBallot", { poll: poll.title })}
              </Button>
            </div>
          )}
        </section>
      ))}
    </div>
  );
}

// ── 3. counting: closed, not yet announced ───────────────────────────────────

function CountingScreen({ data }: { data: EditionDetail }) {
  const t = useTranslations("awards");
  const { token } = useAuth();
  const [watching, setWatching] = useState(false);

  const watch = async () => {
    try {
      await pollsApi.watch({ edition_slug: data.edition.slug, reason: "results" });
      setWatching(true);
      toast.success(t("watchOn"));
    } catch (error: any) {
      toast.error(error?.response?.data?.message || t("watchFailed"));
    }
  };

  return (
    <div className="mx-auto mt-10 max-w-xl space-y-4 text-center">
      <Card className="bg-card rounded-md border py-6 shadow-sm">
        <CardContent className="space-y-3">
          {/* Voting closing and the winners being announced are DIFFERENT moments. This screen is
              the days in between, and it exists because 2025's own page had to say exactly this. */}
          <h2 className="text-lg font-semibold text-foreground">{t("counting.heading")}</h2>
          <p className="text-sm text-muted-foreground">{t("counting.body")}</p>
          {data.edition.winners_announced_at && (
            <p className="text-sm text-foreground">
              {t("counting.comeBack")}{" "}
              <LocalTime value={data.edition.winners_announced_at} mode="datetime" />
            </p>
          )}
          {token && (
            <Button variant="outline" size="sm" onClick={watch} disabled={watching}>
              <IconBell className="mr-1.5 h-3.5 w-3.5" />
              {watching ? t("watchingOn") : t("notifyMeWinners")}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── 4. winners announced: the reveal, then the archive ───────────────────────

type WinnerRow = {
  key: string;
  pollTitle: string;
  question: PollQuestion;
  winner: PollOption;
  /** The published count. CARRIED, NOT SHOWN (owner, 2026-08-16): the awards surface displays the
   *  winner and not the margin. The number stays on the row, and in the database, because it is the
   *  published historical record and dropping it would mean it could not come back. */
  votes: number | null;
};

function collectWinners(data: EditionDetail): WinnerRow[] {
  const rows: WinnerRow[] = [];
  for (const poll of data.polls) {
    for (const question of poll.questions) {
      const winner = question.options.find(
        (option) => option.option_id === question.published_winner_option_id,
      );
      if (!winner) continue;
      rows.push({
        key: `${poll.slug}-${question.question_id}`,
        pollTitle: poll.title,
        question,
        winner,
        votes: question.published_winner_votes ?? null,
      });
    }
  }
  return rows;
}

function WinnersReveal({ data, onChanged }: { data: EditionDetail; onChanged: () => void }) {
  const t = useTranslations("awards");
  const locale = useLocale();
  const winners = useMemo(() => collectWinners(data), [data]);

  const [ceremony, setCeremony] = useState(false);
  const [lit, setLit] = useState(0);
  const [search, setSearch] = useState("");
  const [section, setSection] = useState("all");
  const bandRefs = useRef<Record<string, HTMLElement | null>>({});

  // ── ceremony mode: opt-in, with four brakes ──────────────────────────────
  // Never the default, Escape stops it, a wheel or a finger cancels the timer so the visitor
  // keeps their scroll, and reduced motion refuses to start it and says why. A reveal that fights
  // the reader is worse than a still one.
  useEffect(() => {
    if (!ceremony) return;
    const timer = setInterval(() => {
      setLit((index) => (index + 1 < winners.length ? index + 1 : index));
    }, 4200);
    const stopOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setCeremony(false);
    };
    const stopOnScroll = () => setCeremony(false);
    window.addEventListener("keydown", stopOnEscape);
    window.addEventListener("wheel", stopOnScroll, { passive: true });
    window.addEventListener("touchmove", stopOnScroll, { passive: true });
    return () => {
      clearInterval(timer);
      window.removeEventListener("keydown", stopOnEscape);
      window.removeEventListener("wheel", stopOnScroll);
      window.removeEventListener("touchmove", stopOnScroll);
    };
  }, [ceremony, winners.length]);

  useEffect(() => {
    if (!ceremony) return;
    const row = winners[lit];
    bandRefs.current[row?.key || ""]?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [ceremony, lit, winners]);

  const startCeremony = () => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      toast.info(t("ceremony.reducedMotion"));
      return;
    }
    setLit(0);
    setCeremony(true);
  };

  // ── the archive's own numbers, all DERIVED from the rows and never asserted ──
  const sections = useMemo(
    () => ["all", ...Array.from(new Set(winners.map((row) => row.pollTitle)))],
    [winners],
  );
  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return winners.filter((row) => {
      if (section !== "all" && row.pollTitle !== section) return false;
      if (!needle) return true;
      return (
        row.winner.label.toLowerCase().includes(needle) ||
        row.question.prompt.toLowerCase().includes(needle)
      );
    });
  }, [winners, search, section]);

  const mostDecorated = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of winners) {
      counts.set(row.winner.label, (counts.get(row.winner.label) || 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
  }, [winners]);


  return (
    <div className="mt-10 space-y-8">
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatTile label={t("stats.categories")} value={winners.length.toLocaleString(locale)} />
        <StatTile label={t("stats.ballots")} value={data.polls.length.toLocaleString(locale)} />
        <StatTile
          label={t("stats.mostDecorated")}
          value={mostDecorated[0] ? `${mostDecorated[0][0]} (${mostDecorated[0][1]})` : "-"}
        />
      </section>

      <div className="flex justify-center">
        <Button variant="outline" size="sm" onClick={ceremony ? () => setCeremony(false) : startCeremony}>
          {ceremony ? (
            <>
              <IconPlayerPause className="mr-1.5 h-3.5 w-3.5" />
              {t("ceremony.stop")}
            </>
          ) : (
            <>
              <IconPlayerPlay className="mr-1.5 h-3.5 w-3.5" />
              {t("ceremony.start")}
            </>
          )}
        </Button>
      </div>

      {/* ── the reveal: one winner per full-width band ── */}
      <section className="space-y-4">
        {winners.map((row, index) => (
          <WinnerBand
            key={row.key}
            row={row}
            dimmed={ceremony && index !== lit}
            innerRef={(element) => {
              bandRefs.current[row.key] = element;
            }}
          />
        ))}
      </section>

      {/* ── the archive: deliberately DENSER than the reveal. The reveal is a moment; the archive
             is a record, and a record you scroll for ten minutes is not one. ── */}
      <section className="space-y-4 border-t border-border pt-8">
        <h2 className="text-3xl font-bold text-primary md:text-4xl">{t("archive.heading")}</h2>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1">
            <IconSearch className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("archive.search")}
              className="pl-8"
            />
            {search && (
              <button
                type="button"
                aria-label={t("archive.clear")}
                onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2"
              >
                <IconX className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {sections.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => setSection(name)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs",
                  section === name
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-input text-muted-foreground",
                )}
              >
                {name === "all" ? t("archive.all") : name}
              </button>
            ))}
          </div>
        </div>

        {filtered.length === 0 ? (
          <Card className="bg-card rounded-md border py-6 shadow-sm">
            <CardContent className="text-center text-sm text-muted-foreground">
              {t("archive.empty")}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((row) => (
              <Card key={row.key} className="bg-card rounded-md border py-6 shadow-sm">
                <CardContent className="flex items-center gap-3">
                  <Portrait option={row.winner} size={44} gold />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs uppercase tracking-wide text-gold">
                      {row.question.prompt}
                    </p>
                    <p className="truncate text-sm font-semibold text-foreground">
                      {row.winner.label}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {mostDecorated.length > 0 && (
          <Card className="bg-card rounded-md border py-6 shadow-sm">
            <CardContent className="space-y-1.5">
              <p className="text-sm font-semibold text-foreground">{t("archive.honours")}</p>
              {mostDecorated.map(([name, count]) => (
                <p key={name} className="text-xs text-muted-foreground">
                  {name} - {t("archive.wins", { count })}
                </p>
              ))}
            </CardContent>
          </Card>
        )}
      </section>
    </div>
  );
}

function WinnerBand({
  row,
  dimmed,
  innerRef,
}: {
  row: WinnerRow;
  dimmed: boolean;
  innerRef: (element: HTMLElement | null) => void;
}) {
  const t = useTranslations("awards");

  return (
    <article
      ref={innerRef}
      id={row.question.slug || undefined}
      style={{ scrollMarginTop: "6rem" }}
      className={cn(
        "rounded-md border bg-card p-5 shadow-sm transition-opacity md:p-8",
        dimmed && "opacity-[0.22]",
      )}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <Portrait option={row.winner} size={92} gold />
        <div className="min-w-0 flex-1">
          {/* Gold use 2 of 2: the category eyebrow. */}
          <p className="text-xs font-semibold uppercase tracking-wide text-gold">
            {row.question.prompt}
          </p>
          <h3
            className="mt-1 font-extrabold leading-tight text-foreground"
            style={{ fontSize: "clamp(1.75rem, 6.5vw, 2.75rem)" }}
          >
            {row.winner.label}
          </h3>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            {row.winner.linked?.team_name && (
              <Badge variant="outline" className="rounded-full px-2 py-0.5 text-xs">
                {row.winner.linked.team_name}
              </Badge>
            )}
            <Badge
              variant="outline"
              className="rounded-full border-gold/50 px-2 py-0.5 text-xs text-gold"
            >
              <IconTrophy className="mr-1 h-3 w-3" />
              {t("winner")}
            </Badge>
            {row.winner.linked?.profile_url && (
              <Link
                href={row.winner.linked.profile_url}
                className="text-xs font-medium text-primary hover:underline"
              >
                {t("viewProfile")}
              </Link>
            )}
          </div>
        </div>
      </div>

    </article>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <Card className="bg-card rounded-md border py-6 shadow-sm">
      <CardContent>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-1 truncate text-xl font-bold tabular-nums text-foreground">{value}</p>
      </CardContent>
    </Card>
  );
}
