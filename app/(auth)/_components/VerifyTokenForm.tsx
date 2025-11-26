"use client";

import React, { useState, useTransition } from "react";
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
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { env } from "@/lib/env";
import axios from "axios";
import { Loader } from "@/components/Loader";
import {
  VerifyTokenFormSchema,
  VerifyTokenFormSchemaType,
} from "@/lib/zodSchemas";
import { OTPInput, SlotProps } from "input-otp";
import { cn } from "@/lib/utils";

interface Props {
  email: string;
}

export function VerifyTokenForm({ email }: Props) {
  const router = useRouter();

  const [pending, startTransition] = useTransition();
  const [pendingResend, startResendTransition] = useTransition();
  const form = useForm<VerifyTokenFormSchemaType>({
    resolver: zodResolver(VerifyTokenFormSchema),
    defaultValues: {
      token: "",
      email,
    },
  });

  const handleResendToken = async () => {
    startResendTransition(async () => {
      try {
        const response = await axios.post(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/auth/resend-token/`,
          { email }
        );

        if (response.statusText === "OK") {
          toast.success(response.data.message);
        } else {
          toast.error("Oops! An error occurred");
        }
      } catch (error: any) {
        toast.error(error?.response?.data?.message || "Internal server error");
        return;
      }
    });
  };

  function onSubmit(data: VerifyTokenFormSchemaType) {
    startTransition(async () => {
      try {
        const response = await axios.post(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/auth/verify-token/`,
          { ...data }
        );

        if (response.statusText === "OK") {
          toast.success(`${response.data.message}. Redirecting...`);
          router.push(`/reset-password?email=${email}&token=${data.token}`);
        } else {
          toast.error("Oops! An error occurred");
        }
      } catch (error: any) {
        toast.error(error?.response?.data?.message || "Internal server error");
        return;
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
            {pending ? <Loader text="Verifying..." /> : "Verify token"}
          </Button>
          <Button
            type="button"
            className="w-full"
            variant={"secondary"}
            disabled={pendingResend || pending}
            onClick={handleResendToken}
          >
            {pendingResend ? <Loader text="Resending..." /> : "Resend token"}
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
