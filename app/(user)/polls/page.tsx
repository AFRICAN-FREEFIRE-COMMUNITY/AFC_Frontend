"use client";

/**
 * app/(user)/polls/page.tsx - the public Polls listing.
 *
 * WHAT THIS IS
 *   The one place a visitor finds every community poll AND every published award result. Awards
 *   are not a separate feature: an award ballot IS a poll whose `kind` is "award" (see
 *   backend/afc_polls/models.py), so this page groups by that field rather than joining two
 *   different systems together on the client.
 *
 * WHAT IT TALKS TO
 *   GET {BACKEND}/polls/            -> afc_polls.views.list_polls
 *   Poll titles and descriptions come back ALREADY TRANSLATED for the viewer's locale, because
 *   they are user-generated content and go through the backend translate-on-read layer
 *   (afc_auth/translation.py). Only the static chrome on this page reads messages/<locale>/polls.json.
 *
 * THE LEGACY ANCHOR MAP (spec 7.3) LIVES ON /awards, NOT HERE
 *   /awards used to be one page with two tabs, shared for a year as /awards#content-creators and
 *   /awards#esports-awards. This file used to carry the map that rescues those links, on the
 *   assumption that /awards would become a redirect to /polls. It never did, and /awards is now the
 *   grand awards surface in its own right, so those visitors never reach this page and the map here
 *   could not fire. It now sits in app/(user)/awards/page.tsx, on the page the old links actually
 *   land on.
 *
 * DESIGN NOTE
 *   Deliberately plain, and it stays that way. The occasion treatment the owner asked for is
 *   app/(user)/awards, built on the same endpoints; this page is the plain index of EVERY ballot
 *   and community poll, which is a different job from celebrating one season.
 */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { IconAward, IconChartBar, IconChevronRight } from "@tabler/icons-react";

import { PageHeader } from "@/components/PageHeader";
import { NewBadge } from "@/components/NewBadge";
import { FullLoader } from "@/components/Loader";
import { LocalTime } from "@/components/LocalTime";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { env } from "@/lib/env";
import { useTranslations } from "next-intl";

type PollCard = {
  slug: string;
  title: string;
  description: string;
  kind: "award" | "standard";
  awards_edition: string;
  opens_at: string | null;
  closes_at: string | null;
  is_open: boolean;
  is_closed: boolean;
  question_count: number | null;
  response_count: number | null;
};

export default function PollsPage() {
  const t = useTranslations("polls");
  const [polls, setPolls] = useState<PollCard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`${env.NEXT_PUBLIC_BACKEND_API_URL}/polls/?limit=100`);
        const data = await res.json();
        setPolls(data.results || []);
      } catch {
        // A listing that cannot load shows its empty state rather than an error wall: there is
        // nothing the visitor can do about it, and the nav is still usable around it.
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const awards = useMemo(() => polls.filter((p) => p.kind === "award"), [polls]);
  const community = useMemo(() => polls.filter((p) => p.kind !== "award"), [polls]);

  if (loading) return <FullLoader />;

  return (
    <div className="py-8">
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            {t("title")}
            <NewBadge since="2026-08-16" />
          </span>
        }
        description={t("subtitle")}
        dataTour="polls-header"
      />

      <Tabs defaultValue="all" className="mt-6 w-full">
        <TabsList className="h-9 bg-muted">
          <TabsTrigger value="all">{t("tabs.all")}</TabsTrigger>
          <TabsTrigger value="awards">{t("tabs.awards")}</TabsTrigger>
          <TabsTrigger value="community">{t("tabs.community")}</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-6">
          <PollGrid polls={polls} emptyText={t("empty.all")} />
        </TabsContent>
        <TabsContent value="awards" className="mt-6">
          <PollGrid polls={awards} emptyText={t("empty.awards")} />
        </TabsContent>
        <TabsContent value="community" className="mt-6">
          <PollGrid polls={community} emptyText={t("empty.community")} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function PollGrid({ polls, emptyText }: { polls: PollCard[]; emptyText: string }) {
  if (polls.length === 0) {
    return (
      <Card className="bg-card rounded-md border py-6 shadow-sm">
        <CardContent className="text-center text-sm text-muted-foreground">{emptyText}</CardContent>
      </Card>
    );
  }
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {polls.map((poll) => (
        <PollCardItem key={poll.slug} poll={poll} />
      ))}
    </div>
  );
}

function PollCardItem({ poll }: { poll: PollCard }) {
  const t = useTranslations("polls");
  const Icon = poll.kind === "award" ? IconAward : IconChartBar;

  return (
    <Link href={`/polls/${poll.slug}`} className="group block">
      <Card className="h-full bg-card rounded-md border py-6 shadow-sm transition-colors group-hover:border-primary/50">
        <CardContent className="flex h-full flex-col gap-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-primary">
              <Icon className="h-4 w-4 shrink-0" />
              {/* The edition is the grouping label an admin typed ("NFCA 2025"). Blank on a
                  community poll, where the kind is the only label worth showing. */}
              <span className="truncate">{poll.awards_edition || t("tabs.community")}</span>
            </div>
            <StateBadge poll={poll} />
          </div>

          <h2 className="text-base font-semibold text-foreground">{poll.title}</h2>
          {poll.description && (
            <p className="line-clamp-2 text-xs text-muted-foreground">{poll.description}</p>
          )}

          <div className="mt-auto flex items-center justify-between pt-2 text-xs text-muted-foreground">
            <span>{t("card.questions", { count: poll.question_count ?? 0 })}</span>
            <span className="flex items-center gap-1 text-primary">
              {poll.is_open ? t("card.vote") : t("card.view")}
              <IconChevronRight className="h-3.5 w-3.5" />
            </span>
          </div>

          {/* Rendered in the VIEWER's timezone and locale, never a server-formatted string. */}
          {poll.closes_at && (
            <p className="text-[11px] text-muted-foreground">
              {poll.is_closed ? t("detail.closedOn") : t("detail.closesOn")}{" "}
              <LocalTime value={poll.closes_at} mode="date" />
            </p>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}

function StateBadge({ poll }: { poll: PollCard }) {
  const t = useTranslations("polls");
  if (poll.is_open) {
    return (
      <Badge variant="outline" className="rounded-full border-primary/50 px-2 py-0.5 text-xs text-primary">
        {t("card.open")}
      </Badge>
    );
  }
  // A poll that has closed and a poll that never opened read differently to a visitor, so they
  // get different words. The imported award ballots are the second kind: they are published
  // results, and the site does not know when their voting ran.
  return (
    <Badge variant="outline" className="rounded-full px-2 py-0.5 text-xs text-muted-foreground">
      {poll.is_closed ? t("card.closed") : t("card.results")}
    </Badge>
  );
}
