"use client"

import { useState, useEffect } from "react"
import AdminLayout from "@/components/AdminLayout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, AlertCircle } from "lucide-react"
import { useRankings } from "@/hooks/useAdminApi"
import Link from "next/link"

const AdminRankingsPage = () => {
  const [searchTerm, setSearchTerm] = useState("")
  const [filterType, setFilterType] = useState("all")
  const [rankingsParams, setRankingsParams] = useState({})

  // API hooks
  const { data: rankings, loading, error } = useRankings(rankingsParams)

  // Update API parameters when filters change
  useEffect(() => {
    const filters: any = {}
    if (searchTerm) filters.search = searchTerm
    if (filterType !== "all") filters.type = filterType
    setRankingsParams(filters)
  }, [searchTerm, filterType])

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
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin" />
                <span className="ml-2">Loading rankings...</span>
              </div>
            ) : error ? (
              <div className="flex items-center justify-center py-8 text-red-500">
                <AlertCircle className="h-8 w-8" />
                <span className="ml-2">Error loading rankings: {typeof error === 'string' ? error : 'Unknown error'}</span>
              </div>
            ) : (
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
                  {rankings?.map((ranking: any) => (
                    <TableRow key={ranking.id}>
                      <TableCell>{ranking.name}</TableCell>
                      <TableCell>{ranking.type}</TableCell>
                      <TableCell>{ranking.startDate && ranking.endDate ? `${ranking.startDate} - ${ranking.endDate}` : 'N/A'}</TableCell>
                      <TableCell>
                        <Button asChild variant="outline" size="sm">
                          <Link href={`/admin/rankings/${ranking.id}`}>View</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {rankings?.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8 text-gray-500">
                        No rankings found
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

export default AdminRankingsPage
