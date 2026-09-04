"use client";

// ── Admin · Dashboard ────────────────────────────────────────────────────────
// The at-a-glance numbers, each one a door into its own breakdown.
//
// WHAT THIS PAGE USED TO DO, and why almost all of it was rewritten (owner audit 2026-09-02:
// "everything actually works fine and as they should, check and ensure it is so"):
//
//   1. IT PRINTED NUMBERS NOBODY HAD CALCULATED. Diamond Bundles "0" and "Top: 0", Total Revenue
//      the naira zero twice, and Scrims "0 active" were LITERALS in the JSX. A constant cannot go
//      stale, cannot be wrong, and cannot be right; it is decoration dressed as a metric, and an
//      admin reads a zero revenue line as a fact about the business. 18 paid orders existed.
//   2. IT SHOWED A CONFIDENT ZERO FOR A FAILED REQUEST. "Player Match Stats Records" called an
//      ADMIN endpoint with a bare axios and no Authorization header, got HTTP 400, and swallowed
//      it in `.catch(() => null)`. 2,982 records existed. The "Top Player Match Stats" table was
//      hidden by the same failure, since it was gated on that array being non-empty.
//   3. IT COUNTED SCRIMS WRONG. The backend filtered competition_type="scrim" where the model
//      stores "scrims", so 105 live scrims were reported as 0. Fixed in AFC-B c815fea3.
//   4. IT CARRIED A MOCK. `fetchWebsiteMetrics` returned invented figures (15847 members, 2.45m
//      revenue) and was never called; `metrics` / `setMetrics` were never read.
//   5. THREE CONTROLS WERE `disabled` WITH THEIR LINKS COMMENTED OUT: Manage Members, Create
//      Leaderboard, Manage Rankings. The page offered four quick actions and did two.
//   6. IT MADE THIRTEEN REQUESTS to fill one screen, three of which downloaded a whole table to
//      call `.length` on it (get-all-teams 362 KB, get-all-news 232 KB, get-admin-history 305 KB).
//
// NOW: one authed request to auth/admin/dashboard-stats/ (lib/dashboard.ts) for every figure and
// the ten activity rows, and every card links to auth/admin/dashboard-stats/<metric>/ rendered by
// ./[metric]/page.tsx. A failed load SAYS SO; it never renders a zero it does not have.
//
// CONNECTS TO
//   lib/dashboard.ts  ->  afc_auth/views_dashboard.py (both endpoints, one registry of metrics)
//   ./[metric]/page.tsx   the drill-down every card points at
//   admin-tour-steps.ts   via the data-tour anchors below; renaming one breaks the tour
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  IconActivity,
  IconAlertTriangle,
  IconArticle,
  IconCalendar,
  IconDiamond,
  IconRefresh,
  IconShoppingCart,
  IconStar,
  IconSwords,
  IconTrophy,
  IconUserPlus,
  IconUsers,
} from "@tabler/icons-react";
import { ArrowRight, Shield, TrendingUp } from "lucide-react";

import { FullLoader } from "@/components/Loader";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InfoTip } from "@/components/ui/info-tip";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate, formatMoneyInput } from "@/lib/utils";
import { dashboardApi, type DashboardSummary } from "@/lib/dashboard";

/** Naira. The old markup hardcoded a zero here; this only ever prefixes a real API figure. */
function money(value: string | undefined) {
  if (value === undefined || value === null) return "-";
  const n = Number(value);
  return `₦${Number.isFinite(n) ? formatMoneyInput(n) : value}`;
}

/**
 * One metric card. The heading and the value are a LINK into that metric's breakdown, and the
 * "Manage" button is a SIBLING link, never nested inside it: an anchor inside an anchor (or inside
 * a button, which is what "Create Event" used to be) is invalid markup and breaks keyboard use.
 */
