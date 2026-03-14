"use client";

import { use, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import axios from "axios";
import { toast } from "sonner";

import { FullLoader } from "@/components/Loader";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  IconCheck,
  IconEye,
  IconEyeOff,
  IconLoader2,
  IconSearch,
  IconX,
} from "@tabler/icons-react";
import { useAuth } from "@/contexts/AuthContext";
import { env } from "@/lib/env";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

// ── Schema ────────────────────────────────────────────────────────────────────

const schema = z.object({
  full_name: z.string().min(1, "Full name is required"),
  email: z.string().email("Valid email required"),
  username: z.string().min(1, "Username is required"),
  event_ids: z.array(z.number()).min(1, "Select at least one event"),
  password: z
    .string()
    .min(8, { message: "Password must be at least 8 characters." })
    .refine((val) => /[a-z]/.test(val), {
      message: "Password must contain at least one lowercase letter.",
    })
    .refine((val) => /[A-Z]/.test(val), {
      message: "Password must contain at least one uppercase letter.",
    })
    .refine((val) => /[0-9]/.test(val), {
      message: "Password must contain at least one number.",
    })
    .refine((val) => /[!@#$%^&*(),.?":{}|<>]/.test(val), {
      message: "Password must contain at least one special character.",
    }),
  confirmPassword: z.string(),
});

type FormValues = z.infer<typeof schema>;

interface SponsorDetails {
  sponsor_id: number;
  username: string;
  email: string;
  full_name: string;
  events: Array<{ event_id: number; event_name: string }>;
}

interface EventOption {
  event_id: number;
  event_name: string;
  event_status: string;
  slug: string;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function EditSponsorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: sponsorUsername } = use(params);
  const { token, loading: authLoading } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [events, setEvents] = useState<EventOption[]>([]);
  const [eventSearch, setEventSearch] = useState("");

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      full_name: "",
      email: "",
      username: "",
      event_ids: [],
      password: "",
      confirmPassword: "",
    },
  });

  const selectedIds = form.watch("event_ids");

  const password = form.watch("password");
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

  // ── Load sponsor details + all events ──────────────────────────────────────

  const loadData = useCallback(async () => {
    if (!token) return;
    try {
      const [sponsorRes, eventsRes] = await Promise.all([
        axios.post(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/get-sponsor-details/`,
          { sponsor_username: sponsorUsername },
          { headers: { Authorization: `Bearer ${token}` } },
        ),
        axios.get(`${env.NEXT_PUBLIC_BACKEND_API_URL}/events/get-all-events/`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      const sponsorData: SponsorDetails = sponsorRes.data;
      const allEvents: EventOption[] = eventsRes.data.events ?? [];
      setEvents(allEvents);

      form.reset({
        full_name: sponsorData.full_name,
        email: sponsorData.email,
        username: sponsorData.username,
        event_ids: sponsorData.events.map((e) => e.event_id),
      });
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message || "Failed to load sponsor details.",
      );
    } finally {
      setLoading(false);
    }
  }, [token, sponsorUsername, form]);

  useEffect(() => {
    if (authLoading) return;
    loadData();
  }, [authLoading, loadData]);

  // ── Helpers ───────────────────────────────────────────────────────────────

  const toggleEvent = (id: number) => {
    const current = form.getValues("event_ids");
    form.setValue(
      "event_ids",
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
      { shouldValidate: true },
    );
  };

  const filteredEvents = events.filter((e) =>
    e.event_name.toLowerCase().includes(eventSearch.toLowerCase().trim()),
  );

  // ── Submit ────────────────────────────────────────────────────────────────

  const onSubmit = async (values: FormValues) => {
    if (!token) return;
    setSubmitting(true);
    try {
      await axios.post(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/edit-sponsor-details/`,
        {
          sponsor_username: sponsorUsername,
          full_name: values.full_name,
          email: values.email,
          username: values.username,
          event_ids: values.event_ids,
          password: values.password,
        },
        { headers: { Authorization: `Bearer ${token}` } },
      );

      toast.success("Sponsor details updated successfully.");
      router.push("/a/sponsors");
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message || "Failed to update sponsor details.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading || loading) return <FullLoader />;

  return (
    <div className="flex flex-col gap-3">
      <PageHeader
        back
        title={`Edit Sponsor: ${sponsorUsername}`}
        description="Update sponsor details and event assignments."
      />

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-col gap-6"
        >
          {/* Sponsor details */}
          <Card>
            <CardHeader className="border-b">
              <CardTitle>Sponsor Details</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 pt-4">
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
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="e.g. john@company.com"
                        {...field}
                      />
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
                          aria-label={
                            isVisible ? "Hide password" : "Show password"
                          }
                          aria-pressed={isVisible}
                          aria-controls="password"
                        >
                          {isVisible ? (
                            <IconEyeOff className="size-4" aria-hidden="true" />
                          ) : (
                            <IconEye className="size-4" aria-hidden="true" />
                          )}
                        </Button>
                      </div>
                    </FormControl>
                    <FormMessage />
                    <div
                      className={cn(
                        password?.length !== 0
                          ? "block mt-2 space-y-3"
                          : "hidden",
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
                      <ul
                        className="space-y-1.5"
                        aria-label="Password requirements"
                      >
                        {strength.map((req, index) => (
                          <li key={index} className="flex items-center gap-2">
                            {req.met ? (
                              <IconCheck
                                size={16}
                                className="text-emerald-500"
                                aria-hidden="true"
                              />
                            ) : (
                              <IconX
                                size={16}
                                className="text-muted-foreground/80"
                                aria-hidden="true"
                              />
                            )}
                            <span
                              className={`text-xs ${
                                req.met
                                  ? "text-emerald-600"
                                  : "text-muted-foreground"
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
                            <IconEyeOff className="size-4" aria-hidden="true" />
                          ) : (
                            <IconEye className="size-4" aria-hidden="true" />
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

          {/* Event assignment */}
          <Card>
            <CardHeader className="border-b">
              <CardTitle className="flex items-center gap-2">
                Assigned Events
                {selectedIds.length > 0 && (
                  <Badge variant="secondary">
                    {selectedIds.length} selected
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 pt-4">
              <div className="relative">
                <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  placeholder="Search events..."
                  value={eventSearch}
                  onChange={(e) => setEventSearch(e.target.value)}
                  className="pl-9"
                />
              </div>

              {events.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  No events found.
                </p>
              ) : (
                <ScrollArea className="h-72 rounded-md border">
                  <div className="p-1">
                    {filteredEvents.map((e) => (
                      <label
                        key={e.event_id}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-muted cursor-pointer select-none"
                      >
                        <Checkbox
                          checked={selectedIds.includes(e.event_id)}
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

              <FormField
                control={form.control}
                name="event_ids"
                render={() => (
                  <FormItem>
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
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting && (
                <IconLoader2 className="size-4 animate-spin mr-2" />
              )}
              Save Changes
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
