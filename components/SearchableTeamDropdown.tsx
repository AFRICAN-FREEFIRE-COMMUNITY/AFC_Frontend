import { useState, useEffect } from "react"
import { Check, ChevronsUpDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

// Mock function to fetch teams from the database
const fetchTeams = async () => {
  // In a real app, this would be an API call
  return [
    { value: "team-alpha", label: "Team Alpha" },
    { value: "team-beta", label: "Team Beta" },
    { value: "team-gamma", label: "Team Gamma" },
    // ... more teams
  ]
}

interface SearchableTeamDropdownProps {
  value: string
  onChange: (value: string) => void
}

export function SearchableTeamDropdown({ value, onChange }: SearchableTeamDropdownProps) {
  const [open, setOpen] = useState(false)
  const [teams, setTeams] = useState([])

  useEffect(() => {
    const loadTeams = async () => {
      const fetchedTeams = await fetchTeams()
      setTeams(fetchedTeams)
    }
    loadTeams()
  }, [])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" aria-expanded={open} className="w-[200px] justify-between">
          {value ? teams.find((team) => team.value === value)?.label : "Select team..."}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0">
        <Command>
          <CommandInput placeholder="Search team..." />
          <CommandList>
            <CommandEmpty>No team found.</CommandEmpty>
            <CommandGroup>
              {teams.map((team) => (
                <CommandItem
                  key={team.value}
                  onSelect={() => {
                    onChange(team.value === value ? "" : team.value)
                    setOpen(false)
                  }}
                >
                  <Check className={cn("mr-2 h-4 w-4", value === team.value ? "opacity-100" : "opacity-0")} />
                  {team.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
