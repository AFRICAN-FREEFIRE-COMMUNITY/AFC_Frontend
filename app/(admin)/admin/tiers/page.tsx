"use client"

import { useState, useEffect } from "react"
import AdminLayout from "@/components/AdminLayout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { BarChart2, Plus, Loader2, AlertCircle } from "lucide-react"
import { useTiers } from "@/hooks/useAdminApi"

const AdminTiersPage = () => {
  const [searchTerm, setSearchTerm] = useState("")
  const [filterTier, setFilterTier] = useState("all")

  // Build filters object
  const filters = {
    ...(searchTerm && { search: searchTerm }),
  }

  const { data: tiers, loading, error, updateParams } = useTiers(filters)

  // Update filters when search term changes
  useEffect(() => {
    updateParams(filters)
  }, [searchTerm])

  return (
    <AdminLayout>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">Tier Management</h1>

        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 space-y-4 md:space-y-0">
          <div className="flex items-center space-x-4">
            <Input
              placeholder="Search tiers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-64"
            />
            <Select value={filterTier} onValueChange={setFilterTier}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Filter by tier" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Tiers</SelectItem>
                <SelectItem value="1">Tier 1</SelectItem>
                <SelectItem value="2">Tier 2</SelectItem>
                <SelectItem value="3">Tier 3</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex space-x-4">
            <Button asChild>
              <Link href="/admin/tiers/create">
                <Plus className="mr-2 h-4 w-4" /> Create Tier
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/admin/tiers/metrics">
                <BarChart2 className="mr-2 h-4 w-4" /> Adjust Metrics
              </Link>
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Tiers</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin" />
                <span className="ml-2">Loading tiers...</span>
              </div>
            ) : error ? (
              <div className="flex items-center justify-center py-8 text-red-500">
                <AlertCircle className="h-8 w-8" />
                <span className="ml-2">Error: {typeof error === 'string' ? error : 'Failed to load tiers'}</span>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tier Name</TableHead>
                    <TableHead>Teams</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tiers && tiers.length > 0 ? (
                    tiers.map((tier: any) => (
                      <TableRow key={tier.id}>
                        <TableCell>{tier.name}</TableCell>
                        <TableCell>{tier.teams || 0}</TableCell>
                        <TableCell>
                          <Badge variant={tier.status === "published" ? "default" : "secondary"}>
                            {tier.status === "published" ? "Published" : "Draft"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button asChild variant="outline" size="sm">
                            <Link href={`/admin/tiers/${tier.id}`}>View</Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                        No tiers found
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

export default AdminTiersPage
