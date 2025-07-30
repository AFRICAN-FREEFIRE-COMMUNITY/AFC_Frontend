"use client"

import { useState, useEffect } from "react"
import AdminLayout from "@/components/AdminLayout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import Link from "next/link"
import { useToast } from "@/components/ui/use-toast"

// Mock function to fetch drafts
const fetchDrafts = async () => {
  // Simulating an API call
  await new Promise((resolve) => setTimeout(resolve, 1000))
  return [
    { id: 1, name: "Summer Showdown Draft", type: "tournament", lastEdited: "2023-07-01" },
    { id: 2, name: "Weekly Scrim #5 Draft", type: "scrim", lastEdited: "2023-07-02" },
    { id: 3, name: "News Post Draft", type: "news", lastEdited: "2023-07-03" },
  ]
}

export default function DraftsPage() {
  const [drafts, setDrafts] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")
  const [searchTerm, setSearchTerm] = useState("")
  const [filterType, setFilterType] = useState("all")
  const { toast } = useToast()

  useEffect(() => {
    const getDrafts = async () => {
      try {
        const data = await fetchDrafts()
        setDrafts(data)
      } catch (err) {
        setError("Failed to fetch drafts")
      } finally {
        setIsLoading(false)
      }
    }

    getDrafts()
  }, [])

  const filteredDrafts = drafts.filter(
    (draft) =>
      draft.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
      (filterType === "all" || draft.type === filterType),
  )

  const handleDelete = async (id: number) => {
    // Here you would typically send a delete request to your API
    // For now, we'll just simulate an API call and update the local state
    setIsLoading(true)
    try {
      await new Promise((resolve) => setTimeout(resolve, 1000))
      setDrafts(drafts.filter((draft) => draft.id !== id))
      toast({
        title: "Draft deleted",
        description: "The draft has been successfully deleted.",
      })
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to delete the draft. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return <AdminLayout>Loading drafts...</AdminLayout>
  }

  if (error) {
    return <AdminLayout>Error: {error}</AdminLayout>
  }

  return (
    <AdminLayout>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">Drafts</h1>

        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center space-x-4">
            <Input
              placeholder="Search drafts..."
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
                <SelectItem value="tournament">Tournaments</SelectItem>
                <SelectItem value="scrim">Scrims</SelectItem>
                <SelectItem value="news">News</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Draft Items</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Last Edited</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDrafts.map((draft) => (
                  <TableRow key={draft.id}>
                    <TableCell>{draft.name}</TableCell>
                    <TableCell>{draft.type}</TableCell>
                    <TableCell>{draft.lastEdited}</TableCell>
                    <TableCell>
                      <Button asChild variant="outline" size="sm" className="mr-2">
                        <Link href={`/admin/${draft.type}s/${draft.id}/edit`}>Edit</Link>
                      </Button>
                      <Button variant="destructive" size="sm" onClick={() => handleDelete(draft.id)}>
                        Delete
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
