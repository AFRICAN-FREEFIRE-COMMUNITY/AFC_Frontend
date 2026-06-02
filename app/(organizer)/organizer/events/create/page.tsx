// ─────────────────────────────────────────────────────────────────────────────
// Organizer › Events › Create.
//
// A FOCUSED, single-page create-event form for organizers — the lean cousin of the
// admin 9-step wizard (app/(a)/a/events/create/page.tsx). It covers only the fields
// the backend's create-event endpoint requires, plus an optional banner + rules, and
// always submits ONE valid stage with ONE group behind the scenes so the payload the
// backend receives is identical in shape to the admin one (the backend builds stages
// → groups → matches from that array, so it must be present and valid).
//
// REUSE: the admin Zod schema (EventFormSchema) drives validation, and two admin step
// components are reused verbatim — Step5PrizePool (prize pool + distribution) and
// Step6EventRules (type-or-upload rules). The event-detail fields are rendered inline
// here (a trimmed version of Step1EventDetails) so the organizer form stays a clean
// single page rather than pulling in the wizard's registration-restriction/stream UI.
//
// GATING: rendered only when the caller can create events
// (membership.permissions.can_create_events OR isOwner). Otherwise a notice + a link
// back to the events list — same gate the list page uses for its "Create event" CTA.
//
// SUBMIT: POST multipart FormData to /events/create-event/ with a Bearer token read
// from AuthContext (mirrors the admin page's `Authorization: Bearer ${token}`), and —
// the organizer-specific bit — includes organization_id so the event is homed to the
// selected org. A "Save as draft" vs "Publish" choice sets is_draft + event_status.
// The field names + the JSON-stringified stages array match the admin submit exactly
// so the backend accepts the payload unchanged.
// ─────────────────────────────────────────────────────────────────────────────

"use client";

import React, { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Form } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/PageHeader";
import { IconLock, IconPhoto, IconUpload, IconX } from "@tabler/icons-react";
import Image from "next/image";
import { env } from "@/lib/env";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganizer } from "../../_components/OrganizerContext";

// Reuse the admin schema + the two admin step components the brief calls out.
import { EventFormSchema, EventFormType } from "@/app/(a)/a/events/create/_components/types";
import { Step5PrizePool } from "@/app/(a)/a/events/create/_components/Step5PrizePool";
import { Step6EventRules } from "@/app/(a)/a/events/create/_components/Step6EventRules";

// Accepted banner upload types (same set the admin Step1 + team-edit pages allow).
const ACCEPTED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/webp"];

