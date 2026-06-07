"use client";

// ── HomeLatestSections ───────────────────────────────────────────────────────
// Two compact BLOCKS added to the /home page (app/(user)/home/page.tsx), per the
// approved home-additions mockup. To match the rest of the home page (every other
// section there is a shadcn <Card> block: Featured Shop, Rankings & Tiers, News),
// each section here is ALSO wrapped in a <Card> with the same CardHeader/CardTitle/
// CardContent idiom, so the new blocks read as the same designer's work.
//   1. "Latest Tournaments & Scrims" - the 4 newest events (All / Tournaments /
//      Scrims filter), each clickable to its tournament page.
//   2. "From the Player Market" - the 4 newest market posts (All / Teams recruiting
//      / Players open filter), linking through to the player market.
// Compact on purpose (a slim status-accent strip instead of a big banner, tight
// cards, "View all" links) so it never adds a long scroll to the home page.
//
// Data sources (same endpoints the dedicated pages use, so this can never diverge):
//   GET /events/get-all-events/                         -> events (tournaments page)
//   GET /player-market/view-team-recruitment-posts/     -> team recruitment posts
//   GET /player-market/view-player-availability-posts/  -> player availability posts
// Renders nothing (no empty Card shells) until at least one source has data.

import { useEffect, useState } from "react";
import Link from "next/link";
import axios from "axios";
import { env } from "@/lib/env";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  IconArrowRight,
  IconShield,
  IconMapPin,
  IconUsersGroup,
} from "@tabler/icons-react";

// ── data shapes (mirror the tournaments + player-markets page interfaces) ──
interface EventRow {
  event_id: number;
  event_name: string;
  event_date: string;
  event_status: "upcoming" | "ongoing" | "completed";
  competition_type: "tournament" | "scrims";
  slug: string;
  prizepool: string;
  organization_name?: string | null;
}
interface TeamPost {
  id: number;
  team: string | null;
  country: string | null;
  roles_needed: string[] | null;
  minimum_tier_required: string;
  commitment_type: string;
}
interface PlayerPost {
  id: number;
  player: string;
  country: string | null;
  primary_role: string;
  secondary_role: string;
  availability_type: string;
}

// Status accent colours mirror the tournaments EventCard map exactly.
const STATUS_ACCENT: Record<EventRow["event_status"], string> = {
  upcoming: "bg-blue-500",
  ongoing: "bg-primary",
  completed: "bg-muted-foreground/40",
};
const STATUS_TEXT: Record<EventRow["event_status"], string> = {
  upcoming: "text-blue-500",
  ongoing: "text-primary",
  completed: "text-muted-foreground",
};

// Tier chip colours mirror player-markets getTierColor (Tier 1/2/3).
function tierClass(tier: string) {
  if (tier?.includes("1"))
    return "border-yellow-500/50 text-yellow-600 dark:text-yellow-400";
  if (tier?.includes("2"))
    return "border-cyan-500/50 text-cyan-600 dark:text-cyan-400";
  return "border-purple-500/50 text-purple-600 dark:text-purple-400";
}

const MAX = 4; // 4 newest per section, then "View all" (keeps the home page short)

// A small pill-segment filter (bg-muted track, active = bg-background fill) matching
// the AFC tab idiom used across the site.
function SegFilter({
  options,
  value,
  onChange,
}: {
  options: { key: string; label: string; count: number }[];
  value: string;
  onChange: (k: string) => void;
}) {
  return (
    <div className="inline-flex h-9 items-center gap-1 rounded-md bg-muted p-1 text-muted-foreground">
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          onClick={() => onChange(o.key)}
          className={cn(
            "inline-flex h-7 items-center rounded-sm px-3 text-xs font-medium transition-colors",
            value === o.key
              ? "bg-background text-foreground shadow-sm"
              : "hover:text-foreground",
          )}
        >
          {o.label} <span className="ml-1 opacity-70">({o.count})</span>
        </button>
      ))}
    </div>
  );
}

