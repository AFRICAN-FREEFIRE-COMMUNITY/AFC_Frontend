"use client"

import { useState, useEffect } from "react"
import AdminLayout from "@/components/AdminLayout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import Link from "next/link"
import { Plus, Search, Edit, Eye, Loader2, AlertCircle } from "lucide-react"
import { useEvents, useLeaderboards } from "@/hooks/useAdminApi"

const AdminLeaderboardsPage = () => {
  const [searchTerm, setSearchTerm] = useState("")
  const [filterType, setFilterType] = useState("all")
  const [eventsParams, setEventsParams] = useState({})
  const [leaderboardsParams, setLeaderboardsParams] = useState({})

  // API hooks
  const { data: events, loading: eventsLoading, error: eventsError } = useEvents(eventsParams)
  const { data: leaderboards, loading: leaderboardsLoading, error: leaderboardsError } = useLeaderboards(leaderboardsParams)

  // Update API parameters when filters change
  useEffect(() => {
    const filters: any = {}
    if (searchTerm) filters.search = searchTerm
    if (filterType !== "all") filters.type = filterType
    setEventsParams(filters)
  }, [searchTerm, filterType])

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

            {eventsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin" />
                <span className="ml-2">Loading events...</span>
              </div>
            ) : eventsError ? (
              <div className="flex items-center justify-center py-8 text-red-500">
                <AlertCircle className="h-8 w-8 mr-2" />
                <span>Error loading events: {typeof eventsError === 'string' ? eventsError : 'An error occurred'}</span>
              </div>
            ) : (
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
                  {events?.map((event: any) => (
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
                  {events?.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8">
                        No events found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>All Leaderboards</CardTitle>
          </CardHeader>
          <CardContent>
            {leaderboardsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin" />
                <span className="ml-2">Loading leaderboards...</span>
              </div>
            ) : leaderboardsError ? (
              <div className="flex items-center justify-center py-8 text-red-500">
                <AlertCircle className="h-8 w-8 mr-2" />
                <span>Error loading leaderboards: {typeof leaderboardsError === 'string' ? leaderboardsError : 'An error occurred'}</span>
              </div>
            ) : (
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
                  {leaderboards?.map((leaderboard: any) => {
                    const event = events?.find((e: any) => e.id === leaderboard.eventId)
                    return (
                      <TableRow key={leaderboard.id}>
                        <TableCell>{leaderboard.name}</TableCell>
                        <TableCell>{event?.name || 'Unknown Event'}</TableCell>
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
                  {leaderboards?.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8">
                        No leaderboards found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  )
}

export default AdminLeaderboardsPage
