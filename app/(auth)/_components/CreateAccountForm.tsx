"use client";

import React, { useEffect, useMemo, useState, useTransition } from "react";
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
import { RegisterFormSchema, RegisterFormSchemaType } from "@/lib/zodSchemas";
import { Loader } from "@/components/Loader";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { countries } from "@/constants";
import { CheckIcon, EyeIcon, EyeOffIcon, XIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
// Import Checkbox component (ASSUMED PATH/COMPONENT)
import { Checkbox } from "@/components/ui/checkbox";
import Link from "next/link"; // Required for linking to legal pages

// Prevent paste on specific inputs to block fancy unicode characters
const preventPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
  e.preventDefault();
};

// ── Draft persistence (sessionStorage) ──
// We persist the NON-SECRET fields of the create-account form so that navigating
// back/forward, or an accidental reload, does not wipe what the user typed. This is the
// other half of the abandoned-signup fix: the backend now lets a user retry with the same
// in-game name, and the frontend keeps their data so the retry is one click, not a re-type.
//
// SECURITY: the password / confirmPassword are intentionally NOT persisted (they are
// sensitive and must never sit in sessionStorage). Only ingameName / fullName / email are
// saved. We clear the draft on a successful registration.
const DRAFT_KEY = "afc_create_account_draft";
type AccountDraft = {
  ingameName: string;
  fullName: string;
  email: string;
};

// Read a saved draft (returns null when none / on the server / on parse failure).
function readDraft(): AccountDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return {
      ingameName: typeof parsed.ingameName === "string" ? parsed.ingameName : "",
      fullName: typeof parsed.fullName === "string" ? parsed.fullName : "",
      email: typeof parsed.email === "string" ? parsed.email : "",
    };
  } catch {
    return null;
  }
}

// Persist only the non-secret fields.
function writeDraft(draft: AccountDraft) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // Storage can be unavailable (private mode / quota). Failing to cache the draft must
    // never break the form, so we swallow the error.
  }
}

// Drop the saved draft (called after a successful registration).
function clearDraft() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(DRAFT_KEY);
  } catch {
    // ignore
  }
}

