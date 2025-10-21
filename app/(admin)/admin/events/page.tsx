"use client"

import { useState, useEffect } from "react"
import AdminLayout from "@/components/AdminLayout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Loader2, AlertCircle } from "lucide-react"
import Link from "next/link"
import { useEvents } from "@/hooks/useAdminApi"

export default function EventsAndScrimsPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [filterFormat, setFilterFormat] = useState("all")
  const [filterType, setFilterType] = useState("all")

  // Build filters object
  const filters = {
    ...(searchTerm && { search: searchTerm }),
    ...(filterFormat !== "all" && { format: filterFormat }),
    ...(filterType !== "all" && { type: filterType }),
  }

  const { data: events, loading, error, pagination, updateParams, changePage } = useEvents(filters)

  // Update filters when search/filter values change
  useEffect(() => {
    updateParams(filters)
  }, [searchTerm, filterFormat, filterType])

  const getStatusBadgeVariant = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
      case 'live':
        return 'default'
      case 'upcoming':
        return 'secondary'
      case 'completed':
        return 'outline'
      case 'cancelled':
        return 'destructive'
      default:
        return 'secondary'
    }
  }

  return (
    <AdminLayout>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">Events Management</h1>

        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center space-x-4">
            <Input
              placeholder="Search events..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-64"
            />
            <Select value={filterFormat} onValueChange={setFilterFormat}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Filter by format" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Formats</SelectItem>
                <SelectItem value="Battle Royale">Battle Royale</SelectItem>
                <SelectItem value="Clash Squad">Clash Squad</SelectItem>
                <SelectItem value="Hybrid">Hybrid</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="tournament">Tournaments</SelectItem>
                <SelectItem value="scrim">Scrims</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button asChild>
            <Link href="/admin/events/create">Create New Event</Link>
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Events & Scrims</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin" />
                <span className="ml-2">Loading events...</span>
              </div>
            ) : error ? (
              <div className="flex items-center justify-center py-8 text-red-500">
                <AlertCircle className="h-8 w-8" />
                <span className="ml-2">Error: {error}</span>
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Format</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Participants</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {events && events.length > 0 ? (
                      events.map((event: any) => (
                        <TableRow key={event.id}>
                          <TableCell className="font-medium">{event.name}</TableCell>
                          <TableCell>
                            {new Date(event.startDate).toLocaleDateString()}
                          </TableCell>
                          <TableCell>{event.format}</TableCell>
                          <TableCell className="capitalize">{event.type}</TableCell>
                          <TableCell>
                            <Badge variant={getStatusBadgeVariant(event.status)}>
                              {event.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {event.participantCount || 0} / {event.maxParticipants || 'Unlimited'}
                          </TableCell>
                          <TableCell>
                            <div className="flex space-x-2">
                              <Button asChild variant="outline" size="sm">
                                <Link href={`/admin/events/${event.id}`}>View</Link>
                              </Button>
                              <Button asChild variant="outline" size="sm">
                                <Link href={`/admin/events/${event.id}/edit`}>Edit</Link>
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                          No events found
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>

                {/* Pagination */}
                {pagination && pagination.totalPages > 1 && (
                  <div className="flex items-center justify-between mt-4">
                    <div className="text-sm text-muted-foreground">
                      Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
                      {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
                      {pagination.total} events
                    </div>
                    <div className="flex space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => changePage(pagination.page - 1)}
                        disabled={pagination.page <= 1}
                      >
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => changePage(pagination.page + 1)}
                        disabled={pagination.page >= pagination.totalPages}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  )
}
