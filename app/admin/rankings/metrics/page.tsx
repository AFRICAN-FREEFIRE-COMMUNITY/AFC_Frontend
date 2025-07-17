"use client"

import { useState } from "react"
import AdminLayout from "@/components/AdminLayout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

const metrics = [
  "tournament_kills",
  "tournament_placements",
  "tournament_positions",
  "tournament_finals_played",
  "tournament_wins",
  "scrim_kills",
  "scrim_placements",
  "scrim_positions",
  "scrim_wins",
]

const RankingMetricsPage = () => {
  const [weights, setWeights] = useState<Record<string, number>>(
    Object.fromEntries(metrics.map((metric) => [metric, 1])),
  )

  const handleWeightChange = (metric: string, value: string) => {
    setWeights((prev) => ({ ...prev, [metric]: Number.parseFloat(value) || 0 }))
  }

  const handleSaveWeights = () => {
    // TODO: Implement saving weights to backend
    console.log("Saving weights:", weights)
  }

  return (
    <AdminLayout>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">Ranking Metrics</h1>

        <Card>
          <CardHeader>
            <CardTitle>Edit Metric Weights</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Metric</TableHead>
                  <TableHead>Weight</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {metrics.map((metric) => (
                  <TableRow key={metric}>
                    <TableCell>{metric.replace(/_/g, " ")}</TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={weights[metric]}
                        onChange={(e) => handleWeightChange(metric, e.target.value)}
                        min={0}
                        step={0.1}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Button onClick={handleSaveWeights} className="mt-4">
              Save Weights
            </Button>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  )
}

export default RankingMetricsPage
