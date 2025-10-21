"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import AdminLayout from "@/components/AdminLayout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DatePicker } from "@/components/ui/date-picker"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/components/ui/use-toast"
import { PrizeDistribution } from "@/components/PrizeDistribution"
import { ImageUploader } from "@/components/ImageUploader"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import Link from "next/link"
import { Plus, Edit } from "lucide-react"

// Mock function to fetch tournament data
const fetchTournamentData = async (id: string) => {
  // In a real app, this would be an API call
  await new Promise((resolve) => setTimeout(resolve, 1000)) // Simulate API delay
  return {
    id,
    name: "Sample Tournament",
    format: "Battle Royale",
    startDate: new Date("2023-08-01"),
    endDate: new Date("2023-08-03"),
    registrationOpenDate: new Date("2023-07-15"),
    registrationEndDate: new Date("2023-07-30"),
    prizePool: "10000",
    prizeDistribution: ["5000", "3000", "1000", "500", "250", "250", "", "", "", "", "", ""],
    rules: "Sample tournament rules",
    status: "upcoming",
    registrationLink: "https://example.com/register",
    description: "Sample tournament description",
    tier: "1",
    bannerImage: "/sample-banner.jpg",
    streamLink: "https://twitch.tv/sample",
    location: "online",
    type: "tournament",
    publishedToTournaments: false,
    publishedToNews: false,
    stages: ["Qualifiers", "Semi-Finals", "Finals"],
    leaderboards: {
      Qualifiers: [
        { rank: 1, team: "Team A", kills: 25, points: 100 },
        { rank: 2, team: "Team B", kills: 20, points: 85 },
        { rank: 3, team: "Team C", kills: 18, points: 75 },
      ],
      "Semi-Finals": [
        { rank: 1, team: "Team A", kills: 30, points: 120 },
        { rank: 2, team: "Team D", kills: 28, points: 110 },
        { rank: 3, team: "Team B", kills: 25, points: 100 },
      ],
      Finals: null, // No leaderboard for Finals yet
    },
  }
}