function StatCard({
  title,
  helpId,
  icon,
  value,
  sub,
  metric,
  action,
}: {
  title: string;
  helpId: string;
  icon: React.ReactNode;
  value: React.ReactNode;
  sub?: React.ReactNode;
  metric: string;
  action?: { href: string; label: string; icon: React.ReactNode };
}) {
  return (
    <Card className="gap-1">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium flex items-center">
          <Link href={`/a/dashboard/${metric}`} className="hover:text-primary">
            {title}
          </Link>
          <InfoTip id={helpId} className="ml-1" />
        </CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        {/* The number itself is the door into the detail, which is what the owner asked for:
            "when you click on each text or mini tab it takes you that stats". */}
        <Link href={`/a/dashboard/${metric}`} className="block group">
          <div className="text-2xl font-bold group-hover:text-primary">{value}</div>
          {sub ? <div className="mt-1 text-sm text-muted-foreground">{sub}</div> : null}
          <div className="mt-2 flex items-center gap-1 text-xs text-primary">
            View breakdown <ArrowRight className="size-3" />
          </div>
        </Link>
        {action ? (
          <Button asChild className="w-full mt-3" size="md">
            <Link href={action.href}>
              {action.icon}
              {action.label}
            </Link>
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  // The page must be able to SAY it failed. The old one toasted, set two counters to 0, and
  // rendered the rest of its fabricated numbers as though nothing had happened.
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setStats(await dashboardApi.summary());
    } catch (err: any) {
      setStats(null);
      setError(
        err?.response?.data?.message ||
          "Could not load the dashboard figures. Nothing is being shown as zero on purpose.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <FullLoader />;

  if (error || !stats) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader title="Admin dashboard" />
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <IconAlertTriangle className="size-8 text-destructive" />
            <p className="text-base font-semibold">The figures could not be loaded</p>
            <p className="max-w-md text-sm text-muted-foreground">{error}</p>
            <Button onClick={load} variant="outline">
              <IconRefresh className="mr-2 size-4" />
              Try again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { members, teams, events, news, combat, shop, activity } = stats;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <PageHeader
          title={
            <span data-tour="dashboard-title" className="inline-flex flex-wrap items-center">
              Admin dashboard
              <InfoTip id="dashboard._page" className="ml-1.5" />
            </span>
          }
        />

        {/* ── Headline metrics ─────────────────────────────────────────────── */}
        <div
          data-tour="dashboard-metrics"
          className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-4 gap-2 mb-4"
        >
          <StatCard
            title="Total Members"
            helpId="dashboard.total_members"
            icon={<IconUsers className="h-4 w-4 text-blue-600" />}
            metric="members"
            value={formatMoneyInput(members.total)}
            sub={
              <span className="flex items-center gap-1 text-green-600">
                <TrendingUp className="h-3 w-3" />+ {formatMoneyInput(members.this_month)} this month
              </span>
            }
            action={{
              // Was `disabled` with no destination at all. Members are managed on the Teams and
              // Players page, whose `players` tab is addressable by query param.
              href: "/a/teams?tab=players",
              label: "Manage Members",
              icon: <IconUserPlus className="mr-2 h-4 w-4" />,
            }}
          />

          <StatCard
            title="Total Teams"
            helpId="dashboard.total_teams"
            icon={<Shield className="h-4 w-4 text-purple-600" />}
            metric="teams"
            value={formatMoneyInput(teams.total)}
            sub={
              <span className="flex items-center gap-1 text-green-600">
                <TrendingUp className="h-3 w-3" />+ {formatMoneyInput(teams.this_month)} this month
              </span>
            }
            action={{
              href: "/a/teams",
              label: "Manage Teams",
              icon: <Shield className="mr-2 h-4 w-4" />,
            }}
          />

          <StatCard
            title="Tournaments"
            helpId="dashboard.tournaments"
            icon={<IconTrophy className="h-4 w-4 text-yellow-600" />}
            metric="tournaments"
            value={formatMoneyInput(events.tournaments)}
            sub={
              <span className="flex items-center gap-1 text-blue-600">
                <IconCalendar className="h-3 w-3" />
                {events.tournaments_active} running now
              </span>
            }
            action={{
              href: "/a/events",
              label: "Manage Tournaments",
              icon: <IconTrophy className="mr-2 h-4 w-4" />,
            }}
          />

          <StatCard
            title="Scrims"
            helpId="dashboard.scrims"
            icon={<IconSwords className="h-4 w-4 text-red-600" />}
            metric="scrims"
            // Both numbers are real now. This card read "0" and "0 active" for every scrim ever
            // hosted: the count filtered the wrong enum value, and the "active" line was a literal
            // with no endpoint behind it at all.
            value={formatMoneyInput(events.scrims)}
            sub={
              <span className="flex items-center gap-1 text-orange-600">
                <IconActivity className="h-3 w-3" />
                {events.scrims_active} running now
              </span>
            }
            action={{
              href: "/a/events",
              label: "Manage Scrims",
              icon: <IconSwords className="mr-2 h-4 w-4" />,
            }}
          />
        </div>

        {/* ── Content and commerce ─────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-2 mb-4">
          <StatCard
            title="News & Announcements"
            helpId="dashboard.news"
            icon={<IconArticle className="h-4 w-4 text-indigo-600" />}
            metric="news"
            value={formatMoneyInput(news.total)}
            // Published is a DIFFERENT number from the total now. The endpoint behind the old
            // "published" line counted every row, drafts and scheduled posts included.
            sub={`${formatMoneyInput(news.published)} published, ${formatMoneyInput(
              news.total - news.published,
            )} not yet`}
            action={{
              href: "/a/news",
              label: "Manage News",
              icon: <IconArticle className="mr-2 h-4 w-4" />,
            }}
          />

          <StatCard
            title="Diamond Bundles"
            helpId="dashboard.diamond_bundles"
            icon={<IconDiamond className="h-4 w-4 text-cyan-600" />}
            metric="shop"
            value={formatMoneyInput(shop.diamond_bundles_sold)}
            sub={shop.top_bundle ? `Top seller: ${shop.top_bundle}` : "No bundle sold yet"}
            action={{
              href: "/a/shop",
              label: "Manage Shop",
              icon: <IconShoppingCart className="mr-2 h-4 w-4" />,
            }}
          />

          <StatCard
            title="Total Revenue"
            helpId="dashboard.revenue"
            icon={<IconStar className="h-4 w-4 text-green-600" />}
            metric="revenue"
            value={money(shop.revenue_paid)}
            sub={`${money(shop.diamond_revenue)} from diamonds, across ${formatMoneyInput(
              shop.orders_paid,
            )} paid orders`}
            action={{
              href: "/a/shop/orders",
              label: "View Orders",
              icon: <TrendingUp className="mr-2 h-4 w-4" />,
            }}
          />
        </div>

        {/* ── Competition ──────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-4">
          <StatCard
            title="Total Platform Kills"
            helpId="dashboard.platform_kills"
            icon={<IconSwords className="h-4 w-4 text-red-500" />}
            metric="kills"
            value={formatMoneyInput(combat.total_kills)}
            sub={`Solo ${formatMoneyInput(combat.solo_kills)}, team ${formatMoneyInput(
              combat.team_kills,
            )}`}
          />

          <StatCard
            title="Most Popular Event Format"
            helpId="dashboard.popular_format"
            icon={<IconCalendar className="h-4 w-4 text-violet-500" />}
            metric="formats"
            value={
              <span className="capitalize">
                {events.popular_format ? events.popular_format.replace(/_/g, " ") : "-"}
              </span>
            }
            sub="Based on all events"
          />

          <StatCard
            title="Player Match Stats Records"
            helpId="dashboard.match_stat_records"
            icon={<IconActivity className="h-4 w-4 text-emerald-500" />}
            metric="match-stats"
            // Read 0 until the Authorization header was added. 2,982 rows existed the whole time.
            value={formatMoneyInput(combat.player_match_records)}
            sub={`${formatMoneyInput(combat.solo_match_records)} solo records as well`}
          />
        </div>

        {/* ── Quick actions ────────────────────────────────────────────────── */}
        <div
          data-tour="dashboard-quick-actions"
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2 mb-4"
        >
          {/* All four are real links now. Three were `disabled` buttons with their <Link> sitting
              commented out beside them, so the page offered four actions and performed two. */}
          <Button asChild variant="outline" className="h-auto p-4 bg-transparent">
            <Link href="/a/leaderboards/create" className="flex flex-col items-center gap-2">
              <IconTrophy className="h-6 w-6" />
              <span>Create Leaderboard</span>
            </Link>
          </Button>

          <Button asChild variant="outline" className="h-auto p-4 bg-transparent">
            <Link href="/a/news/create" className="flex flex-col items-center gap-2">
              <IconArticle className="h-6 w-6" />
              <span>Create News</span>
            </Link>
          </Button>

          {/* asChild, which this one was missing: without it the Button renders a <button> that
              WRAPS an <a>, which is invalid markup and unusable from the keyboard. */}
          <Button asChild variant="outline" className="h-auto p-4 bg-transparent">
            <Link href="/a/events/create" className="flex flex-col items-center gap-2">
              <IconCalendar className="h-6 w-6" />
              <span>Create Event</span>
            </Link>
          </Button>

          <Button asChild variant="outline" className="h-auto p-4 bg-transparent">
            <Link href="/a/rankings" className="flex flex-col items-center gap-2">
              <IconStar className="h-6 w-6" />
              <span>Manage Rankings</span>
            </Link>
          </Button>
        </div>

        {/* ── Recent activity ──────────────────────────────────────────────── */}
        <Card data-tour="dashboard-recent-activity">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <IconActivity className="h-5 w-5" />
              <Link href="/a/dashboard/activity" className="hover:text-primary">
                Recent Admin Activities
              </Link>
              <InfoTip id="dashboard.recent_activities._section" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Scrolls inside its own container so three columns never push the page sideways on
                a phone. */}
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Admin User</TableHead>
                    <TableHead>What happened</TableHead>
                    <TableHead>Timestamp</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activity.recent.length === 0 ? (
                    <TableRow>
                      {/* A written empty state. The old table simply rendered nothing at all. */}
                      <TableCell
                        colSpan={3}
                        className="py-10 text-center text-sm text-muted-foreground"
                      >
                        No admin actions have been recorded yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    activity.recent.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="font-medium">{row.admin_user}</TableCell>
                        {/* One sentence, not the raw stored row. An event edit is stored as a
                            JSON document, and this table used to print it (owner 2026-09-03).
                            The individual changes sit under it, so nothing is hidden. */}
                        <TableCell className="max-w-md">
                          <span>{row.summary}</span>
                          {row.details.length > 0 && (
                            <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                              {row.details.map((change, i) => (
                                <li key={i}>{change}</li>
                              ))}
                            </ul>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {row.timestamp ? formatDate(row.timestamp, true) : "-"}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <Button className="flex-1" asChild variant="outline">
                <Link href="/a/dashboard/activity">
                  Activity breakdown ({formatMoneyInput(activity.admin_actions_total)} actions)
                  <ArrowRight className="ml-1 size-4" />
                </Link>
              </Button>
              <Button className="flex-1" asChild variant="outline">
                <Link href="/a/history">
                  View full history <ArrowRight className="ml-1 size-4" />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
