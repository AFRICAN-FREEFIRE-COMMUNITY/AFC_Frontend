"use client";

// UserSearchSelect = a search-as-you-type picker for EXISTING users.
//
// Replaces raw "type a username/email" <Input>s anywhere a human targets an existing user (admin
// bulk notifications, team member invites, transfer ownership, create-team invites, etc.). As you
// type it queries GET /auth/search-users/ (afc_auth.views.search_users) and shows matching users in
// a popover; clicking one selects it. Works in single or multiple mode.
//
// Connects to: GET /auth/search-users/?q=&limit= (Bearer auth_token cookie). The backend matches by
// username / in-game name / full_name (and email for admins only) and returns
// {results:[{user_id, username, full_name, role, email?}], total_count}. The value this component
// emits is the user's USERNAME (which is also the in-game name), because every consumer
// (invite-by-IGN, transfer-by-IGN, notify-by-username) keys off the username.

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { env } from "@/lib/env";
import axios from "axios";
import Cookies from "js-cookie";
import { Check, Loader2, Search, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

export type PickedUser = {
  user_id: number;
  username: string;
  full_name?: string;
  role?: string;
  email?: string; // only present for admin callers (backend privacy gate)
};

// A GHOST player hit (owner 2026-06-12: "let ghost teams and players be searchable"). Returned by
// GET /leaderboards/standalone/search-ghost-players/ and surfaced only when `includeGhosts` is set.
// Ghosts key off their numeric GhostPlayer id (not a username), so they are delivered via the
// separate onPickGhost callback instead of onChange - existing callers are untouched.
export type PickedGhostPlayer = {
  ghost_player_id: number;
  ign: string;
  ghost_team_id?: string | null;
  ghost_team_name?: string | null;
};

type BaseProps = {
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  limit?: number;
  // Opt-in: ALSO search existing ghost players and list them under a "Ghost players" group.
  // Used by the standalone-leaderboard wizard (solo format) so an existing ghost is reused
  // (kind=ghost_existing) instead of duplicated. Picking a ghost fires onPickGhost, never onChange.
  includeGhosts?: boolean;
  onPickGhost?: (ghost: PickedGhostPlayer) => void;
};

type SingleProps = BaseProps & {
  multiple?: false;
  /** selected username, or "" / null when nothing is picked */
  value: string | null;
  onChange: (username: string | null, user?: PickedUser) => void;
};

type MultiProps = BaseProps & {
  multiple: true;
  /** selected usernames */
  value: string[];
  onChange: (usernames: string[], lastUser?: PickedUser) => void;
};

type Props = SingleProps | MultiProps;

function authHeaders() {
  const token = Cookies.get("auth_token");
  return { Authorization: `Bearer ${token ?? ""}` };
}

export function UserSearchSelect(props: Props) {
  const {
    placeholder = "Search a user...",
    className,
    disabled,
    limit = 10,
    includeGhosts = false,
    onPickGhost,
  } = props;
  const multiple = props.multiple === true;

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PickedUser[]>([]);
  // Ghost-player hits, kept separate so they render under their own labelled group.
  const [ghostResults, setGhostResults] = useState<PickedGhostPlayer[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced server search. Fewer than 2 chars -> clear (matches the backend's q>=2 guard).
  // With includeGhosts the ghost endpoint is queried in PARALLEL; a ghost-search failure never
  // breaks the real-user results (each list settles independently).
  const runSearch = useCallback(
    (q: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (q.trim().length < 2) {
        setResults([]);
        setGhostResults([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      debounceRef.current = setTimeout(async () => {
        const real = axios
          .get(`${env.NEXT_PUBLIC_BACKEND_API_URL}/auth/search-users/`, {
            headers: authHeaders(),
            params: { q: q.trim(), limit },
          })
          .then((res) => setResults(res.data?.results ?? []))
          .catch(() => setResults([]));
        const ghost = includeGhosts
          ? axios
              .get(
                `${env.NEXT_PUBLIC_BACKEND_API_URL}/leaderboards/standalone/search-ghost-players/`,
                { headers: authHeaders(), params: { q: q.trim(), limit } },
              )
              .then((res) => setGhostResults(res.data?.results ?? []))
              .catch(() => setGhostResults([]))
          : Promise.resolve(setGhostResults([]));
        await Promise.all([real, ghost]);
        setLoading(false);
      }, 300);
    },
    [limit, includeGhosts],
  );

  useEffect(() => {
    runSearch(query);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, runSearch]);

  const selectedList: string[] = multiple
    ? (props.value as string[])
    : props.value
      ? [props.value as string]
      : [];

  const isSelected = (username: string) => selectedList.includes(username);

  const handlePick = (user: PickedUser) => {
    if (multiple) {
      const cur = props.value as string[];
      const next = cur.includes(user.username)
        ? cur.filter((u) => u !== user.username) // toggle off if already picked
        : [...cur, user.username];
      (props.onChange as MultiProps["onChange"])(next, user);
      // keep the popover open in multi mode so several can be added in a row
      setQuery("");
    } else {
      (props.onChange as SingleProps["onChange"])(user.username, user);
      setOpen(false);
      setQuery("");
    }
  };

  const removeOne = (username: string) => {
    if (multiple) {
      (props.onChange as MultiProps["onChange"])(
        (props.value as string[]).filter((u) => u !== username),
      );
    } else {
      (props.onChange as SingleProps["onChange"])(null);
    }
  };

  // Trigger label: single shows the picked username; multi shows a count.
  const triggerLabel = multiple
    ? selectedList.length > 0
      ? `${selectedList.length} user(s) selected`
      : placeholder
    : (props.value as string | null) || placeholder;

  return (
    <div className={cn("space-y-2", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            className={cn(
              "w-full justify-start font-normal",
              !multiple && !props.value && "text-muted-foreground",
              multiple && selectedList.length === 0 && "text-muted-foreground",
            )}
          >
            <Search className="mr-2 h-4 w-4 shrink-0" />
            <span className="truncate">{triggerLabel}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Type a username or name..."
              value={query}
              onValueChange={setQuery}
            />
            <CommandList>
              {loading && (
                <div className="flex items-center gap-2 px-3 py-4 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Searching...
                </div>
              )}
              {!loading && query.trim().length < 2 && (
                <div className="px-3 py-4 text-sm text-muted-foreground">
                  Type at least 2 characters to search.
                </div>
              )}
              {!loading &&
                query.trim().length >= 2 &&
                results.length === 0 &&
                ghostResults.length === 0 && <CommandEmpty>No users found.</CommandEmpty>}
              {!loading && results.length > 0 && (
                <CommandGroup heading={includeGhosts ? "Players" : undefined}>
                  {results.map((u) => (
                    <CommandItem
                      key={u.user_id}
                      value={u.username}
                      onSelect={() => handlePick(u)}
                      className="flex items-center justify-between gap-2"
                    >
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate font-medium">{u.username}</span>
                        <span className="truncate text-xs text-muted-foreground">
                          {u.full_name || ""}
                          {u.email ? ` · ${u.email}` : ""}
                        </span>
                      </span>
                      {isSelected(u.username) && <Check className="h-4 w-4 shrink-0 text-primary" />}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
              {/* Ghost-player hits (includeGhosts only): own group, orange Ghost badge - the same
                  real/ghost visual language the wizard's participants list uses. Picking one fires
                  onPickGhost (the caller adds it via kind=ghost_existing). */}
              {!loading && includeGhosts && ghostResults.length > 0 && (
                <CommandGroup heading="Ghost players">
                  {ghostResults.map((g) => (
                    <CommandItem
                      key={g.ghost_player_id}
                      value={`ghost-${g.ghost_player_id}`}
                      onSelect={() => {
                        onPickGhost?.(g);
                        setOpen(false);
                        setQuery("");
                      }}
                      className="flex items-center justify-between gap-2"
                    >
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate font-medium">{g.ign}</span>
                        <span className="truncate text-xs text-muted-foreground">
                          {g.ghost_team_name || "no team"}
                        </span>
                      </span>
                      <Badge
                        variant="outline"
                        className="shrink-0 rounded-full border-orange-500 px-2 py-0.5 text-xs text-orange-600"
                      >
                        Ghost
                      </Badge>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Selected chips (so the picks are visible + removable without opening the popover). */}
      {selectedList.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedList.map((username) => (
            <Badge key={username} variant="secondary" className="gap-1 pr-1">
              {username}
              <button
                type="button"
                onClick={() => removeOne(username)}
                className="rounded-full p-0.5 hover:bg-muted-foreground/20"
                aria-label={`Remove ${username}`}
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
