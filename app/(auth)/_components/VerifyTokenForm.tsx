"use client";

import React, { useTransition, useState, useEffect, useRef } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import { env } from "@/lib/env";
import axios from "axios";
import { Loader } from "@/components/Loader";
import {
  VerifyTokenFormSchema,
  VerifyTokenFormSchemaType,
} from "@/lib/zodSchemas";
import { OTPInput, SlotProps } from "input-otp";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

interface Props {
  identifier: string;
  method: "email" | "uid";
}

export function VerifyTokenForm({ identifier, method }: Props) {
  const router = useRouter();

  // Auth namespace: messages/en/auth.json (verifyToken.* keys). Drives the
  // submit/resend buttons, cooldown label, and verify/resend toasts.
  const t = useTranslations("auth");
  const [pending, startTransition] = useTransition();
  const [pendingResend, startResendTransition] = useTransition();
  const [resendCooldown, setResendCooldown] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    timerRef.current = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current!);
  }, [resendCooldown > 0]);

  const form = useForm<VerifyTokenFormSchemaType>({
    resolver: zodResolver(VerifyTokenFormSchema),
    defaultValues: {
      token: "",
      email: method === "email" ? identifier : "",
    },
  });

  const handleResendToken = async () => {
    startResendTransition(async () => {
      try {
        const payload =
          method === "email" ? { email: identifier } : { uid: identifier };
        const response = await axios.post(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/auth/resend-token/`,
          payload
        );
        if (response.statusText === "OK") {
          toast.success(response.data.message);
          setResendCooldown(300);
        } else {
          toast.error(t("verifyToken.genericError"));
        }
      } catch (error: any) {
        toast.error(
          error?.response?.data?.message ||
            t("verifyToken.internalServerError")
        );
      }
    });
  };

  const formatCooldown = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  function onSubmit(data: VerifyTokenFormSchemaType) {
    startTransition(async () => {
      try {
        const payload =
          method === "email"
            ? { token: data.token, email: identifier }
            : { token: data.token, uid: identifier };

        const response = await axios.post(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/auth/verify-token/`,
          payload
        );

        if (response.statusText === "OK") {
          toast.success(
            t("verifyToken.successRedirecting", {
              message: response.data.message,
            })
          );
          const param =
            method === "email"
              ? `email=${encodeURIComponent(identifier)}`
              : `uid=${encodeURIComponent(identifier)}`;
          router.push(`/reset-password?${param}&token=${data.token}`);
        } else {
          toast.error(t("verifyToken.genericError"));
        }
      } catch (error: any) {
        toast.error(
          error?.response?.data?.message ||
            t("verifyToken.internalServerError")
        );
      }
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="token"
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <OTPInput
                  {...field}
                  containerClassName="flex items-center justify-center gap-3 has-disabled:opacity-50"
                  maxLength={6}
                  render={({ slots }) => (
                    <div className="flex gap-2">
                      {slots.map((slot, idx) => (
                        <Slot key={idx} {...slot} />
                      ))}
                    </div>
                  )}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid gap-4">
          <Button
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
            type="submit"
            disabled={pending || pendingResend}
          >
            {pending ? (
              <Loader text={t("verifyToken.verifying")} />
            ) : (
              t("verifyToken.submit")
            )}
          </Button>
          <Button
            type="button"
            className="w-full"
            variant={"secondary"}
            disabled={pendingResend || pending || resendCooldown > 0}
            onClick={handleResendToken}
          >
            {pendingResend ? (
              <Loader text={t("verifyToken.resending")} />
            ) : resendCooldown > 0 ? (
              t("verifyToken.resendCooldown", {
                time: formatCooldown(resendCooldown),
              })
            ) : (
              t("verifyToken.resend")
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}

function Slot(props: SlotProps) {
  return (
    <div
      className={cn(
        "border-input bg-background text-foreground flex size-14 items-center justify-center rounded-md border font-medium shadow-xs transition-[color,box-shadow]",
        { "border-ring ring-ring/50 z-10 ring-[1px]": props.isActive }
      )}
    >
      {props.char !== null && <div>{props.char}</div>}
    </div>
  );
}
