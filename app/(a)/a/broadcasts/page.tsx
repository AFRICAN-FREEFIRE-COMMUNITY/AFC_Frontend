"use client";

// ── Admin · Broadcasts (global broadcast audit) ──────────────────────────────
// THE cross-event admin view of EVERY broadcast ever sent (owner 2026-06-27): the per-event history
// (ActionsTab "History" → BroadcastHistory scope="event") only shows one event at a time, and the
// Settings notification history only shows general/direct sends. Organizers can now message the players
// registered to their events, so admins needed one place to audit ALL of it: who sent what, when, to
// which scope/event, how many people it reached, and the FULL message content.
//
// Data: GET /auth/all-broadcasts/ (afc_auth.get_all_broadcasts) via broadcastsApi.all (lib/broadcasts).
// Server-gated to AFC admins (is_broadcast_admin - the same set exempt from the organizer rate limit);
// the sidebar entry in constants/nav-links.ts is gated to the matching granular roles. Read-only.
//
// Look + feel: mirrors the per-event BroadcastHistory row (scope badge + where line + LocalTime +
// title + message + recipient_count + delivery + sender + link count) and its "Load more" pagination,
// wrapped in the AFC admin idiom (PageHeader, green title, Card/Select/Input filter toolbar). Adds a
// search box (search=), a scope Select (scope=), and a click-to-filter sender chip (sender_id=) plus a
// per-row "Show more" expander so the full message is on demand. Source rows: SentBroadcast.
//
// Connections: lib/broadcasts.ts (broadcastsApi.all + AdminBroadcastRow), components/LocalTime (UTC →
// viewer tz), components/PageHeader. No backend writes - this page only reads the audit log.
//
// SENDING lives here too, since 2026-09-02 (owner: "this notification feature should be under
// broadcasts"). <AudienceBuilder/> was a tab on /a/settings; it now sits above this log, so the
// compose surface and the record of what was sent are one screen. The header line above saying
// "No backend writes" is therefore no longer true, and the card carries its own role gate:
// this page admits four roles that may READ the audit, while the send endpoint admits only a
// coarse admin or head_admin / super_admin. See canSendBroadcast below.

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/PageHeader";
import { LocalTime } from "@/components/LocalTime";
import { FullLoader, Loader } from "@/components/Loader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Users, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { broadcastsApi, type AdminBroadcastRow } from "@/lib/broadcasts";
import { useAuth } from "@/contexts/AuthContext";
import { InfoTip } from "@/components/ui/info-tip";
import { AudienceBuilder } from "./_components/AudienceBuilder";

// Page size - matches the endpoint's default limit (20). "Load more" appends the next page.
const PAGE = 20;

// Human delivery-channel label for the small channel tag (same map as BroadcastHistory).
const DELIVERY_LABEL: Record<string, string> = {
  both: "App + Email",
  push: "App only",
  email: "Email only",
};

// Scope filter options (afc_auth.SentBroadcast.SCOPE_CHOICES). "all" = no scope filter.
const SCOPE_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "All scopes" },
  { value: "general", label: "General" },
  { value: "event", label: "Whole event" },
  { value: "stage", label: "Stage" },
  { value: "group", label: "Group" },
  { value: "room_details", label: "Room details" },
  { value: "direct", label: "Direct message" },
];

