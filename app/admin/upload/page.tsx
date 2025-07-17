"use client"

import React from "react"
import { useRouter } from "next/navigation"
import AdminLayout from "@/components/AdminLayout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

// Mock function to check user role. Replace this with actual authentication logic.
const getUserRole = () => {
  // This should come from your authentication system
  return "admin" // or 'mod' or 'support'
}

export default function UploadPage() {
  const router = useRouter()
  const userRole = getUserRole()

  React.useEffect(() => {
    if (!["admin", "mod", "support"].includes(userRole)) {
      router.push("/home") // Redirect to home if not authorized
    }
  }, [userRole, router])

  if (!["admin", "mod", "support"].includes(userRole)) {
    return null // Or a loading spinner
  }

  return (
    <AdminLayout>
      <div className="max-w-5xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Upload Tournament Results</h1>

        <Tabs defaultValue="details" className="space-y-6">
          <TabsList>
            <TabsTrigger value="details">Tournament Details</TabsTrigger>
            <TabsTrigger value="results">Match Results</TabsTrigger>
            <TabsTrigger value="metrics">Team Metrics</TabsTrigger>
            <TabsTrigger value="social">Social Media</TabsTrigger>
          </TabsList>

          <TabsContent value="details">
            <Card>
              <CardHeader>
                <CardTitle>Tournament Information</CardTitle>
                <CardDescription>Enter the basic tournament details</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="tournament-name">Tournament Name</Label>
                    <Input id="tournament-name" placeholder="Enter tournament name" />
                  </div>
                  <div>
                    <Label htmlFor="prize-pool">Prize Pool (₦)</Label>
                    <Input id="prize-pool" type="number" placeholder="Enter prize pool amount" />
                  </div>
                </div>
                <div>
                  <Label htmlFor="tournament-tier">Tournament Tier</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Select tournament tier" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Tier 1 ($1,000+ or FreeFire Official)</SelectItem>
                      <SelectItem value="2">Tier 2 ($300-$999 or LAN)</SelectItem>
                      <SelectItem value="3">Tier 3 (Below $300)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="tournament-date">Tournament Date</Label>
                  <Input id="tournament-date" type="date" />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="results">
            <Card>
              <CardHeader>
                <CardTitle>Match Results</CardTitle>
                <CardDescription>Upload match results and player statistics</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Team Results</Label>
                  <Textarea
                    placeholder={`Enter team results in JSON format:
{
  "teamName": "Example Team",
  "placement": 1,
  "kills": 15,
  "players": [
    {
      "uid": "123456789",
      "kills": 5,
      "mvps": 1,
      "role": "rusher"
    }
  ]
}`}
                    className="h-[300px] font-mono"
                  />
                </div>
                <div>
                  <Label htmlFor="screenshot">Result Screenshots</Label>
                  <Input id="screenshot" type="file" multiple accept="image/*" />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="metrics">
            <Card>
              <CardHeader>
                <CardTitle>Team Metrics</CardTitle>
                <CardDescription>Record additional team performance metrics</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Finals Appearance</Label>
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder="Did the team reach finals?" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="yes">Yes</SelectItem>
                        <SelectItem value="no">No</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Tournament Win</Label>
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder="Did the team win?" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="yes">Yes</SelectItem>
                        <SelectItem value="no">No</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label>Infractions</Label>
                  <Textarea placeholder="Record any penalties or infractions (if applicable)" className="h-[100px]" />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="social">
            <Card>
              <CardHeader>
                <CardTitle>Social Media Metrics</CardTitle>
                <CardDescription>Update team social media statistics</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Instagram Followers</Label>
                    <Input type="number" placeholder="Enter follower count" />
                  </div>
                  <div>
                    <Label>Instagram Posts</Label>
                    <Input type="number" placeholder="Enter post count" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>TikTok Followers</Label>
                    <Input type="number" placeholder="Enter follower count" />
                  </div>
                  <div>
                    <Label>TikTok Posts</Label>
                    <Input type="number" placeholder="Enter post count" />
                  </div>
                </div>
                <div>
                  <Label>TikTok Likes</Label>
                  <Input type="number" placeholder="Enter total likes" />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-4 mt-6">
          <Button variant="outline">Save as Draft</Button>
          <Button>Submit Results</Button>
        </div>
      </div>
    </AdminLayout>
  )
}