export function CreateAccountForm() {
  const router = useRouter();

  const [pending, startTransition] = useTransition();

  const form = useForm<RegisterFormSchemaType>({
    resolver: zodResolver(RegisterFormSchema),
    defaultValues: {
      ingameName: "",
      fullName: "",
      email: "",
      // country: "" as RegisterFormSchemaType["country"],
      // uid: "",
      password: "",
      confirmPassword: "",
      // Initialize the new field to false
      acceptTerms: false as any,
    },
  });

  // ── Restore the saved draft on mount (back/forward nav or accidental reload) ──
  // Only the non-secret fields are restored; the password fields stay empty so the user
  // re-enters them, which is the intended behaviour for a sensitive field.
  useEffect(() => {
    const draft = readDraft();
    if (!draft) return;
    if (draft.ingameName) form.setValue("ingameName", draft.ingameName);
    if (draft.fullName) form.setValue("fullName", draft.fullName);
    if (draft.email) form.setValue("email", draft.email);
    // run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Persist non-secret fields to sessionStorage on every change ──
  // form.watch returns a subscription we clean up on unmount. We never write the password.
  useEffect(() => {
    const subscription = form.watch((values) => {
      writeDraft({
        ingameName: values.ingameName ?? "",
        fullName: values.fullName ?? "",
        email: values.email ?? "",
      });
    });
    return () => subscription.unsubscribe();
  }, [form]);

  const password = form.watch("password");
  const acceptTerms = form.watch("acceptTerms"); // Watch the new field
  const [isVisible, setIsVisible] = useState<boolean>(false);
  const [isConfirmVisible, setConfirmIsVisible] = useState<boolean>(false);
  const toggleVisibility = () => setIsVisible((prevState) => !prevState);
  const toggleConfirmVisibility = () =>
    setConfirmIsVisible((prevState) => !prevState);

  const checkStrength = (pass: string) => {
    // ... (rest of checkStrength logic remains the same)
    const requirements = [
      { regex: /.{8,}/, text: "At least 8 characters" },
      { regex: /[0-9]/, text: "At least 1 number" },
      { regex: /[a-z]/, text: "At least 1 lowercase letter" },
      { regex: /[A-Z]/, text: "At least 1 uppercase letter" },
      {
        regex: /[!@#$%^&*(),.?":{}|<>]/,
        text: "At least 1 special character",
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
    if (score === 0) return "Enter a password";
    if (score <= 2) return "Weak password";
    if (score === 3) return "Medium password";
    return "Strong password";
  };

  function onSubmit(data: RegisterFormSchemaType) {
    // The Zod resolver already checks data.acceptTerms, so we only need to proceed here.
    startTransition(async () => {
      try {
        const authData = {
          in_game_name: data.ingameName,
          // uid: data.uid,
          email: data.email,
          password: data.password,
          confirm_password: data.confirmPassword,
          full_name: data.fullName,
          // country: data.country,
          // Removed data.acceptTerms from authData as it's not needed by the backend typically
        };
        const response = await axios.post(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/auth/signup/`,
          { ...authData },
        );

        // Success: the typed draft is no longer needed, so we drop it before leaving.
        clearDraft();
        toast.success(response.data.message);
        router.push(`/email-confirmation?email=${data.email}`);
      } catch (error: any) {
        // The backend now returns friendly copy. New conflict responses use `message`
        // ("That in-game name is already taken.", "That email is already registered."),
        // while older validation responses use `error`. Read whichever is present.
        const backendMessage: string =
          error?.response?.data?.message ||
          error?.response?.data?.error ||
          "Something went wrong. Please try again.";

        // Surface the message INLINE next to the field it concerns, so the user fixes just
        // the one thing. We keep the form fully intact (no reset) so nothing they typed is
        // lost. setError does not clear other fields.
        const lower = backendMessage.toLowerCase();
        if (lower.includes("in-game name")) {
          form.setError("ingameName", { type: "server", message: backendMessage });
        } else if (lower.includes("email")) {
          form.setError("email", { type: "server", message: backendMessage });
        }

        // Always also show the toast so the message is visible even if the field is
        // scrolled out of view.
        toast.error(backendMessage);
        return;
      }
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* ... (Existing form fields: fullName, ingameName, uid, email, country, password, confirmPassword) ... */}

        <FormField
          control={form.control}
          name="fullName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Full Name</FormLabel>
              <FormControl>
                <Input
                  placeholder="Enter your full name"
                  onPaste={preventPaste}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="ingameName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>In-game Name</FormLabel>
              <FormControl>
                <Input
                  placeholder="Enter your in-game name"
                  onPaste={preventPaste}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {/* <FormField
          control={form.control}
          name="uid"
          render={({ field }) => (
            <FormItem>
              <FormLabel>UID</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  placeholder="Enter your FreeFire UID"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        /> */}
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input type="email" placeholder="Enter your email" {...field} />
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
                  {getStrengthText(strengthScore)}. Must contain:
                </p>

                {/* Password requirements list */}
                <ul className="space-y-1.5" aria-label="Password requirements">
                  {strength.map((req, index) => (
                    <li key={index} className="flex items-center gap-2">
                      {req.met ? (
                        <CheckIcon
                          size={16}
                          className="text-emerald-500"
                          aria-hidden="true"
                        />
                      ) : (
                        <XIcon
                          size={16}
                          className="text-muted-foreground/80"
                          aria-hidden="true"
                        />
                      )}
                      <span
                        className={`text-xs ${
                          req.met ? "text-emerald-600" : "text-muted-foreground"
                        }`}
                      >
                        {req.text}
                        <span className="sr-only">
                          {req.met
                            ? " - Requirement met"
                            : " - Requirement not met"}
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
              <FormLabel>Confirm password</FormLabel>
              <FormControl>
                <div className="relative">
                  <Input
                    type={isConfirmVisible ? "text" : "password"}
                    placeholder="Enter your password"
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
                      isConfirmVisible ? "Hide password" : "Show password"
                    }
                    aria-pressed={isConfirmVisible}
                    aria-controls="password"
                  >
                    {isConfirmVisible ? ( // FIX: Use isConfirmVisible for icon
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

        {/* NEW: Terms and Policy Checkbox */}
        <FormField
          control={form.control}
          name="acceptTerms"
          render={({ field }) => (
            <FormItem className="flex flex-row items-start space-x-3 space-y-0 p-4 border rounded-lg">
              <FormControl>
                {/* NOTE: You must ensure your Checkbox component
                  handles the checked/onCheckedChange props correctly for react-hook-form.
                */}
                <Checkbox
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
              <div className="space-y-1 leading-none">
                <label htmlFor="terms" className="text-sm leading-relaxed">
                  I confirm that I have read and agree to the{" "}
                  <Link
                    href="/terms-of-service"
                    className="text-primary hover:underline font-medium"
                  >
                    Terms of Service
                  </Link>{" "}
                  and{" "}
                  <Link
                    href="/privacy-policy"
                    className="text-primary hover:underline font-medium"
                  >
                    Privacy Policy
                  </Link>
                  .
                </label>
                <FormMessage />
              </div>
            </FormItem>
          )}
        />

        <Button
          className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
          type="submit"
          // The button is disabled if the registration process is pending OR if the terms are NOT accepted.
          disabled={pending || !acceptTerms}
        >
          {pending ? <Loader text="Creating..." /> : "Register"}
        </Button>
      </form>
    </Form>
  );
}
