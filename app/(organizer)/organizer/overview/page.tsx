// ─────────────────────────────────────────────────────────────────────────────
// Organizer › Overview.
//
// The portal landing page for the selected organization: a summary card (logo,
// name, status badge) plus the headline counts - members and events. Detail comes
// from organizersApi.getOrganization(slug); the member/event counts are derived
// from the related lists the same endpoint returns (so no extra round-trips).
//
// The selected slug is read from the OrganizerContext the portal layout provides -
// switching orgs in the layout re-mounts this subtree (keyed on slug), which
// re-runs the fetch below for the newly-selected org.
// ─────────────────────────────────────────────────────────────────────────────

"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { IconBuilding, IconCalendarEvent, IconUsers } from "@tabler/icons-react";
import { organizersApi } from "@/lib/organizers";
import { useOrganizer } from "../_components/OrganizerContext";

// ── Status badge ──────────────────────────────────────────────────────────────
// Outline badge (rounded-full, text-xs) per AFC constants; colour by org status.

function StatusBadge({ status }: { status: string }) {
  const normalized = (status || "").toLowerCase();
  const colour =
    normalized === "active"
      ? "border-green-500 text-green-600"
      : normalized === "suspended"
        ? "border-red-500 text-red-600"
        : "border-yellow-500 text-yellow-600";
  return (
    <Badge variant="outline" className={`capitalize ${colour}`}>
      {status || "unknown"}
    </Badge>
  );
}

// ── Stat tile ─────────────────────────────────────────────────────────────────
// Small count card reused for the member + event totals.

function StatTile({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
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
        </div>
      </CardContent>
    </Card>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function OrganizerOverviewPage() {
  const { slug } = useOrganizer();

  const [org, setOrg] = useState<any>(null);
  const [memberCount, setMemberCount] = useState(0);
  const [eventCount, setEventCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // ── Load the selected org's detail (and its member/event lists for counts). ──
  useEffect(() => {
    const load = async () => {
      try {
        const res = await organizersApi.getOrganization(slug);
        setOrg(res?.organization ?? null);
        // getOrganization returns the org detail with the headline counts inline
        // (member_count = active members, event_count = events homed here).
        setMemberCount(res?.organization?.member_count ?? 0);
        setEventCount(res?.organization?.event_count ?? 0);
      } catch (err: any) {
        toast.error(
          err?.response?.data?.message || "Failed to load organization.",
        );
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [slug]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 gap-2 text-muted-foreground text-sm">
        Loading organization...
      </div>
    );
  }

  if (!org) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          Could not load this organization.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Overview"
        description="A snapshot of your organization."
      />

      {/* Summary card: logo + name + status. */}
      <Card>
        <CardContent className="flex flex-col sm:flex-row sm:items-center gap-4">
          {/* Logo (or a placeholder when none is set). */}
          <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted">
            {org.logo ? (
              // Org logos can come from arbitrary upload hosts, so use a plain <img>
              // rather than next/image (avoids per-domain remotePatterns config).
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={org.logo}
                alt={`${org.name} logo`}
                className="size-full object-cover"
              />
            ) : (
              <IconBuilding className="size-7 text-muted-foreground" />
            )}
          </div>

          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold">{org.name}</h2>
              <StatusBadge status={org.status} />
            </div>
            {org.description && (
              <p className="text-sm text-muted-foreground line-clamp-2">
                {org.description}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Headline counts. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <StatTile
          icon={<IconUsers className="size-5" />}
          label="Members"
          value={memberCount}
        />
        <StatTile
          icon={<IconCalendarEvent className="size-5" />}
          label="Events"
          value={eventCount}
        />
      </div>
    </div>
  );
}
