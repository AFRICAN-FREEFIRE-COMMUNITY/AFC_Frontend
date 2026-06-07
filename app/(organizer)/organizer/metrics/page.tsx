// ─────────────────────────────────────────────────────────────────────────────
// Organizer › Metrics.
//
// An at-a-glance scorecard for the selected organization, aggregated across all of
// its events: how many events it has run, how many teams + players registered, the
// total kills tallied, and its average event rating (with the number of ratings
// behind that average). Detail comes from organizersApi.getOrgMetrics(slug), which
// returns:
//   { events_count, registered_teams, registered_players, total_kills,
//     average_rating, ratings_count }
//
// GATING: mirrors the rest of the portal (events → can_create_events, design →
// can_submit_designs, members → can_manage_members). Here the gate is
// membership.permissions.can_view_metrics OR isOwner. A member without that
// permission gets a read-only lock notice (mirrors the Design page's lock notice) -
// the stats are never fetched or shown.
//
// The selected slug is read from the OrganizerContext the portal layout provides -
// switching orgs in the layout re-mounts this subtree (keyed on slug), which re-runs
// the fetch below for the newly-selected org.
//
// Design mirrors the sibling organizer pages (overview / events) and the AFC StatCard
// idiom: PageHeader, a responsive grid of stat tiles (icon chip + big number + muted
// label) inside `Card`s - rounded-md, AFC dark surface - per AFC design constants.
// ─────────────────────────────────────────────────────────────────────────────

"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import {
  IconCalendarEvent,
  IconLock,
  IconStarFilled,
  IconSwords,
  IconUsers,
  IconUsersGroup,
} from "@tabler/icons-react";
import { organizersApi } from "@/lib/organizers";
import { useOrganizer } from "../_components/OrganizerContext";

// ── Metrics shape ───────────────────────────────────────────────────────────
// The aggregate payload getOrgMetrics(slug) returns. Every field is optional so the
// page renders sensibly even if a given backend build omits one (defaults to 0).
interface OrgMetrics {
  events_count?: number;
  registered_teams?: number;
  registered_players?: number;
  total_kills?: number;
  average_rating?: number;
  ratings_count?: number;
}

// ── Stat tile ─────────────────────────────────────────────────────────────────
// The AFC StatCard idiom (see organizer Overview): an icon chip + a big number + a
// muted label, inside a `Card`. `sub` is an optional muted line under the value -
// used to hang the ratings count beneath the average rating.
function StatCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-md bg-primary/10 text-primary">
          {icon}
        </div>
        <div>
          <p className="text-2xl font-bold">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
          {/* Optional sub-line - e.g. "from N ratings" under the average rating. */}
          {sub && <p className="text-[11px] text-muted-foreground/80">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function OrganizerMetricsPage() {
  const { slug, membership, isOwner } = useOrganizer();

  // Same gate the rest of the portal uses, on the metrics permission.
  const canViewMetrics = membership.permissions.can_view_metrics || isOwner;

  const [metrics, setMetrics] = useState<OrgMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  // ── Load this org's aggregate metrics. Only fetched when the caller is allowed
  // to see them (so a gated member never triggers the request). Re-runs on org
  // switch (the layout re-mounts this subtree keyed on slug, so `slug` is current). ──
  useEffect(() => {
    // Gated members see the lock notice, not the stats - skip the fetch entirely.
    if (!canViewMetrics) {
      setLoading(false);
      return;
    }

    const load = async () => {
      setLoading(true);
      try {
        const res = await organizersApi.getOrgMetrics(slug);
        setMetrics(res ?? null);
      } catch (err: any) {
        toast.error(
          err?.response?.data?.message || "Failed to load metrics.",
        );
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [slug, canViewMetrics]);

  // ── Non-permitted member: read-only lock notice (mirrors the Design page). ──
  if (!canViewMetrics) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeader
          title="Metrics"
          description="A scorecard for your organization."
        />
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <IconLock className="size-8 text-muted-foreground" />
            <p className="max-w-sm text-sm text-muted-foreground">
              You don&apos;t have permission to view this organization&apos;s
              metrics.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 gap-2 text-muted-foreground text-sm">
        Loading metrics...
      </div>
    );
  }

  // Coalesce every field to 0 so the tiles always render a number, never `undefined`.
  const eventsCount = metrics?.events_count ?? 0;
  const registeredTeams = metrics?.registered_teams ?? 0;
  const registeredPlayers = metrics?.registered_players ?? 0;
  const totalKills = metrics?.total_kills ?? 0;
  const ratingsCount = metrics?.ratings_count ?? 0;
  // Average rating: show one decimal (e.g. "4.3"), or an em-dash when there are no
  // ratings yet (so we never print a misleading "0.0").
  const averageRating =
    ratingsCount > 0 && metrics?.average_rating != null
      ? metrics.average_rating.toFixed(1)
      : "-";

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Metrics"
        description="A scorecard for your organization, across all of its events."
      />

      {/* Responsive stat grid - 1 col on mobile, 2 on small, 3 on large. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <StatCard
          icon={<IconCalendarEvent className="size-5" />}
          label="Events"
          value={eventsCount}
        />
        <StatCard
          icon={<IconUsersGroup className="size-5" />}
          label="Registered teams"
          value={registeredTeams}
        />
        <StatCard
          icon={<IconUsers className="size-5" />}
          label="Registered players"
          value={registeredPlayers}
        />
        <StatCard
          icon={<IconSwords className="size-5" />}
          label="Total kills"
          value={totalKills}
        />
        <StatCard
          icon={<IconStarFilled className="size-5" />}
          label="Average rating"
          value={averageRating}
          // Hang the number of ratings behind the average under the value.
          sub={`from ${ratingsCount} rating${ratingsCount !== 1 ? "s" : ""}`}
        />
      </div>
    </div>
  );
}
