"use client";

/**
 * app/(user)/polls/[slug]/_components/QuestionCard.tsx
 * ───────────────────────────────────────────────────
 * ONE question, in whichever of the six shapes its `answer_type` calls for, plus the published
 * award result when there is one.
 *
 * WHY ALL SIX LIVE IN ONE FILE
 *   They are one control with six renderings, not six controls: every one of them reads the same
 *   `selected` / `value` pair, writes through the same two callbacks, and shares the disabled and
 *   results treatments. Splitting them would mean six copies of "is this interactive, and do we
 *   show counts".
 *
 * THE TWO CHOICES WORTH DEFENDING
 *   - RANKING USES UP AND DOWN BUTTONS, NOT DRAG. Drag-to-reorder inside a scrolling page on a
 *     touchscreen is genuinely bad, and most AFC users are on phones. It is capped at five options
 *     for the same reason.
 *   - A PUBLISHED AWARD RESULT IS RENDERED FROM THE PUBLISHED FIELDS, never from max(votes). The
 *     2025 winners are transcribed from the old page file and may legitimately disagree with the
 *     recomputed tally (backend spec 7.2 trap 2), so the two are rendered as what they are: the
 *     claim, and the counts underneath it.
 *
 * NOMINEE FACES: `option.linked.avatar_url` is null rather than a placeholder when the person has
 * no photo, so this file draws a designed monogram from the name. A nominee without a picture is
 * therefore the same card with a different fill, not a degraded one.
 */

import Link from "next/link";
import {
  IconArrowDown,
  IconArrowUp,
  IconCheck,
  IconExternalLink,
  IconTrophy,
} from "@tabler/icons-react";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { PollOption, PollQuestion } from "@/lib/polls";

/** Deterministic tint from the name, out of three ON-PALETTE options, so a grid of monograms
 *  reads as one palette rather than confetti. Deterministic and not random so the same nominee
 *  keeps the same colour between page loads. */
const MONOGRAM_TINTS = [
  "bg-primary/15 text-primary",
  "bg-gold/15 text-gold",
  "bg-muted text-muted-foreground",
];

export function OptionAvatar({ option, size = 36 }: { option: PollOption; size?: number }) {
  const name = option.linked?.display_name || option.label || "?";
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
  const tint = MONOGRAM_TINTS[[...name].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % 3];
  const src = option.linked?.avatar_url || option.image_url || "";

  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-full text-xs font-semibold",
        tint,
      )}
      style={{ width: size, height: size }}
      aria-hidden
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- media comes from the API host,
        // which is not in the next/image remote allow-list, and this is a 36px avatar.
        <img src={src} alt="" className="h-full w-full object-cover" />
      ) : (
        initials || "?"
      )}
    </span>
  );
}

type Props = {
  question: PollQuestion;
  /** Option ids picked, in order. For a RANKING the order IS the answer. */
  selected: number[];
  /** The non-choice answer: {rating} or {text}. */
  value: { rating?: number; text?: string };
  interactive: boolean;
  showResults: boolean;
  onPick: (optionId: number) => void;
  onValue: (patch: { rating?: number; text?: string }) => void;
  onReorder?: (optionId: number, direction: -1 | 1) => void;
};

export function QuestionCard({
  question,
  selected,
  value,
  interactive,
  showResults,
  onPick,
  onValue,
  onReorder,
}: Props) {
  const t = useTranslations("polls");
  const publishedWinner = question.published_winner_option_id
    ? question.options.find((o) => o.option_id === question.published_winner_option_id)
    : null;

  return (
    <Card className="bg-card rounded-md border py-6 shadow-sm" id={question.slug || undefined}>
      <CardContent className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">
            {question.prompt}
            {question.required && interactive && (
              <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                {t("ballot.required")}
              </span>
            )}
          </h3>
          {question.help_text && (
            <p className="mt-0.5 text-xs text-muted-foreground">{question.help_text}</p>
          )}
          {interactive && <p className="mt-1 text-xs text-muted-foreground">{hint(question, t)}</p>}
        </div>

        {publishedWinner && !interactive ? (
          <PublishedResult question={question} winner={publishedWinner} />
        ) : question.answer_type === "rating" ? (
          <RatingRow question={question} value={value} interactive={interactive} onValue={onValue} />
        ) : question.answer_type === "short_text" || question.answer_type === "long_text" ? (
          <TextAnswer question={question} value={value} interactive={interactive} onValue={onValue} />
        ) : question.answer_type === "ranking" ? (
          <RankingList
            question={question}
            selected={selected}
            interactive={interactive}
            onPick={onPick}
            onReorder={onReorder}
          />
        ) : (
          <ChoiceList
            question={question}
            selected={selected}
            interactive={interactive}
            showResults={showResults}
            onPick={onPick}
          />
        )}
      </CardContent>
    </Card>
  );
}

