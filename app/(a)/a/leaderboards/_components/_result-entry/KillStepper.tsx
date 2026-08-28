"use client";

/**
 * app/(a)/a/leaderboards/_components/_result-entry/KillStepper.tsx
 * ────────────────────────────────────────────────────────────────
 * One player's kill count, entered with a thumb instead of a keyboard.
 *
 * WHY (owner brief 2026-08-27)
 *   Organizers enter results on a phone between maps. Every count today is an
 *   <input type="number">, so each one costs a keyboard round trip: tap, type, dismiss, scroll.
 *   On a 12-team squad map that is roughly 48 of them for kills alone.
 *
 *   Kill counts are small. Measured on the stored rows for the map this rebuild was tested
 *   against, the common values are single digits, so one or two taps beats a keyboard every
 *   time, and the keyboard never covers the screen.
 *
 *   The number itself stays a real text field, so a player who got 23 is one tap and a typed
 *   number away. That is deliberate: a stepper that makes large values tedious would just move
 *   the pain rather than remove it.
 *
 * ABSENT IS NOT ZERO
 *   The value is a ScoreValue (`number | null`) and null means "nothing entered yet". Pressing
 *   + on an empty box gives 1, not 2, and pressing - on an empty box gives 0, because that is
 *   what somebody reaching for the minus key means. Clearing the field returns it to null. See
 *   lib/scoreInput.ts for why that distinction exists at all (owner bug 2026-08-06).
 *
 * DESIGN CONSTRAINTS THIS OBEYS
 *   No borders and no glow (CLAUDE.md hard rule): the buttons and the readout are filled
 *   surfaces, never outlined controls, and the focus ring is the a11y one, which is the single
 *   allowed exception. Tap targets are 44px, the platform minimum.
 *
 * USED BY
 *   • ../_result-entry/TeamStepper.tsx  - one row per player on the per-team screen
 *   • ../ManualMatchResultStep.tsx      - the all-teams review view uses the same control
 */
import React from "react";
import { IconMinus, IconPlus } from "@tabler/icons-react";

import { cn } from "@/lib/utils";
import {
  parseScoreInput,
  scoreInputValue,
  scoreOrZero,
  type ScoreValue,
} from "@/lib/scoreInput";

interface Props {
  value: ScoreValue;
  onChange: (next: ScoreValue) => void;
  /** Greyed out when the player is not in this map's lineup. */
  disabled?: boolean;
  /** Names the control for a screen reader, e.g. "Kills for VT.HABEEB". */
  label: string;
}

/** Nobody gets a negative number of kills, and nobody legitimately gets four figures. */
const MIN = 0;
const MAX = 999;

export function KillStepper({ value, onChange, disabled = false, label }: Props) {
  const step = (by: number) => {
    // An empty box stepped up is 1 and stepped down is 0: scoreOrZero reads absent as zero,
    // which is exactly what the person pressing the key means here.
    const next = scoreOrZero(value) + by;
    onChange(Math.min(MAX, Math.max(MIN, next)));
  };

  const buttonClass =
    "flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-secondary " +
    "text-secondary-foreground transition-colors hover:bg-secondary/80 " +
    "disabled:pointer-events-none disabled:opacity-40 " +
    "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        className={buttonClass}
        onClick={() => step(-1)}
        disabled={disabled || scoreOrZero(value) <= MIN}
        aria-label={`One less. ${label}`}
      >
        <IconMinus className="size-4" />
      </button>

      {/*
        A real field, not a readout: tapping it opens the keyboard for a big number. inputMode
        numeric asks phones for the digit pad rather than the full keyboard. No border, per the
        hairline ban; the filled surface is what makes it read as editable.
      */}
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        className={cn(
          "h-11 w-16 rounded-md bg-muted text-center text-base font-medium tabular-nums",
          "outline-none placeholder:text-muted-foreground",
          "focus-visible:ring-[3px] focus-visible:ring-ring/50",
          "disabled:cursor-not-allowed disabled:opacity-40",
        )}
        placeholder="0"
        value={scoreInputValue(value)}
        disabled={disabled}
        aria-label={label}
        onChange={(e) => {
          const parsed = parseScoreInput(e.target.value);
          onChange(parsed === null ? null : Math.min(MAX, Math.max(MIN, parsed)));
        }}
      />

      <button
        type="button"
        className={buttonClass}
        onClick={() => step(1)}
        disabled={disabled || scoreOrZero(value) >= MAX}
        aria-label={`One more. ${label}`}
      >
        <IconPlus className="size-4" />
      </button>
    </div>
  );
}