export default function OrganizerCreateEventPage() {
  const router = useRouter();
  const { membership, isOwner } = useOrganizer();
  const { token } = useAuth();
  const [isPending, startTransition] = useTransition();

  // Org context: id homes the event, the permission gates the whole surface.
  const organizationId = membership.organization.organization_id;
  const canCreateEvents = membership.permissions.can_create_events || isOwner;

  // ── Banner + rules file state (banner optional; rules type-or-upload). ──
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [selectedRuleFile, setSelectedRuleFile] = useState<File | null>(null);
  const [previewRuleUrl, setPreviewRuleUrl] = useState("");
  const [rulesInputMethod, setRulesInputMethod] = useState<"type" | "upload">("type");
  const bannerInputRef = React.useRef<HTMLInputElement>(null);

  // ── Form ──────────────────────────────────────────────────────────────────
  // Same EventFormSchema as the admin wizard; defaults pre-pick the organizer-sensible
  // values (event_type "internal" per the brief, sane prize distribution seed) so the
  // form is valid with the minimum number of inputs.
  const form = useForm<EventFormType>({
    // @ts-ignore — the admin wizard uses the same cast; the resolver type widens here.
    resolver: zodResolver(EventFormSchema),
    defaultValues: {
      event_name: "",
      competition_type: "tournament",
      participant_type: "squad",
      event_type: "internal", // organizer events default to internal (brief)
      is_public: "True",
      max_teams_or_players: 1,
      banner: "",
      stream_channels: [],
      event_mode: "",
      number_of_stages: 1,
      // The shared admin EventFormSchema requires >=1 fully-valid stage. The organizer
      // form has no stage editor — it auto-builds the real single stage from the chosen
      // mode + dates at submit (buildDefaultStages), which is what actually gets sent. This
      // placeholder stage exists ONLY to satisfy the resolver so submission isn't blocked;
      // it is never sent to the backend.
      stages: [
        {
          stage_name: "Main Stage",
          start_date: "2026-01-01",
          end_date: "2026-01-01",
          number_of_groups: 1,
          stage_format: "br_normal",
          groups: [
            {
              group_name: "Group A",
              playing_date: "2026-01-01",
              playing_time: "18:00",
              teams_qualifying: 1,
              match_count: 1,
              match_maps: ["Bermuda"],
            },
          ],
        },
      ],
      prizepool: "",
      prizepool_cash_value: undefined,
      // Empty object passes the schema's record() vacuously — an organizer can submit
      // with just the prizepool text, or add positions via Step5PrizePool (each added
      // position must then carry a non-empty value, same as the admin wizard).
      prize_distribution: {},
      event_rules: "",
      rules_document: "",
      start_date: "",
      end_date: "",
      registration_open_date: "",
      registration_end_date: "",
      // times (optional) — paired with the dates above so organizers can set when
      // registration + the event open/close, not just the day.
      registration_start_time: "",
      registration_end_time: "",
      event_start_time: "",
      event_end_time: "",
      registration_link: "",
      event_status: "upcoming",
      publish_to_tournaments: false,
      publish_to_news: false,
      save_to_drafts: false,
      registration_restriction: "none",
      restriction_mode: "allow_only",
      is_sponsored: false,
      is_waitlist_enabled: false,
    },
  });

  // ── Banner file handling ──────────────────────────────────────────────────
  const handleBannerFile = (file?: File) => {
    if (!file) return;
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      toast.error("Only PNG, JPG, JPEG, or WEBP files are supported.");
      return;
    }
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  // ── Build the one-stage / one-group array the backend needs ────────────────
  // The organizer form doesn't expose the stage wizard, so we synthesise a single
  // valid stage from the event-level dates + mode. The backend reads each group's
  // match_count to auto-create matches, so we give it exactly one match on one map.
  const buildDefaultStages = (data: EventFormType) => {
    // Every group needs at least one map; Bermuda is the safe default for both
    // BR and CS modes (the backend just cycles match_maps to create matches).
    const defaultMap = "Bermuda";

    return [
      {
        stage_name: "Stage 1",
        start_date: data.start_date,
        end_date: data.end_date,
        number_of_groups: 1,
        stage_format: data.event_mode, // a STAGE_FORMATS value, e.g. "br - normal"
        teams_qualifying_from_stage: 0,
        stage_discord_role_id: "",
        prizepool: data.prizepool || 0,
        prizepool_cash_value: data.prizepool_cash_value || 0,
        prize_distribution: data.prize_distribution || {},
        groups: [
          {
            group_name: "Group 1",
            // Group plays on the event's start date; midnight default time.
            playing_date: data.start_date,
            playing_time: "00:00",
            teams_qualifying: 1,
            match_count: 1,
            match_maps: [defaultMap],
            group_discord_role_id: "",
            room_id: "",
            room_name: "",
            room_password: "",
            prizepool: 0,
            prizepool_cash_value: 0,
            prize_distribution: {},
          },
        ],
      },
    ];
  };

  // ── Chronology validation ─────────────────────────────────────────────────
  // Combine each date with its paired time into a real timestamp (missing time = 00:00),
  // then enforce the sensible ordering: registration opens before it closes, the event
  // can't start before registration closes, and must end after it starts. Returns the
  // first problem message, or null when the window is valid.
  const checkDateOrder = (data: EventFormType): string | null => {
    const ts = (date?: string, time?: string) =>
      date ? new Date(`${date}T${time && time.length ? time : "00:00"}`) : null;
    const regOpen = ts(data.registration_open_date, data.registration_start_time);
    const regClose = ts(data.registration_end_date, data.registration_end_time);
    const evStart = ts(data.start_date, data.event_start_time);
    const evEnd = ts(data.end_date, data.event_end_time);
    if (regOpen && regClose && regClose <= regOpen)
      return "Registration must close after it opens.";
    if (regClose && evStart && evStart < regClose)
      return "The event can't start before registration closes.";
    if (evStart && evEnd && evEnd <= evStart)
      return "The event must end after it starts.";
    return null;
  };

  // ── Submit ────────────────────────────────────────────────────────────────
  // `asDraft` comes from which button the organizer pressed (Save draft / Publish).
  // Rules are optional for organizers, so we send whichever branch (typed/uploaded)
  // is active and leave the other empty — no hard rules requirement to enforce here.
  const submit = (data: EventFormType, asDraft: boolean) => {
    // Block submission (with a clear reason) if the date/time window is out of order.
    const orderError = checkDateOrder(data);
    if (orderError) {
      toast.error(orderError);
      return;
    }
    startTransition(async () => {
      try {
        const formData = new FormData();

        // ── Files (optional) ──
        if (selectedFile) formData.append("event_banner", selectedFile);
        if (rulesInputMethod === "upload" && selectedRuleFile)
          formData.append("uploaded_rules", selectedRuleFile);

        // ── Core required fields (names match the admin submit exactly) ──
        formData.append("event_name", data.event_name);
        formData.append("competition_type", data.competition_type);
        formData.append("participant_type", data.participant_type);
        formData.append("event_type", data.event_type);
        formData.append("is_public", data.is_public);
        formData.append("max_teams_or_players", data.max_teams_or_players.toString());
        formData.append("event_mode", data.event_mode);
        formData.append("prizepool", data.prizepool);
        formData.append(
          "prizepool_cash_value",
          (data.prizepool_cash_value ?? "").toString(),
        );

        // ── Draft vs publish ──
        formData.append("is_draft", asDraft ? "True" : "False");
        formData.append("event_status", asDraft ? "draft" : "upcoming");

        // ── Dates ──
        formData.append("number_of_stages", "1");
        formData.append("start_date", data.start_date);
        formData.append("end_date", data.end_date);
        formData.append("registration_open_date", data.registration_open_date);
        formData.append("registration_end_date", data.registration_end_date);
        // times (optional) — match the admin submit field names so the backend stores them.
        formData.append("registration_start_time", data.registration_start_time || "");
        formData.append("registration_end_time", data.registration_end_time || "");
        formData.append("event_start_time", data.event_start_time || "");
        formData.append("event_end_time", data.event_end_time || "");
        formData.append("registration_link", data.registration_link || "");

        // ── No location restriction on the organizer form (keep it simple). ──
        formData.append("registration_restriction", "none");

        // ── Rules (typed) — uploaded rules ride as the file above. ──
        formData.append(
          "event_rules",
          rulesInputMethod === "type" ? data.event_rules || "" : "",
        );

        // ── Prize distribution + stages (JSON, like the admin page). ──
        formData.append("prize_distribution", JSON.stringify(data.prize_distribution));
        formData.append("stages", JSON.stringify(buildDefaultStages(data)));

        // ── ORGANIZER-SPECIFIC: home the event to the selected organization. ──
        formData.append("organization_id", organizationId.toString());

        const response = await fetch(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/create-event/`,
          {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
            body: formData,
          },
        );

        const contentType = response.headers.get("content-type");
        if (!contentType?.includes("application/json")) {
          toast.error("Server error: Received unexpected response format.");
          return;
        }

        const res = await response.json();
        if (response.ok) {
          toast.success(res.message || "Event created successfully!");
          router.push("/organizer/events");
        } else {
          toast.error(
            res.message || res.detail || "Failed to create event. Check your inputs.",
          );
        }
      } catch {
        toast.error("An unexpected error occurred during submission.");
      }
    });
  };

  // Wraps form.handleSubmit so each button submits with its own draft flag. The onError
  // branch surfaces the first validation error as a toast — without it a failed validation
  // makes the button look dead (no request, no feedback).
  const onSubmit = (asDraft: boolean) =>
    form.handleSubmit(
      // @ts-ignore — same resolver-cast the admin page uses; the zodResolver widens the
      // form's internal TFieldValues so the typed success handler doesn't line up exactly.
      (data: EventFormType) => submit(data, asDraft),
      (errors) => {
        const first = Object.values(errors)[0] as { message?: string } | undefined;
        toast.error(first?.message || "Please fix the highlighted fields and try again.");
      },
    );

  // ── Permission gate ─────────────────────────────────────────────────────────
  // No create permission → a read-only notice instead of the form (mirrors the
  // owner-only notice on the organizer Profile page).
  if (!canCreateEvents) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeader title="Create Event" back />
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <div className="flex size-12 items-center justify-center rounded-md bg-muted text-muted-foreground">
              <IconLock className="size-6" />
            </div>
            <p className="text-sm text-muted-foreground">
              You don&apos;t have permission to create events for this organization.
            </p>
            <Button asChild variant="outline" size="sm">
              <Link href="/organizer/events">Back to events</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Create Event"
        description="Set up a new event for your organization."
        back
      />

      <Form {...form}>
        {/* No native onSubmit — the two footer buttons submit with their own draft flag. */}
        <form className="space-y-6">
          {/* ── Section 1: Event details ── */}
          <Card>
            <CardHeader>
              <CardTitle>Event Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Event name */}
              <FormField
                // @ts-ignore
                control={form.control}
                name="event_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Event Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter event name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Type selects — competition / participant / event_type / privacy. */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  {
                    name: "competition_type" as const,
                    label: "Competition Type",
                    options: [
                      { value: "tournament", label: "Tournament" },
                      { value: "scrims", label: "Scrims" },
                    ],
                  },
                  {
                    name: "participant_type" as const,
                    label: "Participant Type",
                    options: [
                      { value: "solo", label: "Solo" },
                      { value: "duo", label: "Duo" },
                      { value: "squad", label: "Squad" },
                    ],
                  },
                  {
                    name: "event_type" as const,
                    label: "Event Type",
                    options: [
                      { value: "internal", label: "Internal event" },
                      { value: "external", label: "External event" },
                    ],
                  },
                  {
                    name: "is_public" as const,
                    label: "Event Privacy",
                    options: [
                      { value: "True", label: "Public" },
                      { value: "False", label: "Private" },
                    ],
                  },
                ].map(({ name, label, options }) => (
                  <FormField
                    key={name}
                    // @ts-ignore
                    control={form.control}
                    name={name}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{label}</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {options.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ))}
              </div>

              {/* Event mode — drives the synthesised stage's stage_format, so it
                  must be a valid STAGE_FORMATS value the backend recognises. */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  // @ts-ignore
                  control={form.control}
                  name="event_mode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Event Mode</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select mode" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {/* The two most common formats — keep the organizer form lean. */}
                          <SelectItem value="br - normal">
                            Battle Royale - Normal
                          </SelectItem>
                          <SelectItem value="cs - normal">
                            Clash Squad - Normal
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Max teams / players. */}
                <FormField
                  // @ts-ignore
                  control={form.control}
                  name="max_teams_or_players"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Max Teams / Players</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          value={
                            field.value === undefined ||
                            field.value === null ||
                            field.value === 0
                              ? ""
                              : field.value.toString()
                          }
                          onChange={(e) => field.onChange(e.target.value)}
                          placeholder="e.g., 64"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Registration window — each side takes a date AND a time. */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <FormLabel>Registration Opens</FormLabel>
                  <div className="grid grid-cols-[1fr_auto] gap-2">
                    <FormField
                      // @ts-ignore
                      control={form.control}
                      name="registration_open_date"
                      render={({ field }) => (
                        <FormItem className="space-y-0">
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      // @ts-ignore
                      control={form.control}
                      name="registration_start_time"
                      render={({ field }) => (
                        <FormItem className="space-y-0">
                          <FormControl>
                            <Input type="time" className="w-28" {...field} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <FormLabel>Registration Closes</FormLabel>
                  <div className="grid grid-cols-[1fr_auto] gap-2">
                    <FormField
                      // @ts-ignore
                      control={form.control}
                      name="registration_end_date"
                      render={({ field }) => (
                        <FormItem className="space-y-0">
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      // @ts-ignore
                      control={form.control}
                      name="registration_end_time"
                      render={({ field }) => (
                        <FormItem className="space-y-0">
                          <FormControl>
                            <Input type="time" className="w-28" {...field} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              </div>

              {/* Event window — each side takes a date AND a time. */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <FormLabel>Event Start</FormLabel>
                  <div className="grid grid-cols-[1fr_auto] gap-2">
                    <FormField
                      // @ts-ignore
                      control={form.control}
                      name="start_date"
                      render={({ field }) => (
                        <FormItem className="space-y-0">
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      // @ts-ignore
                      control={form.control}
                      name="event_start_time"
                      render={({ field }) => (
                        <FormItem className="space-y-0">
                          <FormControl>
                            <Input type="time" className="w-28" {...field} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <FormLabel>Event End</FormLabel>
                  <div className="grid grid-cols-[1fr_auto] gap-2">
                    <FormField
                      // @ts-ignore
                      control={form.control}
                      name="end_date"
                      render={({ field }) => (
                        <FormItem className="space-y-0">
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      // @ts-ignore
                      control={form.control}
                      name="event_end_time"
                      render={({ field }) => (
                        <FormItem className="space-y-0">
                          <FormControl>
                            <Input type="time" className="w-28" {...field} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              </div>

              {/* Banner upload (optional) — trimmed dropzone from the admin Step1. */}
              <div className="space-y-2">
                <FormLabel>Event Banner (optional)</FormLabel>
                {!previewUrl ? (
                  <div
                    onClick={() => bannerInputRef.current?.click()}
                    className="border-2 border-dashed rounded-md p-10 text-center cursor-pointer bg-muted transition-colors hover:border-primary"
                  >
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center">
                        <IconPhoto size={28} className="text-primary dark:text-white" />
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Click to upload a banner —{" "}
                        <span className="text-primary font-medium">browse</span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Supports: PNG, JPG, JPEG, WEBP
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="relative w-full aspect-video bg-muted border rounded-md overflow-hidden">
                      <Image
                        width={1000}
                        height={1000}
                        src={previewUrl}
                        alt="Event banner preview"
                        className="aspect-video size-full object-cover"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="flex-1"
                        onClick={() => {
                          setSelectedFile(null);
                          setPreviewUrl("");
                          if (bannerInputRef.current) bannerInputRef.current.value = "";
                        }}
                      >
                        <IconX size={16} className="mr-2" /> Remove
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="flex-1"
                        onClick={() => bannerInputRef.current?.click()}
                      >
                        <IconUpload size={16} className="mr-2" /> Replace
                      </Button>
                    </div>
                  </div>
                )}
                <input
                  ref={bannerInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp"
                  className="hidden"
                  onChange={(e) => handleBannerFile(e.target.files?.[0])}
                />
              </div>
            </CardContent>
          </Card>

          {/* ── Section 2: Prize pool (reused admin component) ── */}
          {/* `form as any`: the zodResolver widens the form's internal TFieldValues
              generic, so the reused admin step's stricter UseFormReturn<EventFormType>
              prop type doesn't line up exactly. The admin wizard ts-ignores the same
              usage; we cast at the prop instead (cleaner than a multi-line ts-ignore). */}
          <Step5PrizePool form={form as any} />

          {/* ── Section 3: Rules (reused admin component; optional for organizers) ── */}
          {/* `form as any`: same resolver generic mismatch as Step5PrizePool above. */}
          <Step6EventRules
            form={form as any}
            rulesInputMethod={rulesInputMethod}
            setRulesInputMethod={setRulesInputMethod}
            selectedRuleFile={selectedRuleFile}
            setSelectedRuleFile={setSelectedRuleFile}
            previewRuleUrl={previewRuleUrl}
            setPreviewRuleUrl={setPreviewRuleUrl}
          />

          {/* ── Footer: draft vs publish ── */}
          <div className="flex flex-col sm:flex-row sm:justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={onSubmit(true)}
              disabled={isPending}
            >
              {isPending ? "Saving..." : "Save as draft"}
            </Button>
            <Button type="button" onClick={onSubmit(false)} disabled={isPending}>
              {isPending ? "Publishing..." : "Publish event"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
