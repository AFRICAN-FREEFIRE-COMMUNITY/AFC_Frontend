import type React from "react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface ClashSquadMatchFormProps {
  onMatchAdd: (match: any) => void
}

export function ClashSquadMatchForm({ onMatchAdd }: ClashSquadMatchFormProps) {
  const [match, setMatch] = useState({
    teamA: "",
    teamB: "",
    winner: "",
    teamAKills: 0,
    teamBKills: 0,
    teamADamage: 0,
    teamBDamage: 0,
    teamARoundsWon: 0,
    teamBRoundsWon: 0,
  })

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setMatch((prev) => ({ ...prev, [name]: value }))
  }

  const handleSelectChange = (name: string, value: string) => {
    setMatch((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onMatchAdd(match)
    // Reset form
    setMatch({
      teamA: "",
      teamB: "",
      winner: "",
      teamAKills: 0,
      teamBKills: 0,
      teamADamage: 0,
      teamBDamage: 0,
      teamARoundsWon: 0,
      teamBRoundsWon: 0,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="teamA">Team A</Label>
          <Input id="teamA" name="teamA" value={match.teamA} onChange={handleInputChange} required />
        </div>
        <div>
          <Label htmlFor="teamB">Team B</Label>
          <Input id="teamB" name="teamB" value={match.teamB} onChange={handleInputChange} required />
        </div>
      </div>
      <div>
        <Label htmlFor="winner">Winner</Label>
        <Select value={match.winner} onValueChange={(value) => handleSelectChange("winner", value)}>
          <SelectTrigger>
            <SelectValue placeholder="Select winner" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={match.teamA}>{match.teamA}</SelectItem>
            <SelectItem value={match.teamB}>{match.teamB}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="teamAKills">Team A Kills</Label>
          <Input
            id="teamAKills"
            name="teamAKills"
            type="number"
            value={match.teamAKills}
            onChange={handleInputChange}
            required
          />
        </div>
        <div>
          <Label htmlFor="teamBKills">Team B Kills</Label>
          <Input
            id="teamBKills"
            name="teamBKills"
            type="number"
            value={match.teamBKills}
            onChange={handleInputChange}
            required
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="teamADamage">Team A Damage</Label>
          <Input
            id="teamADamage"
            name="teamADamage"
            type="number"
            value={match.teamADamage}
            onChange={handleInputChange}
            required
          />
        </div>
        <div>
          <Label htmlFor="teamBDamage">Team B Damage</Label>
          <Input
            id="teamBDamage"
            name="teamBDamage"
            type="number"
            value={match.teamBDamage}
            onChange={handleInputChange}
            required
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="teamARoundsWon">Team A Rounds Won</Label>
          <Input
            id="teamARoundsWon"
            name="teamARoundsWon"
            type="number"
            value={match.teamARoundsWon}
            onChange={handleInputChange}
            required
          />
        </div>
        <div>
          <Label htmlFor="teamBRoundsWon">Team B Rounds Won</Label>
          <Input
            id="teamBRoundsWon"
            name="teamBRoundsWon"
            type="number"
            value={match.teamBRoundsWon}
            onChange={handleInputChange}
            required
          />
        </div>
      </div>
      <Button type="submit">Add Match</Button>
    </form>
  )
}
