"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { toast } from "sonner";
import axios from "axios";
import { env } from "@/lib/env";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Loader } from "@/components/Loader";

const FormSchema = z.object({
  email: z.string().email({ message: "Please enter a valid email address" }),
});

type FormSchemaType = z.infer<typeof FormSchema>;

export default function EnterEmailPage() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

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

        toast.success(response.data.message || "Verification code sent!");
        // Redirect to confirmation page with email
        router.push(`/email-confirmation?email=${encodeURIComponent(data.email)}`);
      } catch (error: any) {
        toast.error(
          error?.response?.data?.error ||
          error?.response?.data?.message ||
          "Failed to send verification code"
        );
      }
    });
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="flex justify-center mb-4">
            <Logo size="large" />
          </div>
          <CardTitle className="text-2xl text-center">
            Email Verification Required
          </CardTitle>
          <CardDescription className="text-center">
            Please enter your email address to receive a verification code
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email Address</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="Enter your email"
                        className="bg-input border-border"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button
                className="w-full"
                type="submit"
                disabled={pending}
              >
                {pending ? <Loader text="Sending..." /> : "Send Verification Code"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
