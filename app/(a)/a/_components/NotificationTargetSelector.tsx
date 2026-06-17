"use client";

// ── Admin "What is this about?" target selector ───────────────────────────────
// A shared control that lets an admin attach an optional DEEP LINK to a
// notification, so the recipient gets a "Take me there" button (rendered by the
// user-side NotificationDropdown) that opens the related entity.
//
// It produces { target_type, target_id }:
//   - target_type: one of the backend choices (event/news/team/player/shop/
//     organizer/custom/none). "none" = no link (the safe default).
//   - target_id: the slug/id/username of the entity, or for "custom" a relative
//     "/path". Not needed for "shop" or "none".
//
// How it connects to the rest of the system:
//   - The backend send endpoints accept the target and compute the per-notification
//     `link` returned by GET /auth/get-notifications/:
//       * POST /auth/send-notification/ and /auth/send-notification-to-multiple-users/
//         take target_type + target_id          (settings bulk composer)
//       * /events/broadcast-announcement/ takes target_type + target_id
//         (ActionsTab event broadcast)
//       * /auth/admin-send-message/ uses its target_type/target_id to pick the
//         RECIPIENT, so the LINK target rides on link_target_type + link_target_id
//         instead (SendMessageModal). That mapping is done by the caller; this
//         component always emits the neutral { target_type, target_id } pair.
//   - This is an admin-only surface, so its copy is intentionally English (the
//     admin app under app/(a)/ is i18n-exempt per project rules).

import { useEffect, useRef, useState } from "react";
import axios from "axios";
import { X, Search } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { env } from "@/lib/env";
import { useAuth } from "@/contexts/AuthContext";

// Backend target_type choices (kept in sync with the afc_auth contract).
export type NotificationTargetType =
  | "none"
  | "event"
  | "news"
  | "team"
  | "player"
  | "shop"
  | "organizer"
  | "custom";

// The value this control manages and hands back to its parent.
export interface NotificationTarget {
  target_type: NotificationTargetType;
  target_id: string;
}

// The empty/"no link" target, exported so callers can seed their own state and
// reset back to it after a send.
export const EMPTY_TARGET: NotificationTarget = {
  target_type: "none",
  target_id: "",
};

// One event returned by the event typeahead (GET /events/search/). The picker stores the
// selected events as these (slug + name for the chip); callers turn them into broadcast `targets`
// (each {target_type:"event", target_id: slug}).
export interface EventOption {
  event_id: number;
  event_name: string;
  slug: string;
}

