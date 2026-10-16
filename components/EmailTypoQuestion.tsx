"use client";

/**
 * EmailTypoQuestion - "Did you mean kofi@gmail.com?" under the email field at sign-up (inbox #273).
 *
 * WHY (owner 2026-10-16, answer "A" to #238: accept any real address, catch typos). Production had
 * addresses at gamil.com, gmail.con, gmail.co and two dozen more; the verification code sent there
 * never arrived. The server (AFC-B afc_auth/email_typos.py, called by afc_auth.views.signup) answers
 * code `email_domain_typo` with `suggestion`, the corrected address, ONCE. This asks the person, and
 * either answer is honoured: "Use ..." fills the field with the suggestion, "My address is right"
 * sends the address as typed with `email_domain_confirmed`. It is a question, never a block, because
 * real providers sit one letter away from gmail.com too (mail.com, email.com).
 *
 * CALLERS: app/(auth)/_components/CreateAccountForm.tsx and components/AuthModal.tsx (the popup's
 * Register tab). Copy: messages/<locale>/auth.json -> emailTypo.*.
 */
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

// How long a form waits for a fresh bot token before it stops re-sending by itself after an
// answer. Turnstile normally hands a new token over in a second or two.
export const TYPO_RESUBMIT_WAIT_MS = 6000;

export function EmailTypoQuestion({
  suggestion,
  onUse,
  onKeep,
  disabled,
}: {
  suggestion: string;
  onUse: () => void;
  onKeep: () => void;
  disabled?: boolean;
}) {
  const t = useTranslations("auth");
  return (
    <div role="status" className="rounded-md bg-muted/60 p-3 text-sm">
      <p className="font-medium">{t("emailTypo.question", { suggestion })}</p>
      <p className="mt-1 text-muted-foreground">{t("emailTypo.why")}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" size="sm" onClick={onUse} disabled={disabled} className="max-w-full">
          <span className="truncate">{t("emailTypo.use", { suggestion })}</span>
        </Button>
        <Button type="button" size="sm" variant="secondary" onClick={onKeep} disabled={disabled}>
          {t("emailTypo.keep")}
        </Button>
      </div>
    </div>
  );
}

export default EmailTypoQuestion;
