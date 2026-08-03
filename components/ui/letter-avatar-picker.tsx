"use client";

/**
 * components/ui/letter-avatar-picker.tsx - A-Z Letter-Avatar picker primitive.
 *
 * Purpose
 * -------
 * A reusable, fully PRESENTATIONAL toggle grid for picking one or more letters
 * (A-Z). Free Fire ships a fixed set of "letter avatars" (one per letter), so a
 * team / player needs to declare which letter-avatars they own or want to claim.
 * This component is the shared input for that anywhere it is needed.
 *
 * It holds NO data and does NO fetching. It is a controlled input: the parent
 * owns the selected letters (`value`) and is told about changes (`onChange`).
 * That keeps it identical in spirit to the other inputs in this folder
 * (team-search-select, user-search-select, phone-combobox) which are also
 * controlled and locale-agnostic.
 *
 * How it connects to the rest of the system
 * ------------------------------------------
 *  - Callers (future): the team "manual letter-avatar" picker and the player
 *    profile letter-avatar selector. Those FEATURE components own the data
 *    fetching, the backend save endpoint, and the i18n namespace. They pass the
 *    current selection in via `value`, persist `onChange`, and (for the team
 *    manual picker) pass member-covered letters via `disabledLetters` so those
 *    cannot be unset by hand.
 *  - i18n: every component in components/ui/ is locale-agnostic by repo
 *    convention (NONE of them call useTranslations). User-facing words are taken
 *    as props with English defaults - exactly like phone-combobox's
 *    `otherLabel = 'Use "{q}"'`. The consuming feature component passes the
 *    translated strings from ITS namespace (e.g. `t('letterAvatars.selectAll')`)
 *    so this primitive never reaches into the message catalog itself. The
 *    recommended keys are listed in the build report for the next agent.
 *  - Models / endpoints: NONE. This primitive is pure UI; persistence lives in
 *    the caller's endpoint, not here.
 *  - Explainer image: optionally renders /letter-avatars/explainer.jpeg (the Free
 *    Fire letter-avatar grid the OWNER supplies, see public/letter-avatars/
 *    README.txt). It degrades gracefully: if the file is missing, onError hides
 *    it so a missing asset can never break the picker.
 *
 * Design idiom (mirrors AFC tier badges + Button)
 * -----------------------------------------------
 *  - Chips reuse the outline-tier-badge look: rounded-full, text-xs, bordered.
 *  - Selected chip = bg-primary text-primary-foreground (the green primary).
 *  - Buttons reuse the shared Button (variant="outline"/"ghost", size="sm").
 *  - Count pill reuses Badge variant="outline".
 */

import * as React from "react";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

// The full alphabet, in display order. There are exactly 26 letter-avatars, so
// the denominator of the "N / 26" count pill is always this length.
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const TOTAL_LETTERS = ALPHABET.length; // 26

/**
 * Normalize an arbitrary list of strings into the canonical stored form:
 * UPPERCASE, single A-Z chars only, de-duplicated, sorted. Both the incoming
 * `value`/`disabledLetters` props and every `onChange` payload pass through this
 * so the component always stores "sorted, deduped, uppercase single chars".
 */
function normalizeLetters(letters: readonly string[] | undefined): string[] {
  if (!letters || letters.length === 0) return [];
  const set = new Set<string>();
  for (const raw of letters) {
    if (typeof raw !== "string") continue;
    const ch = raw.trim().toUpperCase();
    // Keep only real single letters A-Z; ignore anything else defensively.
    if (ch.length === 1 && ch >= "A" && ch <= "Z") set.add(ch);
  }
  return Array.from(set).sort();
}

export interface LetterAvatarPickerProps {
  /** Currently selected letters (the user-controlled set). Stored uppercase/sorted/deduped. */
  value: string[];
  /** Called with the next selected set (already normalized) whenever the user toggles. */
  onChange: (next: string[]) => void;
  /**
   * Letters that are force-locked ON and cannot be unset (rendered
   * checked-and-disabled). Used by the team manual picker for letters already
   * covered by a member. They count toward the displayed total and toward `max`,
   * but are kept OUT of the `value`/`onChange` space so the round-trip stays
   * clean (value ↔ onChange only ever carry the user's manual additions).
   */
  disabledLetters?: string[];
  /**
   * Optional cap on the TOTAL number of selected letters (locked + manual).
   * When the cap is reached, unselected chips become non-interactive. Undefined
   * means no cap (up to all 26).
   */
  max?: number;
  /** Read-only display: hides the Select all / Clear buttons and disables all chips. */
  readOnly?: boolean;
  /** When true, render the Free Fire reference image above the grid (if present). */
  showExplainer?: boolean;
  /** Extra classes for the outer wrapper. */
  className?: string;

  // ── i18n: words are props with English defaults (repo convention). The
  //    consuming feature component passes translated strings from its namespace.
  /** Label for the "select all letters" button. */
  selectAllLabel?: string;
  /** Label for the "clear selection" button. */
  clearLabel?: string;
  /** Alt text for the explainer reference image. */
  explainerAlt?: string;
  /** Tooltip shown on locked (member-covered) chips explaining why they can't be unset. */
  lockedHint?: string;
}

/**
 * LetterAvatarPicker - controlled A-Z toggle grid. See file header for the full
 * contract and caller map.
 */
