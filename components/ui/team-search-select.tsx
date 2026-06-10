"use client";

// TeamSearchSelect = a search-as-you-type picker for EXISTING teams.
//
// The team-side twin of UserSearchSelect (components/ui/user-search-select.tsx): same Popover + cmdk
// Command shell, same 300ms debounce, same single/multiple modes + removable chips. The ONLY
// differences are the endpoint it queries and the row it renders. Use it anywhere a human targets an
// existing platform team (here: the standalone-leaderboard wizard's Participants step, team format).
//
// Connects to: GET /team/search-teams/?q=&limit= (Bearer auth_token cookie). The backend matches by
// team_name (icontains, q>=2) and returns {results:[{team_id, team_name, team_tag, country}], total_count}.
// The value this component emits is the team's NUMERIC team_id (the standalone participant endpoint
// keys real-team participants off team_id), plus the full team object as the onChange 2nd arg so the
// caller can show the name/tag without a second lookup.
//
// CONSUMED BY: app/(a)/a/leaderboards/standalone/create/_components/ParticipantsStep.tsx.

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

export type PickedTeam = {
  team_id: number;
  team_name: string;
  team_tag?: string;
  country?: string;
};

type BaseProps = {
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  limit?: number;
};

type SingleProps = BaseProps & {
  multiple?: false;
  /** selected team_id, or null when nothing is picked */
  value: number | null;
  onChange: (teamId: number | null, team?: PickedTeam) => void;
};

type MultiProps = BaseProps & {
  multiple: true;
  /** selected team_ids */
  value: number[];
  onChange: (teamIds: number[], lastTeam?: PickedTeam) => void;
};

type Props = SingleProps | MultiProps;

function authHeaders() {
  const token = Cookies.get("auth_token");
  return { Authorization: `Bearer ${token ?? ""}` };
}

export function TeamSearchSelect(props: Props) {
  const { placeholder = "Search a team...", className, disabled, limit = 10 } = props;
  const multiple = props.multiple === true;

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PickedTeam[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Cache the picked teams so chips/trigger can show the name even though `value` is just the id.
  const [pickedById, setPickedById] = useState<Record<number, PickedTeam>>({});

  // Debounced server search. Fewer than 2 chars -> clear (matches the backend's q>=2 guard).
  const runSearch = useCallback(
    (q: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (q.trim().length < 2) {
        setResults([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      debounceRef.current = setTimeout(async () => {
        try {
          const res = await axios.get(`${env.NEXT_PUBLIC_BACKEND_API_URL}/team/search-teams/`, {
            headers: authHeaders(),
            params: { q: q.trim(), limit },
          });
          setResults(res.data?.results ?? []);
        } catch {
          setResults([]);
        } finally {
          setLoading(false);
        }
      }, 300);
    },
    [limit],
  );

  useEffect(() => {
    runSearch(query);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, runSearch]);

  const selectedList: number[] = multiple
    ? (props.value as number[])
    : props.value != null
      ? [props.value as number]
      : [];

  const isSelected = (teamId: number) => selectedList.includes(teamId);

  // Remember the team so its label survives after the search results clear.
  const remember = (team: PickedTeam) =>
    setPickedById((prev) => ({ ...prev, [team.team_id]: team }));

  const handlePick = (team: PickedTeam) => {
    remember(team);
    if (multiple) {
      const cur = props.value as number[];
      const next = cur.includes(team.team_id)
        ? cur.filter((t) => t !== team.team_id) // toggle off if already picked
        : [...cur, team.team_id];
      (props.onChange as MultiProps["onChange"])(next, team);
      // keep the popover open in multi mode so several can be added in a row
      setQuery("");
    } else {
      (props.onChange as SingleProps["onChange"])(team.team_id, team);
      setOpen(false);
      setQuery("");
    }
  };

  const removeOne = (teamId: number) => {
    if (multiple) {
      (props.onChange as MultiProps["onChange"])(
        (props.value as number[]).filter((t) => t !== teamId),
      );
    } else {
      (props.onChange as SingleProps["onChange"])(null);
    }
  };

  // Human label for a team_id (falls back to the raw id if we never cached the object).
  const labelFor = (teamId: number) => {
    const t = pickedById[teamId];
    if (!t) return `Team #${teamId}`;
    return t.team_tag ? `${t.team_name} [${t.team_tag}]` : t.team_name;
  };

  // Trigger label: single shows the picked team's name; multi shows a count.
  const triggerLabel = multiple
    ? selectedList.length > 0
      ? `${selectedList.length} team(s) selected`
      : placeholder
    : props.value != null
      ? labelFor(props.value as number)
      : placeholder;

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
              !multiple && props.value == null && "text-muted-foreground",
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
              placeholder="Type a team name..."
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
              {!loading && query.trim().length >= 2 && (
                <CommandEmpty>No teams found.</CommandEmpty>
              )}
              {!loading && results.length > 0 && (
                <CommandGroup>
                  {results.map((t) => (
                    <CommandItem
                      key={t.team_id}
                      value={String(t.team_id)}
                      onSelect={() => handlePick(t)}
                      className="flex items-center justify-between gap-2"
                    >
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate font-medium">
                          {t.team_name}
                          {t.team_tag ? ` [${t.team_tag}]` : ""}
                        </span>
                        <span className="truncate text-xs text-muted-foreground">
                          {t.country || ""}
                        </span>
                      </span>
                      {isSelected(t.team_id) && <Check className="h-4 w-4 shrink-0 text-primary" />}
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
          {selectedList.map((teamId) => (
            <Badge key={teamId} variant="secondary" className="gap-1 pr-1">
              {labelFor(teamId)}
              <button
                type="button"
                onClick={() => removeOne(teamId)}
                className="rounded-full p-0.5 hover:bg-muted-foreground/20"
                aria-label={`Remove ${labelFor(teamId)}`}
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
