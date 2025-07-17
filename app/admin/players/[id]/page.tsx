"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import AdminLayout from "@/components/AdminLayout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts"
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
} from "@/components/ui/alert-dialog"
import { useToast } from "@/components/ui/use-toast"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"

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
      totalKills: 1500,
      totalTournaments: 20,
      totalScrims: 50,
      totalMoneyMade: 15000,
      totalMVPs: 15,
      wins: 50,
      mvps: 10,
      tournamentsPlayed: 15,
      earnings: 5000,
      kdr: 3.2,
      avgDamage: 560,
      headshotPercentage: 60,
      winRate: 75,
    },
    eventsPlayed: [
      { id: 1, name: "Summer Showdown 2023", type: "Tournament", placement: 1 },
      { id: 2, name: "Fall Classic 2023", type: "Tournament", placement: 3 },
      { id: 3, name: "Weekly Scrim #5", type: "Scrim", placement: 2 },
    ],
    teamHistory: [
      { id: 1, name: "Team Alpha", role: "Rusher", from: "2022-01-01", to: "Present" },
      { id: 2, name: "Team Beta", role: "Support", from: "2021-06-01", to: "2021-12-31" },
    ],
    recentMatches: [
      { id: 1, tournament: "Summer Showdown", kills: 12, placement: 1, kdr: 4.5, damage: 670, mvps: 2 },
      { id: 2, tournament: "Fall Classic", kills: 8, placement: 3, kdr: 2.3, damage: 450, mvps: 1 },
      { id: 3, tournament: "Winter Cup", kills: 10, placement: 2, kdr: 3.1, damage: 520, mvps: 1 },
    ],
    performanceHistory: [
      { month: "Jan", kills: 100, wins: 3, kdr: 2.8, avgDamage: 500, headshotPercentage: 55 },
      { month: "Feb", kills: 120, wins: 4, kdr: 3.1, avgDamage: 530, headshotPercentage: 58 },
      { month: "Mar", kills: 150, wins: 5, kdr: 3.5, avgDamage: 580, headshotPercentage: 62 },
      { month: "Apr", kills: 130, wins: 4, kdr: 3.2, avgDamage: 550, headshotPercentage: 60 },
      { month: "May", kills: 180, wins: 6, kdr: 4.0, avgDamage: 600, headshotPercentage: 65 },
      { month: "Jun", kills: 200, wins: 7, kdr: 4.3, avgDamage: 620, headshotPercentage: 68 },
    ],
    isBanned: false,
    banReason: "",
  }
}