export function LetterAvatarPicker({
  value,
  onChange,
  disabledLetters,
  max,
  readOnly = false,
  showExplainer = false,
  className,
  selectAllLabel = "Select all",
  clearLabel = "Clear",
  explainerAlt = "Free Fire letter avatar reference",
  lockedHint = "Locked",
}: LetterAvatarPickerProps) {
  // Track whether the explainer image loaded. A missing file flips this false
  // (via onError) so the image disappears instead of showing a broken icon.
  const [explainerOk, setExplainerOk] = React.useState(true);

  // Canonical forms of the two incoming sets. Memoized so the derived Sets below
  // are stable for a given render and we don't re-normalize on every lookup.
  const selected = React.useMemo(() => normalizeLetters(value), [value]);
  const locked = React.useMemo(
    () => normalizeLetters(disabledLetters),
    [disabledLetters],
  );

  const selectedSet = React.useMemo(() => new Set(selected), [selected]);
  const lockedSet = React.useMemo(() => new Set(locked), [locked]);

  // A letter is "covered" if the user selected it OR it is locked on. The count
  // pill and the `max` cap are both based on this effective (union) total.
  const coveredCount = React.useMemo(() => {
    const union = new Set<string>(selected);
    for (const l of locked) union.add(l);
    return union.size;
  }, [selected, locked]);

  // True once the effective total has hit the optional cap. Used to stop the
  // user adding more letters (already-selected ones can still be removed).
  const atMax = typeof max === "number" && coveredCount >= max;

  // Toggle a single letter in the user-controlled `value` set. Locked letters
  // are no-ops (they live in `disabledLetters`, not `value`). Adding is blocked
  // once the cap is reached.
  const toggle = (letter: string) => {
    if (readOnly || lockedSet.has(letter)) return;
    if (selectedSet.has(letter)) {
      // Remove: always allowed.
      onChange(normalizeLetters(selected.filter((l) => l !== letter)));
    } else {
      // Add: only when under the cap.
      if (atMax) return;
      onChange(normalizeLetters([...selected, letter]));
    }
  };

  // Select every letter that is not locked, capped so the effective total never
  // exceeds `max`. Locked letters are managed by the caller and stay out of value.
  const selectAll = () => {
    if (readOnly) return;
    const selectable = ALPHABET.filter((l) => !lockedSet.has(l));
    if (typeof max === "number") {
      const room = Math.max(0, max - locked.length);
      onChange(normalizeLetters(selectable.slice(0, room)));
    } else {
      onChange(normalizeLetters(selectable));
    }
  };

  // Clear the user's manual selection. Locked letters remain (they are not in value).
  const clear = () => {
    if (readOnly) return;
    onChange([]);
  };

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {/* Free Fire reference grid (owner-supplied). Hidden if absent or not requested. */}
      {showExplainer && explainerOk ? (
        // eslint-disable-next-line @next/next/no-img-element -- plain <img> so the
        // onError graceful-fallback works without next/image domain config.
        <img
          src="/letter-avatars/explainer.jpeg"
          alt={explainerAlt}
          onError={() => setExplainerOk(false)}
          className="w-full max-w-md rounded-md border bg-card object-contain"
        />
      ) : null}

      {/* Toolbar: count pill on the left, actions on the right (hidden in readOnly). */}
      <div className="flex items-center justify-between gap-2">
        <Badge variant="outline" className="rounded-full">
          {coveredCount} / {TOTAL_LETTERS}
        </Badge>

        {!readOnly ? (
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={selectAll}
              // No cap-room left to add anything new -> nothing to select.
              disabled={atMax}
            >
              {selectAllLabel}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={clear}
              // Nothing user-selected to clear.
              disabled={selected.length === 0}
            >
              {clearLabel}
            </Button>
          </div>
        ) : null}
      </div>

      {/* The 26 chips: 6 columns on mobile, 7 on >= sm (desktop). */}
      <div className="grid grid-cols-6 gap-2 sm:grid-cols-7">
        {ALPHABET.map((letter) => {
          const isLocked = lockedSet.has(letter);
          const isSelected = isLocked || selectedSet.has(letter);
          // A chip is dimmed/blocked only when it is an unselected letter that
          // can't be added because the cap is full. Locked + selected chips stay
          // at full opacity even though they are non-interactive.
          const blockedByMax = !isSelected && atMax;
          const interactive = !readOnly && !isLocked && !blockedByMax;

          return (
            <button
              key={letter}
              type="button"
              // Pressed state for assistive tech (the visible label is the letter).
              aria-pressed={isSelected}
              disabled={!interactive}
              // Locked chips explain (via title) why they can't be toggled off.
              title={isLocked ? lockedHint : undefined}
              onClick={interactive ? () => toggle(letter) : undefined}
              className={cn(
                // Base chip: square-ish, rounded-full, text-xs - the tier-badge idiom.
                "flex h-9 w-full items-center justify-center rounded-full border text-xs font-semibold transition-colors outline-none",
                "focus-visible:ring-ring/50 focus-visible:ring-[3px]",
                isSelected
                  ? // Selected / locked-on: green primary fill.
                    "border-transparent bg-primary text-primary-foreground"
                  : // Unselected: outline-tier-badge look.
                    "text-foreground hover:bg-accent hover:text-accent-foreground",
                // Cursor + dimming states.
                isLocked && "cursor-not-allowed opacity-90",
                blockedByMax && "cursor-not-allowed opacity-50",
                interactive && "cursor-pointer",
                readOnly && "cursor-default",
              )}
            >
              {letter}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default LetterAvatarPicker;
