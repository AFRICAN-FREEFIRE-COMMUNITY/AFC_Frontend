"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import AdminLayout from "@/components/AdminLayout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import Link from "next/link"

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

const ViewRankingPage = () => {
  const params = useParams()
  const router = useRouter()
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
          <h1 className="text-3xl font-bold">{rankingData.name}</h1>
          <div className="space-x-4">
            <Button variant="outline" onClick={() => router.back()}>
              Back
            </Button>
            <Button asChild>
              <Link href={`/admin/rankings/${params.id}/edit`}>Edit Rankings</Link>
            </Button>
          </div>
        </div>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Ranking Details</CardTitle>
          </CardHeader>
          <CardContent>
            <p>
              <strong>Type:</strong> {rankingData.type}
            </p>
            <p>
              <strong>Date Range:</strong> {rankingData.startDate} - {rankingData.endDate}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Rankings</CardTitle>
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
                {rankingData.rankings.map((rank) => (
                  <TableRow key={rank.rank}>
                    <TableCell>{rank.rank}</TableCell>
                    <TableCell>{rank.name}</TableCell>
                    <TableCell>{rank.killPoints}</TableCell>
                    <TableCell>{rank.booyahPoints}</TableCell>
                    <TableCell>{rank.winPoints}</TableCell>
                    <TableCell>{rank.totalPoints}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  )
}

export default ViewRankingPage
