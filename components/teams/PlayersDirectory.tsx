"use client";

// PlayersDirectory: the Players tab of "Teams & Players" on /teams (inbox #153 / #161, owner
// 2026-10-05: "let there be a page for players also ... people can choose the teams tab or the
// players tab and search for and view the profiles of players").
//
// DATA: GET player/directory/?q=&country=&limit=&offset= (AFC-B afc_player/views_directory.py),
// public, no auth. It lists only players already public somewhere else (on a team, or with a
// scored match), never the whole account list, which stays admin-only; see the backend module.
// The server pages and searches, so this holds one page at a time, never the ~6,800 accounts.
//
// Each card opens the player's public profile (/players/<username>, lib/routes playerPath); the
// team line opens the team page. The whole card is the profile link (a stretched link) and the
// team link sits above it, so there is never a link inside a link.
//
// Strings: messages/<locale>/teamsplayers.json "playersDirectory" (+ rankings.roles for the in-game
// role). Paging: components/ListPager.tsx. States: loading (first load), error with a retry,
// empty (nothing listed / nothing matches), the list. A page change keeps the old cards visible,
// dimmed, until the next page lands, so the grid does not jump.
import { useEffect, useState } from "react";
import axios from "axios";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { IconSearch } from "@tabler/icons-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Loader } from "@/components/Loader";
import { ListPager } from "@/components/ListPager";
import { TeamLink } from "@/components/ui/entity-link";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CountryFlag } from "@/lib/countryFlag";
import { env } from "@/lib/env";
import { playerPath } from "@/lib/routes";
import { cn } from "@/lib/utils";

// Matches the endpoint's DEFAULT_PAGE_SIZE: 8 rows of 3 on a desktop, 12 of 2 on a tablet.
const PAGE_SIZE = 24;
// Radix treats "" as "no value", so "every country" needs a real value of its own.
const ALL = "all";
// Wait this long after the last keystroke before searching, so typing a name is one request.
const SEARCH_DELAY_MS = 300;
const KNOWN_ROLES = ["rusher", "support", "grenader", "sniper"];

type PlayerRow = {
  username: string;
  country: string;
  profile_picture: string | null;
  in_game_role: string | null;
  management_role: string | null;
  team: { team_name: string; team_tag: string | null; team_logo: string | null } | null;
};

// One option per country: the backend folds 'NG' and 'Nigeria' into one (afc_auth/country_grouping),
// and `value` is what goes back as ?country=.
type CountryOption = { value: string; label: string };
type Page = { rows: PlayerRow[]; total: number; countries: CountryOption[] };

