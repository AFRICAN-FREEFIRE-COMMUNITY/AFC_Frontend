"use client"

import { useState } from "react"
import AdminLayout from "@/components/AdminLayout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import Link from "next/link"

export default function AdminNewsPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [filterCategory, setFilterCategory] = useState("all")
  const [error, setError] = useState("")

  // Mock data for news and announcements
  const newsItems = [
    {
      id: "1",
      title: "New Tournament Series Announced",
      content:
        "<p>AFC is proud to announce the launch of the 'African Freefire Masters' tournament series, starting next month. This exciting new series will bring together the best teams from across the continent to compete for glory and substantial prize pools. Stay tuned for more details on registration, format, and schedules.</p>",
      date: "2023-07-01T14:30:00Z",
      author: {
        username: "john_doe",
      },
      image: "/placeholder.svg?height=400&width=800",
      category: "tournament-updates",
      event: "Summer Showdown 2023",
      eventId: "1",
    },
    {
      id: "2",
      title: "Player Transfer Window Open",
      category: "Teams",
      date: "2023-07-15",
      author: { username: "jane_doe" },
    },
    {
      id: "3",
      title: "Season 3 Rankings Released",
      category: "Rankings",
      date: "2023-07-31",
      author: { username: "admin" },
    },
  ]

  const filteredNewsItems = newsItems.filter(
    (item) =>
      item.title.toLowerCase().includes(searchTerm.toLowerCase()) &&
      (filterCategory === "all" || item.category === filterCategory),
  )

  if (error) {
    return <AdminLayout>Error: {error}</AdminLayout>
  }

  return (
    <AdminLayout>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">News & Announcements Management</h1>

        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center space-x-4">
            <Input
              placeholder="Search news..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-64"
            />
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Filter by category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="tournament-updates">Tournaments</SelectItem>
                <SelectItem value="Teams">Teams</SelectItem>
                <SelectItem value="Rankings">Rankings</SelectItem>
                <SelectItem value="General">General</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button asChild>
            <Link href="/admin/news/create">Create New Announcement</Link>
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>News & Announcements</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Author</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredNewsItems.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.title}</TableCell>
                    <TableCell>{item.category}</TableCell>
                    <TableCell>{item.date}</TableCell>
                    <TableCell>{item.author.username}</TableCell>
                    <TableCell>
                      <Button asChild variant="outline" size="sm" className="mr-2">
                        <Link href={`/admin/news/${item.id}`}>View</Link>
                      </Button>
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/admin/news/${item.id}/edit`}>Edit</Link>
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
