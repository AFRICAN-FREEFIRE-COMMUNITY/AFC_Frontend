"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
// import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, ArrowLeft } from "lucide-react";
import { formatDate, formatWord } from "@/lib/utils";
import {
  IconTrophy,
  IconCrosshair,
  IconAward,
  IconClipboardList,
  IconShieldCheck,
  IconCircleCheckFilled,
  IconLock,
  IconClock,
} from "@tabler/icons-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { DEFAULT_PROFILE_PICTURE } from "@/constants";
import { FullLoader, Loader } from "@/components/Loader";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { PageHeader } from "@/components/PageHeader";
import axios from "axios";
import { env } from "@/lib/env";
import { toast } from "sonner";
import { InfoTip } from "@/components/ui/info-tip";
// Subtle clickable team name -> public team page.
import { TeamLink } from "@/components/ui/entity-link";
// Achievements catalog + earned-status helpers (display only; the points->rankings
// boost is an explicit FUTURE feature and is NOT implemented here).
import {
  ACHIEVEMENTS,
  ACHIEVEMENT_SECTIONS,
  earnedPointsTotal,
  isEarned,
  isGoal,
  groupByCategory,
  metricValue,
  TOTAL_POINTS_AVAILABLE,
  type Achievement,
  type AchievementCategory,
  type AchievementContext,
} from "./achievements";
// The owner's OWN full stats window (rich cards + curve + per-event + recent
// matches). Renders from the same richProfile payload, which the backend returns
// in full because we identify as the owner (stats_visible). See OwnStatsTab.tsx.
import { OwnStatsTab } from "./OwnStatsTab";

