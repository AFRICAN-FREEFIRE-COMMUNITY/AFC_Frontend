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
import { useAuth } from "@/contexts/AuthContext";
import { env } from "@/lib/env";
import { zodResolver } from "@hookform/resolvers/zod";
import {
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
import { CheckIcon, EyeIcon, EyeOffIcon, XIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";

const schema = z
  .object({
    full_name: z.string().min(2, "Full name must be at least 2 characters"),
    in_game_name: z
      .string()
      .min(2, "In-game name must be at least 2 characters"),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(/[0-9]/, "Must contain a number")
      .regex(/[a-z]/, "Must contain a lowercase letter")
      .regex(/[A-Z]/, "Must contain an uppercase letter")
      .regex(/[^a-zA-Z0-9]/, "Must contain a special character"),
    confirm_password: z.string(),
    event_ids: z.array(z.number()).min(1, "Select at least one event"),
  })
  .refine((d) => d.password === d.confirm_password, {
    message: "Passwords do not match",
    path: ["confirm_password"],
  });

type FormValues = z.infer<typeof schema>;

interface EventOption {
  event_id: number;
  event_name: string;
  event_status: string;
}

export default function CreateSponsorPage() {
  const { token, loading: authLoading } = useAuth();
  const router = useRouter();

  const [events, setEvents] = useState<EventOption[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [eventSearch, setEventSearch] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      full_name: "",
      in_game_name: "",
      password: "",
      confirm_password: "",
      event_ids: [],
    },
  });

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
    if (authLoading) return;
    if (!token) return;
    fetchEvents();
  }, [authLoading, token, fetchEvents]);

  const filteredEvents = events.filter((e) =>
    e.event_name.toLowerCase().includes(eventSearch.toLowerCase().trim()),
  );

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

  const toggleEvent = (id: number) => {
    const current = form.getValues("event_ids");
    if (current.includes(id)) {
      form.setValue(
        "event_ids",
        current.filter((x) => x !== id),
        { shouldValidate: true },
      );
    } else {
      form.setValue("event_ids", [...current, id], { shouldValidate: true });
    }
  };

  const onSubmit = async (values: FormValues) => {
    setSubmitting(true);
    try {
      // TODO: replace with actual endpoint once available
      // await axios.post(
      //   `${env.NEXT_PUBLIC_BACKEND_API_URL}/sponsors/create-sponsor-account/`,
      //   {
      //     full_name: values.full_name,
      //     in_game_name: values.in_game_name,
      //     password: values.password,
      //     event_ids: values.event_ids,
      //   },
      //   { headers: { Authorization: `Bearer ${token}` } },
      // );
      toast.success("Sponsor account created successfully.");
      router.push("/a/sponsors");
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message ||
          err?.response?.data?.detail ||
          "Failed to create sponsor account.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading) return <FullLoader />;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        back
        title="Create Sponsor Account"
        description="Set up login credentials for a sponsor and assign their events."
      />

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-col gap-6"
        >
          {/* Basic info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Account Details</CardTitle>
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
                name="in_game_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>In-Game Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. GarenaAdmin01" {...field} />
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
                        password.length !== 0
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
                name="confirm_password"
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
            </CardContent>
          </Card>

          {/* Event selection */}
          <Card>
            <CardHeader className="border-b">
              <CardTitle>
                Assign Events
                {selectedIds.length > 0 && (
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    {selectedIds.length} selected
                  </span>
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
              Create Account
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
