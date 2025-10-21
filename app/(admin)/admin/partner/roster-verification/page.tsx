"use client"

import { useState } from "react"
import AdminLayout from "@/components/AdminLayout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { MultiSelect } from "@/components/ui/multi-select"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useToast } from "@/components/ui/use-toast"

// Mock data for teams and tournaments
const teams = [
  { value: "team1", label: "Team Alpha" },
  { value: "team2", label: "Beta Squad" },
  { value: "team3", label: "Gamma Force" },
  { value: "team4", label: "Delta Dynamos" },
  { value: "team5", label: "Epsilon Elite" },
]

const tournaments = [
  { value: "tournament1", label: "Summer Championship 2023" },
  { value: "tournament2", label: "Fall Invitational 2023" },
  { value: "tournament3", label: "Winter Cup 2023" },
]

// Mock function to fetch roster data
const fetchRosterData = async (selectedTeams, selectedTournament) => {
  // Simulate API call delay
  await new Promise((resolve) => setTimeout(resolve, 1000))

  return selectedTeams.map((teamValue) => {
    const team = teams.find((t) => t.value === teamValue)
    return {
      team: team.label,
      players: [
        { name: `Player1_${team.label}`, uid: `UID${Math.random().toString(36).substr(2, 9)}` },
        { name: `Player2_${team.label}`, uid: `UID${Math.random().toString(36).substr(2, 9)}` },
        { name: `Player3_${team.label}`, uid: `UID${Math.random().toString(36).substr(2, 9)}` },
        { name: `Player4_${team.label}`, uid: `UID${Math.random().toString(36).substr(2, 9)}` },
      ],
    }
  })
}

export default function PartnerRosterVerificationPage() {
  const [selectedTeams, setSelectedTeams] = useState([])
  const [selectedTournament, setSelectedTournament] = useState("")
  const [rosterData, setRosterData] = useState([])
  const { toast } = useToast()

  const handleTeamChange = (selected) => {
    setSelectedTeams(selected)
  }

  const handleTournamentChange = (value) => {
    setSelectedTournament(value)
  }

  const handleFetchRoster = async () => {
    if (selectedTeams.length === 0 || !selectedTournament) {
      toast({
        title: "Error",
        description: "Please select at least one team and a tournament.",
        variant: "destructive",
      })
      return
    }

    try {
      const data = await fetchRosterData(selectedTeams, selectedTournament)
      setRosterData(data)
      toast({
        title: "Success",
        description: "Roster data fetched successfully.",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch roster data. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleGenerateImage = () => {
    // This function would handle the image generation
    // For now, we'll just show a toast notification
    toast({
      title: "Image Generated",
      description: "The roster image has been generated and is ready for download.",
    })
  }

  return (
    <AdminLayout>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">Partner Roster Verification</h1>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Select Teams and Tournament</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Select Teams (up to 15)</label>
              <MultiSelect
                options={teams}
                selected={selectedTeams}
                onChange={handleTeamChange}
                className="w-full"
                placeholder="Select teams..."
                max={15}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Select Tournament</label>
              <Select onValueChange={handleTournamentChange}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select tournament..." />
                </SelectTrigger>
                <SelectContent>
                  {tournaments.map((tournament) => (
                    <SelectItem key={tournament.value} value={tournament.value}>
                      {tournament.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleFetchRoster}>Fetch Roster Data</Button>
          </CardContent>
        </Card>

        {rosterData.length > 0 && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Roster Information</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Team</TableHead>
                    <TableHead>Player Name</TableHead>
                    <TableHead>UID</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rosterData.flatMap((team) =>
                    team.players.map((player, index) => (
                      <TableRow key={`${team.team}-${player.uid}`}>
                        {index === 0 && <TableCell rowSpan={team.players.length}>{team.team}</TableCell>}
                        <TableCell>{player.name}</TableCell>
                        <TableCell>{player.uid}</TableCell>
                      </TableRow>
                    )),
                  )}
                </TableBody>
              </Table>
              <Button onClick={handleGenerateImage} className="mt-4">
                Generate Roster Image
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </AdminLayout>
  )
}
