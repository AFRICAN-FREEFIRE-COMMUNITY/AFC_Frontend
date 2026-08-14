"use client";

// ─────────────────────────────────────────────────────────────────────────────
// app/(auth)/_components/PasswordFields.tsx
//
// The "choose a new password" pair of fields: the password box with the live
// strength meter and requirements list, and the confirm box. Both carry the
// show/hide eye toggle.
//
// WHY IT IS A COMPONENT RATHER THAN JSX IN ONE FORM
// AFC now sets a new password on TWO screens that reached the user by different
// doors, and the two must not drift:
//   • ResetPasswordForm.tsx    the emailed-token reset (/reset-password)
//   • RecoverAccountForm.tsx   the WhatsApp reset (/recover-account, 2026-08-08)
// The rule they enforce is the same one the BACKEND enforces in two places too
// (lib/zodSchemas.tsx ResetPasswordFormSchema, and
// backend/afc_auth/views_recovery.py _password_problem), so a copy of this markup
// per screen would be a fourth place for the requirement list to disagree with
// itself. A user told "at least 8 characters" on one screen and something else on
// the other has no way to tell which one is lying.
//
// It renders fields for whatever react-hook-form it is dropped into, so it takes
// the form object rather than owning one. Both callers use
// ResetPasswordFormSchema, which is what guarantees the `password` /
// `confirmPassword` names below exist.
//
// i18n: the `auth` namespace, reusing the keys the emailed reset already ships
// (resetPassword.passwordLabel / confirmPasswordLabel / passwordPlaceholder,
// passwordStrength.*, showHidePassword.*). Deliberately no new keys: the words
// are identical on both screens, so a second set would be a second thing to keep
// translated.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useMemo, useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import { CheckIcon, EyeIcon, EyeOffIcon, XIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { ResetPasswordFormSchemaType } from "@/lib/zodSchemas";

type Props = {
  /** Any form built on ResetPasswordFormSchema, so `password` + `confirmPassword` exist. */
  form: UseFormReturn<ResetPasswordFormSchemaType>;
};

export function PasswordFields({ form }: Props) {
  // Auth namespace: messages/en/auth.json. resetPassword.* labels the two fields,
  // passwordStrength.* powers the meter, showHidePassword.* labels the toggles.
  const t = useTranslations("auth");

  const password = form.watch("password");
  const [isVisible, setIsVisible] = useState<boolean>(false);
  const [isConfirmVisible, setConfirmIsVisible] = useState<boolean>(false);
  const toggleVisibility = () => setIsVisible((prevState) => !prevState);
  const toggleConfirmVisibility = () =>
    setConfirmIsVisible((prevState) => !prevState);

  const checkStrength = (pass: string) => {
    // These five mirror ResetPasswordFormSchema exactly. If one changes, both change:
    // the meter saying a password is fine while the resolver refuses it is worse than
    // having no meter.
    const requirements = [
      { regex: /.{8,}/, text: t("passwordStrength.req8Chars") },
      { regex: /[0-9]/, text: t("passwordStrength.req1Number") },
      { regex: /[a-z]/, text: t("passwordStrength.req1Lowercase") },
      { regex: /[A-Z]/, text: t("passwordStrength.req1Uppercase") },
      {
        regex: /[!@#$%^&*(),.?":{}|<>]/,
        text: t("passwordStrength.req1Special"),
      },
    ];

    return requirements.map((req) => ({
      met: req.regex.test(pass),
      text: req.text,
    }));
  };

  const strength = checkStrength(password);

  const strengthScore = useMemo(() => {
    return strength.filter((req) => req.met).length;
  }, [strength]);

  const getStrengthText = (score: number) => {
    if (score === 0) return t("passwordStrength.enterPassword");
    if (score <= 2) return t("passwordStrength.weak");
    if (score === 3) return t("passwordStrength.medium");
    return t("passwordStrength.strong");
  };

  return (
    <>
      <FormField
        control={form.control}
        name="password"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t("resetPassword.passwordLabel")}</FormLabel>
            <FormControl>
              <div className="relative">
                <Input
                  type={isVisible ? "text" : "password"}
                  // A new password, not the old one: tells a password manager to
                  // offer to generate and then save, instead of autofilling the
                  // password the user is here because they cannot use.
                  autoComplete="new-password"
                  placeholder={t("resetPassword.passwordPlaceholder")}
                  {...field}
                />
                <Button
                  className="absolute top-[50%] translate-y-[-50%] end-1 text-muted-foreground/80"
                  variant={"ghost"}
                  size="icon"
                  type="button"
                  onClick={toggleVisibility}
                  aria-label={
                    isVisible
                      ? t("showHidePassword.hide")
                      : t("showHidePassword.show")
                  }
                  aria-pressed={isVisible}
                  aria-controls="password"
                >
                  {isVisible ? (
                    <EyeOffIcon className="size-4" aria-hidden="true" />
                  ) : (
                    <EyeIcon className="size-4" aria-hidden="true" />
                  )}
                </Button>
              </div>
            </FormControl>
            <FormMessage />
            <div
              className={cn(
                password.length !== 0 ? "block mt-2 space-y-3" : "hidden"
              )}
            >
              <Progress
                value={(strengthScore / 5) * 100}
                className={cn("h-1")}
              />
              {/* Password strength description */}
              <p className="text-foreground mb-2 text-sm font-medium">
                {t("passwordStrength.mustContain", {
                  strength: getStrengthText(strengthScore),
                })}
              </p>

              {/* Password requirements list */}
              <ul
                className="space-y-1.5"
                aria-label={t("passwordStrength.requirementsLabel")}
              >
                {strength.map((req, index) => (
                  <li key={index} className="flex items-center gap-2">
                    {req.met ? (
                      <CheckIcon
                        size={16}
                        className="text-emerald-500"
                        aria-hidden="true"
                      />
                    ) : (
                      <XIcon
                        size={16}
                        className="text-muted-foreground/80"
                        aria-hidden="true"
                      />
                    )}
                    <span
                      className={`text-xs ${
                        req.met ? "text-emerald-600" : "text-muted-foreground"
                      }`}
                    >
                      {req.text}
                      <span className="sr-only">
                        {req.met
                          ? t("passwordStrength.requirementMet")
                          : t("passwordStrength.requirementNotMet")}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="confirmPassword"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t("resetPassword.confirmPasswordLabel")}</FormLabel>
            <FormControl>
              <div className="relative">
                <Input
                  type={isConfirmVisible ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder={t("resetPassword.passwordPlaceholder")}
                  {...field}
                />
                <Button
                  className="absolute top-[50%] translate-y-[-50%] end-1 text-muted-foreground/80"
                  variant={"ghost"}
                  size="icon"
                  type="button"
                  onClick={toggleConfirmVisibility}
                  aria-label={
                    isConfirmVisible
                      ? t("showHidePassword.hide")
                      : t("showHidePassword.show")
                  }
                  aria-pressed={isConfirmVisible}
                  aria-controls="password"
                >
                  {isConfirmVisible ? (
                    <EyeOffIcon className="size-4" aria-hidden="true" />
                  ) : (
                    <EyeIcon className="size-4" aria-hidden="true" />
                  )}
                </Button>
              </div>
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </>
  );
}
