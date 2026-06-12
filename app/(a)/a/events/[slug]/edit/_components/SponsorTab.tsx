"use client";

// SponsorTab = the edit wizard's Sponsor surface (sponsor-system redesign P2).
//
// PRIMARY surface: the shared SponsorshipBuilder (components/sponsorship-builder.tsx) -
// pick existing sponsor entities, toggle "requires approval", and build each sponsor's
// engagement list. Persistence happens HERE on "Save Sponsors":
//   - hydrate:   GET  sponsors/for-event/<event_id>/        (sponsorsApi.forEvent)
//   - new row:   POST sponsors/<id>/events/attach/          (sponsorsApi.attachEvent)
//   - removed:   DELETE sponsors/<id>/events/<event_id>/    (sponsorsApi.detachEvent)
//   - all rows:  PATCH sponsors/<id>/events/<eid>/configure/ (sponsorsApi.configureSponsorship,
//                always re-sent so approval + engagement edits land)
//
// LEGACY surface: the pre-redesign free-text fields (is_sponsored toggle, sponsor_name,
// sponsor account checkboxes, requirement description, field label) live on in a collapsed
// <details> so OLD events that still use them keep working. They save through the parent's
// existing onSave (POST /events/edit-event/), untouched.
//
// CONSUMED BY:
//  - app/(a)/a/events/[slug]/edit/page.tsx            (admin edit wizard, passes eventId)
//  - app/(organizer)/organizer/events/[slug]/edit/page.tsx (organizer edit wizard,
//    hideAdminReviewLink + eventId)

import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  SponsorshipBuilder,
  SponsorshipDraft,
  sponsorshipIssues,
} from "@/components/sponsorship-builder";
import { sponsorsApi } from "@/lib/sponsors";
import { env } from "@/lib/env";
import { useAuth } from "@/contexts/AuthContext";
import { IconChevronRight, IconLoader2, IconUserCheck } from "@tabler/icons-react";
import axios from "axios";
import Link from "next/link";
import { toast } from "sonner";

interface Sponsor {
  user_id: number;
  full_name: string;
  username: string;
  email: string;
}

export interface SponsorForm {
  is_sponsored: boolean;
  sponsor_name: string;
  sponsor_usernames: string[];
  requirement_description: string;
  sponsor_field_label: string;
}

interface SponsorTabProps {
  slug: string;
  sponsorForm: SponsorForm;
  setSponsorForm: React.Dispatch<React.SetStateAction<SponsorForm>>;
  onSave: () => void;
  saving: boolean;
  // ── Organizer reuse ─────────────────────────────────────────────────────────
  // When true, the "Review Sponsors" shortcut is hidden because it deep-links into
  // the ADMIN route (/a/events/<slug>/sponsors), which an organizer can't reach. The
  // sponsor toggle + accounts editing all still work. The admin edit page leaves this
  // undefined (defaults false), so its "Review Sponsors" button is unchanged.
  hideAdminReviewLink?: boolean;
  // ── Sponsor-system P2 ───────────────────────────────────────────────────────
  // The event's numeric id, needed by the sponsorship endpoints (they key on
  // event_id, not slug). Both edit pages pass eventDetails.event_id. When absent
  // (shouldn't happen once the event has loaded) the builder section shows a loader.
  eventId?: number | null;
}

