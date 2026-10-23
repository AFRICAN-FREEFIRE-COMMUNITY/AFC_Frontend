// components/UidInput.tsx
// ─────────────────────────────────────────────────────────────────────────────────────────────────
// The one box a Free Fire UID is typed into (owner 2026-09-30, inbox #89): "when users are inputting
// UIDs only numbers should be allowed, no special characters, full stops, commas, alpahbets etc,
// only numbers are allowed."
//
// WHY A COMPONENT AND NOT A PROP ON EACH INPUT
//   Seven screens take a UID. They used to be a plain <Input> (anything goes) or type="number",
//   which is worse than it looks: a number input accepts "e", ".", "-" and "+", and reports "" to
//   the form for a value it cannot parse. The damage is in the database: a player whose UID showed
//   as taken added a full stop to get past it (".693701479", support ticket AFC-07C386), and the
//   admin identity tool exists to clean rows like "527.0848242". One component means one rule.
//
// WHAT IT DOES
//   Every change, typed or pasted, is reduced to the ASCII digits 0-9 before the caller's onChange
//   sees it, so "693 701.479" pastes as "693701479". The phone keypad opens (inputMode numeric) and
//   the length stops at the 15 the column holds. It stays a text input on purpose, so a leading
//   zero survives and there is no spinner or scroll-wheel change.
//
// HOW IT CONNECTS
//   Drop-in for components/ui/input.tsx: same props, works with react-hook-form's {...field} and
//   with a plain value/onChange pair. Used by the profile edit page, onboarding, forgot password (by
//   UID), the tournament UID prompt, the team member self-edit, the admin sponsor account form,
//   the admin identity repair box and the broadcast kit's caster UID.
//   The server holds the same rule on every write (AFC-B afc_auth/identifiers.uid_format_error),
//   so a client that is not this box is refused rather than trusted.
// ─────────────────────────────────────────────────────────────────────────────────────────────────
import * as React from "react";

import { Input } from "@/components/ui/input";

// User.uid is CharField(max_length=15), mirrored by UID_MAX_LENGTH on the backend.
export const UID_MAX_LENGTH = 15;

/** Only the ASCII digits of `value`, capped at the column width. */
export function digitsOnlyUid(value: string): string {
  return value.replace(/[^0-9]/g, "").slice(0, UID_MAX_LENGTH);
}

function UidInput({ onChange, ...props }: Omit<React.ComponentProps<typeof Input>, "type">) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const clean = digitsOnlyUid(e.target.value);
    // Rewrite the event's value in place, so a caller reading e.target.value (a setState or
    // react-hook-form's field.onChange) receives the digits and nothing else.
    if (clean !== e.target.value) e.target.value = clean;
    onChange?.(e);
  };

  return (
    <Input
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      autoComplete="off"
      maxLength={UID_MAX_LENGTH}
      {...props}
      onChange={handleChange}
    />
  );
}

export { UidInput };
