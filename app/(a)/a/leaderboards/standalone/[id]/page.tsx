"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Standalone Leaderboard — View page
// ----------------------------------------------------------------------------
// Read view of one standalone leaderboard: its header (name, format, status, scoring),
// the participant list, and the computed standings. Fetches GET /leaderboards/standalone/<id>/
// via standaloneLeaderboardsApi.detail (lib/standaloneLeaderboards.ts). The standings table is the
// shared StandaloneStandings component (also used in the wizard's Review step).
//
// Managers (detail.can_manage === true — AFC event-admin or the owning organizer) additionally get an
// "Edit" deep-link back into the create wizard. Phase 1 reuses the create wizard for editing rather
// than a separate edit page (the wizard is keyed off an existing draft/leaderboard id).
//
// ROUTE: /a/leaderboards/standalone/[id]. Reached from the standalone list section on the admin
// Leaderboards surface + the organizer Leaderboards page, and from the wizard after publish.
//
// Design: AFC constants — green page title (PageHeader), rounded-md cards, outline rounded-full badges.
// ─────────────────────────────────────────────────────────────────────────────

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { FullLoader } from "@/components/Loader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { IconPencil, IconUsers } from "@tabler/icons-react";
import { StandaloneStandings } from "../_components/StandaloneStandings";
import {
  standaloneLeaderboardsApi,
  type StandaloneLeaderboardDetail,
  type RankingTier,
} from "@/lib/standaloneLeaderboards";

type Params = { id: string };

// Stream P3: human labels for leaderboard.ranking_tier, shown as a chip beside the rankings flag.
const TIER_LABELS: Record<RankingTier, string> = {
  tier_1: "Tier 1",
  tier_2: "Tier 2",
  tier_3: "Tier 3",
};

export default function StandaloneLeaderboardViewPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { id } = use(params);

  const [detail, setDetail] = useState<StandaloneLeaderboardDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await standaloneLeaderboardsApi.detail(id);
      setDetail(data);
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message || "Failed to load the leaderboard.",
      );
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <FullLoader />;

  if (!detail) {
    return (
      <div className="space-y-4">
        <PageHeader back title="Leaderboard not found" />
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            This leaderboard could not be loaded.
          </CardContent>
        </Card>
      </div>
    );
  }

  const { leaderboard, participants, standings, can_manage } = detail;

  return (
    <div className="space-y-5">
      <PageHeader
        back
        title={leaderboard.name}
        description={
          leaderboard.organization_name
            ? `Standalone leaderboard by ${leaderboard.organization_name}.`
            : "AFC standalone leaderboard."
        }
        action={
          can_manage ? (
            // Edit reuses the create wizard keyed off this leaderboard's id (Phase 1).
            <Button asChild variant="outline" size="sm">
              <Link href={`/a/leaderboards/standalone/create?id=${leaderboard.id}`}>
                <IconPencil className="size-4" /> Edit
              </Link>
            </Button>
          ) : undefined
        }
      />

      {/* Header chips — format, status, ranking flag. Outline rounded-full per AFC constants. */}
      <div className="flex flex-wrap items-center gap-2">
        <Badge
          variant="outline"
          className="rounded-full border-blue-500 px-2 py-0.5 text-xs capitalize text-blue-600"
        >
          {leaderboard.format}
        </Badge>
        <Badge
          variant="outline"
          className={
            leaderboard.status === "published"
              ? "rounded-full border-green-500 px-2 py-0.5 text-xs text-green-600"
              : "rounded-full border-muted-foreground px-2 py-0.5 text-xs text-muted-foreground"
          }
        >
          {leaderboard.status === "published" ? "Published" : "Draft"}
        </Badge>
        {leaderboard.counts_toward_rankings && (
          <Badge
            variant="outline"
            className="rounded-full border-primary px-2 py-0.5 text-xs text-primary"
          >
            Counts toward rankings
          </Badge>
        )}
        {/* Stream P3: ranking tier (leaderboard.ranking_tier), shown only for ranked leaderboards.
            Mirrors the outline rounded-full badge style of the rankings flag chip above. */}
        {leaderboard.counts_toward_rankings && (
          <Badge
            variant="outline"
            className="rounded-full border-primary px-2 py-0.5 text-xs text-primary"
          >
            {TIER_LABELS[leaderboard.ranking_tier] ?? "Tier 3"}
          </Badge>
        )}
      </div>

      {/* Standings */}
      <Card className="rounded-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <IconUsers className="size-4" /> Standings
          </CardTitle>
          <CardDescription>
            {participants.length} participant{participants.length !== 1 ? "s" : ""}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <StandaloneStandings standings={standings} />
        </CardContent>
      </Card>
    </div>
  );
}
