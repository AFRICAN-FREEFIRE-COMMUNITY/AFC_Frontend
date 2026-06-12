"use client";

// StepSponsorRequirement = create-wizard step 7 (sponsor-system redesign P2).
//
// PRIMARY surface: the shared SponsorshipBuilder (components/sponsorship-builder.tsx).
// The event does NOT exist yet at this step, so the builder rows live in the form
// field `sponsorships` (EventFormSchema in ./types.ts, z.array(z.any()).optional()).
// They are NOT part of the create-event FormData: after POST /events/create-event/
// returns the new event_id, the create page loops the rows and calls
// sponsorsApi.attachEvent + configureSponsorship per sponsor (see the onSubmit in
// app/(a)/a/events/create/page.tsx and the organizer twin).
//
// LEGACY surface: the old free-text fields (is_sponsored toggle, sponsor_name,
// sponsor accounts, requirement description, field label) collapse into a <details>
// below the builder so the pre-redesign flow stays available.
//
// CONSUMED BY:
//  - app/(a)/a/events/create/page.tsx                 (admin create wizard, step 7)
//  - app/(organizer)/organizer/events/create/page.tsx (organizer create wizard reuses
//    this exact component, so it gets the builder for free)

import React, { useEffect, useState } from "react";
import { UseFormReturn } from "react-hook-form";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  SponsorshipBuilder,
  SponsorshipDraft,
} from "@/components/sponsorship-builder";
import { useAuth } from "@/contexts/AuthContext";
import { env } from "@/lib/env";
import { IconChevronRight, IconLoader2 } from "@tabler/icons-react";
import axios from "axios";
import { InfoTip } from "@/components/ui/info-tip";
import { EventFormType } from "./types";

interface Sponsor {
  user_id: number;
  full_name: string;
  username: string;
  email: string;
}

interface StepSponsorRequirementProps {
  form: UseFormReturn<EventFormType>;
}

export function StepSponsorRequirement({ form }: StepSponsorRequirementProps) {
  const sponsorRequired = form.watch("is_sponsored");
  const { token } = useAuth();

  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [sponsorsLoading, setSponsorsLoading] = useState(false);

  // ── Sponsor-system P2: builder rows ride in the `sponsorships` form field. ──
  // eventId is null on purpose: the event doesn't exist yet, so the create page
  // attaches + configures these AFTER create-event returns the new event_id.
  const sponsorships: SponsorshipDraft[] =
    // @ts-ignore - sponsorships is z.array(z.any()) in the schema; narrow it here.
    (form.watch("sponsorships") as SponsorshipDraft[] | undefined) ?? [];

  const setSponsorships = (next: SponsorshipDraft[]) => {
    // shouldDirty so leaving the wizard mid-edit is detected like any other field.
    // @ts-ignore - same loose-typing idiom as the other wizard setValue calls.
    form.setValue("sponsorships", next, { shouldDirty: true });
  };

  // ── legacy: fetch the old sponsor ACCOUNTS list when the legacy toggle is on ──
  useEffect(() => {
    if (!sponsorRequired || !token) return;
    const fetchSponsors = async () => {
      setSponsorsLoading(true);
      try {
        const res = await axios.get(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/get-all-sponsors/`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        setSponsors(res.data ?? []);
      } catch {
        // silently fail
      } finally {
        setSponsorsLoading(false);
      }
    };
    fetchSponsors();
  }, [sponsorRequired, token]);

  const selectedUsernames: string[] =
    // @ts-ignore
    form.watch("sponsor_usernames") ?? [];

  const toggleSponsor = (username: string) => {
    const current = selectedUsernames;
    const updated = current.includes(username)
      ? current.filter((u) => u !== username)
      : [...current, username];
    // @ts-ignore
    form.setValue("sponsor_usernames", updated);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          Step 7: Sponsors
          <InfoTip id="events.create.sponsor._section" className="ml-1.5" />
        </CardTitle>
        <CardDescription>
          Attach sponsors and build the engagements participants must complete
          during registration.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* ════════ PRIMARY: sponsor picker + engagement builder (P2) ════════ */}
        <SponsorshipBuilder
          eventId={null}
          value={sponsorships}
          onChange={setSponsorships}
        />

        {/* ════════ LEGACY: old free-text sponsor fields, collapsed ════════ */}
        {/* Opens automatically if the legacy toggle is already on (e.g. a duplicate
            of an old event pre-filled is_sponsored). Saved through the normal
            create-event FormData exactly as before. */}
        <details className="group rounded-md border" open={sponsorRequired}>
          <summary className="flex cursor-pointer items-center gap-2 px-4 py-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
            <IconChevronRight className="size-4 transition-transform group-open:rotate-90" />
            Legacy fields
            {sponsorRequired && (
              <Badge variant="outline" className="rounded-full px-2 py-0.5 text-xs">
                in use
              </Badge>
            )}
          </summary>

          <div className="space-y-6 border-t px-4 py-4">
            <p className="text-xs text-muted-foreground">
              The old single-sponsor flow (free-text name + one UUID field). Kept
              for continuity; new events should use the builder above instead.
            </p>

            {/* Toggle */}
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <Label htmlFor="sponsor-toggle">Enable Sponsor Requirement</Label>
                <p className="text-xs text-muted-foreground">
                  Require players to complete a sponsor task and submit a UUID
                  before registering.
                </p>
              </div>
              <FormField
                // @ts-ignore
                control={form.control}
                name="is_sponsored"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Switch
                        id="sponsor-toggle"
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            {sponsorRequired && (
              <div className="space-y-4">
                {/* Sponsor Name (company name - manual input) */}
                <FormField
                  // @ts-ignore
                  control={form.control}
                  name="sponsor_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Sponsor / Company Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Acme Corp" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Sponsor Multi-Select */}
                <div className="flex flex-col gap-1.5">
                  <Label>Sponsor Accounts</Label>
                  <p className="text-xs text-muted-foreground">
                    Select one or more sponsor accounts to associate with this
                    event.
                  </p>
                  {sponsorsLoading ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                      <IconLoader2 className="size-4 animate-spin" />
                      Loading sponsors...
                    </div>
                  ) : sponsors.length === 0 ? (
                    <p className="text-sm text-muted-foreground mt-1">
                      No sponsors available.
                    </p>
                  ) : (
                    <div className="rounded-md border divide-y max-h-48 overflow-y-auto">
                      {sponsors.map((s) => (
                        <label
                          key={s.user_id}
                          className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-muted/50 transition-colors"
                        >
                          <Checkbox
                            checked={selectedUsernames.includes(s.username)}
                            onCheckedChange={() => toggleSponsor(s.username)}
                          />
                          <span className="text-sm">
                            {s.full_name}{" "}
                            <span className="text-muted-foreground">
                              (@{s.username})
                            </span>
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                  {selectedUsernames.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {selectedUsernames.length} sponsor
                      {selectedUsernames.length !== 1 ? "s" : ""} selected
                    </p>
                  )}
                </div>

                {/* Requirement Description */}
                <FormField
                  // @ts-ignore
                  control={form.control}
                  name="sponsor_requirement_description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Requirement Description</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="e.g. Download our app on the App Store, create an account, and enter your Player UUID below."
                          className="min-h-[100px]"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* UUID Field Label */}
                <FormField
                  // @ts-ignore
                  control={form.control}
                  name="sponsor_field_label"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>UUID Field Label</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Player UUID" {...field} />
                      </FormControl>
                      <p className="text-xs text-muted-foreground">
                        This is the label shown next to the input field during
                        registration.
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}
          </div>
        </details>
      </CardContent>
    </Card>
  );
}
