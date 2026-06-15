"use client";

import { useMemo, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
// i18n: user-visible copy (labels, placeholders, validation messages, toasts) is
// sourced from the `profile` namespace (messages/en/profile.json). The schema is
// built inside the component so its validation messages can be translated too.
import { useTranslations } from "next-intl";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  IconCheck,
  IconEye,
  IconEyeOff,
  IconLock,
  IconX,
} from "@tabler/icons-react";
import { toast } from "sonner";
import { Loader } from "@/components/Loader";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import axios from "axios";
import { env } from "@/lib/env";
import { useAuth } from "@/contexts/AuthContext";

// FormValues is derived from the schema shape (which never changes, only its
// messages do), so a static type is safe even though the schema is built per-render.
type FormValues = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

export const PasswordForm = () => {
  const t = useTranslations("profile");
  const [pending, startTransition] = useTransition();

  const { token } = useAuth();

  // Schema built inside the component so its validation messages can be translated.
  // Memoized on `t` so it is only rebuilt when the locale (and thus `t`) changes.
  const schema = useMemo(
    () =>
      z
        .object({
          currentPassword: z
            .string()
            .min(1, t("password.validation.currentRequired")),
          newPassword: z
            .string()
            .min(8, t("password.validation.minLength")),
          confirmPassword: z
            .string()
            .min(1, t("password.validation.confirmRequired")),
        })
        .refine((data) => data.newPassword === data.confirmPassword, {
          message: t("password.validation.mismatch"),
          path: ["confirmPassword"],
        }),
    [t],
  );

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  const currentPassword = form.watch("currentPassword");
  const password = form.watch("newPassword");
  const [isVisible, setIsVisible] = useState<boolean>(false);
  const [isConfirmVisible, setConfirmIsVisible] = useState<boolean>(false);
  const [isCurrentVisible, setCurrentIsVisible] = useState<boolean>(false);
  const toggleVisibility = () => setIsVisible((prevState) => !prevState);
  const toggleCurrentVisibility = () =>
    setCurrentIsVisible((prevState) => !prevState);

  const toggleConfirmVisibility = () =>
    setConfirmIsVisible((prevState) => !prevState);

  const checkStrength = (pass: string) => {
    const requirements = [
      { regex: /.{8,}/, text: t("password.requirement.minLength") },
      { regex: /[0-9]/, text: t("password.requirement.number") },
      { regex: /[a-z]/, text: t("password.requirement.lowercase") },
      { regex: /[A-Z]/, text: t("password.requirement.uppercase") },
      {
        regex: /[!@#$%^&*(),.?":{}|<>]/,
        text: t("password.requirement.special"),
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
    if (score === 0) return t("password.strength.enter");
    if (score <= 2) return t("password.strength.weak");
    if (score === 3) return t("password.strength.medium");
    return t("password.strength.strong");
  };

  const onSubmit = (values: FormValues) => {
    startTransition(async () => {
      try {
        const data = {
          current_password: values.currentPassword,
          new_password: values.newPassword,
        };
        await axios.post(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/auth/change-password/`,
          { ...data },
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );
        // axios rejects on non-2xx, so reaching here means the change succeeded.
        // Give the user explicit confirmation and clear the form (this feedback
        // was previously commented out, leaving the success path silent).
        toast.success(t("password.changed"));
        form.reset();
      } catch (err: any) {
        const message =
          err?.response?.data?.message ?? t("password.changeFailed");
        toast.error(Array.isArray(message) ? message[0] : message);
      }
    });
  };

  return (
    <Card>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="currentPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("password.currentPassword")}</FormLabel>
                  <div className="relative">
                    <Input
                      placeholder={t("password.currentPasswordPlaceholder")}
                      {...field}
                      type={isCurrentVisible ? "text" : "password"}
                    />
                    <Button
                      className="absolute top-[50%] translate-y-[-50%] end-1 text-muted-foreground/80"
                      variant={"ghost"}
                      size="icon"
                      type="button"
                      onClick={toggleCurrentVisibility}
                      aria-label={
                        isCurrentVisible
                          ? t("password.hidePassword")
                          : t("password.showPassword")
                      }
                      aria-pressed={isCurrentVisible}
                      aria-controls="password"
                    >
                      {isCurrentVisible ? (
                        <IconEyeOff className="size-4" aria-hidden="true" />
                      ) : (
                        <IconEye className="size-4" aria-hidden="true" />
                      )}
                    </Button>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="newPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("password.newPassword")}</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        className="pe-9"
                        placeholder={t("password.newPasswordPlaceholder")}
                        type={isVisible ? "text" : "password"}
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
                            ? t("password.hidePassword")
                            : t("password.showPassword")
                        }
                        aria-pressed={isVisible}
                        aria-controls="password"
                      >
                        {isVisible ? (
                          <IconEyeOff className="size-4" aria-hidden="true" />
                        ) : (
                          <IconEye className="size-4" aria-hidden="true" />
                        )}
                      </Button>
                    </div>
                  </FormControl>
                  <FormMessage />
                  <div
                    className={cn(
                      password.length !== 0 ? "block mt-2 space-y-3" : "hidden",
                    )}
                  >
                    <Progress
                      value={(strengthScore / 5) * 100}
                      className={cn("h-1")}
                    />
                    {/* Password strength description */}
                    <p className="text-foreground mb-2 text-sm font-medium">
                      {t("password.mustContain", {
                        strength: getStrengthText(strengthScore),
                      })}
                    </p>

                    {/* Password requirements list */}
                    <ul
                      className="space-y-1.5"
                      aria-label={t("password.requirementsLabel")}
                    >
                      {strength.map((req, index) => (
                        <li key={index} className="flex items-center gap-2">
                          {req.met ? (
                            <IconCheck
                              size={16}
                              className="text-emerald-500"
                              aria-hidden="true"
                            />
                          ) : (
                            <IconX
                              size={16}
                              className="text-muted-foreground/80"
                              aria-hidden="true"
                            />
                          )}
                          <span
                            className={`text-xs ${
                              req.met
                                ? "text-emerald-600"
                                : "text-muted-foreground"
                            }`}
                          >
                            {req.text}
                            <span className="sr-only">
                              {req.met
                                ? t("password.requirementMet")
                                : t("password.requirementNotMet")}
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
                  <FormLabel>{t("password.confirmPassword")}</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        type={isConfirmVisible ? "text" : "password"}
                        placeholder={t("password.confirmPasswordPlaceholder")}
                        {...field}
                      />
                      <Button
                        className="absolute top-[50%] translate-y-[-50%] end-1 text-muted-foreground/80"
                        variant={"ghost"}
                        size="icon"
                        type="button"
                        onClick={toggleConfirmVisibility}
                        // FIX: Use isConfirmVisible for accessibility label
                        aria-label={
                          isConfirmVisible
                            ? t("password.hidePassword")
                            : t("password.showPassword")
                        }
                        aria-pressed={isConfirmVisible}
                        aria-controls="password"
                      >
                        {isConfirmVisible ? ( // FIX: Use isConfirmVisible for icon
                          <IconEyeOff className="size-4" aria-hidden="true" />
                        ) : (
                          <IconEye className="size-4" aria-hidden="true" />
                        )}
                      </Button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? (
                <Loader text={t("password.updating")} />
              ) : (
                t("password.updatePassword")
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
};
