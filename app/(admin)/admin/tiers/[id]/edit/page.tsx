"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import AdminLayout from "@/components/AdminLayout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/components/ui/use-toast"

const mockTeamData = {
  id: "1",
  name: "Team Alpha",
  tournamentWins: 5,
  moneyEarned: 50000,
  tournamentKills: 300,
  tournamentPlacements: [1, 2, 3, 5, 4],
  finalsAppearances: 3,
  instagramFollowers: 10000,
  instagramPosts: 500,
  tiktokFollowers: 15000,
  tiktokLikes: 100000,
  tiktokPosts: 200,
  scrimWins: 20,
  scrimKills: 500,
  scrimPlacements: [1, 1, 2, 3, 2],
}

const EditTeamTierPage = () => {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const [teamData, setTeamData] = useState(mockTeamData)

  useEffect(() => {
    // In a real app, fetch the team data based on the ID
    console.log("Fetching team data for ID:", params.id)
  }, [params.id])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setTeamData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSave = () => {
    // In a real app, send the updated data to your backend
    console.log("Saving team data:", teamData)
    toast({
      title: "Team Data Updated",
      description: "The team's metrics have been updated successfully.",
    })
    router.push("/admin/tiers")
  }

  return (
    <AdminLayout>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">Edit Team Metrics: {teamData.name}</h1>

        <Card>
          <CardHeader>
            <CardTitle>Team Metrics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="tournamentWins">Tournament Wins</Label>
                <Input
                  id="tournamentWins"
                  name="tournamentWins"
                  type="number"
                  value={teamData.tournamentWins}
                  onChange={handleInputChange}
                />
              </div>
              <div>
                <Label htmlFor="moneyEarned">Money Earned ($)</Label>
                <Input
                  id="moneyEarned"
                  name="moneyEarned"
                  type="number"
                  value={teamData.moneyEarned}
                  onChange={handleInputChange}
                />
              </div>
              <div>
                <Label htmlFor="tournamentKills">Tournament Kills</Label>
                <Input
                  id="tournamentKills"
                  name="tournamentKills"
                  type="number"
                  value={teamData.tournamentKills}
                  onChange={handleInputChange}
                />
              </div>
              <div>
                <Label htmlFor="finalsAppearances">Finals Appearances</Label>
                <Input
                  id="finalsAppearances"
                  name="finalsAppearances"
                  type="number"
                  value={teamData.finalsAppearances}
                  onChange={handleInputChange}
                />
              </div>
              <div>
                <Label htmlFor="instagramFollowers">Instagram Followers</Label>
                <Input
                  id="instagramFollowers"
                  name="instagramFollowers"
                  type="number"
                  value={teamData.instagramFollowers}
                  onChange={handleInputChange}
                />
              </div>
              <div>
                <Label htmlFor="instagramPosts">Instagram Posts</Label>
                <Input
                  id="instagramPosts"
                  name="instagramPosts"
                  type="number"
                  value={teamData.instagramPosts}
                  onChange={handleInputChange}
                />
              </div>
              <div>
                <Label htmlFor="tiktokFollowers">TikTok Followers</Label>
                <Input
                  id="tiktokFollowers"
                  name="tiktokFollowers"
                  type="number"
                  value={teamData.tiktokFollowers}
                  onChange={handleInputChange}
                />
              </div>
              <div>
                <Label htmlFor="tiktokLikes">TikTok Likes</Label>
                <Input
                  id="tiktokLikes"
                  name="tiktokLikes"
                  type="number"
                  value={teamData.tiktokLikes}
                  onChange={handleInputChange}
                />
              </div>
              <div>
                <Label htmlFor="tiktokPosts">TikTok Posts</Label>
                <Input
                  id="tiktokPosts"
                  name="tiktokPosts"
                  type="number"
                  value={teamData.tiktokPosts}
                  onChange={handleInputChange}
                />
              </div>
              <div>
                <Label htmlFor="scrimWins">Scrim Wins</Label>
                <Input
                  id="scrimWins"
                  name="scrimWins"
                  type="number"
                  value={teamData.scrimWins}
                  onChange={handleInputChange}
                />
              </div>
              <div>
                <Label htmlFor="scrimKills">Scrim Kills</Label>
                <Input
                  id="scrimKills"
                  name="scrimKills"
                  type="number"
                  value={teamData.scrimKills}
                  onChange={handleInputChange}
                />
              </div>
            </div>
            <Button onClick={handleSave} className="mt-6">
              Save Changes
            </Button>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  )
}

export default EditTeamTierPage
