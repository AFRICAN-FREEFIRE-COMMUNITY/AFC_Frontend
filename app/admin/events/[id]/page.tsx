"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import AdminLayout from "@/components/AdminLayout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { ArrowLeft, Edit, Upload, Plus } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { toast } from "@/components/ui/use-toast"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

// Mock function to fetch event data
const fetchEventData = async (id: string) => {
  // In a real app, this would be an API call
  await new Promise((resolve) => setTimeout(resolve, 1000)) // Simulate API delay
  return {
    id,
    name: "Sample Event",
    format: "Battle Royale",
    startDate: "2023-08-01",
    endDate: "2023-08-03",
    registrationOpenDate: "2023-07-15",
    registrationEndDate: "2023-07-30",
    prizePool: "10000",
    prizeDistribution: ["5000", "3000", "1000", "500", "250", "250", "", "", "", "", "", ""],
    rules: "Sample event rules",
    status: "upcoming",
    registrationLink: "https://example.com/register",
    description: "Sample event description",
    tier: "1",
    bannerImage: "/sample-banner.jpg",
    streamLink: "https://twitch.tv/sample",
    location: "online",
    type: "tournament",
    publishedToEvents: true,
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

export default function ViewEventPage() {
  const params = useParams()
  const router = useRouter()
  const [eventData, setEventData] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    const loadEventData = async () => {
      try {
        const data = await fetchEventData(params.id)
        setEventData(data)
        setIsLoading(false)
      } catch (err) {
        setError("Failed to load event data")
        setIsLoading(false)
      }
    }

    loadEventData()
  }, [params.id])

  const handlePublishToggle = (type: "events" | "news", checked: boolean) => {
    setEventData((prev) => ({
      ...prev,
      [type === "events" ? "publishedToEvents" : "publishedToNews"]: checked,
    }))
  }

  const handleSave = async () => {
    setIsLoading(true)
    setError("")

    try {
      // Here you would typically send the data to your API
      // For now, we'll just simulate an API call
      await new Promise((resolve) => setTimeout(resolve, 1000))

      toast({
        title: "Event updated",
        description: "The event has been successfully updated and published according to your selections.",
      })

      router.push("/admin/events")
    } catch (err) {
      setError("Failed to update event. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return <AdminLayout>Loading event data...</AdminLayout>
  }

  if (error) {
    return <AdminLayout>{error}</AdminLayout>
  }

  if (!eventData) {
    return <AdminLayout>Event not found</AdminLayout>
  }

  return (
    <AdminLayout>
      <div className="container mx-auto px-4 py-8">
        <Button variant="outline" onClick={() => router.back()} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>

        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">{eventData.name}</h1>
          <div className="space-x-4">
            <Button asChild>
              <Link href={`/admin/events/${params.id}/edit`}>
                <Edit className="mr-2 h-4 w-4" /> Edit
              </Link>
            </Button>
            <Button asChild>
              <Link href={`/admin/events/${params.id}/leaderboard`}>
                <Upload className="mr-2 h-4 w-4" /> Upload Results
              </Link>
            </Button>
          </div>
        </div>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Event Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Type</Label>
                <p>{eventData.type === "tournament" ? "Tournament" : "Scrim"}</p>
              </div>
              <div>
                <Label>Format</Label>
                <p>{eventData.format}</p>
              </div>
              <div>
                <Label>Start Date</Label>
                <p>{eventData.startDate}</p>
              </div>
              <div>
                <Label>End Date</Label>
                <p>{eventData.endDate}</p>
              </div>
              <div>
                <Label>Registration Open Date</Label>
                <p>{eventData.registrationOpenDate}</p>
              </div>
              <div>
                <Label>Registration End Date</Label>
                <p>{eventData.registrationEndDate}</p>
              </div>
              <div>
                <Label>Prize Pool</Label>
                <p>${eventData.prizePool}</p>
              </div>
              <div>
                <Label>Tier</Label>
                <p>Tier {eventData.tier}</p>
              </div>
              <div>
                <Label>Status</Label>
                <p>{eventData.status}</p>
              </div>
              <div>
                <Label>Location</Label>
                <p>{eventData.location}</p>
              </div>
            </div>

            <div>
              <Label>Prize Distribution</Label>
              <ul className="list-disc list-inside">
                {eventData.prizeDistribution.map(
                  (prize, index) =>
                    prize && (
                      <li key={index}>
                        {index + 1}st Place: ${prize}
                      </li>
                    ),
                )}
              </ul>
            </div>

            <div>
              <Label>Event Rules</Label>
              <p>{eventData.rules}</p>
            </div>

            <div>
              <Label>Description</Label>
              <p>{eventData.description}</p>
            </div>

            <div>
              <Label>Registration Link</Label>
              <a
                href={eventData.registrationLink}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 hover:underline"
              >
                {eventData.registrationLink}
              </a>
            </div>

            <div>
              <Label>Stream Link</Label>
              <a
                href={eventData.streamLink}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 hover:underline"
              >
                {eventData.streamLink}
              </a>
            </div>

            <div>
              <Label>Banner Image</Label>
              <Image
                src={eventData.bannerImage || "/placeholder.svg"}
                alt="Event Banner"
                width={300}
                height={200}
                className="mt-2"
              />
            </div>

            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="publish-events"
                  checked={eventData.publishedToEvents}
                  onCheckedChange={(checked) => handlePublishToggle("events", checked)}
                />
                <Label htmlFor="publish-events">Publish to Events</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="publish-news"
                  checked={eventData.publishedToNews}
                  onCheckedChange={(checked) => handlePublishToggle("news", checked)}
                />
                <Label htmlFor="publish-news">Publish to News</Label>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Leaderboards</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue={eventData.stages[0]}>
              <TabsList>
                {eventData.stages.map((stage) => (
                  <TabsTrigger key={stage} value={stage}>
                    {stage}
                  </TabsTrigger>
                ))}
              </TabsList>
              {eventData.stages.map((stage) => (
                <TabsContent key={stage} value={stage}>
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex justify-between items-center">
                        <span>{stage} Leaderboard</span>
                        {eventData.leaderboards[stage] ? (
                          <Button asChild>
                            <Link href={`/admin/leaderboards/${params.id}/edit?stage=${stage}`}>
                              <Edit className="mr-2 h-4 w-4" /> Edit Leaderboard
                            </Link>
                          </Button>
                        ) : (
                          <Button asChild>
                            <Link href={`/admin/leaderboards/${params.id}/add?stage=${stage}`}>
                              <Plus className="mr-2 h-4 w-4" /> Add Leaderboard
                            </Link>
                          </Button>
                        )}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {eventData.leaderboards[stage] ? (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Rank</TableHead>
                              <TableHead>Team</TableHead>
                              <TableHead>Kills</TableHead>
                              {eventData.format === "Battle Royale" && <TableHead>Points</TableHead>}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {eventData.leaderboards[stage].map((entry) => (
                              <TableRow key={entry.rank}>
                                <TableCell>{entry.rank}</TableCell>
                                <TableCell>{entry.team}</TableCell>
                                <TableCell>{entry.kills}</TableCell>
                                {eventData.format === "Battle Royale" && <TableCell>{entry.points}</TableCell>}
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

        <Button onClick={handleSave} className="mt-4">
          Save Changes
        </Button>
      </div>
    </AdminLayout>
  )
}
