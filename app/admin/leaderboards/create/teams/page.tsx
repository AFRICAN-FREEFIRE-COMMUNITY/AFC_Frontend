"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import AdminLayout from "@/components/AdminLayout"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ChevronsUpDown, Plus, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"

// Mock data for teams
const mockTeams = [
  { id: 1, name: "Team Alpha", logo: "/placeholder.svg?height=40&width=40" },
  { id: 2, name: "Team Bravo", logo: "/placeholder.svg?height=40&width=40" },
  { id: 3, name: "Team Charlie", logo: "/placeholder.svg?height=40&width=40" },
  { id: 4, name: "Team Delta", logo: "/placeholder.svg?height=40&width=40" },
  { id: 5, name: "Team Echo", logo: "/placeholder.svg?height=40&width=40" },
  { id: 6, name: "Team Foxtrot", logo: "/placeholder.svg?height=40&width=40" },
  { id: 7, name: "Team Golf", logo: "/placeholder.svg?height=40&width=40" },
  { id: 8, name: "Team Hotel", logo: "/placeholder.svg?height=40&width=40" },
  { id: 9, name: "Team India", logo: "/placeholder.svg?height=40&width=40" },
  { id: 10, name: "Team Juliet", logo: "/placeholder.svg?height=40&width=40" },
  { id: 11, name: "Team Kilo", logo: "/placeholder.svg?height=40&width=40" },
  { id: 12, name: "Team Lima", logo: "/placeholder.svg?height=40&width=40" },
]