export default function EditTournamentPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")

  const [tournamentData, setTournamentData] = useState({
    name: "",
    format: "",
    startDate: new Date(),
    endDate: new Date(),
    registrationOpenDate: new Date(),
    registrationEndDate: new Date(),
    prizePool: "",
    prizeDistribution: Array(12).fill(""),
    rules: "",
    status: "upcoming",
    registrationLink: "",
    description: "",
    tier: "",
    bannerImage: "",
    streamLink: "",
    location: "",
    type: "tournament",
    publishedToTournaments: false,
    publishedToNews: false,
    stages: ["Qualifiers", "Semi-Finals", "Finals"],
    leaderboards: {
      Qualifiers: [
        { rank: 1, team: "Team A", kills: 25, points: 100 },
        { rank: 2, team: "Team B", kills: 20, points: 85 },
        { rank: 3, team: "Team C", kills: 18, points: 75 },
      ],
      "Semi-Finals": [
        { rank: 1, team: "Team A", kills: 30, points: 120 },
        { rank: 2, team: "Team D", kills: 28, points: 110 },
        { rank: 3, team: "Team B", kills: 25, points: 100 },
      ],
      Finals: null, // No leaderboard for Finals yet
    },
  })

  useEffect(() => {
    const loadTournamentData = async () => {
      try {
        const data = await fetchTournamentData(params.id)
        setTournamentData(data)
        setIsLoading(false)
      } catch (err) {
        setError("Failed to load tournament data")
        setIsLoading(false)
      }
    }

    loadTournamentData()
  }, [params.id])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setTournamentData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSelectChange = (name: string, value: string) => {
    setTournamentData((prev) => ({ ...prev, [name]: value }))
  }

  const handleDateChange = (name: string, date: Date | undefined) => {
    if (date) {
      setTournamentData((prev) => ({ ...prev, [name]: date }))
    }
  }

  const handlePrizeDistributionChange = (index: number, value: string) => {
    setTournamentData((prev) => ({
      ...prev,
      prizeDistribution: prev.prizeDistribution.map((prize, i) => (i === index ? value : prize)),
    }))
  }

  const handleImageUpload = (imageUrl: string) => {
    setTournamentData((prev) => ({ ...prev, bannerImage: imageUrl }))
  }

  const handleToggleChange = (name: string) => (checked: boolean) => {
    setTournamentData((prev) => ({ ...prev, [name]: checked }))
  }

  const handleSubmit = async (e: React.FormEvent, publishType: "draft" | "publish") => {
    e.preventDefault()
    setIsLoading(true)
    setError("")

    try {
      // Here you would typically send the data to your API
      // For now, we'll just simulate an API call
      await new Promise((resolve) => setTimeout(resolve, 1000))

      const publishMessage = publishType === "publish" ? "updated and published" : "updated"
      const publishDetails = []
      if (tournamentData.publishedToTournaments) publishDetails.push("Tournaments")
      if (tournamentData.publishedToNews) publishDetails.push("News & Updates")

      toast({
        title: `Tournament ${publishMessage}`,
        description: `The tournament has been successfully ${publishMessage}${
          publishDetails.length > 0 ? ` to ${publishDetails.join(" and ")}` : ""
        }.`,
      })

      router.push("/admin/tournaments")
    } catch (err) {
      setError("Failed to update tournament. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return <AdminLayout>Loading tournament data...</AdminLayout>
  }

  if (error) {
    return <AdminLayout>{error}</AdminLayout>
  }

  return (
    <AdminLayout>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">Edit Tournament</h1>

        <Card>
          <CardHeader>
            <CardTitle>Tournament Details</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={(e) => handleSubmit(e, "publish")} className="space-y-4">
              <div>
                <Label htmlFor="name">Tournament Name</Label>
                <Input id="name" name="name" value={tournamentData.name} onChange={handleInputChange} required />
              </div>

              <div>
                <Label htmlFor="format">Format</Label>
                <Select value={tournamentData.format} onValueChange={(value) => handleSelectChange("format", value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select format" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Battle Royale">Battle Royale</SelectItem>
                    <SelectItem value="Clash Squad">Clash Squad</SelectItem>
                    <SelectItem value="Hybrid">Hybrid</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="startDate">Start Date</Label>
                <DatePicker
                  id="startDate"
                  selected={tournamentData.startDate}
                  onSelect={(date) => handleDateChange("startDate", date)}
                />
              </div>

              <div>
                <Label htmlFor="endDate">End Date</Label>
                <DatePicker
                  id="endDate"
                  selected={tournamentData.endDate}
                  onSelect={(date) => handleDateChange("endDate", date)}
                />
              </div>

              <div>
                <Label htmlFor="registrationOpenDate">Registration Open Date</Label>
                <DatePicker
                  id="registrationOpenDate"
                  selected={tournamentData.registrationOpenDate}
                  onSelect={(date) => handleDateChange("registrationOpenDate", date)}
                />
              </div>

              <div>
                <Label htmlFor="registrationEndDate">Registration End Date</Label>
                <DatePicker
                  id="registrationEndDate"
                  selected={tournamentData.registrationEndDate}
                  onSelect={(date) => handleDateChange("registrationEndDate", date)}
                />
              </div>

              <div>
                <Label htmlFor="prizePool">Prize Pool</Label>
                <Input
                  id="prizePool"
                  name="prizePool"
                  value={tournamentData.prizePool}
                  onChange={handleInputChange}
                  type="number"
                  required
                />
              </div>

              <PrizeDistribution
                distribution={tournamentData.prizeDistribution}
                onChange={handlePrizeDistributionChange}
              />

              <div>
                <Label htmlFor="rules">Tournament Rules</Label>
                <Textarea id="rules" name="rules" value={tournamentData.rules} onChange={handleInputChange} required />
              </div>

              <div>
                <Label htmlFor="status">Tournament Status</Label>
                <Select value={tournamentData.status} onValueChange={(value) => handleSelectChange("status", value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="upcoming">Upcoming</SelectItem>
                    <SelectItem value="ongoing">Ongoing</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="registrationLink">Registration Link</Label>
                <Input
                  id="registrationLink"
                  name="registrationLink"
                  value={tournamentData.registrationLink}
                  onChange={handleInputChange}
                />
              </div>

              <div>
                <Label htmlFor="description">Tournament Description</Label>
                <Textarea
                  id="description"
                  name="description"
                  value={tournamentData.description}
                  onChange={handleInputChange}
                  required
                />
              </div>

              <div>
                <Label htmlFor="tier">Tournament Tier</Label>
                <Select value={tournamentData.tier} onValueChange={(value) => handleSelectChange("tier", value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select tier" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Tier 1</SelectItem>
                    <SelectItem value="2">Tier 2</SelectItem>
                    <SelectItem value="3">Tier 3</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="bannerImage">Tournament Banner/Image</Label>
                <ImageUploader onImageUpload={handleImageUpload} />
                {tournamentData.bannerImage && (
                  <img
                    src={tournamentData.bannerImage || "/placeholder.svg"}
                    alt="Tournament Banner"
                    className="mt-2 max-w-xs"
                  />
                )}
              </div>

              <div>
                <Label htmlFor="streamChannel">Stream Channel</Label>
                <Input
                  id="streamChannel"
                  name="streamChannel"
                  value={tournamentData.streamChannel}
                  onChange={handleInputChange}
                />
              </div>

              <Card className="mt-8">
                <CardHeader>
                  <CardTitle>Leaderboards</CardTitle>
                </CardHeader>
                <CardContent>
                  <Tabs defaultValue={tournamentData.stages[0]}>
                    <TabsList>
                      {tournamentData.stages.map((stage) => (
                        <TabsTrigger key={stage} value={stage}>
                          {stage}
                        </TabsTrigger>
                      ))}
                    </TabsList>
                    {tournamentData.stages.map((stage) => (
                      <TabsContent key={stage} value={stage}>
                        <Card>
                          <CardHeader>
                            <CardTitle className="flex justify-between items-center">
                              <span>{stage} Leaderboard</span>
                              {tournamentData.leaderboards[stage] ? (
                                <Button asChild>
                                  <Link href={`/admin/tournaments/${params.id}/leaderboard/${stage}/edit`}>
                                    <Edit className="mr-2 h-4 w-4" /> Edit Leaderboard
                                  </Link>
                                </Button>
                              ) : (
                                <Button asChild>
                                  <Link href={`/admin/tournaments/${params.id}/leaderboard/${stage}/add`}>
                                    <Plus className="mr-2 h-4 w-4" /> Add Leaderboard
                                  </Link>
                                </Button>
                              )}
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            {tournamentData.leaderboards[stage] ? (
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>Rank</TableHead>
                                    <TableHead>Team</TableHead>
                                    <TableHead>Kills</TableHead>
                                    <TableHead>Points</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {tournamentData.leaderboards[stage].map((entry) => (
                                    <TableRow key={entry.rank}>
                                      <TableCell>{entry.rank}</TableCell>
                                      <TableCell>{entry.team}</TableCell>
                                      <TableCell>{entry.kills}</TableCell>
                                      <TableCell>{entry.points}</TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            ) : (
                              <p>No leaderboard data available for this stage.</p>
                            )}
                          </CardContent>
                        </Card>
                      </TabsContent>
                    ))}
                  </Tabs>
                </CardContent>
              </Card>

              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="publishedToTournaments"
                    checked={tournamentData.publishedToTournaments}
                    onCheckedChange={handleToggleChange("publishedToTournaments")}
                  />
                  <Label htmlFor="publishedToTournaments">Publish to Tournaments</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="publishedToNews"
                    checked={tournamentData.publishedToNews}
                    onCheckedChange={handleToggleChange("publishedToNews")}
                  />
                  <Label htmlFor="publishedToNews">Publish to News & Updates</Label>
                </div>
              </div>

              <div className="flex space-x-4">
                <Button type="submit" disabled={isLoading}>
                  {tournamentData.publishedToTournaments || tournamentData.publishedToNews
                    ? "Update and Publish"
                    : "Update"}{" "}
                  Tournament
                </Button>
                <Button type="button" onClick={(e) => handleSubmit(e, "draft")} disabled={isLoading}>
                  Save as Draft
                </Button>
                <Button type="button" variant="outline" onClick={() => router.push("/admin/events")}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  )
}
