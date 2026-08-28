"use client";

/**
 * app/(a)/a/fantasy/page.tsx - create and run fantasy leagues.
 *
 * THE ORDER THIS SCREEN EXISTS TO MAKE OBVIOUS
 *     draft  ->  price the players  ->  open  ->  (locked)  ->  settled
 *
 *   A league cannot be opened before its players are priced, and the backend refuses it rather
 *   than trusting this page (afc_fantasy.admin_views.admin_open_league). An open budget league
 *   with no prices shows a fan an empty squad builder and no way to understand why, so the button
 *   here stays disabled AND the server holds the same line.
 *
 * WHY PRICES ARE PREVIEWED BEFORE THEY ARE WRITTEN
 *   The price list is the one part of this feature an admin will want to look at before
 *   committing, because it decides whether the league is a game or a lottery. Pricing is pure on
 *   the backend, so a dry run costs nothing and writes nothing.
 *
 * WHY THE RULES LOCK ONCE A LEAGUE OPENS
 *   Squad size, the cap per team, the captain multiplier and the pot are what every entered squad
 *   was built against. Changing them afterwards would silently invalidate work somebody did. The
 *   backend refuses those fields on a non-draft league and names the ones it refused.
 *
 * i18n: admin pages are in scope (feedback_admin_i18n_now_in_scope), strings in
 * messages/{en,fr,pt}/adminFantasy.json.
 *
 * Backend: afc_fantasy/admin_views.py. Consumed endpoints are listed on each handler below.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  IconCoin,
  IconExternalLink,
  IconLock,
  IconPlus,
  IconRefresh,
  IconTrophy,
} from "@tabler/icons-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/PageHeader";
import { NewBadge } from "@/components/NewBadge";
import { FullLoader } from "@/components/Loader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { fantasyApi, type FantasyLeague } from "@/lib/fantasy";

const LIVE_SINCE = "2026-08-17";

export default function AdminFantasyPage() {
  const t = useTranslations("adminFantasy");
  const [leagues, setLeagues] = useState<FantasyLeague[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await fantasyApi.adminLeagues({ limit: 100 });
      setLeagues(data?.results ?? []);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || t("loadFailed"));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /** Preview first, then write. The preview is what an admin actually wants to see. */
  const price = async (slug: string, dryRun: boolean) => {
    setBusy(slug);
    try {
      const res = await fantasyApi.adminPrices(slug, dryRun);
      if (dryRun) {
        toast.success(t("priced.preview", {
          count: res.count ?? 0, floor: res.floor ?? 0, ceiling: res.ceiling ?? 0,
        }));
      } else {
        toast.success(t("priced.written", {
          count: res.written ?? 0, skipped: res.skipped_overrides ?? 0,
        }));
        await load();
      }
    } catch (error: any) {
      toast.error(error?.response?.data?.message || t("priced.failed"));
    } finally {
      setBusy(null);
    }
  };

  const open = async (slug: string) => {
    setBusy(slug);
    try {
      await fantasyApi.adminOpen(slug);
      toast.success(t("opened"));
      await load();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || t("openFailed"));
    } finally {
      setBusy(null);
    }
  };

  const recompute = async (slug: string) => {
    setBusy(slug);
    try {
      const res = await fantasyApi.adminRecompute(slug);
      toast.success(t("recomputed", { rows: res.rows ?? 0 }));
    } catch (error: any) {
      toast.error(error?.response?.data?.message || t("recomputeFailed"));
    } finally {
      setBusy(null);
    }
  };

  if (loading) return <FullLoader text={t("loading")} />;

  return (
    <div className="space-y-4">
      <PageHeader
        title={
          <span className="inline-flex flex-wrap items-center gap-2">
            {t("title")}
            <NewBadge since={LIVE_SINCE} />
          </span>
        }
        description={t("description")}
        action={
          <Button className="w-full md:w-auto" onClick={() => setCreateOpen(true)}>
            <IconPlus className="mr-1.5 size-4" aria-hidden /> {t("create.button")}
          </Button>
        }
      />

      <div className="flex items-start gap-2 rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
        <IconTrophy className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
        <span>{t("explainer")}</span>
      </div>

      {leagues.length === 0 ? (
        <Card className="bg-card rounded-md border py-6 shadow-sm">
          <CardContent className="text-center text-sm text-muted-foreground">
            {t("empty")}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {leagues.map((league) => (
            <Card key={league.slug} className="bg-card rounded-md border py-6 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                  <span className="min-w-0 flex-1 truncate">{league.name}</span>
                  <StatusBadge status={league.status} />
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-muted-foreground">{league.event.event_name}</p>

                {/* The rules of the game, so an admin can see what they set without opening a form.
                    They are frozen once the league opens, which is why they read as facts here. */}
                <dl className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                  <Fact label={t("fact.squad")} value={String(league.squad_size)} />
                  <Fact label={t("fact.perTeam")} value={String(league.max_per_team)} />
                  <Fact label={t("fact.captain")} value={`${league.captain_multiplier}x`} />
                  <Fact
                    label={t("fact.budget")}
                    value={league.use_budget ? String(league.budget_seeds ?? 0) : t("fact.freePick")}
                  />
                </dl>

                <p className="text-xs text-muted-foreground">
                  {t("fact.entries", { count: league.entries })}
                  {" · "}
                  {t("fact.teamPremium", { n: league.team_premium_seeds })}
                </p>

                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline" size="sm" disabled={busy === league.slug}
                    onClick={() => price(league.slug, true)}
                  >
                    <IconCoin className="mr-1.5 size-4" aria-hidden /> {t("action.preview")}
                  </Button>
                  {league.status === "draft" && (
                    <>
                      <Button
                        variant="outline" size="sm" disabled={busy === league.slug}
                        onClick={() => price(league.slug, false)}
                      >
                        {t("action.writePrices")}
                      </Button>
                      <Button
                        size="sm" disabled={busy === league.slug}
                        onClick={() => open(league.slug)}
                      >
                        <IconLock className="mr-1.5 size-4" aria-hidden /> {t("action.open")}
                      </Button>
                    </>
                  )}
                  {(league.status === "open" || league.status === "locked") && (
                    <Button
                      variant="outline" size="sm" disabled={busy === league.slug}
                      onClick={() => recompute(league.slug)}
                    >
                      <IconRefresh className="mr-1.5 size-4" aria-hidden /> {t("action.recompute")}
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" asChild>
                    <Link href={`/fantasy/${league.slug}`} target="_blank">
                      <IconExternalLink className="mr-1.5 size-4" aria-hidden /> {t("action.view")}
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <CreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={async () => {
          setCreateOpen(false);
          await load();
        }}
      />
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-semibold text-foreground">{value}</dd>
    </div>
  );
}

function StatusBadge({ status }: { status: FantasyLeague["status"] }) {
  const t = useTranslations("adminFantasy");
  const tone =
    status === "open"
      ? "border-primary/50 text-primary"
      : status === "locked"
        ? "border-gold/60 text-gold"
        : "text-muted-foreground";
  return (
    <Badge variant="outline" className={`rounded-full px-2 py-0.5 text-xs ${tone}`}>
      {t(`status.${status}`)}
    </Badge>
  );
}

/** Create a league. Everything here is frozen once it opens, which is why the dialog explains that
 *  rather than letting an admin find out by being refused later. */
function CreateDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: () => void;
}) {
  const t = useTranslations("adminFantasy");
  const [eventId, setEventId] = useState("");
  const [name, setName] = useState("");
  const [squadSize, setSquadSize] = useState("5");
  const [maxPerTeam, setMaxPerTeam] = useState("2");
  const [captain, setCaptain] = useState("20");
  const [budget, setBudget] = useState("100");
  const [teamPremium, setTeamPremium] = useState("6");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    try {
      await fantasyApi.adminCreate({
        event_id: Number(eventId),
        name: name.trim() || undefined,
        squad_size: Number(squadSize),
        max_per_team: Number(maxPerTeam),
        captain_multiplier_tenths: Number(captain),
        budget_seeds: Number(budget),
        team_premium_seeds: Number(teamPremium),
      });
      toast.success(t("create.done"));
      onCreated();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || t("create.failed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("create.title")}</DialogTitle>
          <DialogDescription>{t("create.description")}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <Field id="event" label={t("create.eventId")} hint={t("create.eventIdHint")}>
            <Input id="event" value={eventId} onChange={(e) => setEventId(e.target.value)}
                   inputMode="numeric" className="h-9" />
          </Field>
          <Field id="name" label={t("create.name")} hint={t("create.nameHint")}>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)}
                   className="h-9" maxLength={160} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field id="squad" label={t("create.squadSize")} hint={t("create.squadSizeHint")}>
              <Input id="squad" value={squadSize} onChange={(e) => setSquadSize(e.target.value)}
                     inputMode="numeric" className="h-9" />
            </Field>
            <Field id="perTeam" label={t("create.maxPerTeam")} hint={t("create.maxPerTeamHint")}>
              <Input id="perTeam" value={maxPerTeam} onChange={(e) => setMaxPerTeam(e.target.value)}
                     inputMode="numeric" className="h-9" />
            </Field>
            <Field id="captain" label={t("create.captain")} hint={t("create.captainHint")}>
              <Input id="captain" value={captain} onChange={(e) => setCaptain(e.target.value)}
                     inputMode="numeric" className="h-9" />
            </Field>
            <Field id="budget" label={t("create.budget")} hint={t("create.budgetHint")}>
              <Input id="budget" value={budget} onChange={(e) => setBudget(e.target.value)}
                     inputMode="numeric" className="h-9" />
            </Field>
          </div>
          <Field id="premium" label={t("create.teamPremium")} hint={t("create.teamPremiumHint")}>
            <Input id="premium" value={teamPremium} onChange={(e) => setTeamPremium(e.target.value)}
                   inputMode="numeric" className="h-9" />
          </Field>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            {t("create.cancel")}
          </Button>
          <Button onClick={submit} disabled={saving || !eventId}>
            {t("create.submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** A labelled input with the one line explaining what the number does. Every setting here changes
 *  the game, and a bare number with a terse label is how a league ends up unplayable. */
function Field({
  id,
  label,
  hint,
  children,
}: {
  id: string;
  label: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-xs">{label}</Label>
      {children}
      <p className="text-[11px] text-muted-foreground">{hint}</p>
    </div>
  );
}