export default function AdminPlayerProfilePage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const [playerData, setPlayerData] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [banModalOpen, setBanModalOpen] = useState(false)
  const [banDuration, setBanDuration] = useState(7)
  const [banReasons, setBanReasons] = useState<string[]>([])
  const availableBanReasons = [
    {
      id: "conduct",
      label: "Conduct/Toxic Behavior",
      description: "Repeated instances of abusive language, harassment, or unsportsmanlike conduct",
    },
    {
      id: "cheating",
      label: "Cheating",
      description: "Use of unauthorized software, exploits, or other forms of cheating",
    },
    {
      id: "collusion",
      label: "Collusion",
      description: "Cooperating with other teams or players to gain an unfair advantage",
    },
    {
      id: "account_sharing",
      label: "Account Sharing",
      description: "Multiple players using the same account or a player using someone else's account",
    },
    {
      id: "confidentiality",
      label: "Breach of Confidentiality",
      description: "Sharing confidential information about tournaments, scrims, or other teams",
    },
  ]

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

  const handleBanPlayer = async () => {
    try {
      // Simulate API call to ban the player
      await new Promise((resolve) => setTimeout(resolve, 1000))

      const banReasonString = banReasons
        .map((id) => availableBanReasons.find((reason) => reason.id === id)?.label)
        .join(", ")

      setPlayerData((prevData) => ({ ...prevData, isBanned: true, banReason: banReasonString }))

      toast({
        title: "Player Banned",
        description: `Successfully banned ${playerData.name} for ${banDuration} days.`,
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to ban the player. Please try again.",
        variant: "destructive",
      })
    } finally {
      setBanModalOpen(false)
      setBanDuration(7)
      setBanReasons([])
    }
  }

  const handleUnbanPlayer = async () => {
    try {
      // Simulate API call to unban player
      await new Promise((resolve) => setTimeout(resolve, 1000))

      setPlayerData((prevData) => ({ ...prevData, isBanned: false, banReason: "" }))

      toast({
        title: "Player Unbanned",
        description: "Successfully unbanned the player.",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to unban the player. Please try again.",
        variant: "destructive",
      })
    } finally {
      setBanModalOpen(false)
    }
  }

  if (isLoading) return <AdminLayout>Loading player profile...</AdminLayout>
  if (error) return <AdminLayout>Error: {error}</AdminLayout>
  if (!playerData) return <AdminLayout>Player not found</AdminLayout>

  return (
    <AdminLayout>
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-4">
          <Button variant="outline" onClick={() => router.back()}>
            Back to Players
          </Button>
          <AlertDialog open={banModalOpen} onOpenChange={setBanModalOpen}>
            <AlertDialogTrigger asChild>
              <Button variant={playerData.isBanned ? "secondary" : "destructive"}>
                {playerData.isBanned ? "Unban" : "Ban"}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{playerData.isBanned ? "Unban Player" : "Ban Player"}</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to {playerData.isBanned ? "unban" : "ban"} {playerData.name}?
                </AlertDialogDescription>
              </AlertDialogHeader>
              {!playerData.isBanned && (
                <div className="space-y-4 px-4 py-2">
                  <div>
                    <Label htmlFor="banDuration">Ban Duration (Days)</Label>
                    <Input
                      type="number"
                      id="banDuration"
                      value={banDuration}
                      onChange={(e) => setBanDuration(Number.parseInt(e.target.value))}
                      min={1}
                      className="w-full"
                    />
                  </div>
                  <div>
                    <Label>Reason(s) for Ban</Label>
                    <div className="space-y-2 mt-2">
                      {availableBanReasons.map((reason) => (
                        <div key={reason.id} className="flex items-start space-x-2">
                          <Checkbox
                            id={reason.id}
                            checked={banReasons.includes(reason.id)}
                            onCheckedChange={(checked) => {
                              setBanReasons((prevReasons) =>
                                checked ? [...prevReasons, reason.id] : prevReasons.filter((r) => r !== reason.id),
                              )
                            }}
                          />
                          <div>
                            <Label htmlFor={reason.id} className="font-medium">
                              {reason.label}
                            </Label>
                            <p className="text-sm text-muted-foreground">{reason.description}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={playerData.isBanned ? handleUnbanPlayer : handleBanPlayer}>
                  {playerData.isBanned ? "Unban" : "Ban"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

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
                <div className="flex space-x-2 mt-1">
                  <Badge variant="secondary">{playerData.role}</Badge>
                  {playerData.isBanned && <Badge variant="destructive">Banned</Badge>}
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="overview">
              <TabsList>
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="statistics">Statistics</TabsTrigger>
                <TabsTrigger value="matches">Recent Matches</TabsTrigger>
                <TabsTrigger value="events">Events Played</TabsTrigger>
                <TabsTrigger value="teams">Team History</TabsTrigger>
                <TabsTrigger value="performance">Performance History</TabsTrigger>
              </TabsList>
              <TabsContent value="overview">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div>
                    <h3 className="font-semibold">Total Kills</h3>
                    <p className="text-2xl font-bold">{playerData.stats.totalKills}</p>
                  </div>
                  <div>
                    <h3 className="font-semibold">Total Tournaments</h3>
                    <p className="text-2xl font-bold">{playerData.stats.totalTournaments}</p>
                  </div>
                  <div>
                    <h3 className="font-semibold">Total Scrims</h3>
                    <p className="text-2xl font-bold">{playerData.stats.totalScrims}</p>
                  </div>
                  <div>
                    <h3 className="font-semibold">Total Money Made</h3>
                    <p className="text-2xl font-bold">${playerData.stats.totalMoneyMade}</p>
                  </div>
                  <div>
                    <h3 className="font-semibold">Total MVPs</h3>
                    <p className="text-2xl font-bold">{playerData.stats.totalMVPs}</p>
                  </div>
                  <div>
                    <h3 className="font-semibold">Total Wins</h3>
                    <p className="text-2xl font-bold">{playerData.stats.wins}</p>
                  </div>
                  <div>
                    <h3 className="font-semibold">Status</h3>
                    {playerData.isBanned ? (
                      <p className="text-red-500">Banned: {playerData.banReason}</p>
                    ) : (
                      <p className="text-green-500">Active</p>
                    )}
                  </div>
                </div>
              </TabsContent>
              <TabsContent value="statistics">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div>
                    <p className="font-semibold">KDR</p>
                    <p className="text-2xl font-bold">{playerData.stats.kdr}</p>
                  </div>
                  <div>
                    <p className="font-semibold">Avg. Damage</p>
                    <p className="text-2xl font-bold">{playerData.stats.avgDamage}</p>
                  </div>
                  <div>
                    <p className="font-semibold">Headshot %</p>
                    <p className="text-2xl font-bold">{playerData.stats.headshotPercentage}%</p>
                  </div>
                  <div>
                    <p className="font-semibold">Win Rate</p>
                    <p className="text-2xl font-bold">{playerData.stats.winRate}%</p>
                  </div>
                </div>
              </TabsContent>
              <TabsContent value="matches">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tournament</TableHead>
                      <TableHead>Kills</TableHead>
                      <TableHead>KDR</TableHead>
                      <TableHead>Damage</TableHead>
                      <TableHead>MVPs</TableHead>
                      <TableHead>Placement</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {playerData.recentMatches.map((match) => (
                      <TableRow key={match.id}>
                        <TableCell>{match.tournament}</TableCell>
                        <TableCell>{match.kills}</TableCell>
                        <TableCell>{match.kdr}</TableCell>
                        <TableCell>{match.damage}</TableCell>
                        <TableCell>{match.mvps}</TableCell>
                        <TableCell>{match.placement}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TabsContent>
              <TabsContent value="events">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Event Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Placement</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {playerData.eventsPlayed.map((event) => (
                      <TableRow key={event.id}>
                        <TableCell>{event.name}</TableCell>
                        <TableCell>{event.type}</TableCell>
                        <TableCell>{event.placement}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TabsContent>
              <TabsContent value="teams">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Team Name</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>From</TableHead>
                      <TableHead>To</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {playerData.teamHistory.map((team) => (
                      <TableRow key={team.id}>
                        <TableCell>{team.name}</TableCell>
                        <TableCell>{team.role}</TableCell>
                        <TableCell>{team.from}</TableCell>
                        <TableCell>{team.to}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TabsContent>
              <TabsContent value="performance">
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={playerData.performanceHistory}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis yAxisId="left" />
                      <YAxis yAxisId="right" orientation="right" />
                      <Tooltip />
                      <Legend />
                      <Line yAxisId="left" type="monotone" dataKey="kills" stroke="#8884d8" name="Kills" />
                      <Line yAxisId="right" type="monotone" dataKey="wins" stroke="#82ca9d" name="Wins" />
                      <Line yAxisId="left" type="monotone" dataKey="kdr" stroke="#ffc658" name="KDR" />
                      <Line yAxisId="right" type="monotone" dataKey="avgDamage" stroke="#FF4655" name="Avg. Damage" />
                      <Line
                        yAxisId="left"
                        type="monotone"
                        dataKey="headshotPercentage"
                        stroke="#38bdf8"
                        name="Headshot %"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  )
}
