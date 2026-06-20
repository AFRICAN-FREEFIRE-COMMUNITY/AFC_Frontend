"use client";

import React, { Suspense, useEffect, useState, useTransition } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { env } from "@/lib/env";
import axios from "axios";
import { LoginFormSchema, LoginFormSchemaType } from "@/lib/zodSchemas";
import { EyeIcon, EyeOffIcon } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Loader } from "@/components/Loader";
import { useTranslations } from "next-intl";
// "Continue with Google" (owner 2026-06-20). Renders nothing unless
// NEXT_PUBLIC_GOOGLE_CLIENT_ID is configured, so password login is unaffected.
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";

function LoginFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, user, login } = useAuth();
  const redirectUrl = searchParams.get("redirect");
  // Auth namespace: messages/en/auth.json (login.* keys). Powers field labels,
  // placeholders, the submit button, and every sonner toast surfaced here.
  const t = useTranslations("auth");

  const [pending, startTransition] = useTransition();
  const [isVisible, setIsVisible] = useState<boolean>(false);
  const toggleVisibility = () => setIsVisible((prevState) => !prevState);

  const form = useForm<LoginFormSchemaType>({
    resolver: zodResolver(LoginFormSchema),
    defaultValues: {
      ign_or_uid: "",
      password: "",
    },
  });

  useEffect(() => {
    if (!isAuthenticated || !user) return;
    // Return the user to where they were. Priority: an explicit ?redirect= param, then the page
    // stashed when their session expired (owner 2026-06-15: "take me back to where I was" after a
    // timeout re-login — set by AuthContext.stashPostLoginRedirect, consumed + cleared here), then
    // /home as the default.
    let target = redirectUrl;
    if (!target) {
      try {
        const stashed = sessionStorage.getItem("afc_post_login_redirect");
        if (stashed) {
          sessionStorage.removeItem("afc_post_login_redirect");
          target = stashed;
        }
      } catch {}
    }
    if (target) {
      router.replace(target);
    } else {
      router.push("/home");
    }
  }, [isAuthenticated, user, router, redirectUrl]);

  function onSubmit(data: LoginFormSchemaType) {
    startTransition(async () => {
      try {
        const response = await axios.post(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/auth/login/`,
          { ...data },
        );

        if (response.statusText === "OK") {
          await login(response.data.session_token);
          toast.success(response.data.message);
          // redirect is handled by the useEffect above once auth state updates
        } else {
          toast.error(t("login.genericError"));
        }
      } catch (error: any) {
        if (error.response?.status === 403) {
          // User hasn't confirmed their email
          const email = data.ign_or_uid.includes("@") ? data.ign_or_uid : "";
          toast.info(t("login.confirmEmailInfo"));

          // Redirect to email confirmation with email parameter
          if (email) {
            router.push(
              `/email-confirmation?email=${encodeURIComponent(email)}`,
            );
          } else {
            // If they logged in with IGN/UID, redirect to a page to enter email
            router.push(`/email-confirmation/enter-email`);
          }
        } else {
          toast.error(error?.response?.data?.message || t("login.failed"));
          return;
        }
      }
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="ign_or_uid"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("login.identifierLabel")}</FormLabel>
              <FormControl>
                <Input
                  className="bg-input border-border"
                  placeholder={t("login.identifierPlaceholder")}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("login.passwordLabel")}</FormLabel>
              <FormControl>
                <div className="relative">
                  <Input
                    type={isVisible ? "text" : "password"}
                    className="bg-input border-border"
                    placeholder={t("login.passwordPlaceholder")}
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
            </FormItem>
          )}
        />
        <Button
          className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
          type="submit"
          disabled={pending}
        >
          {pending ? <Loader text={t("login.loading")} /> : t("login.submit")}
        </Button>
      </form>
      <GoogleSignInButton />
    </Form>
  );
}

export function LoginForm() {
  // Suspense fallback: this boundary renders before LoginFormContent mounts, so
  // useTranslations is not available here. We use the shared Loader without an
  // explicit label (it falls back to its built-in default); the localized form
  // copy appears the instant the content mounts.
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-8">
          <Loader />
        </div>
      }
    >
      <LoginFormContent />
    </Suspense>
  );
}