export const ProfileContent = () => {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [pending, startTransition] = useTransition();
  const [discordConnected, setDiscordConnected] = useState(false);
  const [myApplications, setMyApplications] = useState<any[]>([]);
  const [loadingApplications, setLoadingApplications] = useState(false);
  const { user, token } = useAuth();

  // ── Rich public-profile payload for THIS user ──────────────────────────────
  // The user/stats object from AuthContext (contexts/AuthContext.tsx) has the
  // career scalars but no team-history or rank/tier fields. The Team History tab
  // and the Overview "Current Rank" fix both need that richer shape, so we fetch
  // the SAME public payload the public profile page uses
  // (PlayerClient.tsx -> POST /player/get-public-player-stats/), keyed off the
  // logged-in user's in-game name. It returns the player's current team (with
  // join_date + in_game_role) and a tier_history list we read the current tier
  // from. Stats tables may be empty in this DB clone, so anything missing is
  // rendered truthfully (empty state / "Unranked"), never faked.
  const [richProfile, setRichProfile] = useState<any | null>(null);
  const [loadingRich, setLoadingRich] = useState(false);

  const checkDiscordConnection = async () => {
    if (!token) return;

    try {
      const res = await axios.get(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/auth/is-discord-account-connected/`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );
      setDiscordConnected(res.data.connected);
    } catch (error) {
      console.error("Error checking Discord status:", error);
    }
  };

  const handleDiscordDisconnect = async () => {
    if (!token) return;

    startTransition(async () => {
      try {
        await axios.post(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/auth/disconnect-discord-account/`,
          {},
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );
        setDiscordConnected(false);
        toast.success("Discord account disconnected.");
      } catch (error) {
        console.error("Error disconnecting Discord:", error);
        toast.error("Failed to disconnect Discord. Please try again.");
      }
    });
  };

  useEffect(() => {
    if (user && token) {
      checkDiscordConnection();
      setLoadingApplications(true);
      axios
        .get(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/player-market/view-my-applications/`,
          { headers: { Authorization: `Bearer ${token}` } },
        )
        .then((res) => setMyApplications(res.data))
        .catch(() => toast.error("Failed to load your applications."))
        .finally(() => setLoadingApplications(false));
    }
  }, [user, token]);

  // Fetch the rich profile for THIS user (team history + tier + full stats). Keyed
  // off the user's in_game_name; this is the same endpoint the public profile
  // (PlayerClient.tsx) calls, so we reuse its exact data + shape here.
  //
  // PRIVACY: that endpoint now gates the detailed stats and only returns them to
  // the player / an admin / a teammate. We are the OWNER viewing our OWN profile,
  // so we MUST send the session token; the backend then sees viewer == player and
  // returns stats_visible=true with the full stat block. Without the token the
  // owner would (incorrectly) get the private, zeroed payload. Re-fetch when the
  // token changes (e.g. re-login).
  useEffect(() => {
    const ign = user?.in_game_name;
    if (!ign || !token) return;

    let active = true;
    setLoadingRich(true);
    axios
      .post(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/player/get-public-player-stats/`,
        { player_ign: ign },
        // Identify ourselves so the backend marks us as the owner (stats_visible).
        { headers: { Authorization: `Bearer ${token}` } },
      )
      .then((res) => {
        if (active) setRichProfile(res.data?.player ?? null);
      })
      .catch(() => {
        // Non-blocking: if this fails we fall back to the lean `user` object and
        // truthful empty/Unranked states. No toast (the page is still usable).
        if (active) setRichProfile(null);
      })
      .finally(() => {
        if (active) setLoadingRich(false);
      });

    return () => {
      active = false;
    };
  }, [user?.in_game_name, token]);

  // Current tier from the rich profile's tier_history (most recent published row
  // with a tier). Drives the truthful "Current Rank / Tier" Overview value below
  // (replaces the old hardcoded 0). Null when no tier has been published.
  const currentTier = (() => {
    const rows: any[] = richProfile?.tier_history ?? [];
    for (let i = rows.length - 1; i >= 0; i--) {
      if (rows[i]?.tier != null) return rows[i];
    }
    return null;
  })();

  // Build the real-data context the Achievements catalog computes against. Lifetime
  // metric ladders read `stats`; the profile milestones read the boolean facts.
  // `profileComplete` is true when the account has a picture, a country, and at
  // least one role. `votedInAwards` is intentionally left undefined (the client has
  // no awards-vote flag yet) so that milestone shows as a goal, never a fake win.
  const achievementCtx: AchievementContext = {
    stats: {
      total_kills: user?.stats?.total_kills ?? 0,
      total_wins: user?.stats?.total_wins ?? 0,
      total_mvps: user?.stats?.total_mvps ?? 0,
      total_booyahs: user?.stats?.total_booyahs ?? 0,
      total_tournaments_played: user?.stats?.total_tournaments_played ?? 0,
      total_scrims_played: user?.stats?.total_scrims_played ?? 0,
    },
    // uid lives on the lean user object (contexts/AuthContext.tsx -> User.uid).
    uidSet: !!user?.uid && String(user.uid).trim().length > 0,
    hasTeam: !!user?.team,
    discordConnected,
    profileComplete:
      !!user?.profile_pic &&
      !!user?.country &&
      ((user?.roles?.length ?? 0) > 0 || !!richProfile?.in_game_role),
    // votedInAwards: not exposed on the client -> remains undefined (goal state).
  };

  useEffect(() => {
    const discordStatus = searchParams.get("discord");

    if (discordStatus) {
      setTimeout(() => {
        if (discordStatus === "connected") {
          setDiscordConnected(true);
          toast.success("Discord account linked successfully!");
        } else {
          setDiscordConnected(false);
          toast.error(
            searchParams.get("message") ||
              "This account is already in use by another user.",
          );
        }

        const newSearchParams = new URLSearchParams(searchParams.toString());
        newSearchParams.delete("discord");
        newSearchParams.delete("step");
        router.replace(
          `${window.location.pathname}?${newSearchParams.toString()}`,
          { scroll: false },
        );
      }, 50);
    }
  }, [searchParams, router]);

  const handleDiscordConnect = () => {
    // Construct the URL to your backend endpoint
    const url = `${env.NEXT_PUBLIC_BACKEND_API_URL}/auth/connect-discord-account?session_token=${token}`;

    // Redirect the browser to start the OAuth flow
    window.open(url, "_blank", "noopener,noreferrer");
  };

  if (!user) return <FullLoader />;

  return (
    <div>
      <PageHeader back title={`Player Profile`} />
      {user.is_banned && (
        <Alert variant="destructive" className="mb-6">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Account Banned</AlertTitle>
          <AlertDescription>This account has been banned.</AlertDescription>
        </Alert>
      )}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="md:col-span-1">
          <CardContent className="flex flex-col items-center">
            <Avatar className="w-32 h-32 mb-4">
              <AvatarImage
                src={user.profile_pic || DEFAULT_PROFILE_PICTURE}
                alt={`${user.full_name}'s picture`}
                className="object-cover"
              />
              <AvatarFallback>{user.full_name.charAt(0)}</AvatarFallback>
            </Avatar>
            <h2 className="text-2xl font-semibold text-center mb-2">
              {user.full_name}
            </h2>
            <p className="text-sm text-muted-foreground mb-2">
              @{user.in_game_name}
            </p>
            <p className="mb-2 text-sm">UID: {user.uid}</p>
            {user.team && (
              <p className="mb-4 text-sm">
                {/* Team name links to the public team page. */}
                Team: <TeamLink name={user.team} />
              </p>
            )}
            {user.role !== "user" && (
              <Badge className="mb-4" variant="secondary">
                Role: <span className="capitalize">{user.role}</span>
              </Badge>
            )}
            <div className="grid w-full gap-2">
              <div className="flex items-center justify-end">
                <InfoTip id="profile.discord_connect" />
              </div>
              <Button className="w-full" asChild>
                <Link href="/profile/edit">Edit Profile</Link>
              </Button>
              {/* <Button
                disabled={pending}
                onClick={
                  discordConnected
                    ? handleDiscordDisconnect
                    : handleDiscordConnect
                }
                variant={discordConnected ? "destructive" : "secondary"} // Change color to red if connected
                className="w-full"
              >
                {pending ? (
                  <Loader
                    text={
                      discordConnected ? "Disconnecting..." : "Connecting..."
                    }
                  />
                ) : discordConnected ? (
                  `Disconnect Discord (${user.discord_username})`
                ) : (
                  "Connect to Discord"
                )}
              </Button> */}

              {discordConnected ? (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="destructive"
                      className="w-full"
                      disabled={pending}
                    >
                      {pending ? (
                        <Loader text="Disconnecting..." />
                      ) : (
                        `Disconnect - ${user.discord_username}`
                      )}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>
                        Are you absolutely sure?
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        This will disconnect your Discord account from your
                        player profile. You will lose access to Discord-linked
                        features until you reconnect.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleDiscordDisconnect}
                        className="bg-destructive text-white hover:bg-destructive/90"
                      >
                        Disconnect
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              ) : (
                <Button
                  disabled={pending}
                  onClick={handleDiscordConnect}
                  variant="secondary"
                  className="w-full"
                >
                  {pending ? (
                    <Loader text="Connecting..." />
                  ) : (
                    "Connect to Discord"
                  )}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardContent>
            <Tabs defaultValue="overview">
              <ScrollArea>
                <TabsList className="w-full mb-4">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  {/* Owner's OWN full stats window (rich cards + curve + tables). */}
                  <TabsTrigger value="stats">Stats</TabsTrigger>
                  <TabsTrigger value="history">Team History</TabsTrigger>
                  <TabsTrigger value="achievements">Achievements</TabsTrigger>
                  <TabsTrigger value="applications">
                    My Applications
                  </TabsTrigger>
                  {user.role === "admin" && (
                    <TabsTrigger value="admin">Admin Capabilities</TabsTrigger>
                  )}
                </TabsList>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>

              <TabsContent value="overview">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Kills</p>
                    <p className="text-lg md:text-xl font-semibold">
                      {user?.stats.total_kills}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Wins</p>
                    <p className="text-lg md:text-xl font-semibold">
                      {user?.stats.total_wins}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">MVPs</p>
                    <p className="text-lg md:text-xl font-semibold">
                      {user?.stats.total_mvps}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Booyahs</p>
                    <p className="text-lg md:text-xl font-semibold">
                      {user?.stats.total_booyahs}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Tournaments</p>
                    <p className="text-lg md:text-xl font-semibold">
                      {user?.stats.total_tournaments_played}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Scrims</p>
                    <p className="text-lg md:text-xl font-semibold">
                      {user?.stats.total_scrims_played}
                    </p>
                  </div>
                  {/* Current Tier: was a hardcoded "0" (misleading). Now shows the
                      real published tier label from the rich profile's tier_history,
                      or a truthful "Unranked" when no tier exists yet. We never
                      fabricate a numeric rank. */}
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Current Tier
                    </p>
                    <p className="text-lg md:text-xl font-semibold">
                      {loadingRich && !richProfile
                        ? "..."
                        : (currentTier?.tier_label ?? "Unranked")}
                    </p>
                  </div>
                  {/* KDR + Win Rate only render when the rich endpoint actually
                      provides them, so we surface real values or nothing (never a
                      fake 0). */}
                  {typeof richProfile?.kdr === "number" && (
                    <div>
                      <p className="text-sm text-muted-foreground">KDR</p>
                      <p className="text-lg md:text-xl font-semibold">
                        {richProfile.kdr.toFixed(2)}
                      </p>
                    </div>
                  )}
                  {typeof richProfile?.win_rate === "number" && (
                    <div>
                      <p className="text-sm text-muted-foreground">Win Rate</p>
                      <p className="text-lg md:text-xl font-semibold">
                        {richProfile.win_rate.toFixed(1)}%
                      </p>
                    </div>
                  )}
                </div>
              </TabsContent>
              {/* ── STATS ────────────────────────────────────────────────────
                  The owner's OWN full stats window. Sourced from richProfile
                  (POST /player/get-public-player-stats/), which the backend returns
                  in FULL here because ProfileContent sends our session token and the
                  backend marks us as the owner (stats_visible=true). Renders the same
                  rich window the public player page shows: headline cards, a
                  performance curve, the per-event breakdown, and recent matches.
                  Empty tables in this DB clone simply read as zeros / empty states,
                  which is the truthful representation, never fabricated. */}
              <TabsContent value="stats">
                {loadingRich && !richProfile ? (
                  <div className="text-center py-10 text-sm text-muted-foreground">
                    Loading your stats...
                  </div>
                ) : (
                  <OwnStatsTab player={richProfile} />
                )}
              </TabsContent>
              {/* ── TEAM HISTORY ─────────────────────────────────────────────
                  Real data sourced from the rich public profile (richProfile,
                  POST /player/get-public-player-stats/). Mirrors the public
                  profile's Team History tab (PlayerClient.tsx) one-for-one: the
                  current team (with join date + in-game role) is shown as an open
                  "Present" stint. Roster-movement history is not tracked yet, so
                  only the current team appears. Empty state when the user has no
                  team. Note: the table body holds only <TableRow>/<TableCell>
                  (valid inside <tbody>), so there is no hydration error. */}
              <TabsContent value="history">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Team</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>From</TableHead>
                      <TableHead>To</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loadingRich && !richProfile ? (
                      <TableRow>
                        <TableCell
                          colSpan={4}
                          className="text-center text-muted-foreground py-8"
                        >
                          Loading team history...
                        </TableCell>
                      </TableRow>
                    ) : richProfile?.team ? (
                      <TableRow>
                        <TableCell className="font-medium">
                          {/* Team name links to the public team page (same idiom
                              as the public profile). */}
                          <Link
                            href={`/teams/${richProfile.team.team_name}`}
                            className="text-primary hover:underline inline-flex items-center gap-1"
                          >
                            <IconShieldCheck className="h-4 w-4" />
                            {richProfile.team.team_name}
                          </Link>
                        </TableCell>
                        <TableCell className="capitalize">
                          {richProfile.in_game_role
                            ? formatWord(richProfile.in_game_role)
                            : "-"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {richProfile.join_date
                            ? formatDate(richProfile.join_date)
                            : "-"}
                        </TableCell>
                        <TableCell>Present</TableCell>
                      </TableRow>
                    ) : user.team ? (
                      // Fallback: the lean user object still knows the team name
                      // even if the rich fetch failed. Show that truthfully.
                      <TableRow>
                        <TableCell className="font-medium">
                          <span className="inline-flex items-center gap-1">
                            <IconShieldCheck className="h-4 w-4" />
                            <TeamLink name={user.team} />
                          </span>
                        </TableCell>
                        <TableCell>-</TableCell>
                        <TableCell className="text-muted-foreground">
                          -
                        </TableCell>
                        <TableCell>Present</TableCell>
                      </TableRow>
                    ) : (
                      <TableRow>
                        <TableCell
                          colSpan={4}
                          className="text-center text-muted-foreground py-8"
                        >
                          No team history yet.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
                <p className="text-xs text-muted-foreground mt-3">
                  Full past-team history will appear here once roster movement is
                  tracked. Only your current team is shown for now.
                </p>
              </TabsContent>
              {/* ── ACHIEVEMENTS ─────────────────────────────────────────────
                  Catalog grouped into Lifetime / Monthly / Daily. Lifetime badges
                  light up from REAL data (achievementCtx, built from user.stats +
                  profile facts). Monthly/Daily are goals shown with their how-to-earn
                  hint and a neutral "not tracked yet" state (no faked dates). The
                  panel is a normal layout (no <tbody>), so there is no hydration
                  error. AchievementsPanel is defined at the bottom of this file. */}
              <TabsContent value="achievements">
                <AchievementsPanel ctx={achievementCtx} />
              </TabsContent>

              <TabsContent value="applications">
                {loadingApplications ? (
                  <div className="text-center py-10 text-sm text-muted-foreground">
                    Loading...
                  </div>
                ) : myApplications.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 py-10 text-muted-foreground">
                    <IconClipboardList className="h-10 w-10 opacity-40" />
                    <p className="text-sm font-medium">No applications yet</p>
                    <p className="text-xs">
                      Apply to teams from the Player Market
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {myApplications.map((app) => {
                      const statusColors: Record<string, string> = {
                        PENDING:
                          "bg-yellow-900/20 text-yellow-400 border-yellow-800",
                        SHORTLISTED:
                          "bg-cyan-900/20 text-cyan-400 border-cyan-800",
                        INVITED: "bg-blue-900/20 text-blue-400 border-blue-800",
                        ACCEPTED:
                          "bg-green-900/20 text-green-400 border-green-800",
                        TRIAL_EXTENDED:
                          "bg-purple-900/20 text-purple-400 border-purple-800",
                        REJECTED: "bg-red-900/20 text-red-400 border-red-800",
                      };
                      return (
                        <div
                          key={app.id}
                          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg border bg-muted/20"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold truncate">{app.team}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Applied {formatDate(app.applied_at)}
                            </p>
                          </div>

                          <div className="flex items-center gap-3 flex-wrap shrink-0">
                            {/* Performance mini-stats */}
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <IconTrophy className="h-3 w-3 text-yellow-400" />
                                {app.tournament_wins}
                              </span>
                              <span className="flex items-center gap-1">
                                <IconCrosshair className="h-3 w-3 text-red-400" />
                                {app.total_tournament_kills}
                              </span>
                              <span className="flex items-center gap-1">
                                <IconAward className="h-3 w-3 text-blue-400" />
                                {app.tournament_finals_appearances}
                              </span>
                            </div>

                            <Badge
                              variant="outline"
                              className={`text-xs ${statusColors[app.status] ?? ""}`}
                            >
                              {app.status.replace("_", " ")}
                            </Badge>

                            {app.contact_unlocked && (
                              <Badge
                                variant="outline"
                                className="text-xs text-green-400 border-green-800"
                              >
                                Contact Unlocked
                              </Badge>
                            )}

                            <Button size="sm" variant="outline" asChild>
                              <Link
                                href={`/player-markets/applications/${app.id}`}
                              >
                                View
                              </Link>
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

// ──────────────────────────────────────────────────────────────────────────────
// AchievementsPanel: the body of the "Achievements" tab.
//
// Renders the data-driven ACHIEVEMENTS catalog (from ./achievements) grouped into
// Lifetime / Monthly / Daily via AFC pill tabs, and within each section grouped
// again into ladders / sub-sections (Kills, Wins, Profile, ...). It shows:
//   - a headline tally of REAL "achievement points earned" (sum of earned lifetime
//     tiers only, never goals) out of the catalog total;
//   - a muted note that points will later boost rankings/tiers ("coming soon"),
//     since the boost mechanism itself is an explicit FUTURE feature not built here;
//   - per ladder, the tiers in ascending order: earned ones highlighted
//     (green/gold), the NEXT locked tier emphasized with progress toward its
//     threshold ("740 / 1000 kills"), the rest muted with their how-to-earn text.
//
// `ctx` is the real-data context assembled in ProfileContent (user.stats + profile
// facts). This component is pure presentation over that context.
// ──────────────────────────────────────────────────────────────────────────────
function AchievementsPanel({ ctx }: { ctx: AchievementContext }) {
  // Which section is showing (lifetime is the substantive, computable one first).
  const [section, setSection] = useState<AchievementCategory>("lifetime");

  // Real earned-points tally (lifetime wins only) + catalog total.
  const earnedPoints = earnedPointsTotal(ctx);
  // How many achievements are actually unlocked (for the "x of y" count).
  const earnedCount = ACHIEVEMENTS.filter((a) => isEarned(a, ctx)).length;

  // The active section grouped into its ladders / sub-sections, in catalog order.
  const groups = groupByCategory(section);

  return (
    <div>
      {/* ── headline tally + coming-soon note ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div>
          <p className="text-sm text-muted-foreground">
            Achievement points earned
          </p>
          <p className="text-2xl font-bold text-primary">
            {earnedPoints}
            <span className="text-sm font-normal text-muted-foreground">
              {" "}
              / {TOTAL_POINTS_AVAILABLE} pts
            </span>
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {earnedCount} of {ACHIEVEMENTS.length} achievements unlocked
          </p>
        </div>
        {/* Trophy badge mirrors the gold accent used across AFC stat surfaces. */}
        <Badge
          variant="outline"
          className="border-gold/60 text-gold self-start sm:self-auto"
        >
          <IconTrophy className="h-4 w-4 mr-1" />
          {earnedPoints} pts
        </Badge>
      </div>

      {/* Honest note: the boost itself is a FUTURE feature, so we only promise it
          is coming, we do not apply it. */}
      <p className="text-xs text-muted-foreground bg-muted/40 border rounded-md px-3 py-2 mb-4">
        Achievement points will be usable to boost your rankings and tiers.
        Coming soon.
      </p>

      {/* ── section tabs (AFC pill segment style) ── */}
      <div className="inline-flex gap-1 bg-muted rounded-lg p-[3px] mb-4">
        {ACHIEVEMENT_SECTIONS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setSection(s.id)}
            className={`h-8 px-3 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
              section === s.id
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Per-section intro: lifetime ladders are computed; monthly/daily are goals. */}
      {section !== "lifetime" && (
        <p className="text-xs text-muted-foreground mb-4 flex items-center gap-1">
          <IconClock className="h-3.5 w-3.5" />
          {section === "monthly" ? "Monthly" : "Daily"} goals are not tracked
          yet. They will light up automatically once time based stats are
          recorded.
        </p>
      )}

      {/* ── grouped ladders / sub-sections ── */}
      <div className="space-y-6">
        {groups.map((g) => (
          <AchievementGroup key={g.group} group={g.group} items={g.items} ctx={ctx} />
        ))}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// AchievementGroup: one ladder / sub-section (e.g. "Kills") rendered as a header +
// its tiers in ascending order. It computes the "next locked tier" for the group:
// the first tier (in order) the user has NOT yet earned. That tier gets the
// progress emphasis ("740 / 1000 kills") so the player sees what they are chasing.
// ──────────────────────────────────────────────────────────────────────────────
function AchievementGroup({
  group,
  items,
  ctx,
}: {
  group: string;
  items: Achievement[];
  ctx: AchievementContext;
}) {
  // The id of the next tier to chase: the first NOT-earned tier in catalog order.
  // For metric ladders this is the next threshold; once all are earned it is null.
  const nextLockedId = items.find((a) => !isEarned(a, ctx))?.id ?? null;

  // How many of this group's tiers are earned (small "x / y" group progress).
  const earnedInGroup = items.filter((a) => isEarned(a, ctx)).length;

  return (
    <div>
      {/* group header: label + earned count for the ladder */}
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-semibold text-foreground">{group}</h4>
        <span className="text-xs text-muted-foreground">
          {earnedInGroup} / {items.length}
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {items.map((a) => (
          <AchievementCard
            key={a.id}
            achievement={a}
            ctx={ctx}
            // emphasize this card when it is the next tier to chase in its ladder
            isNext={a.id === nextLockedId}
          />
        ))}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// AchievementCard: a single catalog entry (one ladder tier or one milestone/goal).
//   - Earned                     -> green/filled treatment + check + gold pts badge.
//   - Next locked metric tier    -> primary-emphasized border + progress bar +
//                                    "740 / 1000 kills" toward the threshold.
//   - Other locked lifetime tier -> muted, lock icon, how-to-earn hint.
//   - Goal (monthly/daily)       -> muted, clock icon, "Not tracked yet".
// The point value always shows as a badge so the catalog reads as a points map.
// ──────────────────────────────────────────────────────────────────────────────
function AchievementCard({
  achievement,
  ctx,
  isNext = false,
}: {
  achievement: Achievement;
  ctx: AchievementContext;
  isNext?: boolean;
}) {
  const Icon = achievement.icon;
  const earned = isEarned(achievement, ctx);
  const goal = isGoal(achievement);

  // Progress numbers for the next locked tier of a metric ladder. metricValue is
  // null for milestones/goals (no numeric progress), so the bar only shows on the
  // ladder tier we are actively chasing.
  const value = metricValue(achievement, ctx);
  const showProgress =
    isNext &&
    !earned &&
    value != null &&
    achievement.threshold != null &&
    achievement.threshold > 0;
  const pct = showProgress
    ? Math.min(100, Math.round(((value as number) / achievement.threshold!) * 100))
    : 0;

  // Card container treatment: earned (green), next-to-chase (primary ring), else
  // a plain muted card.
  const containerClass = earned
    ? "border-primary/40 bg-primary/5"
    : isNext && !goal
      ? "border-primary/60 bg-primary/[0.03] ring-1 ring-primary/30"
      : "border-border bg-card hover:bg-muted/30";

  return (
    <div
      className={`flex items-start gap-3 rounded-md border px-3 py-3 transition-colors ${containerClass}`}
    >
      {/* icon chip: green when earned, muted otherwise */}
      <div
        className={`shrink-0 rounded-md p-2 ${
          earned
            ? "bg-primary/15 text-primary"
            : "bg-muted text-muted-foreground"
        }`}
      >
        <Icon className="h-5 w-5" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p
            className={`text-sm font-semibold truncate ${
              earned || isNext ? "text-foreground" : "text-muted-foreground"
            }`}
          >
            {achievement.title}
          </p>
          {/* point value badge (gold when earned, outline-muted otherwise) */}
          <Badge
            variant="outline"
            className={`shrink-0 text-xs ${
              earned ? "border-gold/60 text-gold" : "text-muted-foreground"
            }`}
          >
            {achievement.points} pts
          </Badge>
        </div>

        {/* how-to-earn text (always shown so the catalog explains itself) */}
        <p className="text-xs text-muted-foreground mt-0.5">
          {achievement.description}
        </p>

        {/* progress toward the next locked tier's threshold (metric ladders only) */}
        {showProgress && (
          <div className="mt-2">
            <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="text-xs text-primary font-medium mt-1">
              {(value as number).toLocaleString()} /{" "}
              {achievement.threshold!.toLocaleString()}{" "}
              {achievement.group.toLowerCase()}
            </p>
          </div>
        )}

        {/* status line: earned / next / locked / goal */}
        <div className="mt-1.5 flex items-center gap-1 text-xs">
          {earned ? (
            <span className="inline-flex items-center gap-1 text-primary font-medium">
              <IconCircleCheckFilled className="h-3.5 w-3.5" />
              Unlocked
            </span>
          ) : goal ? (
            <span className="inline-flex items-center gap-1 text-muted-foreground">
              <IconClock className="h-3.5 w-3.5" />
              Not tracked yet
            </span>
          ) : isNext ? (
            <span className="inline-flex items-center gap-1 text-primary font-medium">
              <IconShieldCheck className="h-3.5 w-3.5" />
              Up next
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-muted-foreground">
              <IconLock className="h-3.5 w-3.5" />
              Locked
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
