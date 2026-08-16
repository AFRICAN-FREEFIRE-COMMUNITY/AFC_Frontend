"use client";

import React, { useTransition } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { env } from "@/lib/env";
import axios from "axios";
import {
  ResetPasswordFormSchema,
  ResetPasswordFormSchemaType,
} from "@/lib/zodSchemas";
import { Loader } from "@/components/Loader";
import { useTranslations } from "next-intl";
import { PasswordFields } from "./PasswordFields";

interface Props {
  identifier: string;
  method: "email" | "uid";
  token: string;
}

export function ResetPasswordForm({ identifier, method, token }: Props) {
  const router = useRouter();

  const [pending, startTransition] = useTransition();
  // Auth namespace: messages/en/auth.json. resetPassword.* drives the submit
  // button and the success toast; the two password fields, the strength meter and
  // the visibility toggles all live in PasswordFields, which reads its own keys
  // from the same namespace. That component is SHARED with the WhatsApp reset
  // (RecoverAccountForm.tsx) so both screens state one identical rule.
  const t = useTranslations("auth");

  const form = useForm<ResetPasswordFormSchemaType>({
    resolver: zodResolver(ResetPasswordFormSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });

  function onSubmit(data: ResetPasswordFormSchemaType) {
    startTransition(async () => {
      try {
        const authData =
          method === "email"
            ? { email: identifier, new_password: data.password, token }
            : { uid: identifier, new_password: data.password, token };
        const response = await axios.post(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/auth/reset-password/`,
          { ...authData }
        );

        toast.success(
          t("resetPassword.successRedirecting", {
            message: response.data.message,
          })
        );
        router.push(`/login`);
      } catch (error: any) {
        toast.error(
          error?.response?.data?.error ||
            t("resetPassword.internalServerError")
        );
        return;
      }
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <PasswordFields form={form} />
        <Button
          className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
          type="submit"
          disabled={pending}
        >
          {pending ? (
            <Loader text={t("resetPassword.resetting")} />
          ) : (
            t("resetPassword.submit")
          )}
        </Button>
      </form>
    </Form>
  );
}
