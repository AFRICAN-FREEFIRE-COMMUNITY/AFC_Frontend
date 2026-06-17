"use client";

// ── Broadcast history list (owner 2026-06-17) ─────────────────────────────────────────────────
// Shows every broadcast that was sent, newest first: what was sent, when, by whom, the scope
// (whole event / stage / group / room details / general / direct), how many people it reached, and
// which entities it linked. Reads the SentBroadcast log written by the backend chokepoint
// (afc_auth.deliver_broadcast). Admin-only surface, so copy is English (app/(a)/ is i18n-exempt).
//
// Two backends, picked by `scope`:
//   - scope="event"   -> GET /events/broadcast-history/?event_id=<id>  (event + stage + group + room sends)
//                        Mounted on the admin event edit page (ActionsTab "Communication").
//   - scope="general" -> GET /auth/broadcast-history/                  (general + direct sends)
//                        Mounted on admin Settings > Notifications.
// Paginated (limit/offset + has_more); a "Load more" button appends the next page.

import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { env } from "@/lib/env";
import { useAuth } from "@/contexts/AuthContext";
import { LocalTime } from "@/components/LocalTime";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader } from "@/components/Loader";
import { Megaphone, Users } from "lucide-react";

interface BroadcastRow {
  id: number;
  scope: string;
  scope_label: string;
  title: string;
  message: string;
  delivery: string;
  recipient_count: number;
  sender_username: string;
  event_id: number | null;
  event_name: string;
  stage_id: number | null;
  stage_name: string;
  group_id: number | null;
  group_name: string;
  targets: { target_type: string; target_id: string }[];
  created_at: string;
}

const PAGE = 15;

// Human delivery label for the small channel badge.
const DELIVERY_LABEL: Record<string, string> = {
  both: "App + Email",
  push: "App only",
  email: "Email only",
};

export function BroadcastHistory({
  scope,
  eventId,
}: {
  scope: "event" | "general";
  eventId?: number;
}) {
  const { token } = useAuth();
  const [rows, setRows] = useState<BroadcastRow[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchPage = useCallback(
    async (off: number) => {
      setLoading(true);
      setError("");
      try {
        const url =
          scope === "event"
            ? `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/broadcast-history/`
            : `${env.NEXT_PUBLIC_BACKEND_API_URL}/auth/broadcast-history/`;
        const params: Record<string, unknown> = { limit: PAGE, offset: off };
        if (scope === "event") params.event_id = eventId;
        const res = await axios.get(url, {
          params,
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = res.data || {};
        setRows((prev) => (off === 0 ? data.results || [] : [...prev, ...(data.results || [])]));
        setHasMore(!!data.has_more);
        setTotal(data.total_count ?? 0);
        setOffset(off + PAGE);
      } catch (e: any) {
        setError(e.response?.data?.message || "Failed to load broadcast history");
      } finally {
        setLoading(false);
      }
    },
    [scope, eventId, token],
  );

  useEffect(() => {
    // Only fetch the event history once we have an event id (the edit page resolves it async).
    if (scope === "event" && !eventId) return;
    fetchPage(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, eventId]);

  if (loading && rows.length === 0) {
    return <Loader text="Loading history..." />;
  }
  if (error) {
    return <p className="text-sm text-destructive">{error}</p>;
  }
  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
        <Megaphone className="h-6 w-6 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">No broadcasts sent yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        {total} broadcast{total === 1 ? "" : "s"} sent
      </p>
      {rows.map((b) => {
        // A short "where it went" line: the scope, plus stage/group when present.
        const where =
          b.scope === "group"
            ? `${b.stage_name ? b.stage_name + " > " : ""}${b.group_name}`
            : b.scope === "stage"
              ? b.stage_name
              : "";
        return (
          <div key={b.id} className="rounded-md border bg-card p-3 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge variant="outline" className="rounded-full text-[11px]">
                  {b.scope_label}
                </Badge>
                {where && (
                  <span className="text-[11px] text-muted-foreground">{where}</span>
                )}
              </div>
              <LocalTime
                value={b.created_at}
                mode="datetime"
                className="shrink-0 text-[11px] text-muted-foreground"
              />
            </div>

            {b.title && (
              <p className="mt-1.5 text-sm font-medium text-foreground">{b.title}</p>
            )}
            {b.message && (
              <p className="mt-0.5 whitespace-pre-line break-words text-xs text-muted-foreground line-clamp-4">
                {b.message}
              </p>
            )}

            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Users className="h-3 w-3" />
                {b.recipient_count} recipient{b.recipient_count === 1 ? "" : "s"}
              </span>
              <span>{DELIVERY_LABEL[b.delivery] || b.delivery}</span>
              {b.sender_username && <span>by {b.sender_username}</span>}
              {b.targets?.length > 0 && (
                <span>
                  {b.targets.length} link{b.targets.length === 1 ? "" : "s"}
                </span>
              )}
            </div>
          </div>
        );
      })}

      {hasMore && (
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          disabled={loading}
          onClick={() => fetchPage(offset)}
        >
          {loading ? <Loader text="Loading..." /> : "Load more"}
        </Button>
      )}
    </div>
  );
}
