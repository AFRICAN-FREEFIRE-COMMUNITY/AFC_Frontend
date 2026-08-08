"use client";

// ─────────────────────────────────────────────────────────────────────────────
// app/(auth)/_components/RecoverAccountForm.tsx
//
// The whole ACCOUNT-RECOVERY-BY-WHATSAPP screen, in one Client Component, because
// a person who cannot get into their account should not also have to keep track of
// where they are. One proof of the number, then a fork:
//
//   identify  -> name the account, a code goes to the WhatsApp number on file
//   code      -> type the code                     ← the shared proof ends here
//   choose    -> what did you come here to fix?
//     password  -> choose the new password
//     email     -> type the new address ...
//     emailCode -> ... then prove it with a second code sent to THAT address
//
// It talks to the backend through lib/recovery.ts (prefix /auth/recovery/whatsapp/,
// backend/afc_auth/views_recovery.py). There is no session anywhere in this file:
// the caller cannot sign in, which is why they are here.
//
// THREE RULES THIS UI HAS TO KEEP, all of them backend properties it must not undo:
//
// 1. NEVER CLAIM AN ACCOUNT WAS FOUND. The start call answers an unknown
//    identifier exactly as it answers a real one, so that the page cannot be used
//    to discover whether somebody has an AFC account. Every branch here therefore
//    shows the backend's own sentence and moves straight to the code screen. Do
//    not add "we found your account", a masked number, or a "no account with that
//    name" error: any of those would put the leak back.
//
// 2. FINISHING DOES NOT SIGN THE USER IN, and must not look as though it did.
//    Either ending sends them to /login. An account with two-step sign-in meets
//    its second factor there, exactly as before, which is what keeps this flow
//    from being a way past it.
//
// 3. ONE GRANT BUYS ONE ENDING. Whichever branch completes spends the grant, so
//    the "choose" screen is a genuine fork and not a menu to work through. Going
//    BACK from a branch is free (nothing has been spent), which is why the back
//    buttons exist.
//
// WHY BOTH OPTIONS ARE ALWAYS OFFERED, even though the email move is refused on an
// account with two-step sign-in: the only way to grey it out would be for the
// verify response to say whether 2FA is on, and that is a fact about an account
// this screen does not need to hold. The refusal comes back as a 409 whose message
// names the two things the user can still do, so the dead end explains itself
// instead of being hidden.
//
// The password fields themselves are the SHARED PasswordFields component, the same
// one the emailed reset uses, so the two reset screens cannot state different
// rules. Validation is ResetPasswordFormSchema, re-checked server side.
//
// i18n: messages/{en,fr,pt}/recovery.json for this flow's own copy, plus the
// `auth` namespace for the password fields (via PasswordFields). Server messages
// are authored in English on the backend and shown verbatim, exactly as the login
// and two-factor screens already do.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader } from "@/components/Loader";
import { NewBadge } from "@/components/NewBadge";
import {
  ResetPasswordFormSchema,
  ResetPasswordFormSchemaType,
} from "@/lib/zodSchemas";
import {
  confirmEmailChangeWithWhatsApp,
  recoveryErrorBody,
  requestEmailChangeWithWhatsApp,
  resetPasswordWithWhatsApp,
  startWhatsAppRecovery,
  verifyWhatsAppRecovery,
} from "@/lib/recovery";
import { PasswordFields } from "./PasswordFields";

/** Which screen is showing. "choose" is the fork; everything after it is one ending. */
type Step = "identify" | "code" | "choose" | "password" | "email" | "emailCode";