// Shared section-header row (title + sub-copy on the left, a "View all" button on the
// right) so both Cards open identically.
function SectionHead({
  title,
  sub,
  href,
  cta,
}: {
  title: string;
  sub: string;
  href: string;
  cta: string;
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <CardTitle>{title}</CardTitle>
        <p className="text-sm text-muted-foreground mt-1">{sub}</p>
      </div>
      <Button asChild variant="outline" size="sm">
        <Link href={href}>
          {cta} <IconArrowRight className="ml-1 h-4 w-4" />
        </Link>
      </Button>
    </div>
  );
}

export function HomeLatestSections() {
  const API = env.NEXT_PUBLIC_BACKEND_API_URL;
  const [events, setEvents] = useState<EventRow[]>([]);
  const [teamPosts, setTeamPosts] = useState<TeamPost[]>([]);
  const [playerPosts, setPlayerPosts] = useState<PlayerPost[]>([]);
  const [evFilter, setEvFilter] = useState<"all" | "tournament" | "scrims">("all");
  const [pmFilter, setPmFilter] = useState<"all" | "teams" | "players">("all");

  useEffect(() => {
    // Fire all three in parallel; each is independently optional (a failure or empty
    // source just leaves that list empty, it never blocks the others or the page).
    const load = async () => {
      const [ev, tp, pp] = await Promise.allSettled([
        axios.get(`${API}/events/get-all-events/`),
        axios.get(`${API}/player-market/view-team-recruitment-posts/`),
        axios.get(`${API}/player-market/view-player-availability-posts/`),
      ]);
      if (ev.status === "fulfilled")
        setEvents(ev.value.data?.events ?? ev.value.data ?? []);
      if (tp.status === "fulfilled")
        setTeamPosts(tp.value.data?.posts ?? tp.value.data ?? []);
      if (pp.status === "fulfilled")
        setPlayerPosts(pp.value.data?.posts ?? pp.value.data ?? []);
    };
    load();
  }, [API]);

  // ── events: filter + newest 4 ──
  const evCounts = {
    all: events.length,
    tournament: events.filter((e) => e.competition_type === "tournament").length,
    scrims: events.filter((e) => e.competition_type === "scrims").length,
  };
  const shownEvents = events
    .filter((e) => evFilter === "all" || e.competition_type === evFilter)
    .slice(0, MAX);

  // ── market: tag posts by kind, filter + newest 4 ──
  const taggedTeam = teamPosts.map((p) => ({ kind: "team" as const, ...p }));
  const taggedPlayer = playerPosts.map((p) => ({ kind: "player" as const, ...p }));
  const allPosts = [...taggedTeam, ...taggedPlayer];
  const pmCounts = {
    all: allPosts.length,
    teams: taggedTeam.length,
    players: taggedPlayer.length,
  };
  const shownPosts = allPosts
    .filter(
      (p) =>
        pmFilter === "all" ||
        (pmFilter === "teams" && p.kind === "team") ||
        (pmFilter === "players" && p.kind === "player"),
    )
    .slice(0, MAX);

  // Nothing to show anywhere -> render nothing (no empty Card shells on the page).
  if (events.length === 0 && allPosts.length === 0) return null;

  const fmtDate = (d: string) => {
    if (!d) return "";
    const date = new Date(d);
    return isNaN(date.getTime())
      ? d
      : date.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        });
  };

  return (
    <div className="space-y-2 mb-4">
      {/* ── BLOCK 1: Latest Tournaments & Scrims (a Card, like the rest of /home) ── */}
      {events.length > 0 && (
        <Card>
          <CardHeader>
            <SectionHead
              title="Latest Tournaments & Scrims"
              sub="A quick look at the newest events. The full list lives on the events page."
              href="/tournaments"
              cta="View all events"
            />
          </CardHeader>
          <CardContent>
            <div className="mb-3">
              <SegFilter
                value={evFilter}
                onChange={(k) => setEvFilter(k as typeof evFilter)}
                options={[
                  { key: "all", label: "All", count: evCounts.all },
                  { key: "tournament", label: "Tournaments", count: evCounts.tournament },
                  { key: "scrims", label: "Scrims", count: evCounts.scrims },
                ]}
              />
            </div>

            <div className="grid gap-2 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
              {shownEvents.map((e) => (
                <Link
                  key={e.event_id}
                  href={`/tournaments/${encodeURIComponent(e.slug)}`}
                  className="group rounded-md border bg-card overflow-hidden transition-colors hover:border-primary/50"
                >
                  {/* slim status-accent strip instead of a full banner (compact) */}
                  <div className={cn("h-1.5 w-full", STATUS_ACCENT[e.event_status])} />
                  <div className="p-3">
                    <div className="flex items-center justify-between mb-1">
                      <Badge variant="outline" className="rounded-full text-[10px] uppercase">
                        {e.competition_type === "scrims" ? "Scrim" : "Tournament"}
                      </Badge>
                      <span className={cn("text-xs font-medium capitalize", STATUS_TEXT[e.event_status])}>
                        {e.event_status}
                      </span>
                    </div>
                    <h3 className="font-semibold text-sm leading-tight group-hover:text-primary line-clamp-1">
                      {e.event_name}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {fmtDate(e.event_date)}
                    </p>
                    <div className="flex items-center gap-2 mt-2 text-xs">
                      <span className="font-medium text-gold">
                        {e.prizepool && e.prizepool !== "0" ? e.prizepool : "No prize"}
                      </span>
                      <Badge variant="outline" className="rounded-full text-[10px]">
                        {e.organization_name || "AFC official"}
                      </Badge>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── BLOCK 2: From the Player Market (a Card) ── */}
      {allPosts.length > 0 && (
        <Card>
          <CardHeader>
            <SectionHead
              title="From the Player Market"
              sub="The newest posts. Open the Player Market for everyone recruiting or available."
              href="/player-markets"
              cta="Open Player Market"
            />
          </CardHeader>
          <CardContent>
            <div className="mb-3">
              <SegFilter
                value={pmFilter}
                onChange={(k) => setPmFilter(k as typeof pmFilter)}
                options={[
                  { key: "all", label: "All", count: pmCounts.all },
                  { key: "teams", label: "Teams recruiting", count: pmCounts.teams },
                  { key: "players", label: "Players open", count: pmCounts.players },
                ]}
              />
            </div>

            <div className="grid gap-2 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
              {shownPosts.map((p) => {
                const name = p.kind === "team" ? p.team || "Unnamed team" : p.player;
                const initial = (name || "?").charAt(0).toUpperCase();
                return (
                  <Link
                    key={`${p.kind}-${p.id}`}
                    href="/player-markets"
                    className="group rounded-md border bg-card p-3 transition-colors hover:border-primary/50"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold">
                        {initial}
                      </span>
                      <h3 className="font-semibold text-sm leading-tight group-hover:text-primary line-clamp-1 flex-1">
                        {name}
                      </h3>
                    </div>
                    <div className="flex flex-wrap items-center gap-1 mb-2">
                      <Badge
                        variant="outline"
                        className={cn(
                          "rounded-full text-[10px]",
                          p.kind === "team"
                            ? "border-primary/50 text-primary"
                            : "border-gold/50 text-gold",
                        )}
                      >
                        {p.kind === "team" ? "Recruiting" : "Open to join"}
                      </Badge>
                      {p.kind === "team" ? (
                        <Badge variant="outline" className={cn("rounded-full text-[10px]", tierClass(p.minimum_tier_required))}>
                          <IconShield className="mr-0.5 h-2.5 w-2.5" />
                          {p.minimum_tier_required || "Any tier"}+
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="rounded-full text-[10px]">
                          {p.primary_role}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {p.country && (
                        <span className="inline-flex items-center gap-0.5">
                          <IconMapPin className="h-3 w-3" />
                          {p.country}
                        </span>
                      )}
                      <span className="inline-flex items-center gap-0.5">
                        <IconUsersGroup className="h-3 w-3" />
                        {p.kind === "team" ? p.commitment_type : p.availability_type}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
