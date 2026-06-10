"use client";

// ── ReviewStep (wizard step 4) ────────────────────────────────────────────────
// Final step: re-fetch the leaderboard detail (GET /leaderboards/standalone/<id>/) so the standings
// reflect every result saved in step 3, render them with the shared StandaloneStandings table, then
// Publish (PATCH /leaderboards/standalone/<id>/edit/ {status:"published"}). A draft is hidden/editable
// until published; publishing makes the standings viewable. After publish we route to the view page.
//
// CONSUMED BY: ../page.tsx (the wizard). On publish it calls onPublished() which navigates to
// /a/leaderboards/standalone/<id>.

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { IconRocket, IconLoader2 } from "@tabler/icons-react";
import { InfoTip } from "@/components/ui/info-tip";
import { StandaloneStandings } from "../../_components/StandaloneStandings";
import {
  standaloneLeaderboardsApi,
  type StandaloneLeaderboardDetail,
} from "@/lib/standaloneLeaderboards";

export function ReviewStep({
  leaderboardId,
  onBack,
  onPublished,
}: {
  leaderboardId: number;
  onBack: () => void;
  onPublished: () => void;
}) {
  const [detail, setDetail] = useState<StandaloneLeaderboardDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await standaloneLeaderboardsApi.detail(leaderboardId);
      setDetail(data);
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message || "Failed to load the standings.",
      );
    } finally {
      setLoading(false);
    }
  }, [leaderboardId]);

  // Fetch fresh standings every time the user lands on this step.
  useEffect(() => {
    load();
  }, [load]);

  const publish = async () => {
    setPublishing(true);
    try {
      await standaloneLeaderboardsApi.update(leaderboardId, {
        status: "published",
      });
      toast.success("Leaderboard published.");
      onPublished();
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message || "Failed to publish the leaderboard.",
      );
    } finally {
      setPublishing(false);
    }
  };

  const isPublished = detail?.leaderboard.status === "published";

  return (
    <Card className="gap-0">
      <CardHeader>
        <CardTitle className="flex items-center">
          Review and publish
          <InfoTip
            text="These are the computed standings from the results you entered. Publish to make the leaderboard viewable."
            className="ml-1.5"
          />
        </CardTitle>
        <CardDescription>
          {detail?.leaderboard.name
            ? `Final standings for "${detail.leaderboard.name}".`
            : "Final standings preview."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
            <IconLoader2 className="h-4 w-4 animate-spin" /> Loading standings...
          </div>
        ) : (
          <StandaloneStandings standings={detail?.standings ?? []} />
        )}

        <div className="flex items-center justify-between pt-2">
          <Button variant="ghost" onClick={onBack} disabled={publishing}>
            Back
          </Button>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={load}
              disabled={loading || publishing}
            >
              Refresh standings
            </Button>
            {isPublished ? (
              // Already published (e.g. re-entered the wizard) — go straight to the view.
              <Button onClick={onPublished}>View leaderboard</Button>
            ) : (
              <Button onClick={publish} disabled={publishing}>
                {publishing ? (
                  <span className="flex items-center gap-2">
                    <IconLoader2 size={14} className="animate-spin" /> Publishing...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <IconRocket size={14} /> Publish
                  </span>
                )}
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