export function PlayersDirectory() {
  const t = useTranslations("teamsplayers");

  const [typed, setTyped] = useState("");
  const [query, setQuery] = useState("");
  const [country, setCountry] = useState(ALL);
  const [page, setPage] = useState(1);
  const [attempt, setAttempt] = useState(0);
  const [data, setData] = useState<Page | null>(null);
  const [failed, setFailed] = useState(false);
  // What the cards on screen were fetched for; anything else means a fetch is in flight.
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const wanted = `${query}|${country}|${page}|${attempt}`;
  const loading = loadedFor !== wanted;

  // The search box settles before it searches, and a new search starts from page 1.
  useEffect(() => {
    const q = typed.trim();
    if (q === query) return;
    const id = setTimeout(() => {
      setQuery(q);
      setPage(1);
    }, SEARCH_DELAY_MS);
    return () => clearTimeout(id);
  }, [typed, query]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        // GET player/directory/ - public, so no auth header (see the file header).
        const res = await axios.get(`${env.NEXT_PUBLIC_BACKEND_API_URL}/player/directory/`, {
          params: {
            q: query || undefined,
            country: country === ALL ? undefined : country,
            limit: PAGE_SIZE,
            offset: (page - 1) * PAGE_SIZE,
          },
        });
        if (cancelled) return;
        setData({
          rows: res.data.results ?? [],
          total: res.data.total_count ?? 0,
          countries: res.data.countries ?? [],
        });
        setFailed(false);
      } catch {
        if (!cancelled) setFailed(true);
      } finally {
        if (!cancelled) setLoadedFor(wanted);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [query, country, page, attempt, wanted]);

  const roleLabel = (role: string | null) =>
    role && KNOWN_ROLES.includes(role) ? t(`rankings.roles.${role}`) : null;

  const firstLoad = data === null && !failed;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("playersDirectory.title")}</CardTitle>
        <CardDescription>{t("playersDirectory.description")}</CardDescription>
      </CardHeader>
      <CardContent>
        {/* ── search + country ── the search is the first control: a name is what people bring. */}
        <div className="mb-4 grid gap-2 sm:grid-cols-[1fr_220px]">
          <div className="relative">
            <IconSearch
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              value={typed}
              onChange={(e) => setTyped(e.target.value.slice(0, 50))}
              placeholder={t("playersDirectory.searchPlaceholder")}
              aria-label={t("playersDirectory.searchPlaceholder")}
              className="pl-9"
            />
          </div>
          <Select
            value={country}
            onValueChange={(v) => {
              setCountry(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-full" aria-label={t("playersDirectory.countryLabel")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t("playersDirectory.allCountries")}</SelectItem>
              {(data?.countries ?? []).map((c) => (
                <SelectItem key={c.value} value={c.value}>
                  <span className="flex items-center gap-2">
                    <CountryFlag country={c.label} />
                    {c.label}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {firstLoad && <Loader text={t("playersDirectory.loading")} />}

        {failed && (
          <div className="flex flex-col items-center gap-3 py-10 text-center text-sm text-muted-foreground">
            <p>{t("playersDirectory.error")}</p>
            <Button variant="secondary" onClick={() => setAttempt((n) => n + 1)}>
              {t("playersDirectory.retry")}
            </Button>
          </div>
        )}

        {!failed && data && data.rows.length === 0 && !loading && (
          <p className="py-10 text-center text-muted-foreground">
            {query || country !== ALL ? t("playersDirectory.noMatch") : t("playersDirectory.empty")}
          </p>
        )}

        {!failed && data && data.rows.length > 0 && (
          <>
            <ul
              className={cn("grid gap-2 sm:grid-cols-2 lg:grid-cols-3", loading && "opacity-60")}
              aria-busy={loading}
            >
              {data.rows.map((p) => {
                const role = roleLabel(p.in_game_role);
                return (
                  <li
                    key={p.username}
                    className="relative flex items-center gap-3 rounded-md bg-muted/40 p-3 hover:bg-muted/70"
                  >
                    <Avatar className="size-12 shrink-0">
                      <AvatarImage src={p.profile_picture ?? undefined} alt="" className="object-cover" />
                      <AvatarFallback className="font-bold">{p.username.trim().slice(0, 1).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 items-center gap-1.5">
                        <CountryFlag country={p.country} />
                        {/* The stretched link: its ::after covers the card, so the whole card
                            opens the profile while the team link below stays its own target. */}
                        <Link
                          href={playerPath(p.username)}
                          className="truncate font-semibold after:absolute after:inset-0 after:rounded-md hover:text-primary"
                        >
                          {/* Shown trimmed (some older names carry stray spaces); the link keeps
                              the exact name, which is the profile's address. */}
                          {p.username.trim()}
                        </Link>
                      </div>
                      <div className="mt-0.5 flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
                        {p.team ? (
                          <span className="relative z-10 min-w-0 truncate">
                            <TeamLink name={p.team.team_name} />
                          </span>
                        ) : (
                          <span>{t("playersDirectory.noTeam")}</span>
                        )}
                        {role && (
                          <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 font-semibold text-primary">
                            {role}
                          </span>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
            <ListPager page={page} pageSize={PAGE_SIZE} total={data.total} onPage={setPage} />
          </>
        )}
      </CardContent>
    </Card>
  );
}
