"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import AdminLayout from "@/components/AdminLayout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useToast } from "@/components/ui/use-toast"

// Mock function to fetch ranking data
const fetchRankingData = async (id: string) => {
  // In a real app, this would be an API call
  await new Promise((resolve) => setTimeout(resolve, 500)) // Simulate API delay
  return {
    id,
    name: "Global Player Rankings",
    type: "Player",
    startDate: "2023-07-01",
    endDate: "2023-07-31",
    rankings: [
      { rank: 1, name: "John Doe", killPoints: 100, booyahPoints: 50, winPoints: 30, totalPoints: 180 },
      { rank: 2, name: "Jane Smith", killPoints: 90, booyahPoints: 45, winPoints: 25, totalPoints: 160 },
      { rank: 3, name: "Mike Johnson", killPoints: 80, booyahPoints: 40, winPoints: 20, totalPoints: 140 },
      { rank: 4, name: "Emily Brown", killPoints: 70, booyahPoints: 35, winPoints: 15, totalPoints: 120 },
      { rank: 5, name: "Chris Wilson", killPoints: 60, booyahPoints: 30, winPoints: 10, totalPoints: 100 },
    ],
  }
}

const EditRankingPage = () => {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const [rankingData, setRankingData] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadRankingData = async () => {
      try {
        const data = await fetchRankingData(params.id as string)
        setRankingData(data)
      } catch (error) {
        console.error("Failed to load ranking data:", error)
      } finally {
        setIsLoading(false)
      }
    }

    loadRankingData()
  }, [params.id])

  const handlePointsChange = (index: number, field: string, value: number) => {
    const updatedRankings = [...rankingData.rankings]
    updatedRankings[index][field] = value
    updatedRankings[index].totalPoints =
      updatedRankings[index].killPoints + updatedRankings[index].booyahPoints + updatedRankings[index].winPoints
    setRankingData({ ...rankingData, rankings: updatedRankings })
  }

  const handleUpdateRankings = () => {
    // In a real app, you would send the updated rankings to your backend
    console.log("Updating rankings:", rankingData.rankings)
    toast({
      title: "Rankings Updated",
      description: "The rankings have been updated successfully.",
    })
    router.push(`/admin/rankings/${params.id}`)
  }

  if (isLoading) {
    return <AdminLayout>Loading ranking data...</AdminLayout>
  }

  if (!rankingData) {
    return <AdminLayout>Ranking not found</AdminLayout>
  }

  return (
    <AdminLayout>
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Edit {rankingData.name}</h1>
          <Button variant="outline" onClick={() => router.back()}>
            Back
          </Button>
        </div>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Edit Rankings</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rank</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Kill Points</TableHead>
                  <TableHead>Booyah Points</TableHead>
                  <TableHead>Win Points</TableHead>
                  <TableHead>Total Points</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rankingData.rankings.map((rank, index) => (
                  <TableRow key={rank.rank}>
                    <TableCell>{rank.rank}</TableCell>
                    <TableCell>{rank.name}</TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={rank.killPoints}
                        onChange={(e) => handlePointsChange(index, "killPoints", Number(e.target.value))}
                        className="w-20"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={rank.booyahPoints}
                        onChange={(e) => handlePointsChange(index, "booyahPoints", Number(e.target.value))}
                        className="w-20"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={rank.winPoints}
                        onChange={(e) => handlePointsChange(index, "winPoints", Number(e.target.value))}
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
          <Button variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button onClick={handleUpdateRankings}>Update Rankings</Button>
        </div>
      </div>
    </AdminLayout>
  )
}

export default EditRankingPage
