"use client";

// ── News "Related events" multi-select (News overhaul) ────────────────────────────────────────────
// A searchable, multi-select event picker used by the admin News CREATE + EDIT forms
// (app/(a)/a/news/create/page.tsx and app/(a)/a/news/[slug]/edit/page.tsx) to attach one or more
// tournaments/events to a news article. It REPLACES the old hardcoded single <Select> that was wired
// to the fake `relatedEvents` constant (constants/index.ts) and, on the create form, never actually
// submitted the choice.
//
// How it connects to the rest of the system:
//   - Search is backed by GET /events/search/?q=&limit=15 (afc_tournament_and_scrims.search_events),
//     which returns { results: [{ event_id, event_name, slug }] } for non-draft events (Bearer auth).
//   - The chosen events are submitted by the forms as repeated `related_events` form fields (one per
//     event_id); the backend create_news / edit_news (afc_auth/views.py) read them via
//     request.data.getlist("related_events") and set the News.related_events M2M.
//   - On EDIT, the initial selection is prefilled from get-news-detail's related_events list
//     (_serialize_related_news_events -> [{event_id, event_name, slug, tournament_tier, end_date}]).
//   - Admin-only surface, so its copy stays English (app/(a)/ is i18n-exempt per project rules).
//
// This mirrors the sibling admin picker in app/(a)/a/_components/NotificationTargetSelector.tsx
// (the notification deep-link event search-select), keeping look + behaviour consistent, but keys the
// selection on event_id (not slug) and takes the auth `token` as a prop rather than from useAuth.

import { useEffect, useRef, useState } from "react";
import axios from "axios";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { env } from "@/lib/env";

// One selected event. The picker keeps only what the form needs to render a chip and submit the id
// (event_id + event_name); the search endpoint also returns `slug`, which this picker ignores.
export interface NewsEventOption {
  event_id: number;
  event_name: string;
}

// One row returned by GET /events/search/ (search_events). `slug` is returned but unused here.
interface EventSearchResult {
  event_id: number;
  event_name: string;
  slug: string;
}

export function EventMultiSelect({
  value,
  onChange,
  token,
}: {
  // Current selection (array of {event_id, event_name}); owned by the parent RHF form field.
  value: NewsEventOption[];
  onChange: (events: NewsEventOption[]) => void;
  // Bearer token from useAuth(), passed in by the parent form.
  token: string | null;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<EventSearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  // Debounced search: wait 300ms after the last keystroke before hitting /events/search/?q=&limit=15.
  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults([]);
      return;
    }
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await axios.get(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/search/`,
          {
            params: { q, limit: 15 },
            headers: { Authorization: `Bearer ${token}` },
          },
        );
        setResults(res.data?.results ?? []);
        setOpen(true);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [query, token]);

  // Close the results dropdown when clicking outside the control.
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  // Add an event to the selection (dedupe by event_id) and reset the search box.
  const add = (ev: EventSearchResult) => {
    if (!value.some((s) => s.event_id === ev.event_id))
      onChange([...value, { event_id: ev.event_id, event_name: ev.event_name }]);
    setQuery("");
    setResults([]);
    setOpen(false);
  };
  const remove = (eventId: number) =>
    onChange(value.filter((s) => s.event_id !== eventId));

  return (
    <div className="space-y-2" ref={boxRef}>
      <div className="relative">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-8"
          placeholder="Search events to link..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length && setOpen(true)}
        />
        {/* Dark results panel (bg-popover) - matches the admin theme; no native white select. */}
        {open && (loading || results.length > 0) && (
          <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md max-h-56 overflow-auto">
            {loading && (
              <div className="px-3 py-2 text-xs text-muted-foreground">
                Searching...
              </div>
            )}
            {!loading &&
              results.map((ev) => {
                const already = value.some((s) => s.event_id === ev.event_id);
                return (
                  <button
                    type="button"
                    key={ev.event_id}
                    onClick={() => add(ev)}
                    disabled={already}
                    className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted disabled:opacity-50"
                  >
                    <span className="truncate">{ev.event_name}</span>
                    {already && (
                      <span className="text-[11px] text-primary">added</span>
                    )}
                  </button>
                );
              })}
          </div>
        )}
      </div>

      {/* Selected events as removable chips (Badge outline pill - AFC tier-badge idiom). */}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((ev) => (
            <Badge
              key={ev.event_id}
              variant="outline"
              className="gap-1 rounded-full"
            >
              {ev.event_name}
              <button
                type="button"
                onClick={() => remove(ev.event_id)}
                aria-label={`Remove ${ev.event_name}`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
