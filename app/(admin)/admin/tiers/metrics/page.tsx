"use client"

import { useState } from "react"
import AdminLayout from "@/components/AdminLayout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useToast } from "@/components/ui/use-toast"
import { Label } from "@/components/ui/label"

const initialMetrics = [
  { name: "Tournament Wins", points: 20, type: "per_win" },
  { name: "Money Earned", points: 1, type: "per_1000" },
  { name: "Tournament Kills", points: 0.1, type: "per_kill" },
  { name: "Tournament Placements", points: 0.5, type: "per_top_placement" },
  { name: "Finals Appearances", points: 5, type: "per_appearance" },
  { name: "Social Media Followers", points: 0.01, type: "per_1000" },
  { name: "Social Media Posts", points: 0.1, type: "per_post" },
  { name: "Scrim Wins", points: 0.5, type: "per_win" },
  { name: "Scrim Kills", points: 0.05, type: "per_kill" },
  { name: "Scrim Placements", points: 0.2, type: "per_top_placement" },
]

const TierMetricsPage = () => {
  const { toast } = useToast()
  const [metrics, setMetrics] = useState(initialMetrics)

  const handlePointsChange = (index: number, value: string) => {
    const newMetrics = [...metrics]
    newMetrics[index].points = Number(value)
    setMetrics(newMetrics)
  }

  const handleSaveMetrics = () => {
    // In a real app, you would send this data to your backend
    console.log("Saving metrics:", metrics)
    toast({
      title: "Metrics Updated",
      description: "The tiering metrics have been updated successfully.",
    })
  }

  return (
    <AdminLayout>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">Tier Metrics</h1>

        <Card>
          <CardHeader>
            <CardTitle>Edit Metric Points</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Metric</TableHead>
                  <TableHead>Points</TableHead>
                  <TableHead>Type</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {metrics.map((metric, index) => (
                  <TableRow key={metric.name}>
                    <TableCell>
                      <Label htmlFor={`metric-${index}`}>{metric.name}</Label>
                    </TableCell>
                    <TableCell>
                      <Input
                        id={`metric-${index}`}
                        type="number"
                        value={metric.points}
                        onChange={(e) => handlePointsChange(index, e.target.value)}
                        min={0}
                        step={0.01}
                      />
                    </TableCell>
                    <TableCell>{metric.type}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Button onClick={handleSaveMetrics} className="mt-4">
              Save Metrics
            </Button>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  )
}

export default TierMetricsPage
