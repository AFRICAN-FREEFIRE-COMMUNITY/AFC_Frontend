"use client";

/**
 * lib/i18n/serverMessage.ts - a server SUCCESS answer, in the reader's language.
 *
 * WHY (inbox #257, owner 2026-10-16: "add them"). Sign-in, sign-up, verification, code resend and
 * event registration answer with an English sentence, and the pages toasted it as is, so the
 * French and Portuguese site said "Login successful" and "Team successfully registered (squad).
 * Discord roles queued." (seen in the fr/pt how-to clips). The backend now sends a stable `code`
 * beside each sentence (AFC-B fix/success-codes, afc_auth/tests_success_codes.py), and this hook
 * prints our own hand-written en/fr/pt text for it from messages/<locale>/serverMessages.json.
 *
 * A code we have no text for, or an answer with no code, falls back to the server's own sentence
 * and then to `fallback`, so nothing ever goes blank while the two halves ship.
 *
 * Callers: CreateAccountForm, LoginForm (password + two-step), ConfirmationForm (verify + resend),
 * tournaments/[slug]/register/success, EventDetailsWrapper (both registration paths).
 */
import { useTranslations } from "next-intl";

export type ServerAnswer = { code?: string | null; message?: string | null } | null | undefined;

export function useServerMessage() {
  const t = useTranslations("serverMessages");
  return (data: ServerAnswer, fallback = ""): string => {
    const code = data?.code;
    if (code && t.has(code)) return t(code);
    return data?.message || fallback;
  };
}
