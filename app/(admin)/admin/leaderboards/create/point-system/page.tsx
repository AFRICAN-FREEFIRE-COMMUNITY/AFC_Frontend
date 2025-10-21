"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import AdminLayout from "@/components/AdminLayout"
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd"
import { GripVertical } from "lucide-react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

const PointSystemPage = () => {
  const router = useRouter()
  const [leaderboardDetails, setLeaderboardDetails] = useState<any>(null)
  const [pointsPerKill, setPointsPerKill] = useState("1")

  // For Battle Royale placement points
  const [placementPoints, setPlacementPoints] = useState([
    { position: 1, points: 12 },
    { position: 2, points: 9 },
    { position: 3, points: 8 },
    { position: 4, points: 7 },
    { position: 5, points: 6 },
    { position: 6, points: 5 },
    { position: 7, points: 4 },
    { position: 8, points: 3 },
    { position: 9, points: 2 },
    { position: 10, points: 1 },
    { position: 11, points: 0 },
    { position: 12, points: 0 },
  ])

  // Tiebreaker order
  const [tiebreakers, setTiebreakers] = useState([
    { id: "booyah", name: "Booyah/Wins" },
    { id: "kills", name: "Kills" },
    { id: "placements", name: "Placements" },
    { id: "last_map", name: "Last Map Placement" },
  ])

  useEffect(() => {
    // Retrieve leaderboard details from localStorage
    const storedDetails = localStorage.getItem("leaderboardDetails")
    if (storedDetails) {
      const details = JSON.parse(storedDetails)
      setLeaderboardDetails(details)

      // If there are already point system settings, load them
      if (details.pointSystem) {
        setPointsPerKill(details.pointSystem.pointsPerKill)
        if (details.pointSystem.placementPoints) {
          setPlacementPoints(details.pointSystem.placementPoints)
        }
        if (details.pointSystem.tiebreakers) {
          setTiebreakers(details.pointSystem.tiebreakers)
        }
      }
    } else {
      // If no details found, redirect back to step 1
      router.push("/admin/leaderboards/create")
    }
  }, [router])

  const handlePlacementPointChange = (position: number, points: string) => {
    const numPoints = Number.parseInt(points) || 0
    setPlacementPoints((prev) =>
      prev.map((item) => (item.position === position ? { ...item, points: numPoints } : item)),
    )
  }

  const handleTiebreakerDragEnd = (result) => {
    if (!result.destination) return

    const items = Array.from(tiebreakers)
    const [reorderedItem] = items.splice(result.source.index, 1)
    items.splice(result.destination.index, 0, reorderedItem)

    setTiebreakers(items)
  }

  const handleContinue = () => {
    // Update leaderboard details with point system
    const pointSystem = {
      pointsPerKill,
      placementPoints,
      tiebreakers,
    }

    const updatedDetails = { ...leaderboardDetails, pointSystem }
    localStorage.setItem("leaderboardDetails", JSON.stringify(updatedDetails))

    // Navigate to the next step
    router.push("/admin/leaderboards/create/teams")
  }

  const handleBack = () => {
    router.push("/admin/leaderboards/create/game-type")
  }

  if (!leaderboardDetails) {
    return <AdminLayout>Loading...</AdminLayout>
  }

  return (
    <AdminLayout>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-2">Create Leaderboard</h1>
        <p className="text-muted-foreground mb-8">Step 3 of 5: Point System</p>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Configure Point System</CardTitle>
            <CardDescription>Set up how points are calculated for {leaderboardDetails.leaderboardName}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div>
                <Label htmlFor="pointsPerKill">Points Per Kill</Label>
                <Input
                  id="pointsPerKill"
                  type="number"
                  value={pointsPerKill}
                  onChange={(e) => setPointsPerKill(e.target.value)}
                  min="0"
                  className="w-32"
                />
              </div>

              {leaderboardDetails.gameType === "battle_royale" && (
                <div>
                  <Label className="mb-2 block">Placement Points</Label>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Position</TableHead>
                        <TableHead>Points</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {placementPoints.map((placement) => (
                        <TableRow key={placement.position}>
                          <TableCell>{placement.position}</TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              value={placement.points}
                              onChange={(e) => handlePlacementPointChange(placement.position, e.target.value)}
                              min="0"
                              className="w-20"
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              <div>
                <Label className="mb-2 block">Tiebreaker Order (Drag to reorder)</Label>
                <DragDropContext onDragEnd={handleTiebreakerDragEnd}>
                  <Droppable droppableId="tiebreakers">
                    {(provided) => (
                      <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-2">
                        {tiebreakers.map((tiebreaker, index) => (
                          <Draggable key={tiebreaker.id} draggableId={tiebreaker.id} index={index}>
                            {(provided) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                className="flex items-center p-3 border rounded-md bg-background"
                              >
                                <div {...provided.dragHandleProps} className="mr-2">
                                  <GripVertical className="h-5 w-5 text-muted-foreground" />
                                </div>
                                <span>
                                  {index + 1}. {tiebreaker.name}
                                </span>
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </DragDropContext>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-between">
          <Button variant="outline" onClick={handleBack}>
            Back
          </Button>
          <Button onClick={handleContinue}>Continue to Team Selection</Button>
        </div>
      </div>
    </AdminLayout>
  )
}

export default PointSystemPage
