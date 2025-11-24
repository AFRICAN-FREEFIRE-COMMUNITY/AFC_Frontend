"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Layout from "@/components/Layout";
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
import { Button } from "@/components/ui/button";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

// Mock function to simulate fetching a tournament
const fetchTournamentData = async (id: string) => {
  // In a real app, this would be an API call
  const tournaments = [
    {
      id: "1",
      name: "Summer Showdown",
      date: "2023-07-15",
      prizePool: 10000,
      location: "Online",
      format: "Battle Royale",
      participants: Array.from({ length: 15 }, (_, i) => `Team ${i + 1}`),
      description: "This is a sample Battle Royale tournament description.",
      stages: [
        { name: "Qualifiers", startDate: "2023-07-15", endDate: "2023-07-16" },
        { name: "Semi-Finals", startDate: "2023-07-22", endDate: "2023-07-23" },
        { name: "Finals", startDate: "2023-07-29", endDate: "2023-07-30" },
      ],
      streamChannel: "https://twitch.tv/summershowdown",
      leaderboards: {
        Qualifiers: {
          "Group A": [
            {
              rank: 1,
              team: "Team 1",
              killPoints: 50,
              placementPoints: 50,
              totalPoints: 100,
            },
            {
              rank: 2,
              team: "Team 2",
              killPoints: 45,
              placementPoints: 45,
              totalPoints: 90,
            },
          ],
        },
        "Semi-Finals": {
          "Group A": [
            {
              rank: 1,
              team: "Team 1",
              killPoints: 60,
              placementPoints: 60,
              totalPoints: 120,
            },
            {
              rank: 2,
              team: "Team 3",
              killPoints: 55,
              placementPoints: 55,
              totalPoints: 110,
            },
          ],
        },
        Finals: {
          "Final Standings": [
            {
              rank: 1,
              team: "Team 1",
              killPoints: 100,
              placementPoints: 100,
              totalPoints: 200,
            },
            {
              rank: 2,
              team: "Team 3",
              killPoints: 90,
              placementPoints: 90,
              totalPoints: 180,
            },
            {
              rank: 3,
              team: "Team 5",
              killPoints: 80,
              placementPoints: 80,
              totalPoints: 160,
            },
          ],
        },
      },
    },
    {
      id: "2",
      name: "Fall Classic",
      date: "2023-09-20",
      prizePool: 15000,
      location: "Physical",
      format: "Clash Squad",
      participants: Array.from({ length: 16 }, (_, i) => `Team ${i + 1}`),
      description: "This is a sample Clash Squad tournament description.",
      stages: [
        { name: "Group Stage", startDate: "2023-09-20", endDate: "2023-09-21" },
        {
          name: "Quarter-Finals",
          startDate: "2023-09-27",
          endDate: "2023-09-28",
        },
        { name: "Semi-Finals", startDate: "2023-10-04", endDate: "2023-10-05" },
        { name: "Finals", startDate: "2023-10-11", endDate: "2023-10-12" },
      ],
      streamChannel: "https://twitch.tv/fallclassic",
      leaderboards: {
        "Group Stage": {
          "Group A": [
            {
              rank: 1,
              team: "Team 1",
              wins: 3,
              losses: 0,
              kills: 45,
              damage: 5000,
            },
            {
              rank: 2,
              team: "Team 2",
              wins: 2,
              losses: 1,
              kills: 38,
              damage: 4500,
            },
            {
              rank: 3,
              team: "Team 3",
              wins: 1,
              losses: 2,
              kills: 30,
              damage: 4000,
            },
            {
              rank: 4,
              team: "Team 4",
              wins: 0,
              losses: 3,
              kills: 25,
              damage: 3500,
            },
          ],
          "Group B": [
            {
              rank: 1,
              team: "Team 5",
              wins: 3,
              losses: 0,
              kills: 42,
              damage: 4800,
            },
            {
              rank: 2,
              team: "Team 6",
              wins: 2,
              losses: 1,
              kills: 36,
              damage: 4300,
            },
            {
              rank: 3,
              team: "Team 7",
              wins: 1,
              losses: 2,
              kills: 28,
              damage: 3900,
            },
            {
              rank: 4,
              team: "Team 8",
              wins: 0,
              losses: 3,
              kills: 22,
              damage: 3400,
            },
          ],
        },
        "Quarter-Finals": {
          Matches: [
            {
              rank: 1,
              team: "Team 1",
              wins: 2,
              losses: 0,
              kills: 30,
              damage: 3500,
            },
            {
              rank: 2,
              team: "Team 5",
              wins: 0,
              losses: 2,
              kills: 18,
              damage: 2800,
            },
          ],
        },
        "Semi-Finals": {
          Matches: [
            {
              rank: 1,
              team: "Team 1",
              wins: 2,
              losses: 1,
              kills: 35,
              damage: 4000,
            },
            {
              rank: 2,
              team: "Team 6",
              wins: 1,
              losses: 2,
              kills: 28,
              damage: 3500,
            },
          ],
        },
        Finals: {
          "Final Standings": [
            {
              rank: 1,
              team: "Team 1",
              wins: 3,
              losses: 2,
              kills: 50,
              damage: 5500,
            },
            {
              rank: 2,
              team: "Team 6",
              wins: 2,
              losses: 3,
              kills: 45,
              damage: 5000,
            },
          ],
        },
      },
      clashSquadMatches: [
        {
          round: "Group Stage",
          matches: [
            {
              match: 1,
              teamA: "Team 1",
              teamB: "Team 2",
              winner: "Team 1",
              score: "4-2",
              teamAKills: 20,
              teamBKills: 15,
              teamADamage: 2500,
              teamBDamage: 2000,
            },
            {
              match: 2,
              teamA: "Team 3",
              teamB: "Team 4",
              winner: "Team 3",
              score: "4-1",
              teamAKills: 18,
              teamBKills: 12,
              teamADamage: 2300,
              teamBDamage: 1800,
            },
          ],
        },
        {
          round: "Finals",
          matches: [
            {
              match: 1,
              teamA: "Team 1",
              teamB: "Team 6",
              winner: "Team 1",
              score: "4-3",
              teamAKills: 25,
              teamBKills: 22,
              teamADamage: 3000,
              teamBDamage: 2800,
            },
            {
              match: 2,
              teamA: "Team 1",
              teamB: "Team 6",
              winner: "Team 6",
              score: "4-2",
              teamAKills: 20,
              teamBKills: 24,
              teamADamage: 2700,
              teamBDamage: 3100,
            },
            {
              match: 3,
              teamA: "Team 1",
              teamB: "Team 6",
              winner: "Team 1",
              score: "4-1",
              teamAKills: 28,
              teamBKills: 18,
              teamADamage: 3200,
              teamBDamage: 2500,
            },
          ],
        },
      ],
    },
    {
      id: "3",
      name: "Hybrid Championship",
      date: "2023-10-15",
      prizePool: 25000,
      location: "Online",
      format: "Hybrid",
      participants: Array.from({ length: 20 }, (_, i) => `Team ${i + 1}`),
      description:
        "The ultimate hybrid tournament combining Battle Royale and Clash Squad formats.",
      stages: [
        { name: "Qualifiers", startDate: "2023-10-15", endDate: "2023-10-16" },
        { name: "Semi-Finals", startDate: "2023-10-22", endDate: "2023-10-23" },
        { name: "Finals", startDate: "2023-10-29", endDate: "2023-10-30" },
      ],
      streamChannel: "https://twitch.tv/hybridchampionship",
      leaderboards: {
        Qualifiers: {
          "Group A": [
            {
              rank: 1,
              team: "Team 1",
              killPoints: 50,
              placementPoints: 50,
              totalPoints: 100,
            },
            {
              rank: 2,
              team: "Team 2",
              killPoints: 45,
              placementPoints: 45,
              totalPoints: 90,
            },
          ],
          "Group B": [
            {
              rank: 1,
              team: "Team 11",
              killPoints: 48,
              placementPoints: 48,
              totalPoints: 96,
            },
            {
              rank: 2,
              team: "Team 12",
              killPoints: 43,
              placementPoints: 43,
              totalPoints: 86,
            },
          ],
        },
        "Semi-Finals": {
          Matches: [
            {
              rank: 1,
              team: "Team 1",
              wins: 3,
              losses: 1,
              kills: 40,
              damage: 5000,
            },
            {
              rank: 2,
              team: "Team 2",
              wins: 2,
              losses: 2,
              kills: 35,
              damage: 4500,
            },
            {
              rank: 3,
              team: "Team 11",
              wins: 2,
              losses: 2,
              kills: 33,
              damage: 4300,
            },
            {
              rank: 4,
              team: "Team 12",
              wins: 1,
              losses: 3,
              kills: 30,
              damage: 4000,
            },
          ],
        },
        Finals: {
          "Final Standings": [
            {
              rank: 1,
              team: "Team 1",
              wins: 3,
              losses: 1,
              kills: 45,
              damage: 5500,
            },
            {
              rank: 2,
              team: "Team 2",
              wins: 2,
              losses: 2,
              kills: 40,
              damage: 5000,
            },
            {
              rank: 3,
              team: "Team 11",
              wins: 1,
              losses: 3,
              kills: 35,
              damage: 4500,
            },
          ],
        },
      },
      stageFormats: {
        Qualifiers: "Battle Royale",
        "Semi-Finals": "Clash Squad",
        Finals: "Clash Squad",
      },
      clashSquadMatches: [
        {
          round: "Semi-Finals",
          matches: [
            {
              match: 1,
              teamA: "Team 1",
              teamB: "Team 12",
              winner: "Team 1",
              score: "4-2",
              teamAKills: 20,
              teamBKills: 15,
              teamADamage: 2500,
              teamBDamage: 2000,
            },
            {
              match: 2,
              teamA: "Team 2",
              teamB: "Team 11",
              winner: "Team 2",
              score: "4-3",
              teamAKills: 18,
              teamBKills: 20,
              teamADamage: 2300,
              teamBDamage: 2500,
            },
          ],
        },
        {
          round: "Finals",
          matches: [
            {
              match: 1,
              teamA: "Team 1",
              teamB: "Team 2",
              winner: "Team 1",
              score: "4-3",
              teamAKills: 25,
              teamBKills: 22,
              teamADamage: 3000,
              teamBDamage: 2800,
            },
            {
              match: 2,
              teamA: "Team 1",
              teamB: "Team 2",
              winner: "Team 2",
              score: "4-2",
              teamAKills: 20,
              teamBKills: 24,
              teamADamage: 2700,
              teamBDamage: 3100,
            },
            {
              match: 3,
              teamA: "Team 1",
              teamB: "Team 2",
              winner: "Team 1",
              score: "4-1",
              teamAKills: 28,
              teamBKills: 18,
              teamADamage: 3200,
              teamBDamage: 2500,
            },
          ],
        },
      ],
    },
    {
      id: "4",
      name: "Spring Championship 2025",
      date: "2025-03-15",
      prizePool: 25000,
      location: "Online",
      format: "Hybrid",
      participants: [],
      description:
        "The biggest hybrid championship featuring Battle Royale qualifiers and Clash Squad finals. This tournament will bring together the most skilled teams from across the region for the ultimate test of versatility and skill.",
      stages: [
        { name: "Qualifiers", startDate: "2025-03-15", endDate: "2025-03-16" },
        { name: "Semi-Finals", startDate: "2025-03-22", endDate: "2025-03-23" },
        { name: "Finals", startDate: "2025-03-29", endDate: "2025-03-30" },
      ],
      streamChannel: "https://twitch.tv/springchampionship2025",
      leaderboards: {},
      stageFormats: {
        Qualifiers: "Battle Royale",
        "Semi-Finals": "Clash Squad",
        Finals: "Clash Squad",
      },
      registrationDeadline: "2025-02-28",
      registrationUrl: "/news/spring-championship-2025-registration",
      newsPostId: "spring-championship-2025-registration",
      newsPost: {
        id: "spring-championship-2025-registration",
        title: "Spring Championship 2025 - Registration Now Open!",
        content: `
          <div class="space-y-4">
            <p>We are thrilled to announce the <strong>Spring Championship 2025</strong> - the biggest hybrid tournament of the year!</p>
            
            <h3 class="text-xl font-semibold mt-6 mb-3">Tournament Details:</h3>
            <ul class="list-disc list-inside space-y-2">
              <li><strong>Format:</strong> Hybrid (Battle Royale + Clash Squad)</li>
              <li><strong>Prize Pool:</strong> $25,000</li>
              <li><strong>Location:</strong> Online</li>
              <li><strong>Registration Deadline:</strong> February 28, 2025</li>
            </ul>
            
            <h3 class="text-xl font-semibold mt-6 mb-3">Tournament Schedule & Formats:</h3>
            <ul class="list-disc list-inside space-y-2">
              <li><strong>Qualifiers:</strong> March 15-16, 2025 (Battle Royale)</li>
              <li><strong>Semi-Finals:</strong> March 22-23, 2025 (Clash Squad)</li>
              <li><strong>Finals:</strong> March 29-30, 2025 (Clash Squad)</li>
            </ul>
            
            <p>This hybrid format will test teams across both game modes, requiring mastery of Battle Royale strategy and Clash Squad tactics. Only the most versatile teams will advance to claim the championship title and prize money!</p>
            
            <h3 class="text-xl font-semibold mt-6 mb-3">Registration Requirements:</h3>
            <ul class="list-disc list-inside space-y-2">
              <li>Teams must have 5 registered players + 1 substitute</li>
              <li>All players must be verified on the AFC platform</li>
              <li>Team must have competed in at least 2 previous tournaments</li>
              <li>Registration fee: $50 per team</li>
            </ul>
            
            <p class="bg-blue-50 p-4 rounded-md"><strong>Early Bird Special:</strong> Teams registering before February 15th get a 20% discount on registration fees!</p>
            
            <p>Don't miss your chance to compete for glory and the biggest prize pool of the spring season!</p>
          </div>
        `,
        date: "2025-01-15T10:00:00Z",
        author: {
          name: "AFC Tournament Committee",
          avatar: "/placeholder.svg?height=40&width=40",
          role: "Tournament Director",
        },
        image:
          "/placeholder.svg?height=400&width=800&text=Spring+Championship+2025",
        category: "tournament-updates",
        registrationLink:
          "https://register.afc-esports.com/spring-championship-2025",
        likes: 127,
        dislikes: 3,
      },
    },
    {
      id: "5",
      name: "AFC Elite Tournament",
      date: "2025-04-20",
      prizePool: 30000,
      location: "Physical",
      format: "Battle Royale",
      participants: [],
      description:
        "The most prestigious Battle Royale tournament of the year, featuring the top 16 teams competing in a live LAN environment for the biggest prize pool in AFC history.",
      stages: [
        { name: "Group Stage", startDate: "2025-04-20", endDate: "2025-04-21" },
        { name: "Playoffs", startDate: "2025-04-26", endDate: "2025-04-27" },
        {
          name: "Grand Finals",
          startDate: "2025-05-03",
          endDate: "2025-05-04",
        },
      ],
      streamChannel: "https://twitch.tv/afc-elite-2025",
      leaderboards: {},
      registrationDeadline: "2025-04-05",
      registrationUrl: "/news/afc-elite-tournament-2025",
      newsPostId: "afc-elite-tournament-2025",
      newsPost: {
        id: "afc-elite-tournament-2025",
        title: "AFC Elite Tournament 2025 - Premium Competition",
        content: `
          <div class="space-y-4">
            <p>Prepare for the ultimate Battle Royale experience at the <strong>AFC Elite Tournament 2025</strong> - our most exclusive and prestigious competition!</p>
            
            <h3 class="text-xl font-semibold mt-6 mb-3">Tournament Details:</h3>
            <ul class="list-disc list-inside space-y-2">
              <li><strong>Format:</strong> Battle Royale</li>
              <li><strong>Prize Pool:</strong> $30,000 (Biggest in AFC history!)</li>
              <li><strong>Location:</strong> Live LAN Event - Lagos, Nigeria</li>
              <li><strong>Registration Deadline:</strong> April 5, 2025</li>
              <li><strong>Limited to:</strong> Top 16 teams only</li>
            </ul>
            
            <h3 class="text-xl font-semibold mt-6 mb-3">Tournament Schedule:</h3>
            <ul class="list-disc list-inside space-y-2">
              <li><strong>Group Stage:</strong> April 20-21, 2025</li>
              <li><strong>Playoffs:</strong> April 26-27, 2025</li>
              <li><strong>Grand Finals:</strong> May 3-4, 2025</li>
            </ul>
            
            <h3 class="text-xl font-semibold mt-6 mb-3">Qualification Criteria:</h3>
            <ul class="list-disc list-inside space-y-2">
              <li>Team must be ranked in top 20 on AFC leaderboards</li>
              <li>Must have won at least 1 major tournament in the past 6 months</li>
              <li>All team members must pass skill verification tests</li>
              <li>Complete medical and travel documentation required</li>
            </ul>
            
            <div class="bg-gradient-to-r from-yellow-50 to-yellow-100 p-4 rounded-md border-l-4 border-yellow-400">
              <p><strong>🏆 Prize Distribution:</strong></p>
              <ul class="list-disc list-inside mt-2 space-y-1">
                <li>1st Place: $15,000 + Trophy + Medals</li>
                <li>2nd Place: $8,000 + Trophy</li>
                <li>3rd Place: $4,000 + Trophy</li>
                <li>4th-8th Place: $1,000 each</li>
                <li>9th-16th Place: $500 each</li>
              </ul>
            </div>
            
            <p class="bg-red-50 p-4 rounded-md border-l-4 border-red-400">
              <strong>⚠️ Important:</strong> This is an invitation-only tournament. Teams will be selected based on performance and qualification criteria. Travel and accommodation support provided for qualifying teams.
            </p>
            
            <p>This is your chance to compete with the absolute best and claim the title of AFC Elite Champions!</p>
          </div>
        `,
        date: "2025-02-01T14:00:00Z",
        author: {
          name: "AFC Elite Committee",
          avatar: "/placeholder.svg?height=40&width=40",
          role: "Elite Tournament Director",
        },
        image:
          "/placeholder.svg?height=400&width=800&text=AFC+Elite+Tournament+2025",
        category: "tournament-updates",
        registrationLink: "https://elite.afc-esports.com/tournament-2025",
        likes: 203,
        dislikes: 5,
      },
    },
  ];

  return tournaments.find((t) => t.id === id);
};

