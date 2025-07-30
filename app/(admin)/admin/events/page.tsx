"use client"

import { useState, useEffect } from "react"
import AdminLayout from "@/components/AdminLayout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import Link from "next/link"

// Mock function to fetch events
const fetchEvents = async (filters) => {
  // In a real app, this would be an API call with the filters applied
  return [
    {
      id: 1,
      name: "Summer Showdown",
      date: "2023-07-15",
      format: "Battle Royale",
      status: "Upcoming",
    },
    {
      id: 2,
      name: "Fall Classic",
      date: "2023-09-20",
      format: "Clash Squad",
      status: "Registration Open",
    },
    {
      id: 3,
      name: "Winter Cup",
      date: "2023-12-10",
      format: "Hybrid",
      status: "Planning",
    },
  ]
}

export default function EventsAndScrimsPage() {
  const [events, setEvents] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")
  const [searchTerm, setSearchTerm] = useState("")
  const [filterFormat, setFilterFormat] = useState("all")
  const [filterType, setFilterType] = useState("all")

  useEffect(() => {
    const getEvents = async () => {
      try {
        const data = await fetchEvents({
          searchTerm,
          format: filterFormat,
          type: filterType,
        })
        setEvents(data)
      } catch (err) {
        setError("Failed to fetch events")
      } finally {
        setIsLoading(false)
      }
    }

    getEvents()
  }, [searchTerm, filterFormat, filterType])

  if (isLoading) {
    return <AdminLayout>Loading events and scrims...</AdminLayout>
  }

  if (error) {
    return <AdminLayout>Error: {error}</AdminLayout>
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Format</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.map((event) => (
                  <TableRow key={event.id}>
                    <TableCell>{event.name}</TableCell>
                    <TableCell>{event.date}</TableCell>
                    <TableCell>{event.format}</TableCell>
                    <TableCell>{event.status}</TableCell>
                    <TableCell>
                      <Button asChild variant="outline" size="sm" className="mr-2">
                        <Link href={`/admin/events/${event.id}`}>View</Link>
                      </Button>
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/admin/events/${event.id}/edit`}>Edit</Link>
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
