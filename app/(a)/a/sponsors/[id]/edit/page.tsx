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
import { Badge } from "@/components/ui/badge";
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
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { IconLoader2, IconSearch } from "@tabler/icons-react";
import { useAuth } from "@/contexts/AuthContext";
import { env } from "@/lib/env";

// ── Schema ────────────────────────────────────────────────────────────────────

const schema = z.object({
  full_name: z.string().min(1, "Full name is required"),
  email: z.string().email("Valid email required"),
  username: z.string().min(1, "Username is required"),
  event_ids: z.array(z.number()).min(1, "Select at least one event"),
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
    },
  });

  const selectedIds = form.watch("event_ids");

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
        axios.get(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/get-all-events/`,
          { headers: { Authorization: `Bearer ${token}` } },
        ),
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
            </CardContent>
          </Card>

          {/* Event assignment */}
          <Card>
            <CardHeader className="border-b">
              <CardTitle className="flex items-center gap-2">
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
