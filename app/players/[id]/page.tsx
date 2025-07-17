"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import Layout from "@/components/Layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts"
import { Button } from "@/components/ui/button"
import Link from "next/link"

// Mock function to fetch player data
const fetchPlayerData = async (id: string) => {
  // In a real app, this would be an API call
  await new Promise((resolve) => setTimeout(resolve, 500)) // Simulate API delay
  return {
    id,
    name: "John Doe",
    username: "johndoe123",
    avatar: "/placeholder.svg",
    team: "Team Alpha",
    role: "Rusher",
    country: "Nigeria",
    stats: {
      kills: 1500,
      wins: 50,
      mvps: 10,
      tournamentsPlayed: 15,
      earnings: 5000,
    },
    recentMatches: [
      { id: 1, tournament: "Summer Showdown", kills: 12, placement: 1 },
      { id: 2, tournament: "Fall Classic", kills: 8, placement: 3 },
      { id: 3, tournament: "Winter Cup", kills: 10, placement: 2 },
    ],
    performanceHistory: [
      { month: "Jan", kills: 100, wins: 3 },
      { month: "Feb", kills: 120, wins: 4 },
      { month: "Mar", kills: 150, wins: 5 },
      { month: "Apr", kills: 130, wins: 4 },
      { month: "May", kills: 180, wins: 6 },
      { month: "Jun", kills: 200, wins: 7 },
    ],
  }
}

export default function PlayerProfilePage() {
  const params = useParams()
  const router = useRouter()
  const [playerData, setPlayerData] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadPlayerData = async () => {
      try {
        const data = await fetchPlayerData(params.id as string)
        setPlayerData(data)
      } catch (err) {
        setError("Failed to load player data")
      } finally {
        setIsLoading(false)
      }
    }

    loadPlayerData()
  }, [params.id])

  if (isLoading) return <Layout>Loading player profile...</Layout>
  if (error) return <Layout>Error: {error}</Layout>
  if (!playerData) return <Layout>Player not found</Layout>

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <div className="flex items-center space-x-4">
              <Avatar className="w-20 h-20">
                <AvatarImage src={playerData.avatar} alt={playerData.name} />
                <AvatarFallback>{playerData.name[0]}</AvatarFallback>
              </Avatar>
              <div>
                <CardTitle className="text-3xl">{playerData.name}</CardTitle>
                <p className="text-muted-foreground">@{playerData.username}</p>
                <Badge className="mt-2">{playerData.role}</Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="overview">
              <TabsList>
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="statistics">Statistics</TabsTrigger>
                <TabsTrigger value="matches">Recent Matches</TabsTrigger>
              </TabsList>
              <TabsContent value="overview">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h3 className="font-semibold">Team</h3>
                    <p>{playerData.team}</p>
                  </div>
                  <div>
                    <h3 className="font-semibold">Country</h3>
                    <p>{playerData.country}</p>
                  </div>
                  <div>
                    <h3 className="font-semibold">Total Kills</h3>
                    <p>{playerData.stats.kills}</p>
                  </div>
                  <div>
                    <h3 className="font-semibold">Total Wins</h3>
                    <p>{playerData.stats.wins}</p>
                  </div>
                  <div>
                    <h3 className="font-semibold">MVPs</h3>
                    <p>{playerData.stats.mvps}</p>
                  </div>
                  <div>
                    <h3 className="font-semibold">Tournaments Played</h3>
                    <p>{playerData.stats.tournamentsPlayed}</p>
                  </div>
                  <div>
                    <h3 className="font-semibold">Total Earnings</h3>
                    <p>${playerData.stats.earnings}</p>
                  </div>
                </div>
              </TabsContent>
              <TabsContent value="statistics">
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={playerData.performanceHistory}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis yAxisId="left" />
                      <YAxis yAxisId="right" orientation="right" />
                      <Tooltip />
                      <Legend />
                      <Line yAxisId="left" type="monotone" dataKey="kills" stroke="#8884d8" />
                      <Line yAxisId="right" type="monotone" dataKey="wins" stroke="#82ca9d" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </TabsContent>
              <TabsContent value="matches">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tournament</TableHead>
                      <TableHead>Kills</TableHead>
                      <TableHead>Placement</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {playerData.recentMatches.map((match) => (
                      <TableRow key={match.id}>
                        <TableCell>{match.tournament}</TableCell>
                        <TableCell>{match.kills}</TableCell>
                        <TableCell>{match.placement}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TabsContent>
            </Tabs>
            <div className="mt-6 flex justify-end">
              <Button asChild>
                <Link href={`/players/${playerData.id}/edit`}>Edit Profile</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  )
}
