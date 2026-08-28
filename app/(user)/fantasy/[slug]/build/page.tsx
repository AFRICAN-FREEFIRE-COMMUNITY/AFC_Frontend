"use client";

/**
 * app/(user)/fantasy/[slug]/build/page.tsx - the squad builder. This screen IS the game.
 *
 * THE ONE DESIGN DECISION EVERYTHING ELSE FOLLOWS FROM
 *   The rules are NOT re-implemented here. Every change posts the squad to the server's dry-run
 *   (PUT my-squad/ with dry_run) and renders whatever it says. A second implementation in
 *   TypeScript would drift from the one that actually gates the save, and the day it drifted a fan
 *   would build a squad the builder called legal and the save refused, with no way to tell who was
 *   right. One rulebook, on the server, rendered here.
 *
 * WHY THE CHECKLIST SHOWS RULES THAT PASS
 *   "3 of 5 picked, 62 of 100 seeds spent" teaches the game. An error that appears only once you
 *   are wrong teaches nothing, and a fan who has never played a fantasy league is the normal case.
 *   Same reasoning as the polls requirements panel.
 *
 * WHY EVERY PRICE SHOWS ITS REASON
 *   "1.9 kills per map over 12 maps, +4 for V-ENT ESPORTS form" is printed under each price.
 *   Somebody will think their favourite is priced wrong, and a price you can check is a price
 *   nobody argues with twice.
 *
 * WHAT IT TALKS TO
 *   GET {BACKEND}/fantasy/<slug>/            -> the league's rules
 *   GET {BACKEND}/fantasy/<slug>/players/    -> the priced pool
 *   GET {BACKEND}/fantasy/<slug>/my-squad/   -> what you already picked
 *   PUT {BACKEND}/fantasy/<slug>/my-squad/   -> dry_run to validate, or the real save
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  IconCheck,
  IconCrown,
  IconDeviceFloppy,
  IconSearch,
  IconX,
} from "@tabler/icons-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/PageHeader";
import { FullLoader } from "@/components/Loader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  fantasyApi,
  type FantasyLeague,
  type FantasyPlayer,
  type SquadPick,
  type SquadRule,
} from "@/lib/fantasy";

export default function SquadBuilderPage() {
  const t = useTranslations("fantasy");
  const router = useRouter();
  const { slug } = useParams<{ slug: string }>();

  const [league, setLeague] = useState<FantasyLeague | null>(null);
  const [pool, setPool] = useState<FantasyPlayer[]>([]);
  const [picks, setPicks] = useState<SquadPick[]>([]);
  const [squadName, setSquadName] = useState("");
  const [rules, setRules] = useState<SquadRule[]>([]);
  const [spent, setSpent] = useState(0);
  const [ok, setOk] = useState(false);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // ── load ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const [detail, players, mine] = await Promise.all([
          fantasyApi.league(slug),
          // limit=500 rather than paging: the builder needs the WHOLE pool to filter and to total
          // a budget, and a page boundary in the middle of a price list is a trap (a fan would
          // think they had seen everything affordable). A real event tops out around 400 players.
          fantasyApi.players(slug, { limit: 500 }),
          fantasyApi.mySquad(slug).catch(() => null),
        ]);
        setLeague(detail);
        setPool(players?.results ?? []);
        if (mine?.has_squad) {
          setPicks(mine.picks ?? []);
          setSquadName(mine.squad_name ?? "");
        }
      } catch {
        setLeague(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [slug]);

  // ── validate, on the server, on every change ────────────────────────────────
  // Debounced so a burst of taps is one request, and it is the SAME endpoint the save calls, so
  // the checklist can never disagree with the thing that gates the save.
  useEffect(() => {
    if (loading || !league) return;
    const handle = setTimeout(() => {
      fantasyApi
        .checkSquad(slug, picks)
        .then((res) => {
          setRules(res.rules ?? []);
          setSpent(res.spent ?? 0);
          setOk(Boolean(res.ok));
        })
        .catch(() => undefined);
    }, 250);
    return () => clearTimeout(handle);
  }, [picks, slug, loading, league]);

  const pickedIds = useMemo(() => new Set(picks.map((p) => p.player_id)), [picks]);
  const priceOf = useMemo(
    () => new Map(pool.map((p) => [p.player_id, p.price_seeds])),
    [pool],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return pool;
    return pool.filter(
      (p) =>
        p.username.toLowerCase().includes(q) ||
        (p.team?.team_name ?? "").toLowerCase().includes(q),
    );
  }, [pool, query]);

  // ── picking ─────────────────────────────────────────────────────────────────
  const toggle = useCallback(
    (player: FantasyPlayer) => {
      setPicks((prev) => {
        if (prev.some((p) => p.player_id === player.player_id)) {
          return prev.filter((p) => p.player_id !== player.player_id);
        }
        // The squad-size rule is the server's, so the client does not block a sixth pick: it lets
        // it happen and shows the rule failing. Silently refusing a tap is the thing that makes a
        // builder feel broken.
        return [...prev, { player_id: player.player_id, is_captain: prev.length === 0 }];
      });
    },
    [],
  );

  const setCaptain = useCallback((playerId: number) => {
    // Exactly one captain, enforced here as well as on the server, because this is a RADIO
    // choice rather than a rule a fan can get wrong: two captains is never something they meant.
    setPicks((prev) => prev.map((p) => ({ ...p, is_captain: p.player_id === playerId })));
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await fantasyApi.saveSquad(slug, { squad_name: squadName, picks });
      toast.success(t("builder.saved"));
      router.push(`/fantasy/${slug}`);
    } catch (error: any) {
      // A 400 carries the full rule list, so the checklist updates to show exactly what failed
      // rather than only a toast the fan has to interpret.
      if (error?.response?.data?.rules) setRules(error.response.data.rules);
      toast.error(error?.response?.data?.message || t("builder.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <FullLoader />;
  if (!league) {
    return (
      <div className="py-8">
        <PageHeader title={t("notFound.title")} description={t("notFound.body")} back />
      </div>
    );
  }

  const budget = league.budget_seeds ?? 0;
  const remaining = budget - spent;

  return (
    <div className="py-8">
      <PageHeader
        back
        title={t("builder.title")}
        description={league.name}
        action={
          <Button
            className="w-full md:w-auto"
            disabled={!ok || saving || league.is_locked}
            onClick={save}
          >
            <IconDeviceFloppy className="mr-1.5 size-4" aria-hidden />
            {t("builder.save")}
          </Button>
        }
      />

      {league.is_locked && (
        <div className="mt-6 rounded-md border border-gold/40 bg-gold/5 p-3 text-xs text-muted-foreground">
          {t("closed.locked")}
        </div>
      )}

      {/* min-w-0 on both columns: a grid item defaults to min-width:auto and will not shrink
          below its content, so at 390px both columns rendered 492px wide and pushed the page
          off-screen with no way to scroll to it. The truncate rules inside only bite once the
          track is allowed to constrain them. */}
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        {/* ── your squad + the checklist ─────────────────────────────────────── */}
        <div className="min-w-0 space-y-4 lg:col-span-1">
          <Card className="bg-card rounded-md border py-6 shadow-sm lg:sticky lg:top-4">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{t("builder.yourSquad")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input
                value={squadName}
                onChange={(e) => setSquadName(e.target.value)}
                placeholder={t("builder.namePlaceholder")}
                maxLength={80}
                className="h-9 text-sm"
              />

              {league.use_budget && (
                <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2 text-xs">
                  <span className="text-muted-foreground">{t("builder.remaining")}</span>
                  <span
                    className={cn(
                      "font-semibold tabular-nums",
                      remaining < 0 ? "text-destructive" : "text-foreground",
                    )}
                  >
                    {t("rules.seeds", { n: remaining })}
                  </span>
                </div>
              )}

              {picks.length === 0 ? (
                <p className="py-4 text-center text-xs text-muted-foreground">
                  {t("builder.nothingPicked")}
                </p>
              ) : (
                <ul className="space-y-2">
                  {picks.map((pick) => {
                    const player = pool.find((p) => p.player_id === pick.player_id);
                    return (
                      <li
                        key={pick.player_id}
                        className="flex flex-wrap items-center gap-2 rounded-md border px-2 py-1.5"
                      >
                        <span className="min-w-0 flex-1 truncate text-xs text-foreground">
                          {player?.username ?? `#${pick.player_id}`}
                        </span>
                        {league.use_budget && (
                          <span className="text-[11px] tabular-nums text-muted-foreground">
                            {priceOf.get(pick.player_id) ?? 0}
                          </span>
                        )}
                        {/* The captain is a radio, not a rule to get wrong. */}
                        <button
                          type="button"
                          onClick={() => setCaptain(pick.player_id)}
                          aria-pressed={pick.is_captain}
                          aria-label={t("builder.makeCaptain")}
                          className={cn(
                            "inline-flex size-7 shrink-0 items-center justify-center rounded-full border transition-colors",
                            pick.is_captain
                              ? "border-gold/60 bg-gold/10 text-gold"
                              : "border-input text-muted-foreground hover:text-foreground",
                          )}
                        >
                          <IconCrown className="size-3.5" aria-hidden />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setPicks((prev) => prev.filter((p) => p.player_id !== pick.player_id))
                          }
                          aria-label={t("builder.remove")}
                          className="inline-flex size-7 shrink-0 items-center justify-center rounded-full border border-input text-muted-foreground transition-colors hover:text-destructive"
                        >
                          <IconX className="size-3.5" aria-hidden />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}

              <Link
                href="/fantasy/how-it-works"
                className="block text-[11px] font-medium text-primary hover:underline"
              >
                {t("guide.readGuide")}
              </Link>

              {/* The checklist. Every rule, passing ones included: it is what teaches the game. */}
              <ul className="space-y-1.5 border-t pt-3">
                {rules.map((rule) => (
                  <li key={rule.key} className="flex items-start gap-2 text-[11px]">
                    {rule.ok ? (
                      <IconCheck className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden />
                    ) : (
                      <IconX className="mt-0.5 size-3.5 shrink-0 text-orange-400" aria-hidden />
                    )}
                    <span className={rule.ok ? "text-muted-foreground" : "text-foreground"}>
                      <span className="font-medium">{rule.label}</span>
                      <span className="block text-muted-foreground">{rule.detail}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>

        {/* ── the pool ────────────────────────────────────────────────────────── */}
        <div className="min-w-0 lg:col-span-2">
          <Card className="bg-card rounded-md border py-6 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{t("builder.players")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="relative">
                <IconSearch
                  className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t("builder.searchPlaceholder")}
                  className="h-9 pl-8 text-sm"
                />
              </div>

              {filtered.length === 0 ? (
                <p className="py-6 text-center text-xs text-muted-foreground">
                  {t("builder.noPlayers")}
                </p>
              ) : (
                <ul className="max-h-[36rem] space-y-2 overflow-y-auto pr-1">
                  {filtered.map((player) => {
                    const picked = pickedIds.has(player.player_id);
                    return (
                      <li key={player.player_id}>
                        <button
                          type="button"
                          onClick={() => toggle(player)}
                          disabled={league.is_locked}
                          className={cn(
                            "flex w-full flex-wrap items-center gap-2 rounded-md border px-3 py-2 text-left transition-colors",
                            "disabled:cursor-not-allowed disabled:opacity-60",
                            picked
                              ? "border-primary/50 bg-primary/5"
                              : "hover:border-primary/40",
                          )}
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-foreground">
                              {player.username}
                            </p>
                            <p className="truncate text-[11px] text-muted-foreground">
                              {player.team?.team_name ?? t("builder.noTeam")}
                            </p>
                            {/* The line that produced the price. This is the whole reason ranked
                                pricing was chosen: it explains itself in one sentence. */}
                            <p className="truncate text-[11px] text-muted-foreground">
                              {player.reason}
                            </p>
                          </div>
                          {player.is_unproven && (
                            <Badge
                              variant="outline"
                              className="rounded-full px-2 py-0.5 text-[10px] text-muted-foreground"
                            >
                              {t("builder.unproven")}
                            </Badge>
                          )}
                          {league.use_budget && (
                            <span className="text-sm font-semibold tabular-nums text-foreground">
                              {player.price_seeds}
                            </span>
                          )}
                          {picked && (
                            <IconCheck className="size-4 shrink-0 text-primary" aria-hidden />
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
