"use client"

import { useState } from "react"
import AdminLayout from "@/components/AdminLayout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { BarChart2, Plus } from "lucide-react"

const AdminTiersPage = () => {
  const [searchTerm, setSearchTerm] = useState("")
  const [filterTier, setFilterTier] = useState("all")

  // Mock data for tiers
  const [tiers, setTiers] = useState([
    { id: 1, name: "Tier 1 - July 2023", teams: 10, status: "published" },
    { id: 2, name: "Tier 2 - July 2023", teams: 15, status: "published" },
    { id: 3, name: "Tier 3 - July 2023", teams: 20, status: "published" },
    { id: 4, name: "Tier 1 - August 2023", teams: 12, status: "draft" },
  ])

  const filteredTiers = tiers.filter(
    (tier) =>
      tier.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
      (filterTier === "all" || tier.name.includes(`Tier ${filterTier}`)),
  )

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
                {filteredTiers.map((tier) => (
                  <TableRow key={tier.id}>
                    <TableCell>{tier.name}</TableCell>
                    <TableCell>{tier.teams}</TableCell>
                    <TableCell>
                      <Badge variant={tier.status === "published" ? "success" : "secondary"}>
                        {tier.status === "published" ? "Published" : "Draft"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/admin/tiers/${tier.id}`}>View</Link>
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

export default AdminTiersPage
