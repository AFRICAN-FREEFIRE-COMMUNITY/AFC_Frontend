"use client"

import { useState } from "react"
import AdminLayout from "@/components/AdminLayout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import Link from "next/link"

const AdminMatchResultsPage = () => {
  const [searchTerm, setSearchTerm] = useState("")
  const [filterType, setFilterType] = useState("all")

  // Mock data for match results
  const matchResults = [
    { id: 1, tournament: "Summer Showdown", type: "Tournament", date: "2023-07-15", teams: 16, status: "Completed" },
    { id: 2, name: "Weekly Scrim #5", type: "Scrim", date: "2023-07-20", teams: 8, status: "Pending Review" },
    {
      id: 3,
      name: "Fall Classic Qualifiers",
      type: "Tournament",
      date: "2023-08-01",
      teams: 32,
      status: "In Progress",
    },
  ]

  const filteredResults = matchResults.filter(
    (result) =>
      (result.tournament?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        result.name?.toLowerCase().includes(searchTerm.toLowerCase())) &&
      (filterType === "all" || result.type === filterType),
  )

  return (
    <AdminLayout>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">Match Results Management</h1>

        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center space-x-4">
            <Input
              placeholder="Search match results..."
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
                <SelectItem value="Tournament">Tournament</SelectItem>
                <SelectItem value="Scrim">Scrim</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button asChild>
            <Link href="/admin/match-results/create">Add New Match Result</Link>
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Match Results</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Teams</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredResults.map((result) => (
                  <TableRow key={result.id}>
                    <TableCell>{result.tournament || result.name}</TableCell>
                    <TableCell>{result.type}</TableCell>
                    <TableCell>{result.date}</TableCell>
                    <TableCell>{result.teams}</TableCell>
                    <TableCell>{result.status}</TableCell>
                    <TableCell>
                      <Button asChild variant="outline" size="sm" className="mr-2">
                        <Link href={`/admin/match-results/${result.id}`}>View</Link>
                      </Button>
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/admin/match-results/${result.id}/edit`}>Edit</Link>
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

export default AdminMatchResultsPage
