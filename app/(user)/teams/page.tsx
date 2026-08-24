"use client";

import React, { useEffect, useState, useTransition } from "react";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/PageHeader";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import axios from "axios";
import { env } from "@/lib/env";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
// LocalTime renders a stored UTC timestamp in the viewer's own timezone + language.
import { LocalTime } from "@/components/LocalTime";
import { FullLoader, Loader } from "@/components/Loader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { ITEMS_PER_PAGE } from "@/constants";
import { TransferWindowBanner } from "@/components/rankings/TransferWindowBanner";
// Subtle clickable names -> public team / player profiles.
import { PlayerLink, TeamLink } from "@/components/ui/entity-link";
// Shared search matcher: punctuation/accent-insensitive + folds stylized "fancy font" IGNs.
import { matchesSearch } from "@/lib/search";
// Browse + claim ghost profiles WITHOUT going through the rankings ladder (owner 2026-08-24).
// A ghost that is not on a ladder previously had no row anywhere, so no claim was reachable.
import UnclaimedProfiles from "./_components/UnclaimedProfiles";
import { NewBadge } from "@/components/NewBadge";

function page() {
  // i18n: teams browse list copy (messages/en/teamsplayers.json -> "teamsList").
  const t = useTranslations("teamsplayers");
  // Scoped separately so the new block owns its own keys rather than widening the shared one.
  const tu = useTranslations("teamsplayers.unclaimed");
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [applicationMessage, setApplicationMessage] = useState("");
  const [selectedTeam, setSelectedTeam] = useState<any>(null);
  const { user, token } = useAuth();

  const [pending, startTransition] = useTransition();
  const [teams, setTeams] = useState<any[]>([]);
  const [myTeam, setMyTeam] = useState<any>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [appliedTeams, setAppliedTeams] = useState<Set<number>>(new Set());
  // Which list the All/Most-active pair is showing. Held here because the page owns pagination.
  const [tab, setTab] = useState<string>("all-teams");

  // Filter teams by the search box. Uses the shared matchesSearch (lib/search.ts) so the match is
  // punctuation/space/accent-insensitive AND folds stylized "fancy font" names: typing "ve" now finds
  // a team literally named "V-E", "Ｖ-Ｅ" or "ᴠᴇ". Matches across the name, tag and owner IGN.
  const filteredTeams = teams.filter((team) =>
    matchesSearch([team.team_name, team.team_tag, team.team_owner], search),
  );

  // ── ORDER (owner 2026-08-24) ────────────────────────────────────────────────────────────────
  // "by name, teams that start with numbers, then letter a then b etc". The list previously had NO
  // sort at all and rendered whatever order the API happened to return, which was newest-first by
  // team_id, so a name was impossible to find by eye.
  //
  // A plain localeCompare is not enough: it has to put DIGITS ahead of letters, and it has to sort
  // "10" after "9" rather than between "1" and "2". So each name gets a bucket (digit / letter /
  // anything else) and ties inside a bucket fall to a numeric-aware collator. Anything starting
  // with a symbol goes last: the owner did not specify, and burying punctuation is the readable
  // choice when the point is to find a name alphabetically.
  const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });
  const nameBucket = (name: string) => {
    const c = (name || "").trim().charAt(0);
    if (/[0-9]/.test(c)) return 0;
    if (/[a-z]/i.test(c)) return 1;
    return 2;
  };
  const byName = (a: any, b: any) => {
    const ba = nameBucket(a.team_name), bb = nameBucket(b.team_name);
    if (ba !== bb) return ba - bb;
    return collator.compare(a.team_name || "", b.team_name || "");
  };
  // Most active = events actually PLAYED, which the backend defines as a scored match line rather
  // than a registration, so this agrees with the number on the team's own page. Matches break a
  // tie, then the name, so the order is total and paging cannot repeat or drop a row.
  const byActivity = (a: any, b: any) =>
    (b.events_played ?? 0) - (a.events_played ?? 0) ||
    (b.matches_played ?? 0) - (a.matches_played ?? 0) ||
    byName(a, b);

  const sortedAll = [...filteredTeams].sort(byName);
  // The active tab lists only teams that have actually played. A team with nothing played is not
  // "least active", it is absent from this question, and padding the list with zeros would bury
  // the answer.
  const activeTeams = [...filteredTeams]
    .filter((tm) => (tm.events_played ?? 0) > 0)
    .sort(byActivity);

  const listForTab = tab === "active" ? activeTeams : sortedAll;
  const totalPages = Math.ceil(listForTab.length / ITEMS_PER_PAGE);
  const paginatedTeams = listForTab.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE,
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [search, tab]);

  useEffect(() => {
    startTransition(async () => {
      try {
        const res = await axios(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/team/get-all-teams/`,
        );

        if (res.statusText === "OK") {
          setTeams(res.data.teams);
        } else {
          toast.error(t("errors.generic"));
        }

        const resCurrent = await axios.post(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/team/get-user-current-team/`,
          {},
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );

        if (resCurrent.statusText === "OK") {
          setMyTeam(resCurrent.data.team);
        } else {
          toast.error(t("errors.generic"));
        }
      } catch (error: any) {
        toast.error(
          error?.response?.data.message || t("teamsList.loadError"),
        );
      }
    });
  }, [token]);

  const [pendingRequest, startRequestTransition] = useTransition();

  const handleApply = (teamId: any) => {
    startRequestTransition(async () => {
      try {
        const res = await axios.post(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/team/send-join-request/`,
          { team_id: teamId, message: applicationMessage },
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        );
        toast.success(res.data.message);

        // Add team to applied teams set
        setAppliedTeams((prev) => new Set(prev).add(teamId));

        // Close the dialog
        setDialogOpen(false);

        // Reset selected team and message
        setSelectedTeam(null);
        setApplicationMessage("");
      } catch (error: any) {
        toast.error(error.response.data.message);
      }
    });
  };

  if (pending) return <FullLoader />;

  return (
    <div>
      <div className="flex items-start mb-4 md:items-center justify-between gap-2 flex-col md:flex-row">
        <PageHeader
          title={t("teamsList.pageTitle")}
          description={t("teamsList.pageDescription")}
        />
        {/* data-tour anchor (guided welcome tour): Create Team button. Targeted by
            guided-tour-stops.ts -> teams stop -> "teams-create". */}
        <Button className="w-full md:w-auto" asChild data-tour="teams-create">
          <Link href="/teams/create">{t("teamsList.createTeam")}</Link>
        </Button>
      </div>

      {/* Transfer-window OPEN/CLOSED status - self-fetching the active ranking
          season; when CLOSED the backend freezes leave/kick/disband (afc_team),
          so this banner explains why those actions are blocked here. */}
      <TransferWindowBanner className="mb-4" />

      <div className="mb-4">
        <Input
          placeholder={t("teamsList.searchPlaceholder")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full"
        />
      </div>

      {/* data-tour anchor (guided welcome tour): the teams browse + join list.
          Targeted by guided-tour-stops.ts -> teams stop -> "teams-list". */}
      <Tabs value={tab} onValueChange={setTab} className="space-y-4" data-tour="teams-list">
        {/* WRAPS on a phone (owner 2026-08-24). Four tabs on one 390px row measured 421px and
            scrolled the whole page sideways. Wrapping to two rows is chosen over an overflow-x
            strip because all four stay visible: a tab a thumb has to discover by swiping is a tab
            most people never find, and "Most active" and "Unclaimed profiles" are the two new ones.
            h-auto because the shadcn TabsList is a fixed-height single row by default. */}
        <TabsList className="flex h-auto w-full flex-wrap gap-1">
          <TabsTrigger value="all-teams">{t("teamsList.tabAllTeams")}</TabsTrigger>
          <TabsTrigger value="active" className="gap-1.5">
            {t("teamsList.tabMostActive")}
            <NewBadge since="2026-08-24" />
          </TabsTrigger>
          <TabsTrigger value="my-team">{t("teamsList.tabMyTeam")}</TabsTrigger>
          <TabsTrigger value="unclaimed" className="gap-1.5">
            {tu("tabLabel")}
            <NewBadge since="2026-08-24" />
          </TabsTrigger>
        </TabsList>

        {/* One panel serves BOTH the all-teams and most-active tabs: the card grid is identical and
            only the ordering and the heading differ, so duplicating ~150 lines of JSX to change a
            sort would be the worse trade. `listForTab` above decides which list is paginated. */}
        <TabsContent value={tab === "active" ? "active" : "all-teams"} className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>
                {tab === "active" ? t("teamsList.mostActiveTitle") : t("teamsList.allTeamsTitle")}
              </CardTitle>
              <CardDescription>
                {tab === "active"
                  ? t("teamsList.mostActiveDescription")
                  : t("teamsList.allTeamsDescription")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                {paginatedTeams.length > 0 ? (
                  paginatedTeams.map((team: any) => (
                    <Card
                      key={team.team_name}
                      className={`card-hover gap-1.5 ${
                        team.is_banned ? "border-destructive" : ""
                      }`}
                    >
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 capitalize">
                          <Avatar className="w-10 h-10">
                            <AvatarImage
                              src={team.team_logo}
                              alt={`${team.team_name} logo`}
                              className="object-cover"
                            />
                            <AvatarFallback>{team.team_name[0]}</AvatarFallback>
                          </Avatar>
                          {/* Team name links to the public team page. */}
                          <TeamLink
                            name={team.team_name}
                            country={team.country}
                            className="uppercase text-lg md:text-xl"
                          />
                          {team.is_banned && (
                            <Badge variant="destructive">{t("teamsList.banned")}</Badge>
                          )}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="text-sm md:text-base">
                        {/* The team's own description, which the public could not see anywhere
                            (owner 2026-08-24): it rendered only on the owner's My Team panel and
                            on no public surface at all, so every team's blurb was written and then
                            hidden. Clamped to two lines so a long one cannot stretch the card. */}
                        {team.team_description && (
                          <p className="mb-2 line-clamp-2 text-xs text-muted-foreground">
                            {team.team_description}
                          </p>
                        )}
                        <p>
                          {t("teamsList.members", { count: team.member_count ? team.member_count : 0 })}
                        </p>
                        <p>{t("teamsList.tier", { tier: team.team_tier })}</p>
                        {/* On the Most active tab, show WHY the team is on it. A rank with no
                            number behind it is a claim the reader cannot check. */}
                        {tab === "active" && (
                          <p className="text-xs text-muted-foreground">
                            {t("teamsList.activityLine", {
                              events: team.events_played ?? 0,
                              matches: team.matches_played ?? 0,
                            })}
                          </p>
                        )}
                        <div className="flex gap-2 justify-between mt-6">
                          <Button
                            variant={"gradient"}
                            className="button-gradient flex-1"
                            asChild
                          >
                            <Link href={`/teams/${team.team_name}`}>
                              {t("teamsList.viewTeam")}
                            </Link>
                          </Button>
                          {team.team_owner !== user?.in_game_name && (
                            <Dialog
                              open={
                                dialogOpen &&
                                selectedTeam?.team_id === team.team_id
                              }
                              onOpenChange={(open) => {
                                setDialogOpen(open);
                                if (!open) {
                                  setSelectedTeam(null);
                                  setApplicationMessage("");
                                }
                              }}
                            >
                              <DialogTrigger asChild>
                                <Button
                                  variant="secondary"
                                  onClick={() => {
                                    setSelectedTeam(team);
                                    setDialogOpen(true);
                                  }}
                                  className="flex-1"
                                  disabled={
                                    team.is_banned ||
                                    team.member_count >= 6 ||
                                    appliedTeams.has(team.team_id)
                                  }
                                >
                                  {appliedTeams.has(team.team_id)
                                    ? t("teamsList.applied")
                                    : t("teamsList.applyToJoin")}
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>
                                    {t("teamsList.applyDialogTitle", { team: selectedTeam?.team_name })}
                                  </DialogTitle>
                                  <DialogDescription>
                                    {t("teamsList.applyDialogDescription")}
                                  </DialogDescription>
                                </DialogHeader>
                                <div className="grid gap-4 py-4">
                                  <div>
                                    <Label
                                      htmlFor="application-message"
                                      className="mb-2.5"
                                    >
                                      {t("teamsList.messageLabel")}
                                    </Label>
                                    <Textarea
                                      id="application-message"
                                      value={applicationMessage}
                                      onChange={(e) =>
                                        setApplicationMessage(e.target.value)
                                      }
                                      placeholder={t("teamsList.messagePlaceholder")}
                                    />
                                  </div>
                                </div>
                                <DialogFooter>
                                  <Button
                                    type="submit"
                                    disabled={pendingRequest}
                                    onClick={() =>
                                      handleApply(selectedTeam?.team_id)
                                    }
                                  >
                                    {pendingRequest ? (
                                      <Loader />
                                    ) : (
                                      t("teamsList.sendApplication")
                                    )}
                                  </Button>
                                </DialogFooter>
                              </DialogContent>
                            </Dialog>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))
                ) : (
                  <div className="col-span-full text-center text-muted-foreground py-8">
                    {search
                      ? t("teamsList.noTeamsMatch")
                      : t("teamsList.noTeamsAvailable")}
                  </div>
                )}
              </div>
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="hidden md:block text-sm text-muted-foreground">
                    {t("teamsList.showing", {
                      start: (currentPage - 1) * ITEMS_PER_PAGE + 1,
                      end: Math.min(currentPage * ITEMS_PER_PAGE, filteredTeams.length),
                      total: filteredTeams.length,
                    })}
                  </p>
                  <Pagination className="w-full md:w-auto mx-0">
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious
                          onClick={() =>
                            setCurrentPage((p) => Math.max(1, p - 1))
                          }
                          className={
                            currentPage === 1
                              ? "pointer-events-none opacity-50"
                              : "cursor-pointer"
                          }
                        />
                      </PaginationItem>
                      {Array.from({ length: totalPages }, (_, i) => i + 1)
                        .filter(
                          (page) =>
                            page === 1 ||
                            page === totalPages ||
                            Math.abs(page - currentPage) <= 1,
                        )
                        .map((page, idx, arr) => (
                          <React.Fragment key={page}>
                            {idx > 0 && arr[idx - 1] !== page - 1 && (
                              <PaginationItem>
                                <PaginationEllipsis />
                              </PaginationItem>
                            )}
                            <PaginationItem>
                              <PaginationLink
                                isActive={currentPage === page}
                                onClick={() => setCurrentPage(page)}
                                className="cursor-pointer"
                              >
                                {page}
                              </PaginationLink>
                            </PaginationItem>
                          </React.Fragment>
                        ))}
                      <PaginationItem>
                        <PaginationNext
                          onClick={() =>
                            setCurrentPage((p) => Math.min(totalPages, p + 1))
                          }
                          className={
                            currentPage === totalPages
                              ? "pointer-events-none opacity-50"
                              : "cursor-pointer"
                          }
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="my-team" className="space-y-4">
          {myTeam ? (
            <Card className={myTeam.is_banned ? "border-destructive" : ""}>
              <CardContent className="space-y-5">
                {/* Header */}
                <div className="flex items-center gap-4">
                  <Avatar className="h-16 w-16 rounded-lg border shrink-0">
                    <AvatarImage
                      src={myTeam.team_logo}
                      alt={`${myTeam.team_name} logo`}
                      className="object-cover"
                    />
                    <AvatarFallback className="rounded-lg text-lg font-bold">
                      {myTeam.team_name?.[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-lg font-semibold leading-tight truncate uppercase">
                        {/* Team name links to the public team page; flag = team's auto-derived country. */}
                        <TeamLink name={myTeam.team_name} country={myTeam.country} />
                      </h2>
                      {myTeam.team_tag && (
                        <Badge variant="outline" className="text-xs shrink-0">
                          [{myTeam.team_tag}]
                        </Badge>
                      )}
                      <Badge variant="outline" className="text-xs shrink-0">
                        {t("teamsList.tierLabel", { tier: myTeam.team_tier })}
                      </Badge>
                      {myTeam.is_banned && (
                        <Badge
                          variant="destructive"
                          className="text-xs shrink-0"
                        >
                          {t("teamsList.banned")}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                      {myTeam.country && <span>{myTeam.country}</span>}
                      <span>
                        {t("teamsList.memberCount", { count: myTeam.member_count ?? 0 })}
                      </span>
                      {myTeam.creation_date && (
                        <span>
                          {/* "Founded <month year>" in the viewer's timezone + language. */}
                          {t.rich("teamsList.founded", {
                            date: () => (
                              <LocalTime value={myTeam.creation_date} mode="date" />
                            ),
                          })}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {myTeam.team_description && (
                  <p className="text-sm text-muted-foreground leading-relaxed border-t pt-4">
                    {myTeam.team_description}
                  </p>
                )}

                {/* Stats grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="rounded-lg border bg-muted/30 p-3">
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wide">
                      {t("teamsList.yourRole")}
                    </p>
                    <p className="text-sm font-medium mt-0.5 capitalize">
                      {myTeam.user_role_in_team?.replace(/_/g, " ") ?? t("teamsList.roleMember")}
                    </p>
                  </div>
                  <div className="rounded-lg border bg-muted/30 p-3">
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wide">
                      {t("teamsList.owner")}
                    </p>
                    <p className="text-sm font-medium mt-0.5 truncate">
                      {/* Owner IGN links to the owner's public player profile. */}
                      <PlayerLink name={myTeam.team_owner} />
                    </p>
                  </div>
                  <div className="rounded-lg border bg-muted/30 p-3">
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wide">
                      {t("teamsList.joined")}
                    </p>
                    <p className="text-sm font-medium mt-0.5">
                      {/* Join date in the viewer's timezone + language. */}
                      {myTeam.join_date ? (
                        <LocalTime value={myTeam.join_date} mode="date" />
                      ) : (
                        "-"
                      )}
                    </p>
                  </div>
                  <div className="rounded-lg border bg-muted/30 p-3">
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wide">
                      {t("teamsList.joinPolicy")}
                    </p>
                    <p className="text-sm font-medium mt-0.5 capitalize">
                      {myTeam.join_settings?.replace(/_/g, " ") ?? "-"}
                    </p>
                  </div>
                  {myTeam.in_game_role && (
                    <div className="rounded-lg border bg-muted/30 p-3">
                      <p className="text-[11px] text-muted-foreground uppercase tracking-wide">
                        {t("teamsList.inGameRole")}
                      </p>
                      <p className="text-sm font-medium mt-0.5">
                        {myTeam.in_game_role}
                      </p>
                    </div>
                  )}
                </div>

                <div className="pt-1">
                  <Button
                    variant="gradient"
                    className="w-full button-gradient"
                    asChild
                  >
                    <Link href={`/teams/${myTeam.team_name}`}>
                      {t("teamsList.viewFullTeam")}
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="text-center text-muted-foreground py-12">
                {t("teamsList.notInTeam")}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── Unclaimed profiles (owner 2026-08-24) ──────────────────────────────────────────
            Ghost teams and players from tournaments AFC did not run. Previously reachable only
            from a ghost ROW on the rankings ladder, so anything not on a ladder could not be
            claimed at all. Same ClaimGhostDialog, reached without the ladder. */}
        <TabsContent value="unclaimed" className="space-y-4">
          <UnclaimedProfiles />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default page;
