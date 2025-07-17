"use client"

import { useState } from "react"
import { useParams, useRouter } from "next/navigation"
import AdminLayout from "@/components/AdminLayout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ImageUploader } from "@/components/ImageUploader"
import { useToast } from "@/components/ui/use-toast"

export default function LeaderboardPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [leaderboardData, setLeaderboardData] = useState([
    { rank: 1, team: "", kills: 0, points: 0 },
    { rank: 2, team: "", kills: 0, points: 0 },
    { rank: 3, team: "", kills: 0, points: 0 },
  ])
  const [resultImage, setResultImage] = useState("")

  const handleInputChange = (index: number, field: string, value: string) => {
    const updatedData = [...leaderboardData]
    updatedData[index] = { ...updatedData[index], [field]: value }
    setLeaderboardData(updatedData)
  }

  const handleImageUpload = (imageUrl: string) => {
    setResultImage(imageUrl)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")

    try {
      // Here you would typically send the data to your API
      // For now, we'll just simulate an API call
      await new Promise((resolve) => setTimeout(resolve, 1000))

      toast({
        title: "Results uploaded",
        description: "The tournament results have been successfully uploaded and saved as a draft.",
      })

      router.push("/admin/drafts")
    } catch (err) {
      setError("Failed to upload results. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <AdminLayout>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">Upload Tournament Results</h1>

        <Card>
          <CardHeader>
            <CardTitle>Leaderboard</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
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
                  {leaderboardData.map((row, index) => (
                    <TableRow key={row.rank}>
                      <TableCell>{row.rank}</TableCell>
                      <TableCell>
                        <Input
                          value={row.team}
                          onChange={(e) => handleInputChange(index, "team", e.target.value)}
                          placeholder="Team name"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={row.kills}
                          onChange={(e) => handleInputChange(index, "kills", e.target.value)}
                          placeholder="Kills"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={row.points}
                          onChange={(e) => handleInputChange(index, "points", e.target.value)}
                          placeholder="Points"
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <div>
                <Label htmlFor="resultImage">Upload Result Image</Label>
                <ImageUploader onImageUpload={handleImageUpload} />
              </div>

              <div className="flex space-x-4">
                <Button type="submit" disabled={isLoading}>
                  Upload Results and Save as Draft
                </Button>
                <Button type="button" variant="outline" onClick={() => router.back()}>
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