// ── Event search-select (owner 2026-06-17 multi-event link picker) ────────────────────────────
// Replaces typing a tournament slug by hand: search the event by name, click to add, pick several.
// Backed by GET /events/search/?q= (afc_tournament_and_scrims.search_events). Admin-only surface, so
// copy stays English (app/(a)/ is i18n-exempt).
function EventMultiSelect({
  selected,
  onChange,
}: {
  selected: EventOption[];
  onChange: (events: EventOption[]) => void;
}) {
  const { token } = useAuth();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<EventOption[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  // Debounced search: wait 300ms after the last keystroke before hitting the API.
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
          { params: { q, limit: 8 }, headers: { Authorization: `Bearer ${token}` } },
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

  // Close the results dropdown when clicking outside.
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const add = (ev: EventOption) => {
    if (!selected.some((s) => s.slug === ev.slug)) onChange([...selected, ev]);
    setQuery("");
    setResults([]);
    setOpen(false);
  };
  const remove = (slug: string) => onChange(selected.filter((s) => s.slug !== slug));

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
        {open && (loading || results.length > 0) && (
          <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md max-h-56 overflow-auto">
            {loading && (
              <div className="px-3 py-2 text-xs text-muted-foreground">Searching...</div>
            )}
            {!loading &&
              results.map((ev) => {
                const already = selected.some((s) => s.slug === ev.slug);
                return (
                  <button
                    type="button"
                    key={ev.event_id}
                    onClick={() => add(ev)}
                    disabled={already}
                    className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted disabled:opacity-50"
                  >
                    <span className="truncate">{ev.event_name}</span>
                    {already && <span className="text-[11px] text-primary">added</span>}
                  </button>
                );
              })}
          </div>
        )}
      </div>

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((ev) => (
            <Badge key={ev.slug} variant="outline" className="gap-1 rounded-full">
              {ev.event_name}
              <button type="button" onClick={() => remove(ev.slug)} aria-label={`Remove ${ev.event_name}`}>
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
      <p className="text-[11px] text-muted-foreground">
        Search and select one or more events to link. Recipients get a "View" button per event.
      </p>
    </div>
  );
}

// Dropdown options. "none" first so it reads as (and stays) the default.
const TYPE_OPTIONS: { value: NotificationTargetType; label: string }[] = [
  { value: "none", label: "No link" },
  { value: "event", label: "Tournament / Event" },
  { value: "news", label: "News article" },
  { value: "team", label: "Team" },
  { value: "player", label: "Player" },
  { value: "shop", label: "Shop" },
  { value: "organizer", label: "Organization" },
  { value: "custom", label: "Custom URL" },
];

// Per-type placeholder + helper hint for the entity input.
const ENTITY_HINT: Partial<
  Record<NotificationTargetType, { placeholder: string; help: string }>
> = {
  event: {
    placeholder: "event-slug",
    help: "The tournament slug (from its URL, e.g. /tournaments/<slug>).",
  },
  news: {
    placeholder: "news-slug",
    help: "The news article slug (from its URL, e.g. /news/<slug>).",
  },
  team: {
    placeholder: "team id",
    help: "The team's numeric id.",
  },
  player: {
    placeholder: "username",
    help: "The player's username (e.g. /players/<username>).",
  },
  organizer: {
    placeholder: "organization-slug",
    help: "The organization slug (e.g. /organizations/<slug>).",
  },
  custom: {
    placeholder: "/some/path",
    help: "A relative path on the site, starting with a slash.",
  },
};

export function NotificationTargetSelector({
  value,
  onChange,
  // ── Optional multi-event mode (owner 2026-06-17) ──
  // When `enableEventSearch` is set and the type is "event", the slug textbox is replaced by a
  // search-select that picks MULTIPLE events (`selectedEvents` / `onSelectedEventsChange`). The
  // caller turns the chosen events into the broadcast `targets` array. Omitting these props keeps
  // the original single-slug behaviour for every existing caller.
  enableEventSearch = false,
  selectedEvents = [],
  onSelectedEventsChange,
}: {
  value: NotificationTarget;
  onChange: (next: NotificationTarget) => void;
  enableEventSearch?: boolean;
  selectedEvents?: EventOption[];
  onSelectedEventsChange?: (events: EventOption[]) => void;
}) {
  // "shop" links to a fixed page and "none" has no link, so neither needs an
  // entity id. Everything else shows the entity input.
  const needsEntity = value.target_type !== "none" && value.target_type !== "shop";
  const hint = ENTITY_HINT[value.target_type];
  // Multi-event search-select is shown only when the caller opted in AND the type is "event".
  const showEventSearch =
    enableEventSearch && value.target_type === "event" && !!onSelectedEventsChange;

  return (
    <div className="space-y-2">
      <Label>What is this about? (optional link)</Label>
      <Select
        value={value.target_type}
        onValueChange={(v) =>
          // Changing the type always clears the previous entity id so a stale
          // slug never rides along under the wrong type.
          onChange({ target_type: v as NotificationTargetType, target_id: "" })
        }
      >
        <SelectTrigger>
          <SelectValue placeholder="No link" />
        </SelectTrigger>
        <SelectContent>
          {TYPE_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Event multi-select (opt-in) takes over for the "event" type; otherwise the slug input. */}
      {showEventSearch ? (
        <EventMultiSelect
          selected={selectedEvents}
          onChange={onSelectedEventsChange!}
        />
      ) : (
        needsEntity && (
          <div className="space-y-1">
            <Input
              placeholder={hint?.placeholder}
              value={value.target_id}
              onChange={(e) =>
                onChange({ ...value, target_id: e.target.value })
              }
            />
            {hint?.help && (
              <p className="text-[11px] text-muted-foreground">{hint.help}</p>
            )}
          </div>
        )
      )}
    </div>
  );
}
