"use client"

import { useState, useEffect } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import AdminLayout from "@/components/AdminLayout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useToast } from "@/components/ui/use-toast"
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

// Mock data for rankings
const mockTeamRankings = [
  { id: 1, name: "Team Alpha", killPoints: 50, booyahPoints: 30, winPoints: 20, totalPoints: 100 },
  { id: 2, name: "Team Beta", killPoints: 45, booyahPoints: 25, winPoints: 20, totalPoints: 90 },
  { id: 3, name: "Team Gamma", killPoints: 40, booyahPoints: 20, winPoints: 20, totalPoints: 80 },
  { id: 4, name: "Team Delta", killPoints: 35, booyahPoints: 15, winPoints: 20, totalPoints: 70 },
  { id: 5, name: "Team Epsilon", killPoints: 30, booyahPoints: 10, winPoints: 20, totalPoints: 60 },
]

const mockPlayerRankings = [
  { id: 1, name: "John Doe", team: "Team Alpha", killPoints: 25, booyahPoints: 15, winPoints: 10, totalPoints: 50 },
  { id: 2, name: "Jane Smith", team: "Team Beta", killPoints: 22, booyahPoints: 13, winPoints: 10, totalPoints: 45 },
  { id: 3, name: "Mike Johnson", team: "Team Gamma", killPoints: 20, booyahPoints: 10, winPoints: 10, totalPoints: 40 },
  { id: 4, name: "Emily Brown", team: "Team Delta", killPoints: 18, booyahPoints: 7, winPoints: 10, totalPoints: 35 },
  {
    id: 5,
    name: "Chris Wilson",
    team: "Team Epsilon",
    killPoints: 15,
    booyahPoints: 5,
    winPoints: 10,
    totalPoints: 30,
  },
]

const EditRankingPage = () => {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { toast } = useToast()
  const [rankingName, setRankingName] = useState("")
  const [rankingType, setRankingType] = useState("")
  const [rankings, setRankings] = useState<any[]>([])
  const [isPublishDialogOpen, setIsPublishDialogOpen] = useState(false)

  useEffect(() => {
    const name = searchParams.get("name")
    const type = searchParams.get("type")
    if (name) setRankingName(name)
    if (type) setRankingType(type)

    // Set mock data based on ranking type
    setRankings(type === "team" ? mockTeamRankings : mockPlayerRankings)
  }, [searchParams])

  const handlePointsChange = (id: number, field: string, newValue: number) => {
    setRankings(
      rankings.map((rank) => {
        if (rank.id === id) {
          const updatedRank = { ...rank, [field]: newValue }
          updatedRank.totalPoints = updatedRank.killPoints + updatedRank.booyahPoints + updatedRank.winPoints
          return updatedRank
        }
        return rank
      }),
    )
  }

  const handlePublishRankings = () => {
    // In a real app, you would send the rankings to your backend for publishing
    console.log("Publishing rankings:", rankings)
    toast({
      title: "Rankings Published",
      description: "The rankings have been published successfully.",
    })
    setIsPublishDialogOpen(false)
    router.push("/admin/rankings") // Redirect to rankings list page
  }

  const handleCancel = () => {
    // In a real app, you might want to confirm before discarding changes
    router.push("/admin/rankings") // Redirect to rankings list page
  }

  return (
    <AdminLayout>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">Edit {rankingName}</h1>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle>{rankingType === "team" ? "Team Rankings" : "Player Rankings"}</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rank</TableHead>
                  <TableHead>Name</TableHead>
                  {rankingType === "player" && <TableHead>Team</TableHead>}
                  <TableHead>Kill Points</TableHead>
                  <TableHead>Booyah Points</TableHead>
                  <TableHead>Win Points</TableHead>
                  <TableHead>Total Points</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rankings.map((rank, index) => (
                  <TableRow key={rank.id}>
                    <TableCell>{index + 1}</TableCell>
                    <TableCell>{rank.name}</TableCell>
                    {rankingType === "player" && <TableCell>{rank.team}</TableCell>}
                    <TableCell>
                      <Input
                        type="number"
                        value={rank.killPoints}
                        onChange={(e) =>
                          handlePointsChange(rank.id, "killPoints", Math.max(0, Number.parseInt(e.target.value) || 0))
                        }
                        className="w-20"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={rank.booyahPoints}
                        onChange={(e) =>
                          handlePointsChange(rank.id, "booyahPoints", Math.max(0, Number.parseInt(e.target.value) || 0))
                        }
                        className="w-20"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={rank.winPoints}
                        onChange={(e) =>
                          handlePointsChange(rank.id, "winPoints", Math.max(0, Number.parseInt(e.target.value) || 0))
                        }
                        className="w-20"
                      />
                    </TableCell>
                    <TableCell>{rank.totalPoints}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <div className="flex justify-end space-x-4">
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <AlertDialog open={isPublishDialogOpen} onOpenChange={setIsPublishDialogOpen}>
            <AlertDialogTrigger asChild>
              <Button>Publish Rankings</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Publish Rankings</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to publish these rankings? This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handlePublishRankings}>Publish</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </AdminLayout>
  )
}

export default EditRankingPage
