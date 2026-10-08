"use client";

/**
 * components/news/TransferFeed.tsx
 * ───────────────────────────────
 * The PUBLIC transfer feed: players joining and leaving teams, newest first (backlog item 21,
 * owner 2026-08-08: "Public automatic transfer news showing players joining and leaving teams").
 * Rebuilt for inbox #146 / #161 (owner 2026-10-05: "the transfers page doesnt loook good, no
 * pagination and also no search ... the filters should be better, like by countries, or by tiers
 * or by teams/players etc."): a search box over player and team names, filters by country, tier,
 * direction and team, numbered pages instead of "Load more", and the same row as the home page.
 *
 * NOBODY WRITES THESE ENTRIES. They are produced by the TeamMembers post_save / post_delete
 * receivers in backend afc_team/signals.py, so the feed keeps itself current no matter which
 * endpoint moved the player. There is no editor surface for it anywhere, on purpose.
 *
 * WHERE IT IS RENDERED: as the "Transfers" option in the category picker on app/(user)/news
 * (/news?category=transfers), in place of the article grid.
 *
 * ── Data ───────────────────────────────────────────────────────────────────────────────────
 *   GET /team/transfers/?q=&country=&tier=&direction=&team_id=&limit=&offset=
 *   (backend afc_team/views_transfers.py). Public, no auth. Returns {results, teams, countries,
 *   tiers, total_count, has_more, next_offset, limit, offset}. The filter options come from the
 *   WHOLE feed, so a dropdown never shrinks as somebody filters. Server-side and invisible here:
 *   only teams that have competed appear (afc_team.transfers.HAS_COMPETED_RULE), and
 *   `in_transfer_window` is the state captured AT THE MOMENT OF THE MOVE.
 *
 * ── Related ────────────────────────────────────────────────────────────────────────────────
 *   • The row          : components/transfers/TransferMoves.tsx TransferMoveRow, shared with the
 *                        home page, so the sentence, the lock badge and the links are one design.
 *   • Paging           : components/ListPager.tsx.
 *   • Strings          : messages/{en,fr,pt}/news.json, namespace "news", key `transfers`.
 *   • NEW tag          : components/NewBadge.tsx, self-expiring, dated to the filters' launch.
 */

import { useEffect, useRef, useState } from "react";
import axios from "axios";
import { useTranslations } from "next-intl";
import { IconSearch } from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Loader } from "@/components/Loader";
import { ListPager } from "@/components/ListPager";
import { NewBadge } from "@/components/NewBadge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TransferMoveRow, type TransferMove } from "@/components/transfers/TransferMoves";
import { CountryFlag } from "@/lib/countryFlag";
import { env } from "@/lib/env";
import { cn } from "@/lib/utils";
// Live refresh (owner 2026-07-02): the site-wide heartbeat, so a move that lands while somebody is
// reading the page appears without them reloading. Same hook the news list and home blocks use.
import { useLiveTick } from "@/hooks/useLiveTick";

// The day search, filters and paging went live (inbox #161), for the self-expiring NEW tag.
const FILTERS_LIVE_SINCE = "2026-10-05";
// Matches the endpoint's DEFAULT_PAGE_SIZE.
const PAGE_SIZE = 20;
// Radix treats "" as "no value", so "everything" needs a real value of its own in each Select.
const ALL = "all";
const SEARCH_DELAY_MS = 300;

type TeamOption = { team_id: number; team_name: string };
type Filters = { q: string; country: string; tier: string; direction: string; team: string };
const NO_FILTERS: Filters = { q: "", country: ALL, tier: ALL, direction: ALL, team: ALL };

type Feed = {
  rows: TransferMove[];
  total: number;
  teams: TeamOption[];
  countries: string[];
  tiers: string[];
};