export function RecoverAccountForm() {
  const router = useRouter();
  const t = useTranslations("recovery");
  const [pending, startTransition] = useTransition();

  const [step, setStep] = useState<Step>("identify");

  // Typed by the user on the first two screens. The third is a react-hook-form,
  // because the password rule needs live validation and a strength meter.
  const [identifier, setIdentifier] = useState("");
  const [code, setCode] = useState("");

  // Handed over by the backend. `recoveryToken` may be a decoy (see the header),
  // which is precisely why nothing is rendered differently when it is.
  const [recoveryToken, setRecoveryToken] = useState("");
  const [grantToken, setGrantToken] = useState("");
  const [username, setUsername] = useState("");
  const [maskedEmail, setMaskedEmail] = useState("");

  // The email ending. `newEmail` is what they typed; `emailCode` is the second code,
  // the one sent to that address to prove they can actually read it.
  const [newEmail, setNewEmail] = useState("");
  const [emailCode, setEmailCode] = useState("");

  // The one inline error line each screen shows, so a failure sits next to the
  // field it concerns instead of only in a toast that scrolls away.
  const [error, setError] = useState("");

  const passwordForm = useForm<ResetPasswordFormSchemaType>({
    resolver: zodResolver(ResetPasswordFormSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  // ── Step 1: name the account ───────────────────────────────────────────────
  function onIdentify(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    startTransition(async () => {
      try {
        const result = await startWhatsAppRecovery(identifier.trim());
        setRecoveryToken(result.recovery_token);
        // Always forward, whatever the identifier was. See rule 1 in the header.
        setStep("code");
        toast.success(result.message);
      } catch (caught) {
        const body = recoveryErrorBody(caught, t("errors.generic"));
        setError(body.message);
      }
    });
  }

  // ── Step 2: prove the number ───────────────────────────────────────────────
  function onVerify(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    startTransition(async () => {
      try {
        const result = await verifyWhatsAppRecovery(recoveryToken, code.trim());
        setGrantToken(result.grant_token);
        setUsername(result.username);
        setMaskedEmail(result.current_email);
        // The proof is done. From here it is a fork, not a queue: the grant is
        // spent by whichever ending completes.
        setStep("choose");
        toast.success(result.message);
      } catch (caught) {
        const body = recoveryErrorBody(caught, t("errors.generic"));
        // attempts_left is surfaced so somebody can see they are running out
        // before the fifth wrong try burns the code, not after.
        setError(
          typeof body.attempts_left === "number" && body.attempts_left > 0
            ? `${body.message} ${t("code.attemptsLeft", { count: body.attempts_left })}`
            : body.message,
        );
        setCode("");
      }
    });
  }

  // ── Step 3: set the new password ───────────────────────────────────────────
  function onReset(data: ResetPasswordFormSchemaType) {
    setError("");
    startTransition(async () => {
      try {
        const result = await resetPasswordWithWhatsApp(grantToken, data.password);
        toast.success(result.message);
        // Straight to sign-in, and NOT signed in: no session was issued, every
        // session on the account was just ended, and an account with two-step
        // sign-in still meets its second factor on that page.
        router.push("/login");
      } catch (caught) {
        setError(recoveryErrorBody(caught, t("errors.generic")).message);
      }
    });
  }

  // ── Step 3B part one: name the new address ─────────────────────────────────
  function onRequestEmail(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    startTransition(async () => {
      try {
        const result = await requestEmailChangeWithWhatsApp(grantToken, newEmail.trim());
        setStep("emailCode");
        toast.success(result.message);
      } catch (caught) {
        // Covers the 409 for an account with two-step sign-in as well as the
        // ordinary 400s. The backend's sentence is shown verbatim because it is
        // the one that names what the user can still do instead.
        setError(recoveryErrorBody(caught, t("errors.generic")).message);
      }
    });
  }

  // ── Step 3B part two: prove the new address, and the account moves ─────────
  function onConfirmEmail(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    startTransition(async () => {
      try {
        const result = await confirmEmailChangeWithWhatsApp(grantToken, emailCode.trim());
        toast.success(result.message);
        // Same landing as the password ending, and for the same reason: nothing
        // here signs anybody in. They sign in at their new address with the
        // password they already had.
        router.push("/login");
      } catch (caught) {
        const body = recoveryErrorBody(caught, t("errors.generic"));
        setError(
          typeof body.attempts_left === "number" && body.attempts_left > 0
            ? `${body.message} ${t("code.attemptsLeft", { count: body.attempts_left })}`
            : body.message,
        );
        setEmailCode("");
      }
    });
  }

  /** Leave an ending and go back to the fork. Nothing has been spent, so this is free. */
  function backToChoice() {
    setStep("choose");
    setError("");
  }

  // Shared inline error line. Rendered as an alert so a screen reader announces
  // it when it appears rather than leaving it as decoration next to the field.
  const errorLine = error ? (
    <p role="alert" className="text-sm text-destructive">
      {error}
    </p>
  ) : null;

  // Which account this is about to change. An in-game name is easy to mistype into
  // a real stranger's account, so every screen after the proof shows it: this is
  // the last moment anybody can notice before something is written. `label`
  // changes because the same card fronts two different endings.
  const accountCard = (label: string) =>
    username ? (
      <div className="rounded-md border bg-card p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium break-all">{username}</p>
        {maskedEmail ? (
          <p className="text-xs text-muted-foreground break-all">{maskedEmail}</p>
        ) : null}
      </div>
    ) : null;

  // The way out for anyone this flow cannot serve: no number saved, a number they
  // no longer use, or two-step sign-in blocking the email move. Same /contact route
  // the login and forgot-password pages already point at.
  const supportLine = (
    <p className="text-center text-sm">
      <span className="text-muted-foreground">{t("password.stuck")} </span>
      <Link href="/contact" className="text-primary hover:underline">
        {t("password.contactSupport")}
      </Link>
    </p>
  );

  // ── Screen 1 ───────────────────────────────────────────────────────────────
  if (step === "identify") {
    return (
      <form onSubmit={onIdentify} className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="recovery-identifier">{t("identify.label")}</Label>
          <Input
            id="recovery-identifier"
            className="bg-input border-border"
            placeholder={t("identify.placeholder")}
            autoComplete="username"
            value={identifier}
            onChange={(event) => setIdentifier(event.target.value)}
            required
          />
          <p className="text-xs text-muted-foreground">{t("identify.hint")}</p>
          {errorLine}
        </div>
        <Button
          className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
          type="submit"
          disabled={pending || !identifier.trim()}
        >
          {pending ? <Loader text={t("identify.sending")} /> : t("identify.submit")}
        </Button>

        {/* THE HONEST STATEMENT OF REACH, said before somebody spends time here
            rather than after they have failed. Only about 116 of 6,809 accounts
            have a WhatsApp number saved, so for most people this page cannot work
            at all and support is the real answer. It sits under the button because
            it is a fallback, not a warning: the people it is for are the ones who
            are about to get the generic "if that account has a number saved"
            message and would otherwise sit waiting for a code that is never
            coming. Remove this line only when capture has actually moved. */}
        <p className="text-center text-sm">
          <span className="text-muted-foreground">{t("identify.reach")} </span>
          <Link href="/contact" className="text-primary hover:underline">
            {t("password.contactSupport")}
          </Link>
        </p>
      </form>
    );
  }

  // ── Screen 2 ───────────────────────────────────────────────────────────────
  if (step === "code") {
    return (
      <form onSubmit={onVerify} className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="recovery-code">{t("code.label")}</Label>
          <Input
            id="recovery-code"
            className="bg-input border-border"
            // inputMode numeric + autocomplete one-time-code: on a phone this
            // brings up the number pad and lets the OS offer the code it can see.
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder={t("code.placeholder")}
            value={code}
            onChange={(event) => setCode(event.target.value)}
            required
          />
          <p className="text-xs text-muted-foreground">{t("code.hint")}</p>
          {errorLine}
        </div>
        <Button
          className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
          type="submit"
          disabled={pending || code.trim().length < 6}
        >
          {pending ? <Loader text={t("code.checking")} /> : t("code.submit")}
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="w-full"
          onClick={() => {
            setStep("identify");
            setCode("");
            setError("");
          }}
        >
          {t("code.back")}
        </Button>
      </form>
    );
  }

  // ── Screen 3: the fork ─────────────────────────────────────────────────────
  // The number is proved. Two things can be fixed from here, and picking one
  // spends the proof, so this is a fork rather than a menu to work through.
  if (step === "choose") {
    return (
      <div className="space-y-6">
        {accountCard(t("choose.provedFor"))}

        <p className="text-sm text-muted-foreground">{t("choose.intro")}</p>

        <div className="space-y-3">
          {/* The ordinary case, and the priority: listed first and styled as the
              primary action, because most people arriving here have simply
              forgotten their password. */}
          <Button
            type="button"
            className="h-auto w-full flex-col items-start gap-1 whitespace-normal bg-primary px-4 py-3 text-left text-primary-foreground hover:bg-primary/90"
            onClick={() => {
              setStep("password");
              setError("");
            }}
          >
            <span className="text-sm font-semibold">{t("choose.passwordTitle")}</span>
            <span className="text-xs font-normal opacity-90">{t("choose.passwordBody")}</span>
          </Button>

          {/* The genuinely NEW capability on this page, so it wears the dated tag:
              a returning user would not otherwise notice that the email move is
              now self-serve. It expires by itself five days after 2026-08-08. */}
          <Button
            type="button"
            variant="secondary"
            className="h-auto w-full flex-col items-start gap-1 whitespace-normal px-4 py-3 text-left"
            onClick={() => {
              setStep("email");
              setError("");
            }}
          >
            <span className="flex flex-wrap items-center gap-2 text-sm font-semibold">
              {t("choose.emailTitle")}
              <NewBadge since="2026-08-08" />
            </span>
            <span className="text-xs font-normal text-muted-foreground">
              {t("choose.emailBody")}
            </span>
          </Button>
        </div>

        {/* Says out loud that this is one-or-the-other, so nobody picks the wrong
            one expecting to come back for the other afterwards. */}
        <p className="text-xs text-muted-foreground">{t("choose.oneOnly")}</p>

        {supportLine}
      </div>
    );
  }

  // ── Screen 4A: name the new address ────────────────────────────────────────
  if (step === "email") {
    return (
      <form onSubmit={onRequestEmail} className="space-y-6">
        {accountCard(t("email.changingFor"))}

        <div className="space-y-2">
          <Label htmlFor="recovery-new-email">{t("email.label")}</Label>
          <Input
            id="recovery-new-email"
            className="bg-input border-border"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder={t("email.placeholder")}
            value={newEmail}
            onChange={(event) => setNewEmail(event.target.value)}
            required
          />
          <p className="text-xs text-muted-foreground">{t("email.hint")}</p>
          {errorLine}
        </div>

        <Button
          className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
          type="submit"
          disabled={pending || !newEmail.trim()}
        >
          {pending ? <Loader text={t("email.sending")} /> : t("email.submit")}
        </Button>

        <Button type="button" variant="ghost" className="w-full" onClick={backToChoice}>
          {t("email.back")}
        </Button>

        {supportLine}
      </form>
    );
  }

  // ── Screen 4B: prove the new address ───────────────────────────────────────
  if (step === "emailCode") {
    return (
      <form onSubmit={onConfirmEmail} className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="recovery-email-code">{t("emailCode.label")}</Label>
          <Input
            id="recovery-email-code"
            className="bg-input border-border"
            // Same phone affordances as the WhatsApp code screen: number pad, and
            // the OS can offer a code it can see.
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder={t("code.placeholder")}
            value={emailCode}
            onChange={(event) => setEmailCode(event.target.value)}
            required
          />
          {/* Names the address the code went to, which is the whole point of this
              screen: if it is wrong, this is the moment to go back and fix it,
              before the account moves onto an inbox nobody can open. */}
          <p className="text-xs text-muted-foreground break-all">
            {t("emailCode.hint", { email: newEmail.trim() })}
          </p>
          {errorLine}
        </div>

        <Button
          className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
          type="submit"
          disabled={pending || emailCode.trim().length < 6}
        >
          {pending ? <Loader text={t("emailCode.saving")} /> : t("emailCode.submit")}
        </Button>

        <Button
          type="button"
          variant="ghost"
          className="w-full"
          onClick={() => {
            // Back to the ADDRESS screen, not the fork: the likeliest reason to be
            // here without a code is a typo in the address they just typed.
            setStep("email");
            setEmailCode("");
            setError("");
          }}
        >
          {t("emailCode.back")}
        </Button>
      </form>
    );
  }

  // ── Screen 4C: the password ending ─────────────────────────────────────────
  return (
    <Form {...passwordForm}>
      <form onSubmit={passwordForm.handleSubmit(onReset)} className="space-y-6">
        {accountCard(t("password.resettingFor"))}

        <PasswordFields form={passwordForm} />

        <p className="text-xs text-muted-foreground">{t("password.hint")}</p>

        {errorLine}

        <Button
          className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
          type="submit"
          disabled={pending}
        >
          {pending ? <Loader text={t("password.saving")} /> : t("password.submit")}
        </Button>

        <Button type="button" variant="ghost" className="w-full" onClick={backToChoice}>
          {t("password.back")}
        </Button>

        {supportLine}
      </form>
    </Form>
  );
}
