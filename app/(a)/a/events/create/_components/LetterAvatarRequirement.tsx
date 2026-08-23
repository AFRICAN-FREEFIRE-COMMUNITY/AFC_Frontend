"use client";

// ─────────────────────────────────────────────────────────────────────────────
// LetterAvatarRequirement - shared "Require letter avatars" control.
//
// PURPOSE: one source of truth for the per-event letter-avatar gate so the CREATE
// wizard (Step1EventDetails) and the EDIT form (BasicInfoTab) render + behave
// identically. Both are reused by the ORGANIZER surfaces as well, so this single
// component backs four screens:
//     /a/events/create                     (admin create wizard, step 1)
//     /a/events/[slug]/edit                (admin edit, Setup tab)
//     /organizer/events/create             (imports Step1EventDetails)
//     /organizer/events/[slug]/edit        (imports BasicInfoTab)
//
// WHAT IT CONTROLS: the single number field `min_letter_avatars`. 0 (or unset) = the
// gate is OFF; 1-26 = the required minimum count of Free Fire letter avatars (A-Z) a
// team or solo player must have AVAILABLE before it may register. A team's available
// letters are the live union of its members' owned letters plus the team's manual
// extras; a solo player's are their own.
//
// CONNECTS TO:
//   • Callers: Step1EventDetails binds it to the react-hook-form field
//     `min_letter_avatars`; BasicInfoTab binds it to the edit page's `waitlistForm`
//     state via setRequirementsForm. Each caller passes its own already-translated
//     copy, because the two live in different i18n namespaces (create wizard:
//     "requireLetterAvatars*"; edit form: "basicInfo.requireLetters*").
//   • Backend: the value is appended to create_event / edit_event FormData by the
//     admin + organizer create and edit pages, parsed by _parse_min_letter_avatars,
//     stored on Event.min_letter_avatars, and enforced in register_for_event.
//     Rehydrated from get_event_details on the edit pages.
//
// ── WHY THE DRAFT STATE EXISTS (bug, owner 2026-08-22, mobile) ────────────────
// The previous inline version was fully controlled AND clamped on every keystroke:
//     onChange={(e) => onChange(Math.max(1, Math.min(26, Number(e.target.value) || 1)))}
// Backspacing to an empty box gives Number("") === 0, `|| 1` turns that into 1, and
// React immediately repaints "1" over the empty field. The box can therefore never be
// cleared, so the only way to replace the value is select-all-and-overtype. That works
// with a desktop keyboard and is impossible on a phone, where an admin or organizer
// could not change the number at all.
//
// The fix: keep a local string draft while the user is typing, so an empty or
// half-typed box ("1" on the way to "12") survives the render. Commit upward only
// values that are already valid, and clamp ONCE on blur. `inputMode="numeric"` asks a
// phone for the number pad.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { InfoTip } from "@/components/ui/info-tip";

// 26 letters exist, so the gate can never require more than 26.
const MIN_LETTERS = 1;
const MAX_LETTERS = 26;

type LetterAvatarRequirementProps = {
  /** Current `min_letter_avatars`. 0 or undefined = gate off. */
  value: number | undefined;
  /** Commits a new `min_letter_avatars` (0 = off, 1-26 = the required minimum). */
  onChange: (next: number) => void;
  /** Switch + input id, so the caller keeps its own stable DOM ids. */
  id: string;
  /** Already-translated copy. Namespaces differ between create and edit. */
  label: string;
  description: string;
  infoTipText: string;
};

export function LetterAvatarRequirement({
  value,
  onChange,
  id,
  label,
  description,
  infoTipText,
}: LetterAvatarRequirementProps) {
  const current = Number(value ?? 0) || 0;
  const enabled = current > 0;

  // null = show the committed value. A string = the user is mid-edit, show that
  // instead, INCLUDING "" so the field can actually be cleared on a phone.
  const [draft, setDraft] = useState<string | null>(null);

  const clampToRange = (n: number) =>
    Math.max(MIN_LETTERS, Math.min(MAX_LETTERS, n));

  const handleChange = (raw: string) => {
    setDraft(raw);
    // Commit only an already-valid number. An empty or out-of-range box is left
    // uncommitted so the parent keeps the last good value until blur decides.
    const parsed = Number(raw);
    if (raw !== "" && Number.isFinite(parsed) && parsed >= MIN_LETTERS && parsed <= MAX_LETTERS) {
      onChange(Math.trunc(parsed));
    }
  };

  const handleBlur = () => {
    // One clamp, at the end. An empty or junk box falls back to the minimum rather
    // than switching the whole gate off, which is what a stray backspace would mean.
    if (draft !== null) {
      const parsed = Number(draft);
      const next =
        draft === "" || !Number.isFinite(parsed)
          ? MIN_LETTERS
          : clampToRange(Math.trunc(parsed));
      onChange(next);
    }
    setDraft(null);
  };

  return (
    <div className="flex items-center justify-between">
      <div className="space-y-0.5">
        <Label htmlFor={id}>
          {label}
          <InfoTip text={infoTipText} className="ml-1" />
        </Label>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="flex items-center gap-3">
        {/* Count input only when the gate is on. */}
        {enabled && (
          <Input
            id={`${id}-count`}
            type="number"
            inputMode="numeric"
            min={MIN_LETTERS}
            max={MAX_LETTERS}
            value={draft ?? String(current)}
            onChange={(e) => handleChange(e.target.value)}
            onBlur={handleBlur}
            className="w-20"
            aria-label={label}
          />
        )}
        <Switch
          id={id}
          checked={enabled}
          // Toggling on seeds a sensible default of 1; off clears to 0 and drops any
          // half-typed draft so the input does not reappear holding stale text.
          onCheckedChange={(on) => {
            setDraft(null);
            onChange(on ? MIN_LETTERS : 0);
          }}
        />
      </div>
    </div>
  );
}

export default LetterAvatarRequirement;
