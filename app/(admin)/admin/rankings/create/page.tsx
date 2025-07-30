"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import AdminLayout from "@/components/AdminLayout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DatePickerWithRange } from "@/components/ui/date-picker-with-range"
import { Label } from "@/components/ui/label"
import { useToast } from "@/components/ui/use-toast"
import { addDays } from "date-fns"

const CreateRankingPage = () => {
  const router = useRouter()
  const { toast } = useToast()
  const [rankingType, setRankingType] = useState("")
  const [dateRange, setDateRange] = useState({
    from: new Date(),
    to: addDays(new Date(), 30),
  })
  const [rankingName, setRankingName] = useState("")

  useEffect(() => {
    if (dateRange.from) {
      const monthName = dateRange.from.toLocaleString("default", { month: "long" })
      const year = dateRange.from.getFullYear()
      setRankingName(`${monthName} ${year} Ranking`)
    }
  }, [dateRange.from])

  const handleCreateRanking = () => {
    // In a real app, you would send this data to your backend
    console.log("Creating ranking:", { rankingName, rankingType, dateRange })

    toast({
      title: "Ranking Created",
      description: `${rankingName} has been created successfully.`,
    })

    // Redirect to the edit page with mock data
    router.push(`/admin/rankings/edit?name=${encodeURIComponent(rankingName)}&type=${rankingType}`)
  }

  return (
    <AdminLayout>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">Create New Ranking</h1>

        <Card>
          <CardHeader>
            <CardTitle>Ranking Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <Label htmlFor="ranking-type">Ranking Type</Label>
                <Select value={rankingType} onValueChange={setRankingType}>
                  <SelectTrigger id="ranking-type">
                    <SelectValue placeholder="Select ranking type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="team">Team Ranking</SelectItem>
                    <SelectItem value="player">Player Ranking</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Ranking Period</Label>
                <DatePickerWithRange dateRange={dateRange} setDateRange={setDateRange} />
              </div>

              <div>
                <Label>Ranking Name</Label>
                <p className="text-sm text-muted-foreground">{rankingName}</p>
              </div>

              <Button onClick={handleCreateRanking} disabled={!rankingType || !dateRange.from || !dateRange.to}>
                Create Ranking
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  )
}

export default CreateRankingPage