export default function AdminBroadcastsPage() {
  const [rows, setRows] = useState<AdminBroadcastRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [nextOffset, setNextOffset] = useState<number | null>(null);
  const [loading, setLoading] = useState(true); // first load only (keeps the list on screen during refetch)
  const [loadingMore, setLoadingMore] = useState(false);

  // ── Filters ──────────────────────────────────────────────────────────────
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState(""); // what actually hits the server
  const [scope, setScope] = useState("all");
  // Sender filter - set by clicking a sender in a row ("show only this organizer's broadcasts").
  const [sender, setSender] = useState<{ id: number; name: string } | null>(null);

  // Per-row expand state: the audit shows the FULL message on demand (collapsed to 4 lines otherwise).
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  // 300ms debounce on the search box so we do not refetch per keystroke (mirrors BlacklistsTable).
  useEffect(() => {
    const tmr = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(tmr);
  }, [search]);

  // Fetch one page. reset=true replaces (first load / filter change → offset 0); otherwise append
  // (the "Load more" button → next_offset from the previous page).
  const fetchPage = useCallback(
    async (reset: boolean) => {
      const offset = reset ? 0 : nextOffset ?? 0;
      if (reset) setLoading(true);
      else setLoadingMore(true);
      try {
        const data = await broadcastsApi.all({
          search: debouncedSearch || undefined,
          scope: scope !== "all" ? scope : undefined,
          sender_id: sender?.id,
          limit: PAGE,
          offset,
        });
        setRows((prev) => (reset ? data.results : [...prev, ...data.results]));
        setHasMore(data.has_more);
        setNextOffset(data.next_offset);
        setTotalCount(data.total_count);
      } catch (e: any) {
        toast.error(e?.response?.data?.message || "Failed to load broadcasts.");
      } finally {
        if (reset) setLoading(false);
        else setLoadingMore(false);
      }
    },
    [debouncedSearch, scope, sender, nextOffset],
  );

  // Refetch from the top whenever a filter changes (search / scope / sender).
  useEffect(() => {
    fetchPage(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, scope, sender]);

  const toggleExpanded = (id: number) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // First load only - keep everything on-screen during filter/page refetches.
  if (loading && rows.length === 0) return <FullLoader />;

  // MIRRORS the server gate on the send endpoint (_is_broadcast_audience_admin): the coarse
  // role=="admin", or a granular head_admin / super_admin. Deliberately NARROWER than the four
  // roles this page admits, because those extra roles may read the audit but may not send, and a
  // compose form that 403s on the last click is worse than no compose form.
  const { user, hasAnyRole } = useAuth();
  const canSendBroadcast =
    user?.role === "admin" || hasAnyRole(["head_admin", "super_admin"]);

  const hasFilters = !!debouncedSearch || scope !== "all" || !!sender;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Broadcasts"
        description="Every broadcast sent across the platform: announcements, stage/group messages, room details and direct messages, by any admin or organizer."
      />

      {/* Compose, above the record of what has already gone out. Only for those the send
          endpoint will actually accept: see canSendBroadcast. */}
      {canSendBroadcast && <AudienceBuilder />}

      {/* The audit log itself. Heading it explicitly matters now that a composer sits above it:
          without one, the filter toolbar reads as part of the send form. */}
      <div className="flex items-center gap-1.5">
        <h2 className="text-lg font-semibold">Sent broadcasts</h2>
        <InfoTip id="broadcasts.sent._section" />
      </div>

      {/* ── Filter toolbar: search + scope. (Sender is filtered by clicking a row's sender.) ── */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
        <div className="flex flex-1 flex-col gap-2">
          <Label htmlFor="bc-search">Search</Label>
          <Input
            id="bc-search"
            placeholder="Search by title, message or sender..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label>Scope</Label>
          <Select value={scope} onValueChange={setScope}>
            <SelectTrigger className="w-full lg:w-44">
              <SelectValue placeholder="Filter by scope" />
            </SelectTrigger>
            <SelectContent>
              {SCOPE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Active sender filter chip (set by clicking a sender in a row). Clear with the X. */}
      {sender && (
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs"
          >
            Sender: {sender.name}
            <button
              type="button"
              onClick={() => setSender(null)}
              aria-label="Clear sender filter"
              className="ml-0.5 rounded-full hover:text-primary"
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        {totalCount} broadcast{totalCount === 1 ? "" : "s"}
      </p>

      {/* ── List (mirrors BroadcastHistory rows) + "Load more". ── */}
      {rows.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            {hasFilters ? "No broadcasts match these filters." : "No broadcasts sent yet."}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {rows.map((b) => {
            // A short "where it went" line: stage / group names when the scope is stage/group.
            const where =
              b.scope === "group"
                ? `${b.stage_name ? b.stage_name + " > " : ""}${b.group_name}`
                : b.scope === "stage"
                  ? b.stage_name
                  : "";
            const isExpanded = expanded.has(b.id);
            // Long enough to warrant a "Show more" toggle (otherwise the 4-line clamp shows it all).
            const isLong = b.message.length > 240 || b.message.split("\n").length > 4;
            return (
              <div key={b.id} className="rounded-md border bg-card p-3 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant="outline" className="rounded-full text-[11px]">
                      {b.scope_label}
                    </Badge>
                    {b.event_name && (
                      <span className="text-[11px] text-muted-foreground">{b.event_name}</span>
                    )}
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
                  <>
                    <p
                      className={cn(
                        "mt-0.5 whitespace-pre-line break-words text-xs text-muted-foreground",
                        !isExpanded && "line-clamp-4",
                      )}
                    >
                      {b.message}
                    </p>
                    {isLong && (
                      <button
                        type="button"
                        onClick={() => toggleExpanded(b.id)}
                        className="mt-1 text-[11px] font-medium text-primary hover:underline"
                      >
                        {isExpanded ? "Show less" : "Show more"}
                      </button>
                    )}
                  </>
                )}

                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {b.recipient_count} recipient{b.recipient_count === 1 ? "" : "s"}
                  </span>
                  <span>{DELIVERY_LABEL[b.delivery] || b.delivery}</span>
                  {/* Sender - click to filter the audit to just this organizer's broadcasts. */}
                  {b.sender_username &&
                    (b.sender_id ? (
                      <button
                        type="button"
                        onClick={() =>
                          setSender({ id: b.sender_id!, name: b.sender_username })
                        }
                        className="hover:text-primary hover:underline"
                      >
                        by {b.sender_username}
                      </button>
                    ) : (
                      <span>by {b.sender_username}</span>
                    ))}
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
              disabled={loadingMore}
              onClick={() => fetchPage(false)}
            >
              {loadingMore ? <Loader text="Loading..." /> : "Load more"}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
