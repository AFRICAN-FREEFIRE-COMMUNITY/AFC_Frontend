"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Info } from "lucide-react"
import AdminLayout from "@/components/AdminLayout"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Check, ChevronsUpDown } from "lucide-react"
import { cn } from "@/lib/utils"

// Mock data for existing events - in a real app, this would come from an API
const mockEvents = [
  { id: 1, name: "Summer Championship 2023", type: "tournament" },
  { id: 2, name: "Winter Invitational 2023", type: "tournament" },
  { id: 3, name: "Pro League Season 5", type: "tournament" },
  { id: 4, name: "Weekly Scrim Series #12", type: "scrim" },
  { id: 5, name: "Monthly Showdown", type: "tournament" },
  { id: 6, name: "Fall Qualifier 2023", type: "tournament" },
  { id: 7, name: "Spring Open 2023", type: "tournament" },
  { id: 8, name: "Regional Finals 2023", type: "tournament" },
]

const stageOptions = [
  { value: "group", label: "Group Stage" },
  { value: "qualifiers", label: "Qualifiers" },
  { value: "quarterfinals", label: "Quarterfinals" },
  { value: "semifinals", label: "Semifinals" },
  { value: "demifinals", label: "Demi Finals" },
  { value: "finals", label: "Finals" },
  { value: "round_robin", label: "Round Robin" },
  { value: "knockout", label: "Knockout" },
  { value: "lcq", label: "Last Chance Qualifiers (LCQ)" },
  { value: "league", label: "League" },
  { value: "double_elimination", label: "Double Elimination" },
]

const CreateLeaderboardPage = () => {
  const router = useRouter()

  const [leaderboardName, setLeaderboardName] = useState("")
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null)
  const [eventType, setEventType] = useState("")
  const [eventName, setEventName] = useState("")
  const [stage, setStage] = useState("")
  const [group, setGroup] = useState("")
  const [searchTerm, setSearchTerm] = useState("")
  const [openEventDropdown, setOpenEventDropdown] = useState(false)

  // Filter events based on search term
  const filteredEvents = mockEvents.filter((event) => event.name.toLowerCase().includes(searchTerm.toLowerCase()))

  // Update event type and name when an event is selected
  useEffect(() => {
    if (selectedEventId) {
      const selectedEvent = mockEvents.find((event) => event.id === selectedEventId)
      if (selectedEvent) {
        setEventType(selectedEvent.type)
        setEventName(selectedEvent.name)
      }
    } else {
      setEventType("")
      setEventName("")
    }
  }, [selectedEventId])

  // Auto-generate leaderboard name based on event name, stage, and group
  useEffect(() => {
    if (eventName) {
      let name = eventName

      if (stage) {
        const stageLabel = stageOptions.find((option) => option.value === stage)?.label || stage
        name += ` - ${stageLabel}`
      }

      if (group) {
        name += ` ${group}`
      }

      setLeaderboardName(name)
    } else {
      setLeaderboardName("")
    }
  }, [eventName, stage, group])

  const handleContinue = () => {
    if (!selectedEventId || !stage) {
      return
    }

    // Store the leaderboard details in localStorage for the next step
    const leaderboardDetails = {
      leaderboardName,
      eventId: selectedEventId,
      eventType,
      eventName,
      stage,
      group,
    }

    localStorage.setItem("leaderboardDetails", JSON.stringify(leaderboardDetails))

    // Navigate to the next step
    router.push("/admin/leaderboards/create/game-type")
  }

  return (
    <AdminLayout>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-2">Create Leaderboard</h1>
        <p className="text-muted-foreground mb-8">Step 1 of 5: Basic Information</p>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Leaderboard Details</CardTitle>
            <CardDescription>Select the event and specify the stage and group for this leaderboard</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <Label htmlFor="event" className="mb-2 block">
                  Select Event
                </Label>
                <Popover open={openEventDropdown} onOpenChange={setOpenEventDropdown}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={openEventDropdown}
                      className="w-full justify-between"
                    >
                      {selectedEventId
                        ? mockEvents.find((event) => event.id === selectedEventId)?.name
                        : "Search and select an event..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0">
                    <Command>
                      <CommandInput placeholder="Search events..." value={searchTerm} onValueChange={setSearchTerm} />
                      <CommandList>
                        <CommandEmpty>No events found.</CommandEmpty>
                        <CommandGroup>
                          {filteredEvents.map((event) => (
                            <CommandItem
                              key={event.id}
                              value={event.id.toString()}
                              onSelect={() => {
                                setSelectedEventId(event.id === selectedEventId ? null : event.id)
                                setOpenEventDropdown(false)
                                setSearchTerm("")
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  selectedEventId === event.id ? "opacity-100" : "opacity-0",
                                )}
                              />
                              {event.name} <span className="ml-2 text-muted-foreground">({event.type})</span>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <Label htmlFor="leaderboardName">Leaderboard Name</Label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-4 w-4 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="max-w-xs">
                          The leaderboard name is automatically generated based on the event, stage, and group.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <Input id="leaderboardName" value={leaderboardName} readOnly className="bg-muted/50" />
                <p className="text-xs text-muted-foreground mt-1">Auto-generated from event details</p>
              </div>

              <div>
                <Label htmlFor="eventType">Event Type</Label>
                <Input id="eventType" value={eventType} readOnly className="bg-muted/50" />
                <p className="text-xs text-muted-foreground mt-1">Based on the selected event</p>
              </div>

              <div>
                <Label htmlFor="stage">Stage</Label>
                <Select value={stage} onValueChange={setStage}>
                  <SelectTrigger id="stage">
                    <SelectValue placeholder="Select stage" />
                  </SelectTrigger>
                  <SelectContent>
                    {stageOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="group">Group</Label>
                <Input
                  id="group"
                  value={group}
                  onChange={(e) => setGroup(e.target.value)}
                  placeholder="e.g., Group A, Pool 1, etc."
                />
                <p className="text-xs text-muted-foreground mt-1">Optional - add group identifier if applicable</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button onClick={handleContinue} disabled={!selectedEventId || !stage}>
            Continue to Game Type
          </Button>
        </div>
      </div>
    </AdminLayout>
  )
}

export default CreateLeaderboardPage
