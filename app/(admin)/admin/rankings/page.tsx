"use client"

import { useState } from "react"
import AdminLayout from "@/components/AdminLayout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import Link from "next/link"

const AdminRankingsPage = () => {
  const [searchTerm, setSearchTerm] = useState("")
  const [filterType, setFilterType] = useState("all")

  // Mock data for rankings
  const rankings = [
    { id: 1, name: "Global Player Rankings", type: "Player", startDate: "2023-07-01", endDate: "2023-07-31" },
    { id: 2, name: "Team Rankings", type: "Team", startDate: "2023-07-01", endDate: "2023-07-31" },
    { id: 3, name: "Tournament MVP Rankings", type: "Player", startDate: "2023-07-01", endDate: "2023-07-31" },
  ]

  const filteredRankings = rankings.filter(
    (ranking) =>
      ranking.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
      (filterType === "all" || ranking.type === filterType),
  )

  return (
    <AdminLayout>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">Rankings Management</h1>

        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center space-x-4">
            <Input
              placeholder="Search rankings..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-64"
            />
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="Player">Player</SelectItem>
                <SelectItem value="Team">Team</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-x-2">
            <Button asChild>
              <Link href="/admin/rankings/create">Create New Ranking</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/admin/rankings/metrics">Edit Metrics</Link>
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Rankings</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Date Range</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRankings.map((ranking) => (
                  <TableRow key={ranking.id}>
                    <TableCell>{ranking.name}</TableCell>
                    <TableCell>{ranking.type}</TableCell>
                    <TableCell>{`${ranking.startDate} - ${ranking.endDate}`}</TableCell>
                    <TableCell>
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/admin/rankings/${ranking.id}`}>View</Link>
                      </Button>
                    </TableCell>
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

export default AdminRankingsPage