export function TransferFeed() {
  // Namespace "news" (messages/{en,fr,pt}/news.json); every key below lives under `transfers`.
  const t = useTranslations("news");
  // Tier options are labelled exactly as components/rankings/TierBadge.tsx labels them: the API
  // answers ranking tier CODES ("0", "3"), and code 0 is shown as "Tier 1" (inbox #163, the
  // filter printed the raw code, so its "Tier 3" was the Rankings page's "Tier 4").
  const tRank = useTranslations("rankings");
  const tick = useLiveTick();

  const [typed, setTyped] = useState("");
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [page, setPage] = useState(1);
  const [attempt, setAttempt] = useState(0);
  const [feed, setFeed] = useState<Feed | null>(null);
  const [failed, setFailed] = useState(false);
  // What the rows on screen were fetched for; anything else means a fetch is in flight. The live
  // tick is left out on purpose: a background refresh must not dim the list.
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const wanted = JSON.stringify([filters, page, attempt]);
  const loading = loadedFor !== wanted;

  const setFilter = (key: keyof Filters, value: string) => {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(1);
  };

  // The search box settles before it searches, and a new search starts from page 1.
  useEffect(() => {
    const q = typed.trim();
    if (q === filters.q) return;
    const id = setTimeout(() => {
      setFilters((f) => ({ ...f, q }));
      setPage(1);
    }, SEARCH_DELAY_MS);
    return () => clearTimeout(id);
  }, [typed, filters.q]);

  // The request the rows on screen answer. The same request again can only be the live tick, a
  // BACKGROUND refresh: it must not blank or dim a feed that is already on screen.
  const lastWanted = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const background = lastWanted.current === wanted;
    const load = async () => {
      try {
        // GET /team/transfers/ - public, so no auth header (see the file header).
        const res = await axios.get(`${env.NEXT_PUBLIC_BACKEND_API_URL}/team/transfers/`, {
          params: {
            q: filters.q || undefined,
            country: filters.country === ALL ? undefined : filters.country,
            tier: filters.tier === ALL ? undefined : filters.tier,
            direction: filters.direction === ALL ? undefined : filters.direction,
            team_id: filters.team === ALL ? undefined : filters.team,
            limit: PAGE_SIZE,
            offset: (page - 1) * PAGE_SIZE,
          },
        });
        if (cancelled) return;
        const d = res.data;
        setFeed({
          rows: d.results ?? [],
          total: d.total_count ?? 0,
          teams: d.teams ?? [],
          countries: d.countries ?? [],
          tiers: d.tiers ?? [],
        });
        setFailed(false);
      } catch {
        // A background refresh never blanks a feed that is already on screen.
        if (!cancelled && !background) setFailed(true);
      } finally {
        if (!cancelled) {
          lastWanted.current = wanted;
          setLoadedFor(wanted);
        }
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [filters, page, attempt, tick, wanted]);

  const filtered =
    filters.q !== "" || filters.country !== ALL || filters.tier !== ALL || filters.direction !== ALL || filters.team !== ALL;

  // One select per filter, all the same shape; the first option clears that filter.
  const filterSelect = (
    key: Exclude<keyof Filters, "q">,
    label: string,
    allLabel: string,
    options: { value: string; label: React.ReactNode }[],
  ) => (
    <Select value={filters[key]} onValueChange={(v) => setFilter(key, v)}>
      <SelectTrigger className="w-full" aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{allLabel}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {t("transfers.heading")}
          {/* Search, filters and pages are new (inbox #161); a returning reader would not
              otherwise notice the feed can now be searched. */}
          <NewBadge since={FILTERS_LIVE_SINCE} />
        </CardTitle>
        <p className="mt-1 text-sm text-muted-foreground">{t("transfers.intro")}</p>
      </CardHeader>

      <CardContent>
        {/* ── search + filters ─────────────────────────────────────────────────────────────
            The search is the widest control: a player's or a team's name is what people bring.
            The four filters sit two to a row on a phone, four across from lg. */}
        <div className="mb-4 space-y-2">
          <div className="relative">
            <IconSearch
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              value={typed}
              onChange={(e) => setTyped(e.target.value.slice(0, 50))}
              placeholder={t("transfers.searchPlaceholder")}
              aria-label={t("transfers.searchPlaceholder")}
              className="pl-9"
            />
          </div>
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            {filterSelect(
              "country",
              t("transfers.filterLabels.country"),
              t("transfers.countryFilter.all"),
              (feed?.countries ?? []).map((c) => ({
                value: c,
                label: (
                  <span className="flex items-center gap-2">
                    <CountryFlag country={c} />
                    {c}
                  </span>
                ),
              })),
            )}
            {filterSelect(
              "tier",
              t("transfers.filterLabels.tier"),
              t("transfers.tierFilter.all"),
              (feed?.tiers ?? []).map((tier) => ({ value: tier, label: tRank("tier", { tier: Number(tier) + 1 }) })),
            )}
            {filterSelect("direction", t("transfers.filterLabels.direction"), t("transfers.directionFilter.all"), [
              { value: "joined", label: t("transfers.directionFilter.joined") },
              { value: "left", label: t("transfers.directionFilter.left") },
            ])}
            {filterSelect(
              "team",
              t("transfers.filterLabels.team"),
              t("transfers.teamFilter.all"),
              (feed?.teams ?? []).map((team) => ({ value: String(team.team_id), label: team.team_name })),
            )}
          </div>
          {filtered && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setTyped("");
                setFilters(NO_FILTERS);
                setPage(1);
              }}
            >
              {t("transfers.clearFilters")}
            </Button>
          )}
        </div>

        {feed === null && !failed && <Loader text={t("transfers.loading")} />}

        {failed && (
          <div className="flex flex-col items-center gap-3 py-10 text-center text-sm text-muted-foreground">
            <p>{t("transfers.error")}</p>
            <Button variant="secondary" onClick={() => setAttempt((n) => n + 1)}>
              {t("transfers.retry")}
            </Button>
          </div>
        )}

        {!failed && feed && feed.rows.length === 0 && !loading && (
          <div className="py-12 text-center">
            {filtered ? (
              <p className="text-muted-foreground">{t("transfers.emptyFiltered")}</p>
            ) : (
              <>
                <h3 className="mb-2 text-lg font-semibold">{t("transfers.empty.title")}</h3>
                <p className="text-muted-foreground">{t("transfers.empty.body")}</p>
              </>
            )}
          </div>
        )}

        {!failed && feed && feed.rows.length > 0 && (
          <>
            <ul className={cn("grid gap-1.5 md:grid-cols-2", loading && "opacity-60")} aria-busy={loading}>
              {feed.rows.map((move) => (
                <TransferMoveRow key={move.transfer_id} move={move} surface="card" />
              ))}
            </ul>
            <ListPager page={page} pageSize={PAGE_SIZE} total={feed.total} onPage={setPage} />
          </>
        )}
      </CardContent>
    </Card>
  );
}
