"use client";

import { use, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import axios from "axios";
import { toast } from "sonner";

import { FullLoader } from "@/components/Loader";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { IconLoader2, IconSearch } from "@tabler/icons-react";
import { useAuth } from "@/contexts/AuthContext";
import { env } from "@/lib/env";

// ── Schema ────────────────────────────────────────────────────────────────────

const schema = z.object({
  sponsor_name: z.string().min(1, "Sponsor name is required"),
  requirement_description: z.string().min(1, "Description is required"),
  uuid_label: z.string().min(1, "Field label is required"),
  event_ids: z.array(z.number()).min(1, "Select at least one event"),
});

type FormValues = z.infer<typeof schema>;

interface EventOption {
  event_id: number;
  event_name: string;
  event_status: string;
  slug: string;
  is_sponsored?: boolean;
  sponsor_username?: string;
}

// ── Helper: fetch one event's full details and call edit-event ─────────────────

async function updateEventSponsor(
  event: EventOption,
  isSponsored: boolean,
  sponsorUsername: string,
  sponsorName: string,
  requirementDescription: string,
  uuidLabel: string,
  token: string,
) {
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };

  // Fetch full event details (need both endpoints, same as edit-event page)
  const [detailsRes, adminRes] = await Promise.all([
    axios.post(
      `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/get-event-details/`,
      { slug: event.slug },
      { headers },
    ),
    axios.post(
      `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/get-event-details-for-admin/`,
      { slug: event.slug },
      { headers },
    ),
  ]);

  const ed = detailsRes.data.event_details;
  const adminStages =
    adminRes.data.event_details?.stages || adminRes.data.stages || [];

  // Build FormData — pass all existing event fields through, update sponsor fields
  const formData = new FormData();
  formData.append("event_id", ed.event_id.toString());
  formData.append("event_status", ed.event_status ?? "upcoming");
  formData.append("is_draft", "False");
  formData.append("event_name", ed.event_name ?? "");
  formData.append("competition_type", ed.competition_type ?? "");
  formData.append("participant_type", ed.participant_type ?? "");
  formData.append("event_type", ed.event_type ?? "");
  formData.append("is_public", ed.is_public ? "True" : "False");
  formData.append(
    "max_teams_or_players",
    String(ed.max_teams_or_players ?? 1),
  );
  formData.append("event_mode", ed.event_mode ?? "");
  formData.append("prizepool", ed.prizepool ?? "");
  formData.append("number_of_stages", String(adminStages.length || 1));
  formData.append("start_date", ed.start_date ?? "");
  formData.append("end_date", ed.end_date ?? "");
  formData.append("registration_open_date", ed.registration_open_date ?? "");
  formData.append("registration_end_date", ed.registration_end_date ?? "");
  formData.append("registration_link", ed.registration_link ?? "");
  formData.append(
    "publish_to_tournaments",
    String(ed.tournament_tier !== "" && !!ed.tournament_tier),
  );
  formData.append("publish_to_news", "false");
  formData.append(
    "registration_restriction",
    ed.registration_restriction ?? "none",
  );
  formData.append(
    "restriction_mode",
    ed.restriction_mode ?? "allow_only",
  );
  formData.append(
    "restricted_countries",
    JSON.stringify(ed.restricted_countries ?? []),
  );
  formData.append("event_rules", ed.event_rules ?? "");
  formData.append(
    "prize_distribution",
    JSON.stringify(ed.prize_distribution ?? {}),
  );
  formData.append(
    "stream_channels",
    JSON.stringify(
      (ed.stream_channels ?? []).filter((s: string) => s.trim() !== ""),
    ),
  );
  formData.append("stages", JSON.stringify(adminStages));

  // ── Updated sponsor fields ──
  formData.append("is_sponsored", isSponsored ? "True" : "False");
  formData.append("sponsor_name", isSponsored ? sponsorName : "");
  formData.append("sponsor_username", isSponsored ? sponsorUsername : "");
  formData.append(
    "requirement_description",
    isSponsored ? requirementDescription : "",
  );
  formData.append("uuid_label", isSponsored ? uuidLabel : "Player UUID");

  await fetch(`${env.NEXT_PUBLIC_BACKEND_API_URL}/events/edit-event/`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
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
      sponsor_name: "",
      requirement_description: "",
      uuid_label: "Player UUID",
      event_ids: [],
    },
  });

  const selectedIds = form.watch("event_ids");

  // ── Load all events and pre-populate form from currently assigned ones ──────

  const loadData = useCallback(async () => {
    if (!token) return;
    try {
      const res = await axios.get(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/get-all-events/`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const allEvents: EventOption[] = res.data.events ?? [];
      setEvents(allEvents);

      // Events where this sponsor is currently assigned
      const assigned = allEvents.filter(
        (e) =>
          e.is_sponsored && e.sponsor_username === sponsorUsername,
      );

      // Pre-populate sponsor settings from the first assigned event's details
      if (assigned.length > 0) {
        try {
          const detailsRes = await axios.post(
            `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/get-event-details/`,
            { slug: assigned[0].slug },
            { headers: { Authorization: `Bearer ${token}` } },
          );
          const ed = detailsRes.data.event_details;
          form.reset({
            sponsor_name: ed.sponsor_name ?? "",
            requirement_description: ed.sponsor_requirement_description ?? "",
            uuid_label: ed.sponsor_field_label ?? "Player UUID",
            event_ids: assigned.map((e) => e.event_id),
          });
        } catch {
          // fallback: just set the event IDs
          form.setValue(
            "event_ids",
            assigned.map((e) => e.event_id),
          );
        }
      }
    } catch {
      toast.error("Failed to load events.");
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
      // Determine which events changed assignment
      const previouslyAssigned = events
        .filter((e) => e.is_sponsored && e.sponsor_username === sponsorUsername)
        .map((e) => e.event_id);

      const toAdd = values.event_ids.filter(
        (id) => !previouslyAssigned.includes(id),
      );
      const toRemove = previouslyAssigned.filter(
        (id) => !values.event_ids.includes(id),
      );
      // Events that remain assigned also need sponsor field updates
      const toUpdate = values.event_ids.filter((id) =>
        previouslyAssigned.includes(id),
      );

      const allAffected = [
        ...toAdd.map((id) => ({ id, sponsored: true })),
        ...toRemove.map((id) => ({ id, sponsored: false })),
        ...toUpdate.map((id) => ({ id, sponsored: true })),
      ];

      // Call edit-event for each affected event
      for (const { id, sponsored } of allAffected) {
        const event = events.find((e) => e.event_id === id);
        if (!event) continue;

        await updateEventSponsor(
          event,
          sponsored,
          sponsorUsername,
          values.sponsor_name,
          values.requirement_description,
          values.uuid_label,
          token,
        );
      }

      toast.success("Sponsor settings updated successfully.");
      router.push("/a/sponsors");
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message ||
          err?.response?.data?.detail ||
          "Failed to update sponsor settings.",
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
        description="Update sponsor settings and event assignments."
      />

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-col gap-6"
        >
          {/* Sponsor settings */}
          <Card>
            <CardHeader className="border-b">
              <CardTitle>Sponsor Settings</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 pt-4">
              <FormField
                control={form.control}
                name="sponsor_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sponsor Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Garena, Supercell" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="uuid_label"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Field Label</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g. Garena UUID, Player ID"
                        {...field}
                      />
                    </FormControl>
                    <p className="text-xs text-muted-foreground">
                      Label shown to players during registration.
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="requirement_description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Requirement Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="e.g. Download the app, create an account, and enter your UUID below."
                        rows={4}
                        {...field}
                      />
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
              <CardTitle className="flex gap-1 items-center">
                Assigned Events
                {selectedIds.length > 0 && (
                  <Badge variant="secondary">{selectedIds.length} selected</Badge>
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
              Save Changes
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
