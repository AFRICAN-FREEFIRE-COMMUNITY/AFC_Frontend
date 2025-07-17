"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import Layout from "@/components/Layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import { useRouter } from "next/navigation"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"

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
            { rank: 1, team: "Team 1", killPoints: 50, placementPoints: 50, totalPoints: 100 },
            { rank: 2, team: "Team 2", killPoints: 45, placementPoints: 45, totalPoints: 90 },
            // ... more teams
          ],
          // ... more groups
        },
        "Semi-Finals": {
          "Group A": [
            { rank: 1, team: "Team 1", killPoints: 60, placementPoints: 60, totalPoints: 120 },
            { rank: 2, team: "Team 3", killPoints: 55, placementPoints: 55, totalPoints: 110 },
            // ... more teams
          ],
        },
        Finals: {
          "Final Standings": [
            { rank: 1, team: "Team 1", killPoints: 100, placementPoints: 100, totalPoints: 200 },
            { rank: 2, team: "Team 3", killPoints: 90, placementPoints: 90, totalPoints: 180 },
            { rank: 3, team: "Team 5", killPoints: 80, placementPoints: 80, totalPoints: 160 },
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
        { name: "Quarter-Finals", startDate: "2023-09-27", endDate: "2023-09-28" },
        { name: "Semi-Finals", startDate: "2023-10-04", endDate: "2023-10-05" },
        { name: "Finals", startDate: "2023-10-11", endDate: "2023-10-12" },
      ],
      streamChannel: "https://twitch.tv/fallclassic",
      leaderboards: {
        "Group Stage": {
          "Group A": [
            { rank: 1, team: "Team 1", wins: 3, losses: 0, kills: 45, damage: 5000 },
            { rank: 2, team: "Team 2", wins: 2, losses: 1, kills: 38, damage: 4500 },
            { rank: 3, team: "Team 3", wins: 1, losses: 2, kills: 30, damage: 4000 },
            { rank: 4, team: "Team 4", wins: 0, losses: 3, kills: 25, damage: 3500 },
          ],
          "Group B": [
            { rank: 1, team: "Team 5", wins: 3, losses: 0, kills: 42, damage: 4800 },
            { rank: 2, team: "Team 6", wins: 2, losses: 1, kills: 36, damage: 4300 },
            { rank: 3, team: "Team 7", wins: 1, losses: 2, kills: 28, damage: 3900 },
            { rank: 4, team: "Team 8", wins: 0, losses: 3, kills: 22, damage: 3400 },
          ],
          // ... more groups
        },
        "Quarter-Finals": {
          Matches: [
            { rank: 1, team: "Team 1", wins: 2, losses: 0, kills: 30, damage: 3500 },
            { rank: 2, team: "Team 5", wins: 0, losses: 2, kills: 18, damage: 2800 },
          ],
          // ... more quarter-final matches
        },
        "Semi-Finals": {
          Matches: [
            { rank: 1, team: "Team 1", wins: 2, losses: 1, kills: 35, damage: 4000 },
            { rank: 2, team: "Team 6", wins: 1, losses: 2, kills: 28, damage: 3500 },
          ],
          // ... more semi-final matches
        },
        Finals: {
          "Final Standings": [
            { rank: 1, team: "Team 1", wins: 3, losses: 2, kills: 50, damage: 5500 },
            { rank: 2, team: "Team 6", wins: 2, losses: 3, kills: 45, damage: 5000 },
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
            // ... more matches
          ],
        },
        // ... other rounds
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
      description: "This is a sample Hybrid tournament with Battle Royale qualifiers and Clash Squad finals.",
      stages: [
        { name: "Qualifiers", startDate: "2023-10-15", endDate: "2023-10-16" },
        { name: "Semi-Finals", startDate: "2023-10-22", endDate: "2023-10-23" },
        { name: "Finals", startDate: "2023-10-29", endDate: "2023-10-30" },
      ],
      streamChannel: "https://twitch.tv/hybridchampionship",
      leaderboards: {
        Qualifiers: {
          "Group A": [
            { rank: 1, team: "Team 1", killPoints: 50, placementPoints: 50, totalPoints: 100 },
            { rank: 2, team: "Team 2", killPoints: 45, placementPoints: 45, totalPoints: 90 },
            // ... more teams
          ],
          "Group B": [
            { rank: 1, team: "Team 11", killPoints: 48, placementPoints: 48, totalPoints: 96 },
            { rank: 2, team: "Team 12", killPoints: 43, placementPoints: 43, totalPoints: 86 },
            // ... more teams
          ],
        },
        "Semi-Finals": {
          Matches: [
            { rank: 1, team: "Team 1", wins: 3, losses: 1, kills: 40, damage: 5000 },
            { rank: 2, team: "Team 2", wins: 2, losses: 2, kills: 35, damage: 4500 },
            { rank: 3, team: "Team 11", wins: 2, losses: 2, kills: 33, damage: 4300 },
            { rank: 4, team: "Team 12", wins: 1, losses: 3, kills: 30, damage: 4000 },
          ],
        },
        Finals: {
          "Final Standings": [
            { rank: 1, team: "Team 1", wins: 3, losses: 1, kills: 45, damage: 5500 },
            { rank: 2, team: "Team 2", wins: 2, losses: 2, kills: 40, damage: 5000 },
            { rank: 3, team: "Team 11", wins: 1, losses: 3, kills: 35, damage: 4500 },
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
            // ... more matches
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
  ]

  return tournaments.find((t) => t.id === id)
}

const isUpcoming = (date: string) => {
  return new Date(date) > new Date()
}

export default function TournamentDetails() {
  const params = useParams()
  const [tournament, setTournament] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedGroups, setSelectedGroups] = useState({})
  const router = useRouter()

  useEffect(() => {
    const fetchTournament = async () => {
      try {
        const data = await fetchTournamentData(params.id)
        if (data) {
          setTournament(data)
          const initialSelectedGroups = {}
          data.stages.forEach((stage) => {
            initialSelectedGroups[stage.name] = Object.keys(data.leaderboards[stage.name])[0]
          })
          setSelectedGroups(initialSelectedGroups)
        } else {
          setError("Tournament not found")
        }
        setIsLoading(false)
      } catch (err) {
        setError("Failed to fetch tournament details")
        setIsLoading(false)
      }
    }

    fetchTournament()
  }, [params.id])

  if (isLoading) return <Layout>Loading tournament details...</Layout>
  if (error) return <Layout>Error: {error.message || "An error occurred"}</Layout>
  if (!tournament) return <Layout>Tournament not found</Layout>

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <Button variant="outline" onClick={() => router.back()} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <Card>
          <CardHeader>
            <CardTitle>{tournament.name}</CardTitle>
          </CardHeader>
          <CardContent>
            <p>Date: {tournament.date}</p>
            <p>Prize Pool: ${tournament.prizePool}</p>
            <p>Location: {tournament.location}</p>
            <p>Format: {tournament.format}</p>
            <p>Participants: {tournament.participants.length} teams</p>
            <p className="mt-4">{tournament.description}</p>

            {isUpcoming(tournament.date) ? (
              <div className="mt-6">
                <h3 className="text-xl font-semibold mb-2">Tournament Information</h3>
                <p>This tournament has not yet begun. Stay tuned for updates and results!</p>
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
                          {stage.name} - {tournament.stageFormats?.[stage.name] || tournament.format}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <Accordion type="single" collapsible className="mb-4">
                          <AccordionItem value="dates">
                            <AccordionTrigger>View Stage Dates</AccordionTrigger>
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
                            tournament.stageFormats?.[stage.name] === "Clash Squad" ? (
                              <div className="mt-4">
                                <h4 className="text-lg font-semibold mb-2">Leaderboard</h4>
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
                                    {Object.values(tournament.leaderboards[stage.name])
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
                                  tournament.clashSquadMatches.find((round) => round.round === stage.name) && (
                                    <div className="mt-6">
                                      <h4 className="text-lg font-semibold mb-2">Matches</h4>
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
                                            .find((round) => round.round === stage.name)
                                            .matches.map((match, index) => (
                                              <TableRow key={index}>
                                                <TableCell>{match.match}</TableCell>
                                                <TableCell>{match.teamA}</TableCell>
                                                <TableCell>{match.teamB}</TableCell>
                                                <TableCell>{match.winner}</TableCell>
                                                <TableCell>{match.score}</TableCell>
                                                <TableCell>{match.teamAKills}</TableCell>
                                                <TableCell>{match.teamBKills}</TableCell>
                                                <TableCell>{match.teamADamage}</TableCell>
                                                <TableCell>{match.teamBDamage}</TableCell>
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
                                  {Object.values(tournament.leaderboards[stage.name])
                                    .flat()
                                    .map((entry, index) => (
                                      <TableRow key={index}>
                                        <TableCell>{entry.rank}</TableCell>
                                        <TableCell>{entry.team}</TableCell>
                                        <TableCell>{entry.killPoints}</TableCell>
                                        <TableCell>{entry.placementPoints}</TableCell>
                                        <TableCell>{entry.totalPoints}</TableCell>
                                      </TableRow>
                                    ))}
                                </TableBody>
                              </Table>
                            )}
                          </>
                        ) : (
                          <p>No leaderboard data available for this stage yet.</p>
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
  )
}