const TeamSelectionPage = () => {
  const router = useRouter()
  const [leaderboardDetails, setLeaderboardDetails] = useState<any>(null)
  const [selectedTeams, setSelectedTeams] = useState<any[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [openTeamDropdown, setOpenTeamDropdown] = useState(false)
  const [mapCount, setMapCount] = useState("3") // Default to 3 maps
  const [entryMethod, setEntryMethod] = useState("manual") // Default to manual entry

  // Filter teams based on search term
  const filteredTeams = mockTeams.filter(
    (team) =>
      team.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
      !selectedTeams.some((selected) => selected.id === team.id),
  )

  useEffect(() => {
    // Retrieve leaderboard details from localStorage
    const storedDetails = localStorage.getItem("leaderboardDetails")
    if (storedDetails) {
      const details = JSON.parse(storedDetails)
      setLeaderboardDetails(details)

      // If there are already selected teams, load them
      if (details.teams) {
        setSelectedTeams(details.teams)
      }

      // If map count is already set, load it
      if (details.mapCount) {
        setMapCount(details.mapCount.toString())
      }

      // If entry method is already set, load it
      if (details.entryMethod) {
        setEntryMethod(details.entryMethod)
      }
    } else {
      // If no details found, redirect back to step 1
      router.push("/admin/leaderboards/create")
    }
  }, [router])

  const handleAddTeam = (teamId: number) => {
    const team = mockTeams.find((t) => t.id === teamId)
    if (team && !selectedTeams.some((selected) => selected.id === team.id)) {
      setSelectedTeams([...selectedTeams, { ...team, players: [] }])
    }
    setOpenTeamDropdown(false)
    setSearchTerm("")
  }

  const handleRemoveTeam = (teamId: number) => {
    setSelectedTeams(selectedTeams.filter((team) => team.id !== teamId))
  }

  const handleMapCountChange = (value: string) => {
    setMapCount(value)
  }

  const handleEntryMethodChange = (value: string) => {
    setEntryMethod(value)
  }

  const handleContinue = () => {
    if (selectedTeams.length === 0) return

    // Generate map names based on map count
    const mapCountInt = Number.parseInt(mapCount)
    const mapNames = Array.from({ length: mapCountInt }, (_, i) => `Map ${i + 1}`)

    // Update leaderboard details with selected teams, map count, and entry method
    const updatedDetails = {
      ...leaderboardDetails,
      teams: selectedTeams,
      mapCount: mapCountInt,
      entryMethod: entryMethod,
      mapNames: mapNames,
      mapImages: {},
    }
    localStorage.setItem("leaderboardDetails", JSON.stringify(updatedDetails))

    // Navigate to the next step
    router.push("/admin/leaderboards/create/results")
  }

  const handleBack = () => {
    router.push("/admin/leaderboards/create/point-system")
  }

  if (!leaderboardDetails) {
    return <AdminLayout>Loading...</AdminLayout>
  }

  return (
    <AdminLayout>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-2">Create Leaderboard</h1>
        <p className="text-muted-foreground mb-8">Step 4 of 5: Team Selection</p>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Match Configuration</CardTitle>
            <CardDescription>Configure the number of maps played and how you want to enter results</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="map-count">Number of Maps Played</Label>
                <Select value={mapCount} onValueChange={handleMapCountChange}>
                  <SelectTrigger id="map-count" className="w-full">
                    <SelectValue placeholder="Select number of maps" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 Map</SelectItem>
                    <SelectItem value="2">2 Maps</SelectItem>
                    <SelectItem value="3">3 Maps</SelectItem>
                    <SelectItem value="4">4 Maps</SelectItem>
                    <SelectItem value="5">5 Maps</SelectItem>
                    <SelectItem value="6">6 Maps</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Entry Method</Label>
                <RadioGroup
                  value={entryMethod}
                  onValueChange={handleEntryMethodChange}
                  className="flex flex-col space-y-1"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="manual" id="manual" />
                    <Label htmlFor="manual">Manual Entry</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="image" id="image" />
                    <Label htmlFor="image">Image Scan & Upload</Label>
                  </div>
                </RadioGroup>
              </div>
            </div>

            {entryMethod === "image" && (
              <div className="mt-4 p-4 bg-muted/20 rounded-md border">
                <h3 className="text-sm font-medium mb-2">Image Scan & Upload</h3>
                <p className="text-sm text-muted-foreground">
                  You'll be able to upload screenshots of your leaderboards on the next page. The system will scan the
                  images and extract the results, which you can then review and edit.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Select Teams</CardTitle>
            <CardDescription>Search and add teams for {leaderboardDetails.leaderboardName}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div>
                <Popover open={openTeamDropdown} onOpenChange={setOpenTeamDropdown}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={openTeamDropdown}
                      className="w-full justify-between"
                    >
                      Search and add teams
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0">
                    <Command>
                      <CommandInput placeholder="Search teams..." value={searchTerm} onValueChange={setSearchTerm} />
                      <CommandList>
                        <CommandEmpty>No teams found.</CommandEmpty>
                        <CommandGroup>
                          {filteredTeams.map((team) => (
                            <CommandItem
                              key={team.id}
                              value={team.id.toString()}
                              onSelect={() => handleAddTeam(team.id)}
                            >
                              <div className="flex items-center">
                                <img
                                  src={team.logo || "/placeholder.svg"}
                                  alt={team.name}
                                  className="w-6 h-6 mr-2 rounded-full"
                                />
                                {team.name}
                              </div>
                              <Plus className="ml-auto h-4 w-4 text-muted-foreground" />
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              <div>
                <h3 className="text-lg font-medium mb-2">Selected Teams ({selectedTeams.length})</h3>
                {selectedTeams.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Team</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedTeams.map((team) => (
                        <TableRow key={team.id}>
                          <TableCell>
                            <div className="flex items-center">
                              <img
                                src={team.logo || "/placeholder.svg"}
                                alt={team.name}
                                className="w-8 h-8 mr-2 rounded-full"
                              />
                              {team.name}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="sm" onClick={() => handleRemoveTeam(team.id)}>
                              <X className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center p-4 border rounded-md bg-muted/20">
                    <p>No teams selected yet. Search and add teams above.</p>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="px-2 py-1">
                  {selectedTeams.length} teams selected
                </Badge>
                {selectedTeams.length > 0 && (
                  <Badge variant="secondary" className="px-2 py-1">
                    {leaderboardDetails.gameType === "battle_royale" ? "Battle Royale" : "Clash Squad"}
                  </Badge>
                )}
                <Badge variant="secondary" className="px-2 py-1">
                  {mapCount} maps
                </Badge>
                <Badge variant="secondary" className="px-2 py-1">
                  {entryMethod === "manual" ? "Manual Entry" : "Image Scan"}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-between">
          <Button variant="outline" onClick={handleBack}>
            Back
          </Button>
          <Button onClick={handleContinue} disabled={selectedTeams.length === 0}>
            Continue to Results Entry
          </Button>
        </div>
      </div>
    </AdminLayout>
  )
}

export default TeamSelectionPage