function hint(question: PollQuestion, t: ReturnType<typeof useTranslations>) {
  if (question.answer_type === "multiple_choice" && question.config?.max_choices) {
    return t("ballot.pickUpTo", { count: question.config.max_choices });
  }
  if (question.answer_type === "ranking") return t("ballot.rankHint");
  if (question.answer_type === "rating") return t("ballot.ratingHint");
  if (question.answer_type === "short_text" || question.answer_type === "long_text") {
    return t("ballot.textHint");
  }
  return t("ballot.pick");
}

function PublishedResult({
  question,
  winner,
}: {
  question: PollQuestion;
  winner: PollOption;
}) {
  const t = useTranslations("polls");
  const runnersUp = question.options.filter((o) => o.option_id !== winner.option_id);
  const total = question.options.reduce((sum, o) => sum + (o.votes || 0), 0);

  return (
    <div className="space-y-2">
      <div className="rounded-md border border-gold/30 bg-gold/5 px-3 py-2.5">
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gold">
          <IconTrophy className="h-3.5 w-3.5" />
          {t("results.winner")}
        </p>
        <div className="mt-1.5 flex items-center gap-2.5">
          <OptionAvatar option={winner} size={44} />
          <div className="min-w-0">
            <p className="truncate text-base font-semibold text-foreground">{winner.label}</p>
            {winner.linked?.team_name && (
              <p className="truncate text-xs text-muted-foreground">{winner.linked.team_name}</p>
            )}
          </div>
          {typeof question.published_winner_votes === "number" && (
            <span className="ml-auto shrink-0 text-lg font-bold tabular-nums text-gold">
              {question.published_winner_votes.toLocaleString()}
            </span>
          )}
        </div>
        {winner.linked?.profile_url && (
          <Link
            href={winner.linked.profile_url}
            className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            {t("results.viewProfile")}
            <IconExternalLink className="h-3 w-3" />
          </Link>
        )}
      </div>

      {/* The runner-up detail, only when the tally actually holds numbers. An award imported from
          the 2025 page file has a published winner and NO stored votes, so this block correctly
          renders nothing rather than a row of zeros that would read as "nobody voted for them". */}
      {total > 0 && runnersUp.some((o) => (o.votes || 0) > 0) && (
        <div className="space-y-1">
          {runnersUp.map((option) => (
            <div key={option.option_id} className="flex items-center gap-2 text-xs">
              <span className="min-w-0 flex-1 truncate text-muted-foreground">{option.label}</span>
              <span className="tabular-nums text-muted-foreground">{option.votes || 0}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ChoiceList({
  question,
  selected,
  interactive,
  showResults,
  onPick,
}: {
  question: PollQuestion;
  selected: number[];
  interactive: boolean;
  showResults: boolean;
  onPick: (optionId: number) => void;
}) {
  const t = useTranslations("polls");
  return (
    <div className="space-y-1.5">
      {question.options.map((option) => {
        const isSelected = selected.includes(option.option_id);
        return (
          <button
            key={option.option_id}
            type="button"
            disabled={!interactive}
            aria-pressed={isSelected}
            onClick={() => onPick(option.option_id)}
            className={cn(
              "flex w-full items-center gap-2.5 rounded-md border px-3 py-2 text-left text-sm transition-colors",
              // 44px minimum so the whole card is a comfortable tap target on a phone.
              "min-h-11",
              isSelected ? "border-primary bg-primary/10 font-medium text-primary" : "border-input",
              interactive ? "hover:bg-muted" : "cursor-default",
            )}
          >
            <OptionAvatar option={option} />
            <span className="min-w-0 flex-1">
              {isSelected && <IconCheck className="mr-1.5 inline h-3.5 w-3.5" />}
              {option.label}
              {option.linked?.team_name && (
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {option.linked.team_name}
                </span>
              )}
              {option.description && (
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {option.description}
                </span>
              )}
            </span>
            {showResults && typeof option.votes === "number" && (
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                {t("results.votes", { count: option.votes })}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function RankingList({
  question,
  selected,
  interactive,
  onPick,
  onReorder,
}: {
  question: PollQuestion;
  selected: number[];
  interactive: boolean;
  onPick: (optionId: number) => void;
  onReorder?: (optionId: number, direction: -1 | 1) => void;
}) {
  const t = useTranslations("polls");
  const ranked = selected
    .map((id) => question.options.find((o) => o.option_id === id))
    .filter(Boolean) as PollOption[];
  const unranked = question.options.filter((o) => !selected.includes(o.option_id));

  return (
    <div className="space-y-2">
      {ranked.map((option, index) => (
        <div
          key={option.option_id}
          className="flex min-h-11 items-center gap-2 rounded-md border border-primary bg-primary/10 px-3 py-2 text-sm"
        >
          <span className="w-5 shrink-0 text-xs font-bold tabular-nums text-primary">
            {index + 1}
          </span>
          <span className="min-w-0 flex-1 truncate font-medium text-primary">{option.label}</span>
          {interactive && (
            <span className="flex shrink-0 items-center gap-1">
              {/* Buttons, not drag: drag-to-reorder inside a scrolling page on a touchscreen is
                  genuinely bad, and most AFC users are on phones. */}
              <button
                type="button"
                aria-label={t("ballot.moveUp")}
                disabled={index === 0}
                onClick={() => onReorder?.(option.option_id, -1)}
                className="flex h-8 w-8 items-center justify-center rounded-md border border-input disabled:opacity-40"
              >
                <IconArrowUp className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                aria-label={t("ballot.moveDown")}
                disabled={index === ranked.length - 1}
                onClick={() => onReorder?.(option.option_id, 1)}
                className="flex h-8 w-8 items-center justify-center rounded-md border border-input disabled:opacity-40"
              >
                <IconArrowDown className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                aria-label={t("ballot.remove")}
                onClick={() => onPick(option.option_id)}
                className="flex h-8 items-center rounded-md border border-input px-2 text-xs"
              >
                {t("ballot.remove")}
              </button>
            </span>
          )}
        </div>
      ))}

      {interactive &&
        unranked.map((option) => (
          <button
            key={option.option_id}
            type="button"
            onClick={() => onPick(option.option_id)}
            className="flex min-h-11 w-full items-center gap-2 rounded-md border border-input px-3 py-2 text-left text-sm hover:bg-muted"
          >
            <span className="min-w-0 flex-1 truncate">{option.label}</span>
            <Badge variant="outline" className="rounded-full px-2 py-0.5 text-xs">
              {t("ballot.addToRanking")}
            </Badge>
          </button>
        ))}
    </div>
  );
}

function RatingRow({
  question,
  value,
  interactive,
  onValue,
}: {
  question: PollQuestion;
  value: { rating?: number };
  interactive: boolean;
  onValue: (patch: { rating?: number }) => void;
}) {
  const points = question.config?.scale_points || 5;
  const labels = question.config?.scale_labels || [];
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-1.5">
        {Array.from({ length: points }, (_, index) => index + 1).map((point) => (
          <button
            key={point}
            type="button"
            disabled={!interactive}
            aria-pressed={value.rating === point}
            onClick={() => onValue({ rating: value.rating === point ? undefined : point })}
            className={cn(
              "h-11 min-w-11 rounded-md border px-3 text-sm font-medium tabular-nums transition-colors",
              value.rating === point
                ? "border-primary bg-primary/10 text-primary"
                : "border-input",
              interactive ? "hover:bg-muted" : "cursor-default",
            )}
          >
            {point}
          </button>
        ))}
      </div>
      {labels.length >= 2 && (
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{labels[0]}</span>
          <span>{labels[labels.length - 1]}</span>
        </div>
      )}
    </div>
  );
}

function TextAnswer({
  question,
  value,
  interactive,
  onValue,
}: {
  question: PollQuestion;
  value: { text?: string };
  interactive: boolean;
  onValue: (patch: { text?: string }) => void;
}) {
  const limit = question.config?.max_length || (question.answer_type === "long_text" ? 800 : 120);
  const text = value.text || "";
  const Field = question.answer_type === "long_text" ? Textarea : Input;

  return (
    <div className="space-y-1">
      <Field
        value={text}
        disabled={!interactive}
        maxLength={limit}
        rows={question.answer_type === "long_text" ? 4 : undefined}
        onChange={(event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
          onValue({ text: event.target.value })
        }
      />
      {interactive && (
        <p className="text-right text-xs tabular-nums text-muted-foreground">
          {text.length} / {limit}
        </p>
      )}
    </div>
  );
}
