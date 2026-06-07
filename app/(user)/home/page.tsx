"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Trophy, Users, Calendar, BarChart2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/PageHeader";
import { HomeBoxes } from "../_components/HomeBoxes";
// Two compact blocks (latest events + latest player-market posts) added below the
// stat boxes per the approved home-additions mockup.
import { HomeLatestSections } from "../_components/HomeLatestSections";
import { LatestNews } from "../_components/LatestNews";
import { useEffect, useState } from "react";
import { FeaturedShop } from "../_components/FeaturedShop";
import { quarterlyTiers, teamRankings } from "@/constants";
import { ProtectedRoute } from "../_components/ProtectedRoute";
// Subtle clickable team name -> public team page.
import { TeamLink } from "@/components/ui/entity-link";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useRouter } from "next/navigation";

function SponsorRedirectModal() {
  const { user } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (user?.roles?.includes("sponsor_admin")) {
      setOpen(true);
    }
  }, [user]);

  function handleRedirect() {
    setOpen(false);
    router.push("/a/sponsor-dashboard");
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sponsor Dashboard Available</DialogTitle>
          <DialogDescription>
            You have a sponsor admin account. Would you like to go to your
            Sponsor Dashboard instead?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Stay Here
          </Button>
          <Button onClick={handleRedirect}>Go to Sponsor Dashboard</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function HomePage() {
  return (
    <ProtectedRoute>
      <SponsorRedirectModal />
      <PageHeader
        title="Welcome to AFC"
        description="Your hub for African Freefire community stats and events"
      />
      <HomeBoxes />
      <div className="grid gap-2 md:grid-cols-2 mb-4">
        <div>
          <LatestNews />
        </div>

        <div>
          {/* Real, live storefront teaser (was a mock list behind a "Coming Soon"
              overlay). Fetches active products from the public shop endpoint. */}
          <FeaturedShop />
        </div>
      </div>
      {/* Latest events + player-market posts sit below the News/Shop row and above
          the Rankings & Tiers table, per the approved layout. */}
      <HomeLatestSections />
      <Card>
        <CardHeader>
          <CardTitle>Rankings and Tiers</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="rankings" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-2">
              <TabsTrigger value="rankings">Current Rankings</TabsTrigger>
              <TabsTrigger value="tiers">Quarterly Tiers</TabsTrigger>
            </TabsList>

            <TabsContent value="rankings">
              <p className="text-sm text-muted-foreground mb-4">
                Team rankings based on overall performance metrics
              </p>
              <div className="overflow-x-auto rounded-md border max-h-96 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Rank</TableHead>
                      <TableHead>Team</TableHead>
                      <TableHead>Points</TableHead>
                      <TableHead>Wins</TableHead>
                      <TableHead>Kills</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {teamRankings.map((team) => (
                      <TableRow key={team.team}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {team.rank <= 3 && (
                              <Trophy
                                className={`h-4 w-4 ${
                                  team.rank === 1
                                    ? "text-yellow-500"
                                    : team.rank === 2
                                      ? "text-gray-400"
                                      : "text-amber-600"
                                }`}
                              />
                            )}
                            <span className="font-medium">{team.rank}</span>
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">
                          {/* Team name links to the public team page. */}
                          <TeamLink name={team.team} />
                        </TableCell>
                        <TableCell>{team.points}</TableCell>
                        <TableCell>{team.tournamentWins}</TableCell>
                        <TableCell>{team.kills}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="tiers">
              <p className="text-sm text-muted-foreground mb-4">
                Third quarter tier standings (July - September)
              </p>
              <div className="overflow-x-auto rounded-md border max-h-96 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tier</TableHead>
                      <TableHead>Team</TableHead>
                      <TableHead>Points</TableHead>
                      <TableHead>Apr</TableHead>
                      <TableHead>May</TableHead>
                      <TableHead>Jun</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {quarterlyTiers.map((team) => (
                      <TableRow key={team.team}>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={
                              team.tier === "Tier 1"
                                ? "border-green-500 text-green-600 dark:text-green-400"
                                : team.tier === "Tier 2"
                                  ? "border-blue-500 text-blue-600 dark:text-blue-400"
                                  : "border-orange-500 text-orange-600 dark:text-orange-400"
                            }
                          >
                            {team.tier}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium">
                          {/* Team name links to the public team page. */}
                          <TeamLink name={team.team} />
                        </TableCell>
                        <TableCell className="font-medium">
                          {team.points}
                        </TableCell>
                        <TableCell>{team.july}</TableCell>
                        <TableCell>{team.august}</TableCell>
                        <TableCell>{team.september}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </ProtectedRoute>
  );
}
