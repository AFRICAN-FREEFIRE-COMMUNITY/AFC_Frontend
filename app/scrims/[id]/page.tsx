"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import Layout from "@/components/Layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"

// Mock function to simulate fetching a scrim
const getScrim = async (id) => {
  // In a real app, this would be an API call
  const scrims = [
    {
      id: "1",
      name: "Weekly Practice",
      date: "2023-07-10",
      format: "Battle Royale",
      participants: Array.from({ length: 12 }, (_, i) => `Team ${i + 1}`),
      description: "This is a sample Battle Royale scrim description.",
      stages: [
        { name: "Group Stage", startDate: "2023-07-01", endDate: "2023-07-05" },
        { name: "Finals", startDate: "2023-07-06", endDate: "2023-07-10" },
      ],
      leaderboards: {
        "Group Stage": {
          "Group A": [
            { rank: 1, team: "Team 1", killPoints: 50, placementPoints: 50, totalPoints: 100 },
            { rank: 2, team: "Team 2", killPoints: 45, placementPoints: 45, totalPoints: 90 },
            { rank: 3, team: "Team 3", killPoints: 40, placementPoints: 40, totalPoints: 80 },
          ],
          "Group B": [
            { rank: 1, team: "Team 4", killPoints: 48, placementPoints: 48, totalPoints: 96 },
            { rank: 2, team: "Team 5", killPoints: 43, placementPoints: 43, totalPoints: 86 },
            { rank: 3, team: "Team 6", killPoints: 38, placementPoints: 38, totalPoints: 76 },
          ],
        },
        Finals: {
          "Final Standings": [
            { rank: 1, team: "Team 1", killPoints: 60, placementPoints: 60, totalPoints: 120 },
            { rank: 2, team: "Team 4", killPoints: 55, placementPoints: 55, totalPoints: 110 },
            { rank: 3, team: "Team 2", killPoints: 50, placementPoints: 50, totalPoints: 100 },
          ],
        },
      },
    },
    {
      id: "2",
      name: "Team Alpha vs Team Beta",
      date: "2023-07-17",
      format: "Clash Squad",
      participants: ["Team Alpha", "Team Beta"],
      description: "This is a sample Clash Squad scrim description.",
      stages: [
        { name: "Group Stage", startDate: "2023-07-10", endDate: "2023-07-15" },
        { name: "Finals", startDate: "2023-07-16", endDate: "2023-07-17" },
      ],
      leaderboards: {
        "Group Stage": {
          Matches: [
            { rank: 1, team: "Team Alpha", wins: 3, losses: 1, kills: 40, damage: 5000 },
            { rank: 2, team: "Team Beta", wins: 1, losses: 3, kills: 35, damage: 4500 },
          ],
        },
        Finals: {
          "Final Standings": [
            { rank: 1, team: "Team Alpha", wins: 3, losses: 2, kills: 50, damage: 6000 },
            { rank: 2, team: "Team Beta", wins: 2, losses: 3, kills: 45, damage: 5500 },
          ],
        },
      },
      clashSquadMatches: [
        {
          round: "Group Stage",
          matches: [
            {
              match: 1,
              teamA: "Team Alpha",
              teamB: "Team Beta",
              winner: "Team Alpha",
              score: "4-2",
              teamAKills: 20,
              teamBKills: 15,
              teamADamage: 2500,
              teamBDamage: 2000,
            },
            {
              match: 2,
              teamA: "Team Alpha",
              teamB: "Team Beta",
              winner: "Team Beta",
              score: "4-3",
              teamAKills: 18,
              teamBKills: 20,
              teamADamage: 2300,
              teamBDamage: 2500,
            },
            {
              match: 3,
              teamA: "Team Alpha",
              teamB: "Team Beta",
              winner: "Team Alpha",
              score: "4-1",
              teamAKills: 22,
              teamBKills: 12,
              teamADamage: 2700,
              teamBDamage: 1800,
            },
          ],
        },
        {
          round: "Finals",
          matches: [
            {
              match: 1,
              teamA: "Team Alpha",
              teamB: "Team Beta",
              winner: "Team Alpha",
              score: "4-3",
              teamAKills: 25,
              teamBKills: 22,
              teamADamage: 3000,
              teamBDamage: 2800,
            },
            {
              match: 2,
              teamA: "Team Alpha",
              teamB: "Team Beta",
              winner: "Team Beta",
              score: "4-2",
              teamAKills: 20,
              teamBKills: 24,
              teamADamage: 2700,
              teamBDamage: 3100,
            },
            {
              match: 3,
              teamA: "Team Alpha",
              teamB: "Team Beta",
              winner: "Team Alpha",
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
      name: "Hybrid Scrim",
      date: "2023-07-24",
      format: "Hybrid",
      participants: Array.from({ length: 16 }, (_, i) => `Team ${i + 1}`),
      description: "This is a sample Hybrid scrim with Battle Royale qualifiers and Clash Squad finals.",
      stages: [
        { name: "Qualifiers", startDate: "2023-07-18", endDate: "2023-07-22" },
        { name: "Semi-Finals", startDate: "2023-07-23", endDate: "2023-07-23" },
        { name: "Finals", startDate: "2023-07-24", endDate: "2023-07-24" },
      ],
      leaderboards: {
        Qualifiers: {
          "Group A": [
            { rank: 1, team: "Team 1", killPoints: 55, placementPoints: 55, totalPoints: 110 },
            { rank: 2, team: "Team 2", killPoints: 50, placementPoints: 50, totalPoints: 100 },
            { rank: 3, team: "Team 3", killPoints: 45, placementPoints: 45, totalPoints: 90 },
          ],
          "Group B": [
            { rank: 1, team: "Team 4", killPoints: 52, placementPoints: 52, totalPoints: 104 },
            { rank: 2, team: "Team 5", killPoints: 48, placementPoints: 48, totalPoints: 96 },
            { rank: 3, team: "Team 6", killPoints: 42, placementPoints: 42, totalPoints: 84 },
          ],
        },
        "Semi-Finals": {
          Matches: [
            { rank: 1, team: "Team 1", wins: 3, losses: 1, kills: 40, damage: 5000 },
            { rank: 2, team: "Team 2", wins: 2, losses: 2, kills: 35, damage: 4500 },
            { rank: 3, team: "Team 4", wins: 2, losses: 2, kills: 33, damage: 4300 },
            { rank: 4, team: "Team 5", wins: 1, losses: 3, kills: 30, damage: 4000 },
          ],
        },
        Finals: {
          "Final Standings": [
            { rank: 1, team: "Team 1", wins: 3, losses: 1, kills: 45, damage: 5500 },
            { rank: 2, team: "Team 2", wins: 2, losses: 2, kills: 40, damage: 5000 },
            { rank: 3, team: "Team 4", wins: 1, losses: 3, kills: 35, damage: 4500 },
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
              teamB: "Team 5",
              winner: "Team 1",
              score: "4-2",
              teamAKills: 22,
              teamBKills: 18,
              teamADamage: 2800,
              teamBDamage: 2300,
            },
            {
              match: 2,
              teamA: "Team 2",
              teamB: "Team 4",
              winner: "Team 2",
              score: "4-3",
              teamAKills: 20,
              teamBKills: 22,
              teamADamage: 2500,
              teamBDamage: 2700,
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
  ]

  return scrims.find((s) => s.id === id)
}

const isUpcoming = (date: string) => {
  return new Date(date) > new Date()
}

export default function ScrimDetails() {
  const params = useParams()
  const router = useRouter()
  const [scrim, setScrim] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedGroups, setSelectedGroups] = useState({})

  useEffect(() => {
    const fetchScrim = async () => {
      try {
        const data = await getScrim(params.id)
        if (data) {
          setScrim(data)
          const initialSelectedGroups = {}
          data.stages.forEach((stage) => {
            initialSelectedGroups[stage.name] = Object.keys(data.leaderboards[stage.name])[0]
          })
          setSelectedGroups(initialSelectedGroups)
        } else {
          setError("Scrim not found")
        }
        setIsLoading(false)
      } catch (err) {
        setError("Failed to fetch scrim details")
        setIsLoading(false)
      }
    }

    fetchScrim()
  }, [params.id])

  if (isLoading) return <Layout>Loading scrim details...</Layout>
  if (error) return <Layout>Error: {error.message || "An error occurred"}</Layout>
  if (!scrim) return <Layout>Scrim not found</Layout>

  return (
    <Layout>
      <Button variant="outline" onClick={() => router.back()} className="mb-4">
        <ArrowLeft className="mr-2 h-4 w-4" /> Back
      </Button>
      <Card>
        <CardHeader>
          <CardTitle>{scrim.name}</CardTitle>
        </CardHeader>
        <CardContent>
          <p>Date: {scrim.date}</p>
          <p>Format: {scrim.format}</p>
          <p>Participants: {scrim.participants.join(", ")}</p>
          <p className="mt-4">{scrim.description}</p>

          {isUpcoming(scrim.date) ? (
            <div className="mt-6">
              <h3 className="text-xl font-semibold mb-2">Scrim Information</h3>
              <p>This scrim has not yet begun. Stay tuned for updates and results!</p>
            </div>
          ) : (
            <>
              {scrim.streamLink && (
                <div className="mt-6">
                  <h3 className="text-xl font-semibold mb-2">Stream</h3>
                  <a
                    href={scrim.streamLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    Watch the scrim stream
                  </a>
                </div>
              )}
              <Tabs defaultValue={scrim.stages[0].name} className="mt-6">
                <TabsList>
                  {scrim.stages.map((stage) => (
                    <TabsTrigger key={stage.name} value={stage.name}>
                      {stage.name} ({scrim.stageFormats?.[stage.name] || scrim.format})
                    </TabsTrigger>
                  ))}
                </TabsList>
                {scrim.stages.map((stage) => (
                  <TabsContent key={stage.name} value={stage.name}>
                    <Card>
                      <CardHeader>
                        <CardTitle>
                          {stage.name} - {scrim.stageFormats?.[stage.name] || scrim.format}
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
                        {scrim.leaderboards[stage.name] && (
                          <>
                            <div className="mb-4">
                              <Select
                                value={selectedGroups[stage.name]}
                                onValueChange={(value) =>
                                  setSelectedGroups((prev) => ({ ...prev, [stage.name]: value }))
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select group" />
                                </SelectTrigger>
                                <SelectContent>
                                  {Object.keys(scrim.leaderboards[stage.name]).map((group) => (
                                    <SelectItem key={group} value={group}>
                                      {group}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Rank</TableHead>
                                  <TableHead>Team</TableHead>
                                  {(scrim.stageFormats?.[stage.name] || scrim.format) === "Battle Royale" ? (
                                    <>
                                      <TableHead>Kill Points</TableHead>
                                      <TableHead>Placement Points</TableHead>
                                      <TableHead>Total Points</TableHead>
                                    </>
                                  ) : (
                                    <>
                                      <TableHead>Wins</TableHead>
                                      <TableHead>Losses</TableHead>
                                      <TableHead>Kills</TableHead>
                                      <TableHead>Damage</TableHead>
                                    </>
                                  )}
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {scrim.leaderboards[stage.name][selectedGroups[stage.name]].map((entry) => (
                                  <TableRow key={entry.rank}>
                                    <TableCell>{entry.rank}</TableCell>
                                    <TableCell>{entry.team}</TableCell>
                                    {(scrim.stageFormats?.[stage.name] || scrim.format) === "Battle Royale" ? (
                                      <>
                                        <TableCell>{entry.killPoints}</TableCell>
                                        <TableCell>{entry.placementPoints}</TableCell>
                                        <TableCell>{entry.totalPoints}</TableCell>
                                      </>
                                    ) : (
                                      <>
                                        <TableCell>{entry.wins}</TableCell>
                                        <TableCell>{entry.losses}</TableCell>
                                        <TableCell>{entry.kills}</TableCell>
                                        <TableCell>{entry.damage}</TableCell>
                                      </>
                                    )}
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </>
                        )}
                        {(scrim.stageFormats?.[stage.name] || scrim.format) === "Clash Squad" &&
                          scrim.clashSquadMatches && (
                            <div className="mt-6">
                              <h3 className="text-lg font-semibold mb-2">Matches</h3>
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
                                  {scrim.clashSquadMatches
                                    .find((r) => r.round === stage.name)
                                    ?.matches.map((match, index) => (
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
                      </CardContent>
                    </Card>
                  </TabsContent>
                ))}
              </Tabs>
            </>
          )}
        </CardContent>
      </Card>
    </Layout>
  )
}
