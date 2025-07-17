"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import AdminLayout from "@/components/AdminLayout"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/components/ui/use-toast"
import { Badge } from "@/components/ui/badge"
import { Check, Edit, Trophy } from "lucide-react"

const FinalLeaderboardPage = () => {
  const router = useRouter()
  const { toast } = useToast()
  const [leaderboardDetails, setLeaderboardDetails] = useState<any>(null)
  const [teams, setTeams] = useState<any[]>([])
  const [maps, setMaps] = useState<string[]>([])
  const [currentViewMap, setCurrentViewMap] = useState("overall")

  useEffect(() => {
    // Retrieve leaderboard details from localStorage
    const storedDetails = localStorage.getItem("leaderboardDetails")
    if (storedDetails) {
      const details = JSON.parse(storedDetails)
      setLeaderboardDetails(details)

      if (details.teams) {
        setTeams(details.teams)
      }

      // Generate map names based on map count
      const mapCount = details.mapCount || 3
      const mapNames = Array.from({ length: mapCount }, (_, i) => `Map ${i + 1}`)
      setMaps(mapNames)
    } else {
      // If no details found, redirect back to step 1
      router.push("/admin/leaderboards/create")
    }
  }, [router])

  const handleSaveLeaderboard = () => {
    // In a real application, this would save to a database
    toast({
      title: "Leaderboard Saved",
      description: "The leaderboard has been successfully saved to the database.",
    })

    // Navigate to the leaderboards list
    router.push("/admin/leaderboards")
  }

  const handleEditResults = () => {
    router.push("/admin/leaderboards/create/results")
  }

  if (!leaderboardDetails || !teams.length) {
    return <AdminLayout>Loading...</AdminLayout>
  }

  return (
    <AdminLayout>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-2">Final Leaderboard</h1>
        <p className="text-muted-foreground mb-8">Review and save your leaderboard</p>

        <Card className="mb-8">
          <CardHeader>
            <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
              <div>
                <CardTitle>{leaderboardDetails.leaderboardName}</CardTitle>
                <CardDescription>
                  {leaderboardDetails.gameType === "battle_royale" ? "Battle Royale" : "Clash Squad"} • {maps.length}{" "}
                  Maps • {teams.length} Teams
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleEditResults}>
                  <Edit className="w-4 h-4 mr-2" />
                  Edit Results
                </Button>
                <Button onClick={handleSaveLeaderboard}>
                  <Check className="w-4 h-4 mr-2" />
                  Save Leaderboard
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs value={currentViewMap} onValueChange={setCurrentViewMap}>
              <TabsList className="mb-4">
                <TabsTrigger value="overall">Overall</TabsTrigger>
                {maps.map((map) => (
                  <TabsTrigger key={map} value={map}>
                    {map}
                  </TabsTrigger>
                ))}
              </TabsList>

              <TabsContent value="overall">
                <div className="mb-6">
                  <h3 className="text-xl font-semibold mb-4 flex items-center">
                    <Trophy className="w-5 h-5 mr-2 text-yellow-500" />
                    Overall Standings
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    {teams.slice(0, 3).map((team, index) => (
                      <Card
                        key={team.id}
                        className={`
                        ${index === 0 ? "bg-yellow-50 border-yellow-200" : ""}
                        ${index === 1 ? "bg-gray-50 border-gray-200" : ""}
                        ${index === 2 ? "bg-amber-50 border-amber-200" : ""}
                      `}
                      >
                        <CardContent className="p-4 flex items-center">
                          <div className="flex-shrink-0 mr-4">
                            <div
                              className={`
                              w-10 h-10 rounded-full flex items-center justify-center text-white font-bold
                              ${index === 0 ? "bg-yellow-500" : ""}
                              ${index === 1 ? "bg-gray-400" : ""}
                              ${index === 2 ? "bg-amber-600" : ""}
                            `}
                            >
                              {index + 1}
                            </div>
                          </div>
                          <div className="flex-grow">
                            <div className="flex items-center">
                              <img
                                src={team.logo || "/placeholder.svg"}
                                alt={team.name}
                                className="w-8 h-8 mr-2 rounded-full"
                              />
                              <h4 className="font-semibold">{team.name}</h4>
                            </div>
                            <div className="flex items-center mt-2 text-sm">
                              <span className="mr-4">{team.totalPoints || 0} pts</span>
                              <span>{team.totalKills || 0} kills</span>
                              {team.booyahCount > 0 && (
                                <Badge variant="outline" className="ml-2">
                                  {team.booyahCount} Booyah
                                </Badge>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>

                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Position</TableHead>
                        <TableHead>Team</TableHead>
                        <TableHead>Kills</TableHead>
                        {leaderboardDetails.gameType === "battle_royale" && <TableHead>Placement Points</TableHead>}
                        <TableHead>Total Points</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {teams
                        .sort((a, b) => (a.position || 999) - (b.position || 999))
                        .map((team) => (
                          <TableRow key={team.id} className={team.position <= 3 ? "bg-muted/30" : ""}>
                            <TableCell>{team.position || "-"}</TableCell>
                            <TableCell>
                              <div className="flex items-center">
                                <img
                                  src={team.logo || "/placeholder.svg"}
                                  alt={team.name}
                                  className="w-6 h-6 mr-2 rounded-full"
                                />
                                {team.name}
                              </div>
                            </TableCell>
                            <TableCell>{team.totalKills || 0}</TableCell>
                            {leaderboardDetails.gameType === "battle_royale" && (
                              <TableCell>{team.totalPlacementPoints || 0}</TableCell>
                            )}
                            <TableCell className="font-medium">{team.totalPoints || 0}</TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>

              {maps.map((map) => (
                <TabsContent key={map} value={map}>
                  <h3 className="text-xl font-semibold mb-4">{map} Results</h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Position</TableHead>
                        <TableHead>Team</TableHead>
                        <TableHead>Kills</TableHead>
                        {leaderboardDetails.gameType === "battle_royale" && <TableHead>Placement Points</TableHead>}
                        <TableHead>Total Points</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {leaderboardDetails.mapResults &&
                        leaderboardDetails.mapResults[map]
                          ?.sort((a, b) => (a.position || 999) - (b.position || 999))
                          .map((teamResult) => {
                            const team = teams.find((t) => t.id === teamResult.teamId)
                            return (
                              <TableRow key={teamResult.teamId}>
                                <TableCell>{teamResult.position || "-"}</TableCell>
                                <TableCell>
                                  <div className="flex items-center">
                                    <img
                                      src={team?.logo || "/placeholder.svg"}
                                      alt={team?.name}
                                      className="w-6 h-6 mr-2 rounded-full"
                                    />
                                    {team?.name}
                                  </div>
                                </TableCell>
                                <TableCell>{teamResult.totalKills || 0}</TableCell>
                                {leaderboardDetails.gameType === "battle_royale" && (
                                  <TableCell>{teamResult.placementPoints || 0}</TableCell>
                                )}
                                <TableCell className="font-medium">{teamResult.totalPoints || 0}</TableCell>
                              </TableRow>
                            )
                          })}
                    </TableBody>
                  </Table>
                </TabsContent>
              ))}
            </Tabs>
          </CardContent>
        </Card>

        <div className="flex justify-between">
          <Button variant="outline" onClick={handleEditResults}>
            Back to Edit Results
          </Button>
          <Button onClick={handleSaveLeaderboard}>Save Leaderboard</Button>
        </div>
      </div>
    </AdminLayout>
  )
}

export default FinalLeaderboardPage
