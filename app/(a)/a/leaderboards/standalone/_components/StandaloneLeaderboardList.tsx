"use client";

// ── StandaloneLeaderboardList ─────────────────────────────────────────────────
// A self-contained "Standalone leaderboards" section: a Card with a header + "Create standalone"
// button and a table of the caller's standalone leaderboards. Shared by BOTH list surfaces so the
// admin and organizer sections look identical:
//   • app/(a)/a/_components/LeaderboardsAdminContent.tsx  (admin — no org scope, sees all it can manage)
//   • app/(organizer)/organizer/leaderboards/page.tsx     (organizer — scoped via organizationId prop)
//
// Data: GET /leaderboards/standalone/ (standaloneLeaderboardsApi.list) — the house pagination envelope
// {results, has_more, next_offset, total_count}. The organizer surface passes organizationId so the
// backend scopes to that org. Rows link to the view page /a/leaderboards/standalone/<id>.
//
// Design: AFC table constants — text-xs cells, p-2 padding, h-10 header rows, text-foreground headers,
// rounded-md bordered card, outline rounded-full status/format badges. No em/en dashes in copy.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { IconEye, IconPlus, IconTrophy } from "@tabler/icons-react";
import { InfoTip } from "@/components/ui/info-tip";
import { formatDate } from "@/lib/utils";
import {
  standaloneLeaderboardsApi,
  type StandaloneLeaderboardHeader,
  type RankingTier,
} from "@/lib/standaloneLeaderboards";

// Stream P3: human labels for leaderboard.ranking_tier, rendered as a chip beside the status badge
// on ranked leaderboards. Mirrors the same map on the standalone view page.
const TIER_LABELS: Record<RankingTier, string> = {
  tier_1: "Tier 1",
  tier_2: "Tier 2",
  tier_3: "Tier 3",
};

export function StandaloneLeaderboardList({
  organizationId,
  createHref = "/a/leaderboards/standalone/create",
  viewHrefBase = "/a/leaderboards/standalone",
}: {
  // When set (organizer surface), the list is scoped to this org. Omitted on the admin surface.
  organizationId?: number;
  // Where "Create standalone" points (default = the admin wizard; both surfaces use the same wizard).
  createHref?: string;
  // Route base each row's "View" link points at (default = the admin view; the organizer surface
  // passes its own base so the link lands inside the organizer portal it can actually reach).
  // The row link is `${viewHrefBase}/${lb.id}`.
  viewHrefBase?: string;
}) {
  const [rows, setRows] = useState<StandaloneLeaderboardHeader[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, any> = { limit: 50 };
      if (organizationId) params.organization_id = organizationId;
      const res = await standaloneLeaderboardsApi.list(params);
      // Envelope is {results,...}; tolerate a bare array just in case.
      setRows(res?.results ?? res ?? []);
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message || "Failed to load standalone leaderboards.",
      );
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Card className="rounded-md">
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="flex items-center text-base">
          <IconTrophy className="mr-1.5 size-4" />
          Standalone leaderboards
          <InfoTip
            text="Leaderboards not tied to an event. Add real or ghost teams/players, enter per-map results, and publish standings."
            className="ml-1.5"
          />
        </CardTitle>
        <Button asChild size="sm">
          <Link href={createHref}>
            <IconPlus className="size-4" /> Create standalone
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
            Loading standalone leaderboards...
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
            <div className="flex size-12 items-center justify-center rounded-md bg-primary/10 text-primary">
              <IconTrophy className="size-6" />
            </div>
            <p className="text-sm text-muted-foreground">
              No standalone leaderboards yet. Create one to get started.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-md border">
            <Table>
              <TableHeader>
                <TableRow className="h-10">
                  <TableHead className="p-2 text-xs text-foreground">Name</TableHead>
                  <TableHead className="p-2 text-xs text-foreground">Format</TableHead>
                  <TableHead className="p-2 text-xs text-foreground">Status</TableHead>
                  <TableHead className="p-2 text-xs text-foreground">Created</TableHead>
                  <TableHead className="p-2 text-xs text-foreground"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((lb) => (
                  <TableRow key={lb.id}>
                    <TableCell className="p-2 text-xs font-medium">{lb.name}</TableCell>
                    <TableCell className="p-2 text-xs">
                      <Badge
                        variant="outline"
                        className="rounded-full border-blue-500 px-2 py-0.5 text-xs capitalize text-blue-600"
                      >
                        {lb.format}
                      </Badge>
                    </TableCell>
                    <TableCell className="p-2 text-xs">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge
                          variant="outline"
                          className={
                            lb.status === "published"
                              ? "rounded-full border-green-500 px-2 py-0.5 text-xs text-green-600"
                              : "rounded-full border-muted-foreground px-2 py-0.5 text-xs text-muted-foreground"
                          }
                        >
                          {lb.status === "published" ? "Published" : "Draft"}
                        </Badge>
                        {/* Stream P3: ranking tier chip (leaderboard.ranking_tier), shown only for
                            leaderboards that count toward rankings. Mirrors the outline rounded-full
                            badge style of the status badge above. */}
                        {lb.counts_toward_rankings && (
                          <Badge
                            variant="outline"
                            className="rounded-full border-primary px-2 py-0.5 text-xs text-primary"
                          >
                            {TIER_LABELS[lb.ranking_tier] ?? "Tier 3"}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="p-2 text-xs">
                      {lb.created_at ? formatDate(lb.created_at) : "-"}
                    </TableCell>
                    <TableCell className="p-2 text-xs">
                      <div className="flex items-center justify-end">
                        <Button asChild variant="outline" size="sm">
                          <Link href={`${viewHrefBase}/${lb.id}`}>
                            <IconEye className="size-4" /> View
                          </Link>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
