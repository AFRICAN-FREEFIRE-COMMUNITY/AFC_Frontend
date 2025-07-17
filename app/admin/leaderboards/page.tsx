"use client"

import { useState } from "react"
import AdminLayout from "@/components/AdminLayout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import Link from "next/link"
import { Plus, Search, Edit, Eye } from "lucide-react"

// Mock data for events and leaderboards
const mockEvents = [
  { id: 1, name: "Summer Showdown 2023", date: "2023-07-15", type: "Tournament" },
  { id: 2, name: "Fall Classic 2023", date: "2023-09-20", type: "Tournament" },
  { id: 3, name: "Winter Cup 2023", date: "2023-12-10", type: "Tournament" },
  { id: 4, name: "Weekly Scrim #1", date: "2023-07-05", type: "Scrim" },
  { id: 5, name: "Weekly Scrim #2", date: "2023-07-12", type: "Scrim" },
]

const mockLeaderboards = [
  { id: 1, eventId: 1, name: "Summer Showdown 2023 - Overall", type: "Overall" },
  { id: 2, eventId: 1, name: "Summer Showdown 2023 - Kills", type: "Kills" },
  { id: 3, eventId: 2, name: "Fall Classic 2023 - Overall", type: "Overall" },
  { id: 4, eventId: 4, name: "Weekly Scrim #1 - Overall", type: "Overall" },
]

const AdminLeaderboardsPage = () => {
  const [searchTerm, setSearchTerm] = useState("")
  const [filterType, setFilterType] = useState("all")
  const [events, setEvents] = useState(mockEvents)
  const [leaderboards, setLeaderboards] = useState(mockLeaderboards)

  const filteredEvents = events.filter(
    (event) =>
      event.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
      (filterType === "all" || event.type === filterType),
  )

  return (
    <AdminLayout>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">Leaderboards Management</h1>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Search Events</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-4 mb-4">
              <Input
                placeholder="Search events..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-grow"
              />
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="Tournament">Tournament</SelectItem>
                  <SelectItem value="Scrim">Scrim</SelectItem>
                </SelectContent>
              </Select>
              <Button>
                <Search className="mr-2 h-4 w-4" /> Search
              </Button>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Event Name</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEvents.map((event) => (
                  <TableRow key={event.id}>
                    <TableCell>{event.name}</TableCell>
                    <TableCell>{event.date}</TableCell>
                    <TableCell>{event.type}</TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Button asChild variant="outline" size="sm">
                          <Link href="/admin/leaderboards/create">
                            <Plus className="mr-2 h-4 w-4" /> Create Leaderboard
                          </Link>
                        </Button>
                        <Button asChild variant="outline" size="sm">
                          <Link href={`/admin/events/${event.id}/leaderboards`}>
                            <Eye className="mr-2 h-4 w-4" /> View Leaderboards
                          </Link>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>All Leaderboards</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Leaderboard Name</TableHead>
                  <TableHead>Event</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leaderboards.map((leaderboard) => {
                  const event = events.find((e) => e.id === leaderboard.eventId)
                  return (
                    <TableRow key={leaderboard.id}>
                      <TableCell>{leaderboard.name}</TableCell>
                      <TableCell>{event?.name}</TableCell>
                      <TableCell>{leaderboard.type}</TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          <Button asChild variant="outline" size="sm">
                            <Link href={`/admin/leaderboards/${leaderboard.id}/edit`}>
                              <Edit className="mr-2 h-4 w-4" /> Edit
                            </Link>
                          </Button>
                          <Button asChild variant="outline" size="sm">
                            <Link href={`/admin/leaderboards/${leaderboard.id}`}>
                              <Eye className="mr-2 h-4 w-4" /> View
                            </Link>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  )
}

export default AdminLeaderboardsPage
