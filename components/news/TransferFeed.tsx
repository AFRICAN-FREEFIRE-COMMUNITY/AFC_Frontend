"use client";

/**
 * components/news/TransferFeed.tsx
 * ───────────────────────────────
 * The PUBLIC transfer feed: players joining and leaving teams, newest first (backlog item 21,
 * owner 2026-08-08: "Public automatic transfer news showing players joining and leaving teams").
 *
 * NOBODY WRITES THESE ENTRIES. They are produced by the TeamMembers post_save / post_delete
 * receivers in backend afc_team/signals.py, so the feed keeps itself current no matter which
 * endpoint moved the player. There is no editor surface for it anywhere, on purpose: an editorial
 * version dies in the first busy month.
 *
 * WHERE IT IS RENDERED: as the "Transfers" option in the category picker on app/(user)/news, in
 * place of the article grid. It is a CATEGORY of the news surface rather than a separate top-level
 * page, which is where a reader already goes for "what happened".
 *
 * ── Data ───────────────────────────────────────────────────────────────────────────────────
 *   GET /team/transfers/?team_id=&limit=&offset=   (backend afc_team/views_transfers.py)
 *   Public, no auth. Returns {results, teams, total_count, has_more, next_offset, limit, offset}.
 *   Two rules are applied SERVER-side and are invisible here:
 *     • only teams that have actually competed appear (afc_team.transfers.HAS_COMPETED_RULE), so
 *       the feed is not a churn log of teams nobody has heard of;
 *     • `in_transfer_window` is the state captured AT THE MOMENT OF THE MOVE, not re-derived now.
 *
 * ── The sentence is built by ICU, never by concatenation ───────────────────────────────────
 * "X joined Y" is a translated message with the player and team as PLACEHOLDERS inside rich-text
 * tags (news.transfers.entry.joined / .left), so French and Portuguese are free to put the words
 * in their own order. Gluing a name onto a translated verb here would lock every language into
 * English word order.
 *
 * ── Related ────────────────────────────────────────────────────────────────────────────────
 *   • Strings          : messages/{en,fr,pt}/news.json, namespace "news", key `transfers`.
 *   • Dates            : components/LocalTime.tsx (viewer's timezone + language; backend is UTC).
 *   • The window badge : mirrors components/rankings/TransferWindowBanner.tsx, which tells a
 *                        reader whether roster moves are allowed RIGHT NOW; this says whether they
 *                        were allowed when a given move happened.
 *   • NEW tag          : components/NewBadge.tsx, self-expiring.
 */

import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { IconUserMinus, IconUserPlus, IconLock } from "@tabler/icons-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader } from "@/components/Loader";
import { LocalTime } from "@/components/LocalTime";
import { NewBadge } from "@/components/NewBadge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { env } from "@/lib/env";
import { cn } from "@/lib/utils";
// Live refresh (owner 2026-07-02): the site-wide heartbeat, so a move that lands while somebody is
// reading the page appears without them reloading. Same hook the news list and home blocks use.
import { useLiveTick } from "@/hooks/useLiveTick";

// The day this surface goes LIVE, for the self-expiring NEW tag (owner rule: 5 days, date-driven).
// Written 2026-08-08, shipped 2026-08-16; the badge is dated to the day readers can actually see
// it, and matches the one on the Transfers option in the news category picker.
const TRANSFERS_LIVE_SINCE = "2026-08-16";

// One page of entries. Matches the endpoint's DEFAULT_PAGE_SIZE; "Load more" appends the next page
// rather than replacing, so somebody reading down the feed never loses their place.
const PAGE_SIZE = 20;

// Sentinel for the team <Select>. Radix treats "" as "no value", so the "all teams" option needs a
// real value of its own - the same trick the news category filter uses with "all".
const ALL_TEAMS = "all";

type TransferRow = {
  transfer_id: number;
  direction: "joined" | "left";
  /** Live username while the account exists, otherwise the one recorded at the time of the move. */
  player_username: string;
  /** False once the account is gone: the name still reads, it just carries no link. */
  player_exists: boolean;
  team_id: number | null;
  /** Live team name while the team exists, otherwise the one recorded at the time of the move. */
  team_name: string;
  team_tag: string | null;
  team_logo: string | null;
  management_role: string | null;
  occurred_at: string;
  /** true = window was open (routine), false = it was closed (notable), null = no season. */
  in_transfer_window: boolean | null;
};

type TeamOption = { team_id: number; team_name: string };

