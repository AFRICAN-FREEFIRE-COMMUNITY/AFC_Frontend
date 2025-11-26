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

function LoginFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated } = useAuth();

  const { login } = useAuth();
  const redirectUrl = searchParams.get("redirect");

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
    if (isAuthenticated) return router.push("/home");
  }, [router]);

  function onSubmit(data: LoginFormSchemaType) {
    startTransition(async () => {
      try {
        const response = await axios.post(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/auth/login/`,
          { ...data }
        );

        if (response.statusText === "OK") {
          // Wait for login to complete (including fetching user data)
          await login(response.data.session_token);

          toast.success(response.data.message);

          // Small delay to ensure auth state is fully updated
          setTimeout(() => {
            // Redirect to the URL they came from, or default to /home
            // Use replace to avoid adding login page to history
            if (redirectUrl) {
              router.replace(redirectUrl);
            } else {
              router.push("/home");
            }
          }, 100);
        } else {
          toast.error("Oops! An error occurred");
        }
      } catch (error: any) {
        if (error.response?.status === 403) {
          // User hasn't confirmed their email
          const email = data.ign_or_uid.includes("@") ? data.ign_or_uid : "";
          toast.info("Please confirm your email to continue");

          // Redirect to email confirmation with email parameter
          if (email) {
            router.push(
              `/email-confirmation?email=${encodeURIComponent(email)}`
            );
          } else {
            // If they logged in with IGN/UID, redirect to a page to enter email
            router.push(`/email-confirmation/enter-email`);
          }
        } else {
          toast.error(
            error?.response?.data?.message || "Internal server error"
          );
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
              <FormLabel>In-game Name or UID</FormLabel>
              <FormControl>
                <Input
                  className="bg-input border-border"
                  placeholder="Enter your in-game name or UID"
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
              <FormLabel>Password</FormLabel>
              <FormControl>
                <div className="relative">
                  <Input
                    type={isVisible ? "text" : "password"}
                    className="bg-input border-border"
                    placeholder="Enter your password"
                    {...field}
                  />
                  <Button
                    className="absolute top-[50%] translate-y-[-50%] end-1 text-muted-foreground/80"
                    variant={"ghost"}
                    size="icon"
                    type="button"
                    onClick={toggleVisibility}
                    aria-label={isVisible ? "Hide password" : "Show password"}
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
          {pending ? <Loader text="Authenticating..." /> : "Login"}
        </Button>
      </form>
    </Form>
  );
}

export function LoginForm() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-8">
          <Loader text="Loading..." />
        </div>
      }
    >
      <LoginFormContent />
    </Suspense>
  );
}
