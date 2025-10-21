"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import Layout from "@/components/Layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { toast } from "@/components/ui/use-toast"

// Mock join requests data
const mockJoinRequests = [
  { id: "1", name: "Alice Johnson", uid: "123456" },
  { id: "2", name: "Bob Williams", uid: "234567" },
  { id: "3", name: "Charlie Brown", uid: "345678" },
]

export default function JoinRequestsPage() {
  const params = useParams()
  const router = useRouter()
  const [joinRequests, setJoinRequests] = useState(mockJoinRequests)

  useEffect(() => {
    // In a real app, fetch join requests data based on params.id
    // setJoinRequests(fetchedJoinRequests)
  }, [])

  const handleAccept = async (requestId: string) => {
    try {
      // Simulating an API call
      await new Promise((resolve) => setTimeout(resolve, 1000))
      setJoinRequests((prevRequests) => prevRequests.filter((request) => request.id !== requestId))
      toast({
        title: "Request accepted",
        description: "The player has been added to your team.",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "An error occurred while accepting the request. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleReject = async (requestId: string) => {
    try {
      // Simulating an API call
      await new Promise((resolve) => setTimeout(resolve, 1000))
      setJoinRequests((prevRequests) => prevRequests.filter((request) => request.id !== requestId))
      toast({
        title: "Request rejected",
        description: "The join request has been rejected.",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "An error occurred while rejecting the request. Please try again.",
        variant: "destructive",
      })
    }
  }

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Join Requests</CardTitle>
          </CardHeader>
          <CardContent>
            {joinRequests.length === 0 ? (
              <p>No pending join requests.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>UID</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {joinRequests.map((request) => (
                    <TableRow key={request.id}>
                      <TableCell>{request.name}</TableCell>
                      <TableCell>{request.uid}</TableCell>
                      <TableCell>
                        <div className="space-x-2">
                          <Button onClick={() => handleAccept(request.id)}>Accept</Button>
                          <Button variant="outline" onClick={() => handleReject(request.id)}>
                            Reject
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            <div className="mt-4">
              <Button variant="outline" onClick={() => router.push(`/teams/${params.id}`)}>
                Back to Team Profile
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  )
}