const isUpcoming = (date: string) => {
  return new Date(date) > new Date();
};

export default function TournamentDetails() {
  const params = useParams();
  const [tournament, setTournament] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedGroups, setSelectedGroups] = useState({});
  const router = useRouter();

  useEffect(() => {
    const fetchTournament = async () => {
      try {
        const data = await fetchTournamentData(params.id);
        if (data) {
          setTournament(data);
          const initialSelectedGroups = {};
          data.stages.forEach((stage) => {
            if (data.leaderboards[stage.name]) {
              initialSelectedGroups[stage.name] = Object.keys(
                data.leaderboards[stage.name]
              )[0];
            }
          });
          setSelectedGroups(initialSelectedGroups);
        } else {
          setError("Tournament not found");
        }
        setIsLoading(false);
      } catch (err) {
        setError("Failed to fetch tournament details");
        setIsLoading(false);
      }
    };

    fetchTournament();
  }, [params.id]);

  if (isLoading) return <Layout>Loading tournament details...</Layout>;
  if (error) return <Layout>Error: {error}</Layout>;
  if (!tournament) return <Layout>Tournament not found</Layout>;

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <Button
          variant="outline"
          onClick={() => router.back()}
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              {tournament.name}
              {isUpcoming(tournament.date) && (
                <Badge
                  variant="secondary"
                  className="bg-green-100 text-green-800"
                >
                  Upcoming
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div>
                <p>
                  <strong>Date:</strong> {tournament.date}
                </p>
                <p>
                  <strong>Prize Pool:</strong> $
                  {tournament.prizePool.toLocaleString()}
                </p>
              </div>
              <div>
                <p>
                  <strong>Location:</strong> {tournament.location}
                </p>
                <p>
                  <strong>Format:</strong> {tournament.format}
                </p>
              </div>
            </div>

            {tournament.participants.length > 0 && (
              <p>
                <strong>Participants:</strong> {tournament.participants.length}{" "}
                teams
              </p>
            )}

            <p className="mt-4 text-gray-700">{tournament.description}</p>

            {isUpcoming(tournament.date) ? (
              <div className="mt-6">
                {/* Show News Post Content for Upcoming Tournaments */}
                {tournament.newsPost && (
                  <Card className="mt-6">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        Tournament Announcement
                        <Badge variant="outline">
                          {tournament.newsPost.category}
                        </Badge>
                      </CardTitle>
                      <div className="text-sm text-muted-foreground">
                        Published by {tournament.newsPost.author.name} (
                        {tournament.newsPost.author.role}) •{" "}
                        {new Date(
                          tournament.newsPost.date
                        ).toLocaleDateString()}
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div
                        className="prose max-w-none mb-6"
                        dangerouslySetInnerHTML={{
                          __html: tournament.newsPost.content,
                        }}
                      />

                      <div className="flex gap-4 mt-6">
                        {tournament.newsPost.registrationLink && (
                          <Button
                            asChild
                            className="bg-green-600 hover:bg-green-700"
                          >
                            <a
                              href={tournament.newsPost.registrationLink}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              Register Now{" "}
                              <ExternalLink className="ml-2 h-4 w-4" />
                            </a>
                          </Button>
                        )}
                        <Button variant="outline" asChild>
                          <Link href={`/news/${tournament.newsPostId}`}>
                            View Full News Post{" "}
                            <ExternalLink className="ml-2 h-4 w-4" />
                          </Link>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Tournament Schedule */}
                <Card className="mt-6">
                  <CardHeader>
                    <CardTitle>Tournament Schedule</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {tournament.stages.map((stage, index) => (
                        <div
                          key={index}
                          className="flex justify-between items-center p-4 bg-gray-50 rounded-md"
                        >
                          <div>
                            <h4 className="font-semibold text-lg">
                              {stage.name}
                            </h4>
                            {tournament.stageFormats &&
                              tournament.stageFormats[stage.name] && (
                                <Badge variant="outline" className="mt-1">
                                  {tournament.stageFormats[stage.name]}
                                </Badge>
                              )}
                          </div>
                          <div className="text-right text-sm text-muted-foreground">
                            <div className="font-medium">{stage.startDate}</div>
                            <div>to {stage.endDate}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Registration Information */}
                <Card className="mt-6">
                  <CardHeader>
                    <CardTitle>Registration Information</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {tournament.registrationDeadline && (
                        <p className="text-lg">
                          <strong>Registration Deadline:</strong>
                          <span className="ml-2 px-2 py-1 bg-red-100 text-red-800 rounded">
                            {tournament.registrationDeadline}
                          </span>
                        </p>
                      )}
                      {tournament.streamChannel && (
                        <p>
                          <strong>Stream Channel:</strong>{" "}
                          <a
                            href={tournament.streamChannel}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline"
                          >
                            {tournament.streamChannel}
                          </a>
                        </p>
                      )}
                      {tournament.newsPost &&
                        tournament.newsPost.registrationLink && (
                          <div className="mt-4 p-4 bg-blue-50 rounded-md">
                            <p className="text-blue-800 font-medium mb-2">
                              Ready to compete?
                            </p>
                            <Button
                              asChild
                              size="lg"
                              className="bg-blue-600 hover:bg-blue-700"
                            >
                              <a
                                href={tournament.newsPost.registrationLink}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                Register Your Team Now{" "}
                                <ExternalLink className="ml-2 h-4 w-4" />
                              </a>
                            </Button>
                          </div>
                        )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <Tabs defaultValue={tournament.stages[0].name} className="mt-6">
                <TabsList>
                  {tournament.stages.map((stage) => (
                    <TabsTrigger key={stage.name} value={stage.name}>
                      {stage.name}
                    </TabsTrigger>
                  ))}
                </TabsList>
                {tournament.stages.map((stage) => (
                  <TabsContent key={stage.name} value={stage.name}>
                    <Card>
                      <CardHeader>
                        <CardTitle>
                          {stage.name} -{" "}
                          {tournament.stageFormats?.[stage.name] ||
                            tournament.format}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <Accordion type="single" collapsible className="mb-4">
                          <AccordionItem value="dates">
                            <AccordionTrigger>
                              View Stage Dates
                            </AccordionTrigger>
                            <AccordionContent>
                              <p>
                                <strong>Start Date:</strong> {stage.startDate}
                              </p>
                              <p>
                                <strong>End Date:</strong> {stage.endDate}
                              </p>
                            </AccordionContent>
                          </AccordionItem>
                        </Accordion>
                        {tournament.leaderboards[stage.name] ? (
                          <>
                            {tournament.format === "Clash Squad" ||
                            tournament.stageFormats?.[stage.name] ===
                              "Clash Squad" ? (
                              <div className="mt-4">
                                <h4 className="text-lg font-semibold mb-2">
                                  Leaderboard
                                </h4>
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead>Rank</TableHead>
                                      <TableHead>Team</TableHead>
                                      <TableHead>Wins</TableHead>
                                      <TableHead>Losses</TableHead>
                                      <TableHead>Kills</TableHead>
                                      <TableHead>Damage</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {Object.values(
                                      tournament.leaderboards[stage.name]
                                    )
                                      .flat()
                                      .map((entry, index) => (
                                        <TableRow key={index}>
                                          <TableCell>{entry.rank}</TableCell>
                                          <TableCell>{entry.team}</TableCell>
                                          <TableCell>{entry.wins}</TableCell>
                                          <TableCell>{entry.losses}</TableCell>
                                          <TableCell>{entry.kills}</TableCell>
                                          <TableCell>{entry.damage}</TableCell>
                                        </TableRow>
                                      ))}
                                  </TableBody>
                                </Table>
                                {tournament.clashSquadMatches &&
                                  tournament.clashSquadMatches.find(
                                    (round) => round.round === stage.name
                                  ) && (
                                    <div className="mt-6">
                                      <h4 className="text-lg font-semibold mb-2">
                                        Matches
                                      </h4>
                                      <Table>
                                        <TableHeader>
                                          <TableRow>
                                            <TableHead>Match</TableHead>
                                            <TableHead>Team A</TableHead>
                                            <TableHead>Team B</TableHead>
                                            <TableHead>Winner</TableHead>
                                            <TableHead>Score</TableHead>
                                            <TableHead>Team A Kills</TableHead>
                                            <TableHead>Team B Kills</TableHead>
                                            <TableHead>Team A Damage</TableHead>
                                            <TableHead>Team B Damage</TableHead>
                                          </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                          {tournament.clashSquadMatches
                                            .find(
                                              (round) =>
                                                round.round === stage.name
                                            )
                                            .matches.map((match, index) => (
                                              <TableRow key={index}>
                                                <TableCell>
                                                  {match.match}
                                                </TableCell>
                                                <TableCell>
                                                  {match.teamA}
                                                </TableCell>
                                                <TableCell>
                                                  {match.teamB}
                                                </TableCell>
                                                <TableCell>
                                                  {match.winner}
                                                </TableCell>
                                                <TableCell>
                                                  {match.score}
                                                </TableCell>
                                                <TableCell>
                                                  {match.teamAKills}
                                                </TableCell>
                                                <TableCell>
                                                  {match.teamBKills}
                                                </TableCell>
                                                <TableCell>
                                                  {match.teamADamage}
                                                </TableCell>
                                                <TableCell>
                                                  {match.teamBDamage}
                                                </TableCell>
                                              </TableRow>
                                            ))}
                                        </TableBody>
                                      </Table>
                                    </div>
                                  )}
                              </div>
                            ) : (
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>Rank</TableHead>
                                    <TableHead>Team</TableHead>
                                    <TableHead>Kill Points</TableHead>
                                    <TableHead>Placement Points</TableHead>
                                    <TableHead>Total Points</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {Object.values(
                                    tournament.leaderboards[stage.name]
                                  )
                                    .flat()
                                    .map((entry, index) => (
                                      <TableRow key={index}>
                                        <TableCell>{entry.rank}</TableCell>
                                        <TableCell>{entry.team}</TableCell>
                                        <TableCell>
                                          {entry.killPoints}
                                        </TableCell>
                                        <TableCell>
                                          {entry.placementPoints}
                                        </TableCell>
                                        <TableCell>
                                          {entry.totalPoints}
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                </TableBody>
                              </Table>
                            )}
                          </>
                        ) : (
                          <p>
                            No leaderboard data available for this stage yet.
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  </TabsContent>
                ))}
              </Tabs>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