export function TransferFeed() {
  // Namespace "news" (messages/{en,fr,pt}/news.json); every key below lives under `transfers`.
  const t = useTranslations("news");
  const tick = useLiveTick();

  const [rows, setRows] = useState<TransferRow[]>([]);
  const [teams, setTeams] = useState<TeamOption[]>([]);
  const [teamFilter, setTeamFilter] = useState<string>(ALL_TEAMS);
  const [hasMore, setHasMore] = useState(false);
  const [nextOffset, setNextOffset] = useState(0);
  const [failed, setFailed] = useState(false);

  // ── "are we loading?" is DERIVED, not stored ────────────────────────────────────────────────
  // `loadedFilter` is the team filter the rows currently on screen were fetched for, and null
  // until the first page lands. So "loading" is simply "what is on screen is not what is being
  // asked for", which is true on first paint and again the moment somebody picks a different team,
  // with no second state to keep in step. Storing a boolean and flipping it on inside the effect
  // would ALSO work, but it schedules an extra render before the fetch even starts, and it is the
  // kind of pair that gets stuck on when a later edit adds an early return.
  const [loadedFilter, setLoadedFilter] = useState<string | null>(null);
  const loading = loadedFilter !== teamFilter;

  const fetchPage = useCallback(
    async (offset: number, { append }: { append: boolean }) => {
      // GET /team/transfers/ - see the file header. No auth header: the feed is public, and
      // sending one would only make it uncacheable.
      const params: Record<string, string | number> = { limit: PAGE_SIZE, offset };
      if (teamFilter !== ALL_TEAMS) params.team_id = teamFilter;

      const res = await axios.get(`${env.NEXT_PUBLIC_BACKEND_API_URL}/team/transfers/`, {
        params,
      });
      const data = res.data;
      setRows((prev) => (append ? [...prev, ...data.results] : data.results));
      // The team options come from the WHOLE feed, not the current page, so the dropdown does not
      // change as somebody pages down.
      setTeams(data.teams ?? []);
      setHasMore(!!data.has_more);
      setNextOffset(data.next_offset ?? 0);
    },
    [teamFilter],
  );

  // First page, and again whenever the team filter changes or the live tick fires. A tick is a
  // BACKGROUND refresh: it must not throw the reader back to a spinner, and a transient failure
  // must not blank a feed that is already on screen, so only the foreground path touches `failed`.
  useEffect(() => {
    let cancelled = false;
    const background = tick > 0;
    // The work sits in a nested async function rather than running straight off the effect body,
    // which is the idiom the rest of this app uses (see app/(user)/news/page.tsx): the effect
    // itself only starts and cancels it.
    const load = async () => {
      try {
        await fetchPage(0, { append: false });
        if (!cancelled && !background) setFailed(false);
      } catch {
        if (!cancelled && !background) setFailed(true);
      } finally {
        // Records WHICH filter the rows on screen belong to, which is what `loading` is derived
        // from above. Set on failure as well as success, so a feed that cannot load shows its
        // error message instead of spinning for ever.
        if (!cancelled) setLoadedFilter(teamFilter);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [fetchPage, tick, teamFilter]);

  const roleLabel = (role: string | null) => {
    if (!role) return null;
    // Unknown keys fall back to the raw value rather than throwing: the backend's role set can grow
    // ahead of this catalogue, and a missing label must not take the whole feed down.
    const known = ["team_captain", "vice_captain", "member", "coach", "manager", "analyst"];
    return known.includes(role) ? t(`transfers.roles.${role}`) : role;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {t("transfers.heading")}
          {/* Self-expiring NEW tag: this category did not exist before the date above, and a returning
              reader would not otherwise notice a new option in the picker. */}
          <NewBadge since={TRANSFERS_LIVE_SINCE} />
        </CardTitle>
        <p className="text-sm text-muted-foreground mt-1">{t("transfers.intro")}</p>
      </CardHeader>

      <CardContent>
        {/* ── per-team view ─────────────────────────────────────────────────────────────────
            "What happened to my team" is what people actually click, so the filter is the first
            control in the block. Only teams that appear in the feed are offered. */}
        {teams.length > 0 && (
          <div className="mb-4">
            <Select value={teamFilter} onValueChange={setTeamFilter}>
              <SelectTrigger className="w-full md:w-72">
                <SelectValue placeholder={t("transfers.teamFilter.placeholder")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_TEAMS}>{t("transfers.teamFilter.all")}</SelectItem>
                {teams.map((team) => (
                  <SelectItem key={team.team_id} value={String(team.team_id)}>
                    {team.team_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {loading && <Loader text={t("transfers.loading")} />}

        {!loading && failed && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {t("transfers.error")}
          </p>
        )}

        {!loading && !failed && rows.length === 0 && (
          <div className="py-12 text-center">
            <h3 className="mb-2 text-lg font-semibold">{t("transfers.empty.title")}</h3>
            <p className="text-muted-foreground">
              {teamFilter === ALL_TEAMS
                ? t("transfers.empty.body")
                : t("transfers.empty.bodyForTeam")}
            </p>
          </div>
        )}

        {!loading && !failed && rows.length > 0 && (
          <ul className="space-y-2">
            {rows.map((row) => {
              const joined = row.direction === "joined";
              // false means the window was CLOSED when this happened. null (no active season) is
              // deliberately NOT flagged: there was no window to be outside of.
              const outsideWindow = row.in_transfer_window === false;
              const role = roleLabel(row.management_role);

              // The two halves of the sentence, rendered as links when the player/team still
              // exist. A deleted account or team keeps the recorded name as plain text rather
              // than a dead link.
              //
              // BOTH ROUTES ARE ADDRESSED BY NAME, NOT BY ID. /teams/[id] looks its team up with
              // an exact team_name match (backend get_team_details) and /players/[username] with
              // the username, so `/teams/${team_id}` would 404 every time - the same mistake that
              // broke the event-invitation deep link for all 24 invitations ever sent. The backend
              // sends the LIVE name in these fields precisely so this link resolves after a
              // rename; encodeURIComponent because team names contain spaces.
              const sentenceValues = {
                playerName: row.player_username,
                teamName: row.team_name,
                pl: (chunks: React.ReactNode) =>
                  row.player_exists ? (
                    <Link
                      href={`/players/${encodeURIComponent(row.player_username)}`}
                      className="font-semibold text-foreground hover:text-primary hover:underline"
                    >
                      {chunks}
                    </Link>
                  ) : (
                    <span className="font-semibold text-foreground">{chunks}</span>
                  ),
                tm: (chunks: React.ReactNode) =>
                  row.team_id ? (
                    <Link
                      href={`/teams/${encodeURIComponent(row.team_name)}`}
                      className="font-semibold text-foreground hover:text-primary hover:underline"
                    >
                      {chunks}
                    </Link>
                  ) : (
                    <span className="font-semibold text-foreground">{chunks}</span>
                  ),
              };

              return (
                <li
                  key={row.transfer_id}
                  className="flex items-start gap-3 rounded-md border bg-card p-3 transition-colors hover:border-primary/50"
                >
                  {/* Direction is carried by an icon as well as by the wording, so the feed is
                      scannable without reading every sentence. Colour alone is never the signal. */}
                  <span
                    className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                      joined ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
                    )}
                    aria-hidden="true"
                  >
                    {joined ? (
                      <IconUserPlus className="h-4 w-4" />
                    ) : (
                      <IconUserMinus className="h-4 w-4" />
                    )}
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="text-sm break-words">
                      {/* ICU rich text: the names are placeholders inside <pl>/<tm> tags, so a
                          translator can reorder the whole sentence. */}
                      {t.rich(
                        joined ? "transfers.entry.joined" : "transfers.entry.left",
                        sentenceValues,
                      )}
                      {/* The role is a separate clause, not glued into the sentence above, so
                          "joined as Coach" reads correctly in every language without needing four
                          more message variants. */}
                      {joined && role && (
                        <span className="text-muted-foreground">
                          {" "}
                          {t("transfers.entry.asRole", { role })}
                        </span>
                      )}
                    </p>

                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                      <LocalTime value={row.occurred_at} mode="date" />
                      {outsideWindow && (
                        <>
                          <span aria-hidden="true">•</span>
                          {/* The distinction the owner asked for: roster moves are frozen
                              server-side while the window is closed, so one that happened anyway
                              is the story. A move inside an open window is routine and wears no
                              badge, which keeps the flag meaningful. */}
                          <Badge
                            variant="outline"
                            className="rounded-full border-destructive/60 px-2 py-0.5 text-xs text-destructive"
                            title={t("transfers.window.outsideHint")}
                          >
                            <IconLock className="mr-1 h-3 w-3" />
                            {t("transfers.window.outside")}
                          </Badge>
                        </>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {!loading && !failed && hasMore && (
          <div className="mt-4 flex justify-center">
            <Button variant="outline" onClick={() => fetchPage(nextOffset, { append: true })}>
              {t("transfers.loadMore")}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
