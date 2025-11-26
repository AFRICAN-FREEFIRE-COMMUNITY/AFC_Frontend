"use client";

import type React from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  EmailConfirmationFormSchema,
  EmailConfirmationFormSchemaType,
} from "@/lib/zodSchemas";
import { useEffect, useTransition } from "react";
import axios from "axios";
import { env } from "@/lib/env";
import { Loader } from "@/components/Loader";
import { OTPInput, SlotProps } from "input-otp";
import { cn } from "@/lib/utils";

interface Props {
  email: string;
}

export function ConfirmationForm({ email }: Props) {
  const router = useRouter();

  const [pending, startTransition] = useTransition();
  const [pendingResend, startResendTransition] = useTransition();

  useEffect(() => {
    if (!email) router.push(`/email-confirmation/enter-email`);
  }, [email, router]);

  const form = useForm<EmailConfirmationFormSchemaType>({
    resolver: zodResolver(EmailConfirmationFormSchema),
    defaultValues: {
      email,
      code: "",
    },
  });

  function onSubmit(data: EmailConfirmationFormSchemaType) {
    startTransition(async () => {
      try {
        const response = await axios.post(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/auth/verify-code/`,
          { ...data }
        );

        toast.success(response.data.message);
        router.push(`/login`);
      } catch (error: any) {
        toast.error(error?.response?.data?.error || "Internal server error");
      }
    });
  }

  const handleResendCode = () => {
    startResendTransition(async () => {
      try {
        const response = await axios.post(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/auth/resend-verification-code/`,
          { email }
        );

        toast.success(response.data.message);
      } catch (error: any) {
        toast.error(error?.response?.data?.error || "Internal server error");
      }
    });
  };

  return (
    <>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* <FormField
            control={form.control}
            name="code"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <Input placeholder="Enter confirmation code" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          /> */}
          <FormField
            control={form.control}
            name="code"
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
          <div className="grid gap-2">
            <Button
              className="w-full"
              type="submit"
              disabled={pending || pendingResend}
            >
              {pending ? <Loader text="Confirming..." /> : "Confirm Email"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="w-full"
              onClick={handleResendCode}
              disabled={pendingResend || pending}
            >
              {pendingResend ? (
                <Loader text="Sending..." />
              ) : (
                "Resend confirmation code"
              )}
            </Button>
          </div>
        </form>
      </Form>
      <div className="mt-4 text-center"></div>
    </>
  );
}

function Slot(props: SlotProps) {
  return (
    <div
      className={cn(
        "border-input bg-muted text-foreground flex size-14 items-center justify-center rounded-md border font-medium shadow-xs transition-[color,box-shadow]",
        { "border-ring ring-ring/50 z-10 ring-[1px]": props.isActive }
      )}
    >
      {props.char !== null && <div>{props.char}</div>}
    </div>
  );
}
