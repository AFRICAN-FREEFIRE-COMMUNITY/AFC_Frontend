"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import AdminLayout from "@/components/AdminLayout"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/components/ui/use-toast"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Eye, FileText, Image, Save, Edit2 } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

// Free Fire map options
const MAP_OPTIONS = ["Alpine", "Bermuda", "Kalahari", "Bermuda Remastered", "Purgatory", "Nexterra"]

// Mock data for players
const generateMockPlayers = (teamId) => [
  { id: `${teamId}-1`, name: "Player 1", kills: 0 },
  { id: `${teamId}-2`, name: "Player 2", kills: 0 },
  { id: `${teamId}-3`, name: "Player 3", kills: 0 },
  { id: `${teamId}-4`, name: "Player 4", kills: 0 },
]

const ResultsEntryPage = () => {
  const router = useRouter()
  const { toast } = useToast()
  const [leaderboardDetails, setLeaderboardDetails] = useState<any>(null)
  const [teams, setTeams] = useState<any[]>([])
  const [maps, setMaps] = useState<string[]>([])
  const [mapNames, setMapNames] = useState<Record<string, string>>({})
  const [currentMap, setCurrentMap] = useState("")
  const [mapResults, setMapResults] = useState<Record<string, any>>({})
  const [viewMode, setViewMode] = useState<"entry" | "leaderboard">("entry")
  const [currentViewMap, setCurrentViewMap] = useState("")
  const [entryMethod, setEntryMethod] = useState("manual")
  const [mapImages, setMapImages] = useState<Record<string, string>>({})
  const [processingImage, setProcessingImage] = useState(false)
  const [editingMapName, setEditingMapName] = useState<string | null>(null)

  useEffect(() => {
    // Retrieve leaderboard details from localStorage
    const storedDetails = localStorage.getItem("leaderboardDetails")
    if (storedDetails) {
      const details = JSON.parse(storedDetails)
      setLeaderboardDetails(details)

      // Set entry method
      if (details.entryMethod) {
        setEntryMethod(details.entryMethod)
      }

      // Set map images if available
      if (details.mapImages) {
        setMapImages(details.mapImages)
      }

      // Generate map slots based on map count
      const mapCount = details.mapCount || 3
      const mapSlots = Array.from({ length: mapCount }, (_, i) => `Map ${i + 1}`)
      setMaps(mapSlots)

      // Set map names if available, otherwise use default names
      if (details.mapNames) {
        setMapNames(details.mapNames)
      } else {
        // Initialize with default map names
        const initialMapNames = {}
        mapSlots.forEach((mapSlot, index) => {
          initialMapNames[mapSlot] = MAP_OPTIONS[index % MAP_OPTIONS.length]
        })
        setMapNames(initialMapNames)
      }

      // Set initial current map
      if (mapSlots.length > 0) {
        setCurrentMap(mapSlots[0])
        setCurrentViewMap(mapSlots[0])
      }

      if (details.teams) {
        // Add players to each team
        const teamsWithPlayers = details.teams.map((team) => ({
          ...team,
          players: generateMockPlayers(team.id),
          placement: 0,
          totalKills: 0,
          totalPoints: 0,
        }))
        setTeams(teamsWithPlayers)

        // Initialize map results
        const initialMapResults = {}
        mapSlots.forEach((map) => {
          initialMapResults[map] = teamsWithPlayers.map((team) => ({
            teamId: team.id,
            placement: 0,
            players: team.players.map((player) => ({ ...player, kills: 0 })),
          }))
        })
        setMapResults(initialMapResults)
      }

      // If there are already results, load them
      if (details.mapResults) {
        setMapResults(details.mapResults)
      }
    } else {
      // If no details found, redirect back to step 1
      router.push("/admin/leaderboards/create")
    }
  }, [router])

  const handleMapNameChange = (mapSlot: string, newMapName: string) => {
    setMapNames((prev) => ({
      ...prev,
      [mapSlot]: newMapName,
    }))

    // Update leaderboard details with the new map name
    const updatedDetails = {
      ...leaderboardDetails,
      mapNames: {
        ...leaderboardDetails.mapNames,
        [mapSlot]: newMapName,
      },
    }
    localStorage.setItem("leaderboardDetails", JSON.stringify(updatedDetails))

    setEditingMapName(null)

    toast({
      title: "Map Name Updated",
      description: `${mapSlot} has been updated to ${newMapName}.`,
    })
  }

  const handlePlacementChange = (teamId: number, placement: string) => {
    const placementValue = Number.parseInt(placement) || 0

    // Update the placement for this team in the current map
    setMapResults((prev) => {
      const updatedMapResults = { ...prev }
      const teamIndex = updatedMapResults[currentMap].findIndex((t) => t.teamId === teamId)

      if (teamIndex !== -1) {
        updatedMapResults[currentMap][teamIndex] = {
          ...updatedMapResults[currentMap][teamIndex],
          placement: placementValue,
        }
      }

      return updatedMapResults
    })
  }

  const handlePlayerKillsChange = (teamId: number, playerId: string, kills: string) => {
    const killsValue = Number.parseInt(kills) || 0

    // Update the kills for this player in the current map
    setMapResults((prev) => {
      const updatedMapResults = { ...prev }
      const teamIndex = updatedMapResults[currentMap].findIndex((t) => t.teamId === teamId)

      if (teamIndex !== -1) {
        const playerIndex = updatedMapResults[currentMap][teamIndex].players.findIndex((p) => p.id === playerId)

        if (playerIndex !== -1) {
          updatedMapResults[currentMap][teamIndex].players[playerIndex] = {
            ...updatedMapResults[currentMap][teamIndex].players[playerIndex],
            kills: killsValue,
          }
        }
      }

      return updatedMapResults
    })
  }

  const handleImageUpload = (mapSlot: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // In a real app, you would upload this to a server and get a URL back
    // For this example, we'll create a fake URL
    const fakeImageUrl = URL.createObjectURL(file)

    setMapImages((prev) => ({
      ...prev,
      [mapSlot]: fakeImageUrl,
    }))

    // Update leaderboard details with the new image
    const updatedDetails = {
      ...leaderboardDetails,
      mapImages: {
        ...leaderboardDetails.mapImages,
        [mapSlot]: fakeImageUrl,
      },
    }
    localStorage.setItem("leaderboardDetails", JSON.stringify(updatedDetails))

    // Simulate image processing
    setProcessingImage(true)
    setTimeout(() => {
      setProcessingImage(false)

      // In a real app, this would be the result of OCR processing
      // For this demo, we'll just simulate some random data
      const updatedMapResults = { ...mapResults }
      updatedMapResults[mapSlot] = updatedMapResults[mapSlot].map((teamResult, index) => {
        const randomPlacement = index + 1
        const randomKills = Math.floor(Math.random() * 15)

        return {
          ...teamResult,
          placement: randomPlacement,
          players: teamResult.players.map((player) => ({
            ...player,
            kills: Math.floor(Math.random() * 5),
          })),
        }
      })

      setMapResults(updatedMapResults)

      toast({
        title: "Image Processed",
        description: `${mapSlot} (${mapNames[mapSlot]}) leaderboard image has been processed. Please review the extracted data.`,
      })
    }, 2000)
  }

  const handleRemoveImage = (mapSlot: string) => {
    // Remove image and update state
    const updatedMapImages = { ...mapImages }
    delete updatedMapImages[mapSlot]
    setMapImages(updatedMapImages)

    // Update leaderboard details
    const updatedDetails = { ...leaderboardDetails }
    if (updatedDetails.mapImages) {
      delete updatedDetails.mapImages[mapSlot]
    }
    localStorage.setItem("leaderboardDetails", JSON.stringify(updatedDetails))

    toast({
      title: "Image Removed",
      description: `${mapSlot} (${mapNames[mapSlot]}) leaderboard image has been removed.`,
    })
  }

  const calculateMapPoints = (mapSlot: string) => {
    if (!leaderboardDetails || !leaderboardDetails.pointSystem) return []

    const { pointsPerKill, placementPoints } = leaderboardDetails.pointSystem
    const killPointValue = Number.parseInt(pointsPerKill) || 1

    // Calculate points for the specific map
    const mapTeamResults = [...mapResults[mapSlot]]

    mapTeamResults.forEach((teamResult) => {
      // Calculate total kills for the team in this map
      const totalKills = teamResult.players.reduce((sum, player) => sum + player.kills, 0)

      // Calculate placement points (for Battle Royale)
      let placementPointsValue = 0
      if (leaderboardDetails.gameType === "battle_royale" && teamResult.placement > 0) {
        const placementPoint = placementPoints.find((p) => p.position === teamResult.placement)
        placementPointsValue = placementPoint ? placementPoint.points : 0
      }

      // Calculate total points for this map
      const totalPoints = totalKills * killPointValue + placementPointsValue

      teamResult.totalKills = totalKills
      teamResult.placementPoints = placementPointsValue
      teamResult.totalPoints = totalPoints
    })

    // Sort teams by points for this map
    mapTeamResults.sort((a, b) => {
      if (a.totalPoints !== b.totalPoints) {
        return b.totalPoints - a.totalPoints
      }

      // Apply tiebreakers in order
      for (const tiebreaker of leaderboardDetails.pointSystem.tiebreakers) {
        if (tiebreaker.id === "kills") {
          if (a.totalKills !== b.totalKills) {
            return b.totalKills - a.totalKills
          }
        } else if (tiebreaker.id === "placements") {
          if (a.placement !== b.placement) {
            return a.placement - b.placement
          }
        }
      }

      return 0
    })

    // Assign positions for this map
    mapTeamResults.forEach((teamResult, index) => {
      teamResult.position = index + 1
    })

    return mapTeamResults
  }

  const calculateTotalPoints = () => {
    if (!leaderboardDetails || !leaderboardDetails.pointSystem) return

    const { pointsPerKill, placementPoints } = leaderboardDetails.pointSystem
    const killPointValue = Number.parseInt(pointsPerKill) || 1

    // Calculate points for each team in each map
    const calculatedMapResults = { ...mapResults }

    Object.keys(calculatedMapResults).forEach((map) => {
      calculatedMapResults[map] = calculatedMapResults[map].map((teamResult) => {
        // Calculate total kills for the team in this map
        const totalKills = teamResult.players.reduce((sum, player) => sum + player.kills, 0)

        // Calculate placement points (for Battle Royale)
        let placementPointsValue = 0
        if (leaderboardDetails.gameType === "battle_royale" && teamResult.placement > 0) {
          const placementPoint = placementPoints.find((p) => p.position === teamResult.placement)
          placementPointsValue = placementPoint ? placementPoint.points : 0
        }

        // Calculate total points for this map
        const totalPoints = totalKills * killPointValue + placementPointsValue

        return {
          ...teamResult,
          totalKills,
          placementPoints: placementPointsValue,
          totalPoints,
        }
      })
    })

    setMapResults(calculatedMapResults)

    // Calculate overall results
    const updatedTeams = teams.map((team) => {
      let totalKills = 0
      let totalPlacementPoints = 0
      let totalPoints = 0
      let totalPlacements = 0
      let booyahCount = 0

      Object.values(calculatedMapResults).forEach((mapResult: any[]) => {
        const teamResult = mapResult.find((result) => result.teamId === team.id)
        if (teamResult) {
          totalKills += teamResult.totalKills || 0
          totalPlacementPoints += teamResult.placementPoints || 0
          totalPoints += teamResult.totalPoints || 0
          totalPlacements += teamResult.placement || 0
          if (teamResult.placement === 1) booyahCount++
        }
      })

      return {
        ...team,
        totalKills,
        totalPlacementPoints,
        totalPoints,
        averagePlacement: totalPlacements / Object.keys(calculatedMapResults).length,
        booyahCount,
      }
    })

    // Sort teams by points (and apply tiebreakers if needed)
    updatedTeams.sort((a, b) => {
      if (a.totalPoints !== b.totalPoints) {
        return b.totalPoints - a.totalPoints
      }

      // Apply tiebreakers in order
      for (const tiebreaker of leaderboardDetails.pointSystem.tiebreakers) {
        if (tiebreaker.id === "booyah") {
          if (a.booyahCount !== b.booyahCount) {
            return b.booyahCount - a.booyahCount
          }
        } else if (tiebreaker.id === "kills") {
          if (a.totalKills !== b.totalKills) {
            return b.totalKills - a.totalKills
          }
        } else if (tiebreaker.id === "placements") {
          if (a.averagePlacement !== b.averagePlacement) {
            return a.averagePlacement - b.averagePlacement
          }
        } else if (tiebreaker.id === "last_map") {
          const lastMap = maps[maps.length - 1]
          const aLastMapResult = calculatedMapResults[lastMap].find((result) => result.teamId === a.id)
          const bLastMapResult = calculatedMapResults[lastMap].find((result) => result.teamId === b.id)

          if (aLastMapResult && bLastMapResult && aLastMapResult.placement !== bLastMapResult.placement) {
            return aLastMapResult.placement - bLastMapResult.placement
          }
        }
      }

      return 0
    })

    // Assign final positions
    updatedTeams.forEach((team, index) => {
      team.position = index + 1
    })

    setTeams(updatedTeams)

    return {
      teams: updatedTeams,
      mapResults: calculatedMapResults,
      mapNames: mapNames,
    }
  }

  const handleSaveProgress = () => {
    // Calculate current points
    const results = calculateTotalPoints()

    if (!results) return

    // Update leaderboard details with results
    const updatedDetails = {
      ...leaderboardDetails,
      teams: results.teams,
      mapResults: results.mapResults,
      mapImages: mapImages,
      mapNames: mapNames,
      savedProgress: true,
    }

    localStorage.setItem("leaderboardDetails", JSON.stringify(updatedDetails))

    // Show success message
    toast({
      title: "Progress Saved",
      description: "Your leaderboard progress has been saved.",
    })
  }

  const handleSubmit = () => {
    const results = calculateTotalPoints()

    if (!results) return

    // Update leaderboard details with results
    const updatedDetails = {
      ...leaderboardDetails,
      teams: results.teams,
      mapResults: results.mapResults,
      mapImages: mapImages,
      mapNames: mapNames,
      finalResults: true,
    }

    localStorage.setItem("leaderboardDetails", JSON.stringify(updatedDetails))

    // Navigate to the final leaderboard view
    router.push("/admin/leaderboards/create/final")
  }

  const handleBack = () => {
    router.push("/admin/leaderboards/create/teams")
  }

  const handleViewLeaderboard = () => {
    calculateTotalPoints()
    setViewMode("leaderboard")
  }

  const handleBackToEntry = () => {
    setViewMode("entry")
  }

  const handleSaveMapLeaderboard = (mapSlot: string) => {
    // Calculate points for this map
    const mapTeamResults = calculateMapPoints(mapSlot)

    // Update map results
    setMapResults((prev) => ({
      ...prev,
      [mapSlot]: mapTeamResults,
    }))

    // Update leaderboard details with the updated map results
    const updatedMapResults = {
      ...mapResults,
      [mapSlot]: mapTeamResults,
    }

    const updatedDetails = {
      ...leaderboardDetails,
      mapResults: updatedMapResults,
      mapNames: mapNames,
    }

    localStorage.setItem("leaderboardDetails", JSON.stringify(updatedDetails))

    toast({
      title: "Map Leaderboard Saved",
      description: `${mapSlot} (${mapNames[mapSlot]}) leaderboard has been saved.`,
    })
  }

  if (!leaderboardDetails || !teams.length) {
    return <AdminLayout>Loading...</AdminLayout>
  }

  return (
    <AdminLayout>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-2">Create Leaderboard</h1>
        <p className="text-muted-foreground mb-8">Step 5 of 5: Results Entry</p>

        {viewMode === "entry" ? (
          <>
            {entryMethod === "manual" ? (
              // Manual Entry UI
              <Card className="mb-8">
                <CardHeader>
                  <CardTitle>Enter Match Results</CardTitle>
                  <CardDescription>Enter team placements and player kills for each map</CardDescription>
                </CardHeader>
                <CardContent>
                  <Tabs value={currentMap} onValueChange={setCurrentMap}>
                    <TabsList className="mb-4">
                      {maps.map((mapSlot) => (
                        <TabsTrigger key={mapSlot} value={mapSlot} className="relative pr-8">
                          <span>{mapNames[mapSlot] || mapSlot}</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="absolute right-0 top-1/2 -translate-y-1/2 h-6 w-6"
                            onClick={(e) => {
                              e.stopPropagation()
                              setEditingMapName(mapSlot)
                            }}
                          >
                            <Edit2 className="h-3 w-3" />
                            <span className="sr-only">Edit map name</span>
                          </Button>
                        </TabsTrigger>
                      ))}
                    </TabsList>

                    {maps.map((mapSlot) => (
                      <TabsContent key={mapSlot} value={mapSlot}>
                        <div className="flex justify-between items-center mb-4">
                          <div className="flex items-center">
                            <h3 className="text-lg font-medium">{mapNames[mapSlot] || mapSlot}</h3>
                          </div>
                          <Button variant="outline" size="sm" onClick={() => handleSaveMapLeaderboard(mapSlot)}>
                            <Save className="w-4 h-4 mr-2" />
                            Save {mapNames[mapSlot] || mapSlot} Leaderboard
                          </Button>
                        </div>

                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Team</TableHead>
                              <TableHead>Placement</TableHead>
                              <TableHead>Players</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {mapResults[mapSlot]?.map((teamResult) => {
                              const team = teams.find((t) => t.id === teamResult.teamId)
                              return (
                                <TableRow key={teamResult.teamId}>
                                  <TableCell>
                                    <div className="flex items-center">
                                      <img
                                        src={team?.logo || "/placeholder.svg"}
                                        alt={team?.name}
                                        className="w-8 h-8 mr-2 rounded-full"
                                      />
                                      {team?.name}
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <Input
                                      type="number"
                                      value={teamResult.placement || ""}
                                      onChange={(e) => handlePlacementChange(teamResult.teamId, e.target.value)}
                                      min="1"
                                      max={teams.length}
                                      className="w-20"
                                    />
                                  </TableCell>
                                  <TableCell>
                                    <div className="space-y-2">
                                      {teamResult.players.map((player) => (
                                        <div key={player.id} className="flex items-center space-x-2">
                                          <span className="w-24 text-sm">{player.name}</span>
                                          <Label htmlFor={`${player.id}-kills`} className="text-sm">
                                            Kills:
                                          </Label>
                                          <Input
                                            id={`${player.id}-kills`}
                                            type="number"
                                            value={player.kills || ""}
                                            onChange={(e) =>
                                              handlePlayerKillsChange(teamResult.teamId, player.id, e.target.value)
                                            }
                                            min="0"
                                            className="w-16"
                                          />
                                        </div>
                                      ))}
                                    </div>
                                  </TableCell>
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
            ) : (
              // Image Scan UI
              <Card className="mb-8">
                <CardHeader>
                  <CardTitle>Upload & Process Leaderboard Images</CardTitle>
                  <CardDescription>Upload screenshots of your leaderboards for each map</CardDescription>
                </CardHeader>
                <CardContent>
                  <Tabs value={currentMap} onValueChange={setCurrentMap}>
                    <TabsList className="mb-4">
                      {maps.map((mapSlot) => (
                        <TabsTrigger key={mapSlot} value={mapSlot} className="relative pr-8">
                          <span>{mapNames[mapSlot] || mapSlot}</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="absolute right-0 top-1/2 -translate-y-1/2 h-6 w-6"
                            onClick={(e) => {
                              e.stopPropagation()
                              setEditingMapName(mapSlot)
                            }}
                          >
                            <Edit2 className="h-3 w-3" />
                            <span className="sr-only">Edit map name</span>
                          </Button>
                        </TabsTrigger>
                      ))}
                    </TabsList>

                    {maps.map((mapSlot) => (
                      <TabsContent key={mapSlot} value={mapSlot}>
                        <div className="space-y-6">
                          <div className="flex justify-between items-center">
                            <h3 className="text-lg font-medium">{mapNames[mapSlot] || mapSlot} Leaderboard</h3>
                          </div>

                          <Card>
                            <CardHeader className="pb-3">
                              <CardTitle className="text-lg">
                                {mapNames[mapSlot] || mapSlot} Leaderboard Image
                              </CardTitle>
                            </CardHeader>
                            <CardContent>
                              {mapImages[mapSlot] ? (
                                <div className="space-y-4">
                                  <div className="relative aspect-video w-full max-w-2xl mx-auto border rounded-md overflow-hidden">
                                    <img
                                      src={mapImages[mapSlot] || "/placeholder.svg"}
                                      alt={`${mapNames[mapSlot] || mapSlot} leaderboard`}
                                      className="object-contain w-full h-full"
                                    />
                                  </div>
                                </div>
                              ) : (
                                <div className="flex flex-col items-center justify-center border border-dashed rounded-md p-8 bg-muted/20">
                                  <Image className="h-10 w-10 text-muted-foreground mb-2" />
                                  <p className="text-sm text-muted-foreground mb-4">
                                    Upload a screenshot of the {mapNames[mapSlot] || mapSlot} leaderboard
                                  </p>
                                  <Label
                                    htmlFor={`image-upload-${mapSlot}`}
                                    className="cursor-pointer inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
                                  >
                                    Select Image
                                  </Label>
                                  <Input
                                    id={`image-upload-${mapSlot}`}
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={(e) => handleImageUpload(mapSlot, e)}
                                  />
                                </div>
                              )}
                            </CardContent>
                            {mapImages[mapSlot] && (
                              <CardFooter className="flex justify-between">
                                <Button variant="outline" onClick={() => handleRemoveImage(mapSlot)}>
                                  Replace Image
                                </Button>
                                <Button variant="outline" onClick={() => handleSaveMapLeaderboard(mapSlot)}>
                                  <Save className="w-4 h-4 mr-2" />
                                  Save {mapNames[mapSlot] || mapSlot} Leaderboard
                                </Button>
                              </CardFooter>
                            )}
                          </Card>

                          {processingImage && currentMap === mapSlot && (
                            <Alert>
                              <FileText className="h-4 w-4" />
                              <AlertTitle>Processing Image</AlertTitle>
                              <AlertDescription>
                                Analyzing the {mapNames[mapSlot] || mapSlot} leaderboard image and extracting data...
                              </AlertDescription>
                            </Alert>
                          )}

                          {mapImages[mapSlot] && !processingImage && (
                            <Card>
                              <CardHeader className="pb-3">
                                <CardTitle className="text-lg">Extracted Results</CardTitle>
                                <CardDescription>Review and edit the data extracted from the image</CardDescription>
                              </CardHeader>
                              <CardContent>
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead>Team</TableHead>
                                      <TableHead>Placement</TableHead>
                                      <TableHead>Players</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {mapResults[mapSlot]?.map((teamResult) => {
                                      const team = teams.find((t) => t.id === teamResult.teamId)
                                      return (
                                        <TableRow key={teamResult.teamId}>
                                          <TableCell>
                                            <div className="flex items-center">
                                              <img
                                                src={team?.logo || "/placeholder.svg"}
                                                alt={team?.name}
                                                className="w-8 h-8 mr-2 rounded-full"
                                              />
                                              {team?.name}
                                            </div>
                                          </TableCell>
                                          <TableCell>
                                            <Input
                                              type="number"
                                              value={teamResult.placement || ""}
                                              onChange={(e) => handlePlacementChange(teamResult.teamId, e.target.value)}
                                              min="1"
                                              max={teams.length}
                                              className="w-20"
                                            />
                                          </TableCell>
                                          <TableCell>
                                            <div className="space-y-2">
                                              {teamResult.players.map((player) => (
                                                <div key={player.id} className="flex items-center space-x-2">
                                                  <span className="w-24 text-sm">{player.name}</span>
                                                  <Label htmlFor={`${player.id}-kills`} className="text-sm">
                                                    Kills:
                                                  </Label>
                                                  <Input
                                                    id={`${player.id}-kills`}
                                                    type="number"
                                                    value={player.kills || ""}
                                                    onChange={(e) =>
                                                      handlePlayerKillsChange(
                                                        teamResult.teamId,
                                                        player.id,
                                                        e.target.value,
                                                      )
                                                    }
                                                    min="0"
                                                    className="w-16"
                                                  />
                                                </div>
                                              ))}
                                            </div>
                                          </TableCell>
                                        </TableRow>
                                      )
                                    })}
                                  </TableBody>
                                </Table>
                              </CardContent>
                            </Card>
                          )}
                        </div>
                      </TabsContent>
                    ))}
                  </Tabs>
                </CardContent>
              </Card>
            )}

            <div className="flex justify-between">
              <Button variant="outline" onClick={handleBack}>
                Back
              </Button>
              <div className="space-x-4">
                <Button variant="outline" onClick={handleSaveProgress}>
                  <Save className="w-4 h-4 mr-2" />
                  Save Progress
                </Button>
                <Button variant="outline" onClick={handleViewLeaderboard}>
                  <Eye className="w-4 h-4 mr-2" />
                  View Leaderboards
                </Button>
                <Button onClick={handleSubmit}>Continue to Final Leaderboard</Button>
              </div>
            </div>
          </>
        ) : (
          <>
            <Card className="mb-8">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>Leaderboard Preview</CardTitle>
                    <CardDescription>View leaderboards for individual maps or the overall standings</CardDescription>
                  </div>
                  <Button variant="outline" onClick={handleBackToEntry}>
                    Back to Results Entry
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <Tabs value={currentViewMap} onValueChange={setCurrentViewMap}>
                  <TabsList className="mb-4">
                    {maps.map((mapSlot) => (
                      <TabsTrigger key={mapSlot} value={mapSlot}>
                        {mapNames[mapSlot] || mapSlot}
                      </TabsTrigger>
                    ))}
                    <TabsTrigger value="overall">Overall</TabsTrigger>
                  </TabsList>

                  {maps.map((mapSlot) => (
                    <TabsContent key={mapSlot} value={mapSlot}>
                      <h3 className="text-xl font-semibold mb-4">{mapNames[mapSlot] || mapSlot} Leaderboard</h3>
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
                          {calculateMapPoints(mapSlot).map((teamResult) => {
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

                  <TabsContent value="overall">
                    <h3 className="text-xl font-semibold mb-4">Overall Leaderboard</h3>
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
                            <TableRow key={team.id}>
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
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>

            <div className="flex justify-between">
              <Button variant="outline" onClick={handleBackToEntry}>
                Back to Results Entry
              </Button>
              <Button onClick={handleSubmit}>Continue to Final Leaderboard</Button>
            </div>
          </>
        )}
      </div>

      {/* Map Name Edit Dialog */}
      <Dialog open={editingMapName !== null} onOpenChange={(open) => !open && setEditingMapName(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Map Name</DialogTitle>
            <DialogDescription>Select the map for {editingMapName}</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Select
              defaultValue={editingMapName ? mapNames[editingMapName] || "" : ""}
              onValueChange={(value) => editingMapName && handleMapNameChange(editingMapName, value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a map" />
              </SelectTrigger>
              <SelectContent>
                {MAP_OPTIONS.map((mapName) => (
                  <SelectItem key={mapName} value={mapName}>
                    {mapName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingMapName(null)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  )
}

export default ResultsEntryPage
