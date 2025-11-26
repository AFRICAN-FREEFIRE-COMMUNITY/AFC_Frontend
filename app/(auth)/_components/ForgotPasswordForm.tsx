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
  ForgotPasswordFormSchema,
  ForgotPasswordFormSchemaType,
} from "@/lib/zodSchemas";

export function ForgotPasswordForm() {
  const router = useRouter();

  const [pending, startTransition] = useTransition();
  const form = useForm<ForgotPasswordFormSchemaType>({
    resolver: zodResolver(ForgotPasswordFormSchema),
    defaultValues: {
      email: "",
    },
  });

  function onSubmit(data: ForgotPasswordFormSchemaType) {
    startTransition(async () => {
      try {
        const response = await axios.post(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/auth/send-verification-token/`,
          { ...data }
        );

        if (response.statusText === "OK") {
          toast.success(response.data.message);
          router.push(`/verify-token?email=${data.email}`);
        } else {
          toast.error("Oops! An error occurred");
        }
      } catch (error: any) {
        toast.error(error?.response?.data?.error || "Internal server error");
        return;
      }
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input
                  className="bg-input border-border"
                  type="email"
                  placeholder="Enter your email"
                  {...field}
                />
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
          {pending ? <Loader text="Sending..." /> : "Send Reset Instructions"}
        </Button>
      </form>
    </Form>
  );
}
