"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
// i18n: user-visible copy on the owner's own profile page is sourced from the
// `profile` namespace (messages/en/profile.json). The active locale comes from the
// NEXT_LOCALE cookie (set on the profile edit page) and falls back to English.
import { useTranslations, useLocale } from "next-intl";
// import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, ArrowLeft } from "lucide-react";
import { formatWord } from "@/lib/utils";
// LocalTime: renders a stored UTC timestamp in the VIEWER's own timezone + language
// (components/LocalTime.tsx). Replaces the old formatDate() calls, which rendered in
// UTC with a hardcoded "en-US" locale. Used here for the team-history join date.
import { LocalTime } from "@/components/LocalTime";
// Shared, self-expiring NEW tag (owner rule: any new surface wears one for 5 days).
import { NewBadge } from "@/components/NewBadge";
// formatLocalTime: the string-form sibling of <LocalTime/> (lib/i18n/time.ts), for
// the (rare) places a plain string is needed instead of JSX. Used here to localize
// the "Applied {date}" line whose date is passed as a t() parameter.
import { formatLocalTime } from "@/lib/i18n/time";
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
import { FullLoader } from "@/components/Loader";
import { ScrollableTabsList } from "@/components/ui/scrollable-tabs";
import { PageHeader } from "@/components/PageHeader";
import axios from "axios";
import { env } from "@/lib/env";
import { toast } from "sonner";
import { InfoTip } from "@/components/ui/info-tip";
// Subtle clickable team name -> public team page.
import { TeamLink } from "@/components/ui/entity-link";
// Shared AFC headline-stat card, the same one the public player page and the Stats tab
// use, so the owner's career snapshot belongs to the same design system (components/StatBox.tsx).
import { StatBox } from "@/components/StatBox";
// Flag glyph for the country chip in the identity band (lib/countryFlag.tsx), matching
// how the public player page renders a player's country.
import { CountryFlag } from "@/lib/countryFlag";
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
// "My reports" tab body (owner 2026-06-20): reports this user filed + admin answers.
import { MyPlayerReports } from "./MyPlayerReports";

// ── i18n: achievement-group display string -> message key ─────────────────────
// The achievements CATALOG (achievements.ts) stores group/title/description in
// English as the data + fallback source; the UI renders the TRANSLATED text from
// the `achievementsCatalog` block of messages/en/profile.json. This maps a group's
// English display string (e.g. "Monthly Kills") to its message key ("monthlyKills")
// so group headers, ladder units, and ladder descriptions can be localized without
// changing the data module. Unknown groups fall back to the raw string.
const ACHIEVEMENT_GROUP_KEY: Record<string, string> = {
  Kills: "kills",
  // No lifetime "Wins" group: its ladder was merged into Booyahs (one number, one ladder).
  // "Monthly Wins" below is a separate, still-live group.
  Tournaments: "tournaments",
  Scrims: "scrims",
  MVPs: "mvps",
  Booyahs: "booyahs",
  Profile: "profile",
  "Monthly Kills": "monthlyKills",
  "Monthly Wins": "monthlyWins",
  "Monthly Activity": "monthlyActivity",
  Daily: "daily",
};

