"use client";

import { FullLoader } from "@/components/Loader";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { env } from "@/lib/env";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  IconCheck,
  IconCopy,
  IconEye,
  IconEyeOff,
  IconLoader2,
  IconSearch,
} from "@tabler/icons-react";
import axios from "axios";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import {
  CheckIcon,
  DownloadIcon,
  EyeIcon,
  EyeOffIcon,
  XIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CreatedSponsorDetails {
  full_name: string;
  uid: string;
  username: string;
  email: string;
  password: string;
  assigned_events: string[];
}

interface EventOption {
  event_id: number;
  event_name: string;
  event_status: string;
}

// ─── Schemas ──────────────────────────────────────────────────────────────────

const accountSchema = z
  .object({
    full_name: z.string().min(2, "Full name must be at least 2 characters"),
    uid: z.string().min(1, "UID is required"),
    username: z.string().min(2, "Username must be at least 2 characters"),
    email: z.string().email("Invalid email address"),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(/[0-9]/, "Must contain a number")
      .regex(/[a-z]/, "Must contain a lowercase letter")
      .regex(/[A-Z]/, "Must contain an uppercase letter")
      .regex(/[^a-zA-Z0-9]/, "Must contain a special character"),
    confirm_password: z.string(),
  })
  .refine((d) => d.password === d.confirm_password, {
    message: "Passwords do not match",
    path: ["confirm_password"],
  });

type AccountFormValues = z.infer<typeof accountSchema>;

// ─── Step indicator ───────────────────────────────────────────────────────────

function StepIndicator({ step }: { step: 1 | 2 }) {
  return (
    <div className="flex items-center gap-3 mb-2">
      {[1, 2].map((n) => (
        <div key={n} className="flex items-center gap-2">
          <div
            className={cn(
              "size-7 rounded-full flex items-center justify-center text-xs font-semibold border-2 transition-colors",
              step === n
                ? "border-primary bg-primary text-primary-foreground"
                : step > n
                  ? "border-emerald-500 bg-emerald-500 text-white"
                  : "border-muted-foreground/30 text-muted-foreground",
            )}
          >
            {step > n ? <CheckIcon className="size-3.5" /> : n}
          </div>
          <span
            className={cn(
              "text-sm",
              step === n ? "font-medium" : "text-muted-foreground",
            )}
          >
            {n === 1 ? "Account Details" : "Assign Events"}
          </span>
          {n === 1 && (
            <div
              className={cn(
                "w-8 h-px mx-1",
                step > 1 ? "bg-emerald-500" : "bg-muted-foreground/30",
              )}
            />
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CreateSponsorPage() {
  const { token, loading: authLoading } = useAuth();
  const router = useRouter();

  // Step 1: account creation state
  const [step, setStep] = useState<1 | 2>(1);
  const [createdAccount, setCreatedAccount] =
    useState<AccountFormValues | null>(null);
  const [submittingAccount, setSubmittingAccount] = useState(false);

  // Step 2: event assignment state
  const [events, setEvents] = useState<EventOption[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [eventSearch, setEventSearch] = useState("");
  const [selectedEventIds, setSelectedEventIds] = useState<number[]>([]);
  const [submittingEvents, setSubmittingEvents] = useState(false);

  // Success modal
  const [successDetails, setSuccessDetails] =
    useState<CreatedSponsorDetails | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Password visibility
  const [isVisible, setIsVisible] = useState(false);
  const [isConfirmVisible, setConfirmIsVisible] = useState(false);

  const form = useForm<AccountFormValues>({
    resolver: zodResolver(accountSchema),
    defaultValues: {
      full_name: "",
      uid: "",
      username: "",
      email: "",
      password: "",
      confirm_password: "",
    },
  });

  const password = form.watch("password");

  const fetchEvents = useCallback(async () => {
    try {
      const res = await axios.get(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/get-all-events/`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setEvents(res.data.events ?? []);
    } catch {
      toast.error("Failed to load events.");
    } finally {
      setEventsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (authLoading || !token) return;
    fetchEvents();
  }, [authLoading, token, fetchEvents]);

  const filteredEvents = events.filter((e) =>
    e.event_name.toLowerCase().includes(eventSearch.toLowerCase().trim()),
  );

  // ── Password strength ──────────────────────────────────────────────────────

  const checkStrength = (pass: string) => {
    const requirements = [
      { regex: /.{8,}/, text: "At least 8 characters" },
      { regex: /[0-9]/, text: "At least 1 number" },
      { regex: /[a-z]/, text: "At least 1 lowercase letter" },
      { regex: /[A-Z]/, text: "At least 1 uppercase letter" },
      { regex: /[!@#$%^&*(),.?":{}|<>]/, text: "At least 1 special character" },
    ];
    return requirements.map((req) => ({ met: req.regex.test(pass), text: req.text }));
  };

  const strength = checkStrength(password);
  const strengthScore = useMemo(
    () => strength.filter((r) => r.met).length,
    [strength],
  );
  const getStrengthText = (score: number) => {
    if (score === 0) return "Enter a password";
    if (score <= 2) return "Weak password";
    if (score === 3) return "Medium password";
    return "Strong password";
  };

  // ── Step 1 submit: create account ─────────────────────────────────────────

  const onSubmitAccount = async (values: AccountFormValues) => {
    setSubmittingAccount(true);
    try {
      await axios.post(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/create-sponsor-account/`,
        {
          fullname: values.full_name,
          uid: values.uid,
          email: values.email,
          username: values.username,
          password: values.password,
          confirm_password: values.confirm_password,
        },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setCreatedAccount(values);
      setStep(2);
      toast.success("Account created! Now assign events.");
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message ||
          err?.response?.data?.detail ||
          "Failed to create sponsor account.",
      );
    } finally {
      setSubmittingAccount(false);
    }
  };

  // ── Step 2 submit: assign events ──────────────────────────────────────────

  const onAssignEvents = async () => {
    if (!createdAccount) return;
    setSubmittingEvents(true);
    try {
      if (selectedEventIds.length > 0) {
        await axios.post(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/assign-sponsor-to-event/`,
          {
            sponsor_username: createdAccount.username,
            event_ids: selectedEventIds,
          },
          { headers: { Authorization: `Bearer ${token}` } },
        );
      }

      const assignedEventNames = selectedEventIds
        .map(
          (id) =>
            events.find((e) => e.event_id === id)?.event_name ?? `Event #${id}`,
        )
        .filter(Boolean);

      setSuccessDetails({
        full_name: createdAccount.full_name,
        uid: createdAccount.uid,
        username: createdAccount.username,
        email: createdAccount.email,
        password: createdAccount.password,
        assigned_events: assignedEventNames,
      });
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message ||
          err?.response?.data?.detail ||
          "Failed to assign events.",
      );
    } finally {
      setSubmittingEvents(false);
    }
  };

  const skipAssignment = () => {
    if (!createdAccount) return;
    setSuccessDetails({
      full_name: createdAccount.full_name,
      uid: createdAccount.uid,
      username: createdAccount.username,
      email: createdAccount.email,
      password: createdAccount.password,
      assigned_events: [],
    });
  };

  // ── Event toggle ──────────────────────────────────────────────────────────

  const toggleEvent = (id: number) => {
    setSelectedEventIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  // ── Credentials helpers ───────────────────────────────────────────────────

  const copyToClipboard = async (value: string, field: string) => {
    await navigator.clipboard.writeText(value);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const downloadCredentials = (details: CreatedSponsorDetails) => {
    const content = [
      "=== Sponsor Account Credentials ===",
      "",
      `Full Name:  ${details.full_name}`,
      `UID:        ${details.uid}`,
      `Username:   ${details.username}`,
      `Email:      ${details.email}`,
      `Password:   ${details.password}`,
      "",
      "=== Assigned Events ===",
      ...(details.assigned_events.length > 0
        ? details.assigned_events.map((e, i) => `  ${i + 1}. ${e}`)
        : ["  (none)"]),
      "",
      `Generated: ${new Date().toLocaleString()}`,
    ].join("\n");

    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sponsor-${details.username}-credentials.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (authLoading) return <FullLoader />;

  return (
    <div className="flex flex-col gap-3">
      <PageHeader
        back
        title="Create Sponsor Account"
        description="Set up login credentials for a sponsor and assign their events."
      />

      <StepIndicator step={step} />

      {/* ── Step 1: Account Details ── */}
      {step === 1 && (
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmitAccount)}
            className="flex flex-col gap-6"
          >
            <Card>
              <CardHeader className="border-b">
                <CardTitle>Account Details</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <FormField
                  control={form.control}
                  name="full_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. John Doe" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="uid"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>UID</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. 123456789" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Username</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. john_doe" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="e.g. john@gmail.com"
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
                            placeholder="Enter your password"
                            {...field}
                          />
                          <Button
                            className="absolute top-[50%] translate-y-[-50%] end-1 text-muted-foreground/80"
                            variant="ghost"
                            size="icon"
                            type="button"
                            onClick={() => setIsVisible((p) => !p)}
                          >
                            {isVisible ? (
                              <EyeOffIcon className="size-4" />
                            ) : (
                              <EyeIcon className="size-4" />
                            )}
                          </Button>
                        </div>
                      </FormControl>
                      <FormMessage />
                      <div
                        className={cn(
                          password.length !== 0
                            ? "block mt-2 space-y-3"
                            : "hidden",
                        )}
                      >
                        <Progress
                          value={(strengthScore / 5) * 100}
                          className="h-1"
                        />
                        <p className="text-foreground mb-2 text-sm font-medium">
                          {getStrengthText(strengthScore)}. Must contain:
                        </p>
                        <ul className="space-y-1.5" aria-label="Password requirements">
                          {strength.map((req, index) => (
                            <li key={index} className="flex items-center gap-2">
                              {req.met ? (
                                <CheckIcon size={16} className="text-emerald-500" />
                              ) : (
                                <XIcon size={16} className="text-muted-foreground/80" />
                              )}
                              <span
                                className={`text-xs ${req.met ? "text-emerald-600" : "text-muted-foreground"}`}
                              >
                                {req.text}
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
                  name="confirm_password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirm Password</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            type={isConfirmVisible ? "text" : "password"}
                            placeholder="Re-enter your password"
                            {...field}
                          />
                          <Button
                            className="absolute top-[50%] translate-y-[-50%] end-1 text-muted-foreground/80"
                            variant="ghost"
                            size="icon"
                            type="button"
                            onClick={() => setConfirmIsVisible((p) => !p)}
                          >
                            {isConfirmVisible ? (
                              <EyeOffIcon className="size-4" />
                            ) : (
                              <EyeIcon className="size-4" />
                            )}
                          </Button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <div className="flex gap-3 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
                disabled={submittingAccount}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submittingAccount}>
                {submittingAccount && (
                  <IconLoader2 className="size-4 animate-spin mr-2" />
                )}
                Next: Assign Events
              </Button>
            </div>
          </form>
        </Form>
      )}

      {/* ── Step 2: Assign Events ── */}
      {step === 2 && (
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader className="border-b">
              <CardTitle className="flex gap-2 items-center">
                Assign Events
                <span className="text-xs font-normal text-muted-foreground">
                  (optional)
                </span>
                {selectedEventIds.length > 0 && (
                  <Badge variant="secondary">
                    {selectedEventIds.length} selected
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="relative">
                <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  placeholder="Search events..."
                  value={eventSearch}
                  onChange={(e) => setEventSearch(e.target.value)}
                  className="pl-9"
                />
              </div>

              {eventsLoading ? (
                <div className="flex items-center justify-center py-8 text-muted-foreground text-sm gap-2">
                  <IconLoader2 className="size-4 animate-spin" />
                  Loading events...
                </div>
              ) : filteredEvents.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  {events.length === 0
                    ? "No events found."
                    : "No events match your search."}
                </p>
              ) : (
                <ScrollArea className="h-64 rounded-md border">
                  <div className="p-1">
                    {filteredEvents.map((e) => (
                      <label
                        key={e.event_id}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-muted cursor-pointer select-none"
                      >
                        <Checkbox
                          checked={selectedEventIds.includes(e.event_id)}
                          onCheckedChange={() => toggleEvent(e.event_id)}
                        />
                        <div className="flex flex-col min-w-0">
                          <span className="text-sm font-medium truncate">
                            {e.event_name}
                          </span>
                          <span className="text-xs text-muted-foreground capitalize">
                            {e.event_status}
                          </span>
                        </div>
                      </label>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>

          <div className="flex gap-3 justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={skipAssignment}
              disabled={submittingEvents}
            >
              Skip
            </Button>
            <Button
              onClick={onAssignEvents}
              disabled={submittingEvents || selectedEventIds.length === 0}
            >
              {submittingEvents && (
                <IconLoader2 className="size-4 animate-spin mr-2" />
              )}
              Assign &amp; Finish
            </Button>
          </div>
        </div>
      )}

      {/* ── Success modal ── */}
      <Dialog
        open={!!successDetails}
        onOpenChange={(open) => {
          if (!open) {
            setSuccessDetails(null);
            router.push("/a/sponsors");
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader className="border-b">
            <DialogTitle className="flex items-center gap-2">
              <CheckIcon className="size-5 text-emerald-500" />
              Account Created
            </DialogTitle>
            <DialogDescription>
              Share these credentials with the sponsor. This is the only time
              the password will be shown.
            </DialogDescription>
          </DialogHeader>

          {successDetails && (
            <div className="flex flex-col gap-3">
              {(
                [
                  { label: "Full Name", key: "full_name" },
                  { label: "UID", key: "uid" },
                  { label: "Username", key: "username" },
                  { label: "Email", key: "email" },
                  { label: "Password", key: "password" },
                ] as { label: string; key: keyof CreatedSponsorDetails }[]
              ).map(({ label, key }) => {
                const value = successDetails[key] as string;
                return (
                  <div key={key} className="flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground font-medium">
                      {label}
                    </span>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 bg-muted rounded px-3 py-1.5 text-sm font-mono truncate">
                        {key === "password" ? "•".repeat(value.length) : value}
                      </code>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="shrink-0 size-8"
                        onClick={() => copyToClipboard(value, key)}
                      >
                        {copiedField === key ? (
                          <IconCheck className="size-4 text-emerald-500" />
                        ) : (
                          <IconCopy className="size-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                );
              })}

              {successDetails.assigned_events.length > 0 && (
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground font-medium">
                    Assigned Events
                  </span>
                  <div className="bg-muted rounded px-3 py-2 flex flex-wrap gap-1.5">
                    {successDetails.assigned_events.map((name) => (
                      <Badge key={name} variant="outline" className="text-xs">
                        {name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => downloadCredentials(successDetails)}
                >
                  <DownloadIcon className="size-4 mr-2" />
                  Download .txt
                </Button>
                <Button
                  className="flex-1"
                  onClick={() => {
                    setSuccessDetails(null);
                    router.push("/a/sponsors");
                  }}
                >
                  Done
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