export default function SponsorTab({
  slug,
  sponsorForm,
  setSponsorForm,
  onSave,
  saving,
  hideAdminReviewLink = false,
  eventId = null,
}: SponsorTabProps) {
  const { token } = useAuth();

  // ── legacy sponsor-account list (old system, unchanged) ──
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [sponsorsLoading, setSponsorsLoading] = useState(false);

  // ── sponsorship builder state (new system) ──
  // rows = the working copy the builder edits. savedIdsRef = the sponsor ids that are
  // attached ON THE SERVER right now; saving diffs rows against it to decide
  // attach vs detach (config is always re-patched).
  const [rows, setRows] = useState<SponsorshipDraft[]>([]);
  const [rowsLoading, setRowsLoading] = useState(false);
  const [savingSponsorships, setSavingSponsorships] = useState(false);
  const savedIdsRef = useRef<Set<number>>(new Set());

  // Hydrate the builder from the event's current sponsorships.
  useEffect(() => {
    if (!eventId) return;
    let cancelled = false;
    setRowsLoading(true);
    sponsorsApi
      .forEvent(eventId)
      .then((res) => {
        if (cancelled) return;
        const hydrated: SponsorshipDraft[] = (res.results ?? []).map((r) => ({
          sponsor_id: r.sponsor.id,
          sponsor_name: r.sponsor.name,
          requires_approval: r.requires_approval,
          engagements: r.engagements ?? [],
        }));
        setRows(hydrated);
        savedIdsRef.current = new Set(hydrated.map((r) => r.sponsor_id));
      })
      .catch(() => {
        // Leave the builder empty; saving will then just attach whatever is added.
      })
      .finally(() => {
        if (!cancelled) setRowsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  // Diff-save the builder rows against the server state (see file header for the
  // endpoint map). Partial failures are collected and toasted; whatever succeeded
  // is reflected into savedIdsRef so a retry only re-runs the failed pieces.
  const saveSponsorships = async () => {
    if (!eventId) return;

    // Client-side mirror of the server's engagement schema - warn before the 400.
    const issues = sponsorshipIssues(rows);
    if (issues.length > 0) {
      toast.error(issues[0] + (issues.length > 1 ? ` (+${issues.length - 1} more)` : ""));
      return;
    }

    setSavingSponsorships(true);
    const failed: string[] = [];
    const saved = savedIdsRef.current;

    // 1) detach sponsors that were removed in the UI
    const removedIds = [...saved].filter((id) => !rows.some((r) => r.sponsor_id === id));
    for (const id of removedIds) {
      try {
        await sponsorsApi.detachEvent(id, eventId);
        saved.delete(id);
      } catch {
        failed.push(`detach sponsor #${id}`);
      }
    }

    // 2) attach new sponsors, then (re)patch every row's config so approval +
    //    engagement edits always land, even on rows that were already attached.
    for (const row of rows) {
      try {
        if (!saved.has(row.sponsor_id)) {
          await sponsorsApi.attachEvent(row.sponsor_id, eventId);
          saved.add(row.sponsor_id);
        }
        await sponsorsApi.configureSponsorship(row.sponsor_id, eventId, {
          requires_approval: row.requires_approval,
          engagements: row.engagements,
        });
      } catch (err: any) {
        failed.push(
          `${row.sponsor_name} (${err?.response?.data?.message || "request failed"})`,
        );
      }
    }

    setSavingSponsorships(false);
    if (failed.length > 0) {
      toast.error(`Some sponsor changes failed: ${failed.join(", ")}`);
    } else {
      toast.success("Sponsors saved!");
    }
  };

  // ── legacy: fetch the old sponsor ACCOUNTS list (users with the sponsor role) ──
  useEffect(() => {
    if (!sponsorForm.is_sponsored || !token) return;
    setSponsorsLoading(true);
    axios
      .get(`${env.NEXT_PUBLIC_BACKEND_API_URL}/events/get-all-sponsors/`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => setSponsors(res.data ?? []))
      .catch(() => {})
      .finally(() => setSponsorsLoading(false));
  }, [sponsorForm.is_sponsored, token]);

  const toggleSponsor = (username: string) => {
    setSponsorForm((p) => ({
      ...p,
      sponsor_usernames: p.sponsor_usernames.includes(username)
        ? p.sponsor_usernames.filter((u) => u !== username)
        : [...p.sponsor_usernames, username],
    }));
  };

  return (
    <div className="space-y-4">
      {/* ════════ PRIMARY: sponsor picker + engagement builder (P2) ════════ */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Sponsors for this event</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Attach sponsor entities and build the engagements registrants must
              complete (collect an ID, follow socials, create an account, join a group).
            </p>
          </div>
          {rows.length > 0 && <Badge variant="default">{rows.length} attached</Badge>}
        </CardHeader>
        <CardContent>
          {rowsLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <IconLoader2 className="size-4 animate-spin" />
              Loading sponsorships...
            </div>
          ) : (
            <SponsorshipBuilder eventId={eventId} value={rows} onChange={setRows} />
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={saveSponsorships} disabled={savingSponsorships || rowsLoading}>
          {savingSponsorships && <IconLoader2 className="size-4 animate-spin mr-2" />}
          {savingSponsorships ? "Saving..." : "Save Sponsors"}
        </Button>
      </div>

      {/* ════════ LEGACY: free-text sponsor fields (old events keep working) ════════ */}
      {/* Collapsed by default; opens automatically when the event still uses the old
          system (is_sponsored). Saving here goes through the parent's onSave, which
          POSTs the full /events/edit-event/ payload exactly as before. */}
      <details className="group rounded-md border" open={sponsorForm.is_sponsored}>
        <summary className="flex cursor-pointer items-center gap-2 px-4 py-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
          <IconChevronRight className="size-4 transition-transform group-open:rotate-90" />
          Legacy sponsor fields
          {sponsorForm.is_sponsored && (
            <Badge variant="outline" className="rounded-full px-2 py-0.5 text-xs">
              in use
            </Badge>
          )}
        </summary>

        <div className="space-y-6 border-t px-4 py-4">
          <div className="flex items-start justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              The old single-sponsor flow (free-text name + one UUID field). Kept so
              events created before the sponsor system redesign keep working. New
              events should use the builder above instead.
            </p>
            {/* "Review Sponsors" deep-links into the admin route, so it's hidden
                on the organizer surface (hideAdminReviewLink). Lives in the body
                (not the summary) so clicking it never toggles the details. */}
            {sponsorForm.is_sponsored && !hideAdminReviewLink && (
              <Button size="sm" variant="secondary" asChild className="shrink-0">
                <Link href={`/a/events/${slug}/sponsors`}>
                  <IconUserCheck className="size-3.5 mr-1" />
                  Review Sponsors
                </Link>
              </Button>
            )}
          </div>

          {/* Toggle */}
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label htmlFor="sponsor-toggle">Enable Sponsor Requirement</Label>
              <p className="text-xs text-muted-foreground">
                Players will be prompted to input their sponsor ID during
                registration.
              </p>
            </div>
            <Switch
              id="sponsor-toggle"
              checked={sponsorForm.is_sponsored}
              onCheckedChange={(v) =>
                setSponsorForm((p) => ({ ...p, is_sponsored: v }))
              }
            />
          </div>

          {sponsorForm.is_sponsored && (
            <div className="space-y-4">
              {/* Sponsor / Company Name */}
              <div className="space-y-1.5">
                <Label>Sponsor / Company Name</Label>
                <Input
                  placeholder="e.g. Garena, Supercell"
                  value={sponsorForm.sponsor_name}
                  onChange={(e) =>
                    setSponsorForm((p) => ({
                      ...p,
                      sponsor_name: e.target.value,
                    }))
                  }
                />
              </div>

              {/* Sponsor Accounts Multi-Select */}
              <div className="space-y-1.5">
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
                          checked={sponsorForm.sponsor_usernames.includes(
                            s.username,
                          )}
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
                {sponsorForm.sponsor_usernames.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {sponsorForm.sponsor_usernames.length} sponsor
                    {sponsorForm.sponsor_usernames.length !== 1 ? "s" : ""}{" "}
                    selected
                  </p>
                )}
              </div>

              {/* Requirement Description */}
              <div className="space-y-1.5">
                <Label>Requirement Description</Label>
                <Textarea
                  placeholder="e.g. Download the Garena app, create an account, and enter your Garena UUID below."
                  value={sponsorForm.requirement_description}
                  onChange={(e) =>
                    setSponsorForm((p) => ({
                      ...p,
                      requirement_description: e.target.value,
                    }))
                  }
                  rows={4}
                />
              </div>

              {/* Field Label */}
              <div className="space-y-1.5">
                <Label>Field Label</Label>
                <Input
                  placeholder="e.g. Garena UUID, Player ID, Account ID"
                  value={sponsorForm.sponsor_field_label}
                  onChange={(e) =>
                    setSponsorForm((p) => ({
                      ...p,
                      sponsor_field_label: e.target.value,
                    }))
                  }
                />
                <p className="text-xs text-muted-foreground">
                  This label appears next to the input field players see during
                  registration.
                </p>
              </div>
            </div>
          )}

          <div className="flex justify-end">
            <Button variant="outline" onClick={onSave} disabled={saving}>
              {saving && <IconLoader2 className="size-4 animate-spin mr-2" />}
              {saving ? "Saving..." : "Save Legacy Sponsor Settings"}
            </Button>
          </div>
        </div>
      </details>
    </div>
  );
}