export const ProfileContent = () => {
  const t = useTranslations("profile");
  // Saved-delivery copy lives in the `shop` namespace (messages/en/shop.json ->
  // savedDelivery), reused here for the "Saved addresses" quick-link card that points
  // at /profile/addresses (app/(user)/profile/_components/SavedAddresses.tsx).
  const tShop = useTranslations("shop");
  // Copy for the "Connected apps" quick link at the bottom of this page. Its own
  // namespace because the page it points at (ConnectedApps.tsx) owns the rest of it.
  const tConnected = useTranslations("connectedApps");
  // Copy for the "Sign-in security" quick link (two-step sign-in). Its own namespace
  // because the page it points at (TwoFactorSecurity.tsx) and the login second step
  // (TwoFactorStep.tsx) share it.
  const tTwoFactor = useTranslations("twoFactor");
  // Active UI locale, passed to formatLocalTime so the "Applied {date}" string
  // localizes month names to the chosen language (and skips the cookie read).
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [pending, startTransition] = useTransition();
  const [discordConnected, setDiscordConnected] = useState(false);
  const [myApplications, setMyApplications] = useState<any[]>([]);
  const [loadingApplications, setLoadingApplications] = useState(false);
  const { user, token } = useAuth();

  // Active tab is controlled so the "Your report was reviewed" notification can deep
  // link to /profile?tab=reports and land directly on the My-reports tab (owner
  // 2026-06-20). Seeded once from the ?tab= query param, defaulting to "overview".
  const [activeTab, setActiveTab] = useState<string>(
    searchParams.get("tab") || "overview",
  );
  // Report-feature copy (messages/en/playerReports.json) for the My-reports tab label.
  const tReports = useTranslations("playerReports");

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
        .catch(() => toast.error(t("applications.loadFailed")))
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

  // ── Does this player have a record of their OWN, and does their team? ────────
  // Two different populations, and keeping them apart is the whole point of the
  // 2026-08-07 stat fix:
  //   total_matches = matches the player was FIELDED in (has a scoreline for). It is
  //                   the denominator of kills-per-match and win rate.
  //   team_matches  = every match the player's rostered tournament teams played,
  //                   whether or not the player was in the lineup. Denominator of
  //                   team win rate.
  // A rostered player who never played has total_matches 0 and team_matches > 0. That
  // is a real and common state (a substitute, or a manager on the roster), so the page
  // renders it honestly rather than showing 0.00 averages that look like a bug.
  const hasOwnMatches = (richProfile?.total_matches ?? 0) > 0;
  const hasTeamMatches = (richProfile?.team_matches ?? 0) > 0;

  // Build the real-data context the Achievements catalog computes against. Lifetime
  // metric ladders read `stats`; the profile milestones read the boolean facts.
  // `profileComplete` is true when the account has a picture, a country, and at
  // least one role. `votedInAwards` is intentionally left undefined (the client has
  // no awards-vote flag yet) so that milestone shows as a goal, never a fake win.
  const achievementCtx: AchievementContext = {
    stats: {
      total_kills: user?.stats?.total_kills ?? 0,
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
          toast.success(t("discord.linked"));
        } else {
          setDiscordConnected(false);
          toast.error(
            searchParams.get("message") || t("discord.linkFailed"),
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

  if (!user) return <FullLoader />;

  return (
    <div>
      <PageHeader back title={t("page.title")} />
      {user.is_banned && (
        <Alert variant="destructive" className="mb-6">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>{t("page.banned.title")}</AlertTitle>
          <AlertDescription>{t("page.banned.description")}</AlertDescription>
        </Alert>
      )}
      {/* ══════════════════════════════════════════════════════════════════════
          IDENTITY BAND (redesign, owner-approved 2026-08-07)
          ─────────────────────────────────────────────────────────────────────
          One full-width block that reads as a PERSON: avatar, real name, @handle
          and UID on one line, then the facts that used to be a stack of
          "Label: value" text lines rendered as badges (in-game role, team, tier,
          country, account role).

          WHAT THIS REPLACED, and why:
            • The old page was a narrow md:col-span-1 card holding a vertical list
              of "UID:", "Team:", "Role:", "Language:" lines in mixed styles. It
              read as a debug dump, and because that column ran long while the
              tab card beside it ran short, the right half of the page was empty
              for most of its height.
            • The esport image rendered TWICE from the same user.esport_image_url,
              once under an uppercase "ESPORT IMAGE" label and again under
              "Esports Image". It now renders ONCE, here, at a size that respects
              its natural aspect (object-contain), and links to the edit page.
            • Language moved into the Overview facts grid, where the rest of the
              account details live.

          Mirrors the public player page's identity card
          (players/[username]/_components/PlayerClient.tsx) one for one, so a
          player's own profile and their public profile read as one design.
          ══════════════════════════════════════════════════════════════════════ */}
      <Card>
        <CardContent>
          <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
            {/* flex-wrap + a 14rem basis on the text column: below 640px this lets
                the avatar and the esport tile share row one (they read as a pair of
                images) and gives the name, handle and badges the FULL card width on
                row two. Measured at 390px without it, the name column was squeezed to
                about 150px, which broke a long real name over three lines and put
                every badge on its own row. */}
            <div className="flex min-w-0 flex-1 flex-wrap items-start gap-4">
              <Avatar className="h-20 w-20 shrink-0 border-4 border-primary">
                <AvatarImage
                  src={user.profile_pic || DEFAULT_PROFILE_PICTURE}
                  alt={t("card.avatarAlt", { name: user.full_name })}
                  className="object-cover"
                />
                <AvatarFallback className="text-2xl">
                  {user.full_name.charAt(0)}
                </AvatarFallback>
              </Avatar>

              {/* ── Esport image: the ONLY place it appears on this page ──────────
                  UserProfile.esports_pic, returned as esport_image_url by
                  GET /auth/get-user-profile/ and held on the AuthContext user.
                  Organizers use it as the player's image in event graphics and some
                  events require it before registration, so the player needs to see
                  whether they have one. Uploaded / replaced on /profile/edit. */}
              {user.esport_image_url ? (
                <Link
                  href="/profile/edit"
                  title={t("card.esportImage")}
                  className="h-28 w-20 shrink-0 overflow-hidden rounded-md border transition-colors hover:border-primary/60 sm:h-32 sm:w-24"
                >
                  {/* Short alt on purpose. When the file 404s (a real state on any
                      environment whose media directory is not in sync) the browser
                      paints the ALT TEXT inside this 80px tile, and the long
                      "{name}'s esports image" string filled it with wrapped text.
                      A brief label degrades to something that still reads as a label.
                      text-[10px] keeps that fallback inside the tile. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={user.esport_image_url}
                    alt={t("card.esportImage")}
                    className="h-full w-full object-contain text-[10px] text-muted-foreground"
                  />
                </Link>
              ) : (
                <Link
                  href="/profile/edit"
                  className="flex h-28 w-20 shrink-0 flex-col items-center justify-center gap-1 rounded-md border border-dashed p-2 text-center text-[11px] leading-tight text-muted-foreground transition-colors hover:bg-muted/40 sm:h-32 sm:w-24"
                >
                  <span>{t("card.esportsImageEmpty")}</span>
                  <span className="text-primary">{t("card.esportsImageHint")}</span>
                </Link>
              )}

              <div className="min-w-0 flex-1 basis-56">
                <h2 className="text-xl font-semibold md:text-3xl break-words">
                  {user.full_name}
                </h2>
                <p className="mt-0.5 text-sm text-muted-foreground break-words">
                  @{user.in_game_name}
                  {user.uid ? (
                    <>
                      {" "}
                      <span className="mx-1">·</span>{" "}
                      {t("card.uid", { uid: user.uid })}
                    </>
                  ) : null}
                </p>

                {/* Badge row: the identity facts, no longer a list of text lines.
                    Each renders only when it has a real value, so a brand-new
                    account shows fewer badges rather than empty labels. */}
                <div className="mt-2.5 flex flex-wrap gap-2">
                  {richProfile?.in_game_role && (
                    <Badge variant="secondary" className="capitalize">
                      {formatWord(richProfile.in_game_role)}
                    </Badge>
                  )}
                  {user.team && (
                    <Badge
                      variant="outline"
                      className="border-primary/50 text-primary"
                      asChild
                    >
                      <Link href={`/teams/${user.team}`}>{user.team}</Link>
                    </Badge>
                  )}
                  {/* Real published tier, or a truthful "Unranked". Never a fake rank.
                      GOLD is what identifies this badge as the competitive tier: a
                      label like "Entry" sitting untinted between "Rusher" and "Nigeria"
                      reads as just another role, so the colour is load-bearing, not
                      decoration (gold is used nowhere else in this row). The title
                      spells it out for anyone who hovers. */}
                  <Badge
                    variant="outline"
                    title={t("overview.currentTier")}
                    className={
                      currentTier?.tier_label
                        ? "border-gold/60 text-gold"
                        : "text-muted-foreground"
                    }
                  >
                    {currentTier?.tier_label ?? t("overview.unranked")}
                  </Badge>
                  {user.country && (
                    <Badge
                      variant="outline"
                      className="text-muted-foreground gap-1.5"
                    >
                      <CountryFlag country={user.country} />
                      {user.country}
                    </Badge>
                  )}
                  {user.role !== "user" && (
                    <Badge variant="secondary" className="capitalize">
                      {user.role}
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            {/* Owner actions. w-full on a phone so they are full-width tap targets,
                auto width beside the identity on desktop. */}
            <div className="flex w-full shrink-0 flex-col gap-2 md:w-auto md:min-w-44">
              <div className="flex items-center justify-end">
                <InfoTip id="profile.discord_connect" />
              </div>
              <Button className="w-full" asChild>
                <Link href="/profile/edit">{t("card.editProfile")}</Link>
              </Button>
              {/* Account connections moved to /profile/connected-apps (owner 2026-08-26).
                  That page carries every provider (Discord, Google, v-ent.co) in one list, plus
                  the apps that can sign this player in. Keeping a second, Discord-only control
                  here would mean two places to look and two places to keep correct. It also
                  removed a hardcoded English string and a handler that put the player's live
                  session token in a URL sent to discord.com. */}
              <Button variant="secondary" className="w-full" asChild>
                <Link href="/profile/connected-apps">{t("card.manageConnections")}</Link>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ══════════════════════════════════════════════════════════════════════
          CAREER SNAPSHOT
          ─────────────────────────────────────────────────────────────────────
          The nine bare label-over-number text cells that used to sit in the
          Overview tab, now rendered as the shared AFC StatBox card
          (components/StatBox.tsx) in the same 2-up / 4-up grid the public player
          page uses. It is promoted OUT of the tabs because it is the thing a
          player opens this page to see.

          ORDER IS DELIBERATE. "Matches played" comes first because it is the
          DENOMINATOR behind kills per match and win rate. The owner reported a
          profile reading 7 wins beside 0 kills and a 0.0% win rate and could not
          tell which number was lying; the answer was that the wins were the
          TEAM's and this page never showed how many matches the player was
          actually in. Both halves are fixed: the denominator is on screen, and
          the team record is explicitly labelled as the team's.

          DATA: richProfile (POST /player/get-public-player-stats/), which the
          backend returns in full because we send the owner's token. Each tile
          keeps the existing render guard, a real value or nothing, never a fake 0.
          ══════════════════════════════════════════════════════════════════════ */}
      <div className="mt-6 mb-3 text-xs font-medium text-muted-foreground">
        {t("overview.careerSnapshot")}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {typeof richProfile?.total_matches === "number" && (
          <StatBox
            label={t("overview.totalMatches")}
            value={richProfile.total_matches}
          />
        )}
        <StatBox
          label={t("overview.totalKills")}
          value={user.stats.total_kills}
          accent="green"
        />
        {/* Booyahs comes from richProfile.total_wins, NOT user.stats.total_booyahs,
            and the difference is the whole bug the owner reported.
            get_user_profile (afc_auth) still computes total_booyahs as
            solo_wins + TEAM wins, so it counts matches the player's team won while
            they sat on the roster. compute_player_stats (afc_player) computes
            total_wins over the player's OWN match lines only, which is the same
            population as total_matches and win_rate beside it.
            Sourcing this tile from the lean payload put a team number in the middle
            of a row of personal ones, which is exactly how "7 wins, 0 kills, 0.0%
            win rate" happened in the first place. The whole snapshot now reads from
            ONE payload with ONE definition, and the team record is the two
            explicitly labelled tiles below. */}
        {typeof richProfile?.total_wins === "number" && (
          <StatBox
            label={t("overview.booyahs")}
            value={richProfile.total_wins}
          />
        )}
        <StatBox
          label={t("overview.mvps")}
          value={user.stats.total_mvps}
          accent="gold"
        />
        {/* Kills per match and win rate are BOTH per-match averages over the
            player's own match lines. With no lines there is no average, so we say
            so instead of printing 0.00, which is what made this page look broken
            rather than empty (owner bug 2026-08-07). */}
        {typeof richProfile?.kdr === "number" && (
          <StatBox
            label={t("overview.kdr")}
            value={
              hasOwnMatches ? richProfile.kdr.toFixed(2) : t("overview.noMatchesYet")
            }
            muted={!hasOwnMatches}
          />
        )}
        {typeof richProfile?.win_rate === "number" && (
          <StatBox
            label={t("overview.winRate")}
            value={
              hasOwnMatches
                ? `${richProfile.win_rate.toFixed(1)}%`
                : t("overview.noMatchesYet")
            }
            muted={!hasOwnMatches}
          />
        )}
        {/* The TEAM record, named so it can never be read as the player's own.
            v7.1.41 split these out in the backend; the profile shows them here so a
            rostered player who has not been fielded still sees why their team page
            says one thing and their own numbers say another. */}
        {typeof richProfile?.team_wins === "number" && (
          <StatBox
            label={t("overview.teamWins")}
            value={richProfile.team_wins}
            sub={
              typeof richProfile?.team_matches === "number"
                ? t("overview.teamMatchesSub", {
                    count: richProfile.team_matches,
                  })
                : undefined
            }
          />
        )}
        {typeof richProfile?.team_win_rate === "number" && (
          <StatBox
            label={t("overview.teamWinRate")}
            value={
              hasTeamMatches
                ? `${richProfile.team_win_rate.toFixed(1)}%`
                : t("overview.noMatchesYet")
            }
            muted={!hasTeamMatches}
          />
        )}
      </div>

      {/* The honest empty state. It only appears in the exact situation that
          confused the owner: the player has no match lines of their own, but their
          rostered teams DO have a record. Rather than leaving a wall of zeros that
          reads as a broken page, it says in plain English what the numbers mean and
          what to do about it. */}
      {richProfile && !hasOwnMatches && hasTeamMatches && (
        <p className="mt-4 rounded-md border bg-muted/40 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
          <span className="font-semibold text-foreground">
            {t("overview.noScorelinesTitle")}
          </span>{" "}
          {t("overview.noScorelinesBody", {
            wins: richProfile.team_wins ?? 0,
            matches: richProfile.team_matches ?? 0,
          })}
        </p>
      )}

      {/* Tabs are now FULL WIDTH. They used to sit in a md:col-span-2 beside the
          tall identity column, which left the right half of the page empty for most
          of its height while the left column ran long. */}
      <Card className="mt-6">
        <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <ScrollableTabsList className="w-full mb-4">
                <TabsTrigger value="overview">
                  {t("tabs.overview")}
                </TabsTrigger>
                {/* Owner's OWN full stats window (rich cards + curve + tables). */}
                <TabsTrigger value="stats">{t("tabs.stats")}</TabsTrigger>
                <TabsTrigger value="history">{t("tabs.history")}</TabsTrigger>
                <TabsTrigger value="achievements">
                  {t("tabs.achievements")}
                </TabsTrigger>
                <TabsTrigger value="applications">
                  {t("tabs.applications")}
                </TabsTrigger>
                {/* Player reports the user filed + the admin's answers. */}
                <TabsTrigger value="reports">
                  {tReports("mine.tabLabel")}
                </TabsTrigger>
                {user.role === "admin" && (
                  <TabsTrigger value="admin">{t("tabs.admin")}</TabsTrigger>
                )}
              </ScrollableTabsList>

              {/* ── OVERVIEW: the account facts ────────────────────────────────
                  The performance numbers moved OUT of this tab and up into the
                  career snapshot above, so Overview now carries only the account
                  details, in the same label-over-value grid the public player page
                  uses for its identity facts.

                  NOTHING HERE IS REPEATED FROM THE IDENTITY BAND. Country, UID,
                  team, tier, in-game role and account role are badges up top, so
                  listing them again would be the same duplication the redesign set
                  out to remove. What is left is genuinely only here. */}
              <TabsContent value="overview">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-5">
                  {/* These two now mean EVENTS PLAYED, not events signed up for (owner ruling
                      2026-08-08). GET /auth/get-user-profile/ counts only events holding a
                      match line with a score assigned to this user, through the one shared
                      backend rule the public player page also reads
                      (afc_tournament_and_scrims/participation.py), so the labels say
                      "played". */}
                  <div>
                    <p className="text-xs text-muted-foreground">
                      {t("overview.tournamentsPlayed")}
                    </p>
                    <p className="mt-0.5 text-sm">
                      {user.stats.total_tournaments_played}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">
                      {t("overview.scrimsPlayed")}
                    </p>
                    <p className="mt-0.5 text-sm">
                      {user.stats.total_scrims_played}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">
                      {t("overview.joinedTeam")}
                    </p>
                    <p className="mt-0.5 text-sm">
                      {/* Viewer's own timezone + language, per the i18n rule. */}
                      {richProfile?.join_date ? (
                        <LocalTime value={richProfile.join_date} mode="date" />
                      ) : (
                        "-"
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">
                      {t("overview.discord")}
                    </p>
                    <p className="mt-0.5 text-sm break-words">
                      {discordConnected && user.discord_username
                        ? user.discord_username
                        : t("overview.notConnected")}
                    </p>
                  </div>
                  {/* Preferred UI language, read-only. Changed from Edit Profile.
                      Native language names stay in their own language by design. */}
                  <div>
                    <p className="text-xs text-muted-foreground">
                      {t("overview.language")}
                    </p>
                    <p className="mt-0.5 text-sm">
                      {{ en: "English", fr: "Français", pt: "Português" }[
                        user.language ?? "en"
                      ] ?? "English"}
                    </p>
                  </div>
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
                    {t("stats.loading")}
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
                      <TableHead>{t("history.team")}</TableHead>
                      <TableHead>{t("history.role")}</TableHead>
                      <TableHead>{t("history.from")}</TableHead>
                      <TableHead>{t("history.to")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loadingRich && !richProfile ? (
                      <TableRow>
                        <TableCell
                          colSpan={4}
                          className="text-center text-muted-foreground py-8"
                        >
                          {t("history.loading")}
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
                          {/* Join date rendered in the viewer's own timezone +
                              language via <LocalTime/> (was formatDate, which used
                              UTC + a hardcoded en-US locale). */}
                          {richProfile.join_date ? (
                            <LocalTime value={richProfile.join_date} mode="date" />
                          ) : (
                            "-"
                          )}
                        </TableCell>
                        <TableCell>{t("history.present")}</TableCell>
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
                        <TableCell>{t("history.present")}</TableCell>
                      </TableRow>
                    ) : (
                      <TableRow>
                        <TableCell
                          colSpan={4}
                          className="text-center text-muted-foreground py-8"
                        >
                          {t("history.empty")}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
                <p className="text-xs text-muted-foreground mt-3">
                  {t("history.note")}
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
                    {t("applications.loading")}
                  </div>
                ) : myApplications.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 py-10 text-muted-foreground">
                    <IconClipboardList className="h-10 w-10 opacity-40" />
                    <p className="text-sm font-medium">
                      {t("applications.emptyTitle")}
                    </p>
                    <p className="text-xs">{t("applications.emptyHint")}</p>
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
                              {/* applied_at localized to the viewer's timezone +
                                  language. formatLocalTime is the string form (the
                                  date is a t() parameter, not standalone JSX). */}
                              {t("applications.applied", {
                                date: formatLocalTime(
                                  app.applied_at,
                                  "date",
                                  locale,
                                ),
                              })}
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
                                {t("applications.contactUnlocked")}
                              </Badge>
                            )}

                            <Button size="sm" variant="outline" asChild>
                              <Link
                                href={`/player-markets/applications/${app.id}`}
                              >
                                {t("applications.view")}
                              </Link>
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </TabsContent>

              {/* My player reports (owner 2026-06-20): the reports this user filed
                  against other players + each admin's answer. Lazy-loads on tab open
                  (the component fetches /auth/my-player-reports/ on mount). */}
              <TabsContent value="reports">
                <MyPlayerReports />
              </TabsContent>
            </Tabs>
        </CardContent>
      </Card>

      {/* ══════════════════════════════════════════════════════════════════════
          ACCOUNT QUICK LINKS
          These were three stacked full-width cards, each a mostly-empty band with
          one button pinned to the far right. As a 3-up grid they occupy one row on
          desktop and still stack on a phone, which is what closed most of the
          remaining vertical dead space on this page.
          `items-stretch` + `h-full` keeps the three cards the same height when one
          description wraps to two lines.
          ══════════════════════════════════════════════════════════════════════ */}
      <div className="mt-6 grid grid-cols-1 items-stretch gap-4 md:grid-cols-3">
        {/* Saved addresses -> /profile/addresses (SavedAddresses.tsx), where the buyer
            reviews the delivery profiles reused at checkout (the picker in
            shop/_components/CartDetails.tsx). Copy from the `shop` namespace. */}
        <Card className="h-full">
          <CardContent className="flex h-full flex-col gap-3">
            <div className="flex-1">
              <h3 className="text-base font-semibold">
                {tShop("savedDelivery.profileCardTitle")}
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                {tShop("savedDelivery.profileCardDescription")}
              </p>
            </div>
            <Button variant="outline" className="w-full sm:w-auto" asChild>
              <Link href="/profile/addresses">
                {tShop("savedDelivery.manage")}
              </Link>
            </Button>
          </CardContent>
        </Card>

        {/* Connected apps -> /profile/connected-apps (ConnectedApps.tsx), where the
            player sees every partner org they signed into with "Sign in with AFC" and
            can cut one off. The consent screen those orgs show
            (backend/afc_sso/templates/afc_sso/authorize.html) promises this page by
            name, so this link is what makes that promise findable. */}
        <Card className="h-full">
          <CardContent className="flex h-full flex-col gap-3">
            <div className="flex-1">
              <h3 className="text-base font-semibold">
                {tConnected("profileCardTitle")}
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                {tConnected("profileCardDescription")}
              </p>
            </div>
            <Button variant="outline" className="w-full sm:w-auto" asChild>
              <Link href="/profile/connected-apps">{tConnected("manage")}</Link>
            </Button>
          </CardContent>
        </Card>

        {/* Sign-in security -> /profile/security (TwoFactorSecurity.tsx), where the
            player turns two-step sign-in on or off and manages their recovery codes.
            It is opt in, so this link is the only route to it for an ordinary player;
            admins and organizers also get a nudge (components/TwoFactorPrompt.tsx). */}
        <Card className="h-full">
          <CardContent className="flex h-full flex-col gap-3">
            <div className="flex-1">
              {/* NEW tag on the card title: two-step sign-in shipped 2026-08-06, and this
                  card is the only way an ordinary player finds it, so it is exactly the
                  "returning user would not otherwise notice it" case the rule is for.
                  Expires by itself 5 days on. Kept through the profile redesign: the
                  redesign is not itself a new feature and gets no badge of its own. */}
              <h3 className="flex flex-wrap items-center gap-2 text-base font-semibold">
                {tTwoFactor("profileCard.title")}
                <NewBadge since="2026-08-06" />
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                {tTwoFactor("profileCard.description")}
              </p>
            </div>
            <Button variant="outline" className="w-full sm:w-auto" asChild>
              <Link href="/profile/security">
                {tTwoFactor("profileCard.manage")}
              </Link>
            </Button>
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
  const t = useTranslations("profile");
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
            {t("achievementsPanel.pointsEarned")}
          </p>
          <p className="text-2xl font-bold text-primary">
            {earnedPoints}
            <span className="text-sm font-normal text-muted-foreground">
              {t("achievementsPanel.pointsSuffix", {
                total: TOTAL_POINTS_AVAILABLE,
              })}
            </span>
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t("achievementsPanel.unlockedCount", {
              earned: earnedCount,
              total: ACHIEVEMENTS.length,
            })}
          </p>
        </div>
        {/* Trophy badge mirrors the gold accent used across AFC stat surfaces. */}
        <Badge
          variant="outline"
          className="border-gold/60 text-gold self-start sm:self-auto"
        >
          <IconTrophy className="h-4 w-4 mr-1" />
          {t("achievementsPanel.pointsBadge", { points: earnedPoints })}
        </Badge>
      </div>

      {/* Honest note: the boost itself is a FUTURE feature, so we only promise it
          is coming, we do not apply it. */}
      <p className="text-xs text-muted-foreground bg-muted/40 border rounded-md px-3 py-2 mb-4">
        {t("achievementsPanel.comingSoonNote")}
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
            {/* Section label localized by id (Lifetime / Monthly / Daily). The
                catalog's English s.label is the fallback source only. */}
            {t(`achievementsPanel.sectionLabel.${s.id}`)}
          </button>
        ))}
      </div>

      {/* Per-section intro: lifetime ladders are computed; monthly/daily are goals. */}
      {section !== "lifetime" && (
        <p className="text-xs text-muted-foreground mb-4 flex items-center gap-1">
          <IconClock className="h-3.5 w-3.5" />
          {t("achievementsPanel.goalsNotTracked", {
            section:
              section === "monthly"
                ? t("achievementsPanel.section.monthly")
                : t("achievementsPanel.section.daily"),
          })}
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
  const t = useTranslations("profile");
  // The id of the next tier to chase: the first NOT-earned tier in catalog order.
  // For metric ladders this is the next threshold; once all are earned it is null.
  const nextLockedId = items.find((a) => !isEarned(a, ctx))?.id ?? null;

  // How many of this group's tiers are earned (small "x / y" group progress).
  const earnedInGroup = items.filter((a) => isEarned(a, ctx)).length;

  // Localized group header (Kills / Wins / Monthly Activity ...). The catalog's
  // English `group` string is mapped to its message key; unknown groups fall back
  // to the raw string so nothing ever renders blank.
  const groupKey = ACHIEVEMENT_GROUP_KEY[group];
  const groupLabel = groupKey
    ? t(`achievementsCatalog.group.${groupKey}`)
    : group;

  return (
    <div>
      {/* group header: label + earned count for the ladder */}
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-semibold text-foreground">{groupLabel}</h4>
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
  const t = useTranslations("profile");
  const Icon = achievement.icon;
  const earned = isEarned(achievement, ctx);
  const goal = isGoal(achievement);

  // ── Localized title + description for this catalog entry ──────────────────────
  // The catalog (achievements.ts) holds the English strings as the data + fallback
  // source; the UI renders the TRANSLATED text from the `achievementsCatalog` block.
  // Title is keyed by the entry id. Description is either a parameterized ladder
  // phrase ("Reach 1,000 kills.") for metric ladders, or a per-id sentence for
  // milestones/goals. A ladder is identified by having a metric + threshold.
  const isLadder =
    achievement.metric != null && achievement.threshold != null;
  const groupKey = ACHIEVEMENT_GROUP_KEY[achievement.group];
  const achTitle = t(`achievementsCatalog.title.${achievement.id}`);
  const achDescription = isLadder
    ? t("achievementsCatalog.ladderDesc", {
        count: achievement.threshold!.toLocaleString(),
        // Ladder groups all have a unit key; fall back to the lowercased group.
        unit: groupKey
          ? t(`achievementsCatalog.unit.${groupKey}`)
          : achievement.group.toLowerCase(),
      })
    : t(`achievementsCatalog.desc.${achievement.id}`);

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
            {achTitle}
          </p>
          {/* point value badge (gold when earned, outline-muted otherwise) */}
          <Badge
            variant="outline"
            className={`shrink-0 text-xs ${
              earned ? "border-gold/60 text-gold" : "text-muted-foreground"
            }`}
          >
            {t("achievementsPanel.tierPoints", { points: achievement.points })}
          </Badge>
        </div>

        {/* how-to-earn text (always shown so the catalog explains itself) */}
        <p className="text-xs text-muted-foreground mt-0.5">
          {achDescription}
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
              {/* unit (e.g. "kills") comes from the achievement's group label in
                  achievements.ts; the surrounding label is translated. */}
              {t("achievementsPanel.progressLabel", {
                value: (value as number).toLocaleString(),
                threshold: achievement.threshold!.toLocaleString(),
                // Localized unit (e.g. "kills") for the ladder group; falls back
                // to the lowercased English group when no key is mapped.
                unit: groupKey
                  ? t(`achievementsCatalog.unit.${groupKey}`)
                  : achievement.group.toLowerCase(),
              })}
            </p>
          </div>
        )}

        {/* status line: earned / next / locked / goal */}
        <div className="mt-1.5 flex items-center gap-1 text-xs">
          {earned ? (
            <span className="inline-flex items-center gap-1 text-primary font-medium">
              <IconCircleCheckFilled className="h-3.5 w-3.5" />
              {t("achievementsPanel.status.unlocked")}
            </span>
          ) : goal ? (
            <span className="inline-flex items-center gap-1 text-muted-foreground">
              <IconClock className="h-3.5 w-3.5" />
              {t("achievementsPanel.status.notTracked")}
            </span>
          ) : isNext ? (
            <span className="inline-flex items-center gap-1 text-primary font-medium">
              <IconShieldCheck className="h-3.5 w-3.5" />
              {t("achievementsPanel.status.upNext")}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-muted-foreground">
              <IconLock className="h-3.5 w-3.5" />
              {t("achievementsPanel.status.locked")}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
