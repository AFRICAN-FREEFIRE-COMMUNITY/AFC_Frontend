"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { toast } from "sonner";
import axios from "axios";
import { env } from "@/lib/env";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Logo } from "@/components/Logo";
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
import { Loader } from "@/components/Loader";
import { useTranslations } from "next-intl";

const FormSchema = z.object({
  email: z.string().email({ message: "Please enter a valid email address" }),
});

type FormSchemaType = z.infer<typeof FormSchema>;

export default function EnterEmailPage() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  // Auth namespace: messages/en/auth.json (enterEmail.* keys). Drives the
  // heading, description, email field, submit button, and resend-code toasts.
  const t = useTranslations("auth");

  const form = useForm<FormSchemaType>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      email: "",
    },
  });

  function onSubmit(data: FormSchemaType) {
    startTransition(async () => {
      try {
        // Resend verification code to this email
        const response = await axios.post(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/auth/resend-verification-code/`,
          { email: data.email }
        );

        toast.success(response.data.message || t("enterEmail.successSent"));
        // Redirect to confirmation page with email
        router.push(
          `/email-confirmation?email=${encodeURIComponent(data.email)}`
        );
      } catch (error: any) {
        toast.error(
          error?.response?.data?.error ||
            error?.response?.data?.message ||
            t("enterEmail.failed")
        );
      }
    });
  }

  return (
    <div>
      <h1 className="text-2xl md:text-3xl font-semibold text-primary mb-2 text-center">
        {t("enterEmail.heading")}
      </h1>
      <p className="text-muted-foreground text-center text-base mb-8">
        {t("enterEmail.description")}
      </p>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("enterEmail.emailLabel")}</FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    placeholder={t("enterEmail.emailPlaceholder")}
                    className="bg-input border-border"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button className="w-full" type="submit" disabled={pending}>
            {pending ? (
              <Loader text={t("enterEmail.sending")} />
            ) : (
              t("enterEmail.submit")
            )}
          </Button>
        </form>
      </Form>
    </div>
  );
}
