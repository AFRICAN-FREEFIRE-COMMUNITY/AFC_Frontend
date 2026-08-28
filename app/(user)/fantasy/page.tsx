"use client";

/**
 * app/(user)/fantasy/page.tsx - the Fantasy League listing.
 *
 * WHAT THIS IS
 *   Every fantasy league a fan can see, newest first. A league is attached to one AFC event: you
 *   pick a squad of real players from it before the first match, and score from what those players
 *   actually do.
 *
 * WHY IT STILL EXPLAINS THE GAME
 *   This page replaced a coming-soon page whose whole job was explaining what a fantasy league IS,
 *   because most people reading it have never played one. That explanation does not stop being
 *   needed the day the feature ships: a list of league names means nothing to somebody who does not
 *   know what a league is. So the three "how it works" cards stay, above the list, and they are the
 *   first thing on the page when no league is running.
 *
 * WHAT IT TALKS TO
 *   GET {BACKEND}/fantasy/  -> afc_fantasy.views.list_leagues (public, auth optional)
 *   Signed in, each row also says whether YOU may enter and whether you already have.
 *
 * Strings: messages/{en,fr,pt}/fantasy.json. The section layout carries the page metadata, because
 * a "use client" page cannot export any.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  IconBook,
  IconChartBar,
  IconChevronRight,
  IconTrophy,
  IconUsers,
} from "@tabler/icons-react";

import { PageHeader } from "@/components/PageHeader";
import { NewBadge } from "@/components/NewBadge";
import { FullLoader } from "@/components/Loader";
import { LocalTime } from "@/components/LocalTime";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { fantasyApi, type FantasyLeague } from "@/lib/fantasy";

// The day the feature goes live, for the self-expiring NEW tag.
const LIVE_SINCE = "2026-08-17";

export default function FantasyPage() {
  // Namespace "fantasy" (messages/{en,fr,pt}/fantasy.json).
  const t = useTranslations("fantasy");
  const [leagues, setLeagues] = useState<FantasyLeague[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fantasyApi
      .leagues({ limit: 100 })
      .then((data) => setLeagues(data?.results ?? []))
      // A listing that cannot load shows its empty state rather than an error wall: there is
      // nothing the visitor can do about it, and the nav is still usable around it.
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  const HOW = [
    { icon: IconUsers, key: "pick" },
    { icon: IconChartBar, key: "score" },
    { icon: IconTrophy, key: "win" },
  ];

  if (loading) return <FullLoader />;

  return (
    <div className="py-8">
      <PageHeader
        title={
          <span className="inline-flex flex-wrap items-center gap-2">
            {t("title")}
            <NewBadge since={LIVE_SINCE} />
          </span>
        }
        description={t("subtitle")}
      />

      {/* How it works, kept from the coming-soon page. "Pick a squad" means nothing to somebody
          who has never played a fantasy league, and that is most of the audience. */}
      <section className="mt-6 grid gap-4 sm:grid-cols-3">
        {HOW.map(({ icon: Icon, key }) => (
          <Card key={key} className="bg-card rounded-md border py-6 shadow-sm">
            <CardContent className="space-y-2">
              <Icon className="h-5 w-5 text-primary" aria-hidden />
              <p className="text-sm font-semibold text-foreground">{t(`how.${key}.title`)}</p>
              <p className="text-xs text-muted-foreground">{t(`how.${key}.body`)}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      {/* The three cards above say what it is in a sentence each. Somebody who wants the whole
          thing (the points table, the worked examples, what happens if a player never plays) needs
          somewhere to go, and it must be reachable BEFORE they commit to a league. */}
      <div className="mt-4">
        <Link
          href="/fantasy/how-it-works"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
        >
          <IconBook className="size-4" aria-hidden />
          {t("guide.readGuide")}
        </Link>
      </div>

      <div className="mt-8">
        {leagues.length === 0 ? (
          <Card className="bg-card rounded-md border py-6 shadow-sm">
            <CardContent className="space-y-2 text-center">
              <p className="text-sm text-muted-foreground">{t("empty.title")}</p>
              <p className="text-xs text-muted-foreground">{t("empty.body")}</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {leagues.map((league) => (
              <LeagueCard key={league.slug} league={league} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function LeagueCard({ league }: { league: FantasyLeague }) {
  const t = useTranslations("fantasy");

  return (
    <Link href={`/fantasy/${league.slug}`} className="group block">
      <Card className="h-full bg-card rounded-md border py-6 shadow-sm transition-colors group-hover:border-primary/50">
        <CardContent className="flex h-full flex-col gap-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-primary">
              <IconTrophy className="h-4 w-4 shrink-0" aria-hidden />
              <span className="truncate">{league.event.event_name}</span>
            </div>
            <StateBadge league={league} />
          </div>

          <h2 className="text-base font-semibold text-foreground">{league.name}</h2>
          {league.description && (
            <p className="line-clamp-2 text-xs text-muted-foreground">{league.description}</p>
          )}

          {/* The two facts that decide whether somebody bothers: how many are already in, and what
              it costs to be one of them. */}
          <div className="mt-auto flex items-center justify-between pt-2 text-xs text-muted-foreground">
            <span>{t("card.entries", { count: league.entries })}</span>
            <span className="flex items-center gap-1 text-primary">
              {league.has_entered ? t("card.mySquad") : league.can_enter ? t("card.enter") : t("card.view")}
              <IconChevronRight className="h-3.5 w-3.5" aria-hidden />
            </span>
          </div>

          {/* Rendered in the VIEWER's timezone and locale, never a server-formatted string. */}
          {league.locks_at && (
            <p className="text-[11px] text-muted-foreground">
              {league.is_locked ? t("card.lockedOn") : t("card.locksOn")}{" "}
              <LocalTime value={league.locks_at} mode="datetime" />
            </p>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}

/** Open / locked / finished, in the one place that decides how a league's state is worded. */
function StateBadge({ league }: { league: FantasyLeague }) {
  const t = useTranslations("fantasy");
  if (league.status === "settled") {
    return (
      <Badge variant="outline" className="rounded-full px-2 py-0.5 text-xs text-muted-foreground">
        {t("state.settled")}
      </Badge>
    );
  }
  if (league.is_locked) {
    return (
      <Badge variant="outline" className="rounded-full border-gold/60 px-2 py-0.5 text-xs text-gold">
        {t("state.locked")}
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="rounded-full border-primary/50 px-2 py-0.5 text-xs text-primary">
      {t("state.open")}
    </Badge>
  );
}
