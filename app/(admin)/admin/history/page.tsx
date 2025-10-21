"use client"

import { useState, useEffect } from "react"
import AdminLayout from "@/components/AdminLayout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DatePickerWithRange } from "@/components/ui/date-picker-with-range"
import { Button } from "@/components/ui/button"
import { addDays } from "date-fns"

// Mock function to fetch admin actions
const fetchAdminActions = async (filters: any) => {
  // In a real app, this would be an API call with filters applied
  return [
    { id: 1, user: "John Doe", role: "Admin", action: "Created new tournament", timestamp: "2023-07-01 14:30" },
    { id: 2, user: "Jane Smith", role: "Moderator", action: "Updated player profile", timestamp: "2023-07-01 13:15" },
    { id: 3, user: "Mike Johnson", role: "Admin", action: "Banned player #12345", timestamp: "2023-07-01 11:45" },
    { id: 4, user: "Sarah Lee", role: "Moderator", action: "Added new shop item", timestamp: "2023-06-30 16:20" },
    { id: 5, user: "Tom Brown", role: "Admin", action: "Modified tier criteria", timestamp: "2023-06-30 10:05" },
  ]
}

export default function AdminHistoryPage() {
  const [actions, setActions] = useState([])
  const [searchTerm, setSearchTerm] = useState("")
  const [roleFilter, setRoleFilter] = useState("all")
  const [dateRange, setDateRange] = useState({
    from: addDays(new Date(), -30),
    to: new Date(),
  })

  useEffect(() => {
    const loadActions = async () => {
      const fetchedActions = await fetchAdminActions({
        searchTerm,
        roleFilter,
        dateRange,
      })
      setActions(fetchedActions)
    }
    loadActions()
  }, [searchTerm, roleFilter, dateRange])

  const handleSearch = () => {
    // In a real app, this would trigger a new API call with the current filters
    console.log("Searching with filters:", { searchTerm, roleFilter, dateRange })
  }

  return (
    <AdminLayout>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">Admin Action History</h1>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
              <div>
                <Input
                  placeholder="Search actions..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div>
                <Select value={roleFilter} onValueChange={setRoleFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Filter by role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Roles</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="moderator">Moderator</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="lg:col-span-2">
                <DatePickerWithRange dateRange={dateRange} setDateRange={setDateRange} />
              </div>
            </div>
            <Button onClick={handleSearch}>Apply Filters</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Action History</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Timestamp</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {actions.map((action) => (
                  <TableRow key={action.id}>
                    <TableCell>{action.user}</TableCell>
                    <TableCell>{action.role}</TableCell>
                    <TableCell>{action.action}</TableCell>
                    <TableCell>{action.timestamp}</TableCell>
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
