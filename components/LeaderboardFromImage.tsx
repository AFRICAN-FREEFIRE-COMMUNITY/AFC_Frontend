import { useState } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

interface LeaderboardEntry {
  rank: number
  teamName: string
  kills: number
  points: number
  placement: number
  placementPoints: number
  players: { name: string; kills: number; mvps: number }[]
  bot: { kills: number; mvps: number }
}

interface LeaderboardFromImageProps {
  leaderboardData: LeaderboardEntry[]
  onConfirm: (data: LeaderboardEntry[]) => void
  onReject: () => void
  onEdit: (data: LeaderboardEntry[]) => void
  mapName: string
}

export function LeaderboardFromImage({
  leaderboardData,
  onConfirm,
  onReject,
  onEdit,
  mapName,
}: LeaderboardFromImageProps) {
  const [editableData, setEditableData] = useState(leaderboardData)

  const handleChange = (teamIndex: number, field: string, value: any) => {
    const updatedData = [...editableData]
    updatedData[teamIndex] = { ...updatedData[teamIndex], [field]: value }
    setEditableData(updatedData)
    onEdit(updatedData)
  }

  const handlePlayerChange = (teamIndex: number, playerIndex: number, field: string, value: any) => {
    const updatedData = [...editableData]
    updatedData[teamIndex].players[playerIndex] = {
      ...updatedData[teamIndex].players[playerIndex],
      [field]: value,
    }
    setEditableData(updatedData)
    onEdit(updatedData)
  }

  const handleBotChange = (teamIndex: number, field: string, value: any) => {
    const updatedData = [...editableData]
    updatedData[teamIndex].bot = { ...updatedData[teamIndex].bot, [field]: value }
    setEditableData(updatedData)
    onEdit(updatedData)
  }

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle>Generated Leaderboard - {mapName}</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Rank</TableHead>
              <TableHead>Team</TableHead>
              <TableHead>Kills</TableHead>
              <TableHead>Placement</TableHead>
              <TableHead>Placement Points</TableHead>
              <TableHead>Total Points</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {editableData.map((entry, teamIndex) => (
              <TableRow key={entry.rank}>
                <TableCell>
                  <Input
                    type="number"
                    value={entry.rank}
                    onChange={(e) => handleChange(teamIndex, "rank", Number(e.target.value))}
                    className="w-16"
                  />
                </TableCell>
                <TableCell>
                  <Input value={entry.teamName} onChange={(e) => handleChange(teamIndex, "teamName", e.target.value)} />
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    value={entry.kills}
                    onChange={(e) => handleChange(teamIndex, "kills", Number(e.target.value))}
                    className="w-16"
                  />
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    value={entry.placement}
                    onChange={(e) => handleChange(teamIndex, "placement", Number(e.target.value))}
                    className="w-16"
                  />
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    value={entry.placementPoints}
                    onChange={(e) => handleChange(teamIndex, "placementPoints", Number(e.target.value))}
                    className="w-16"
                  />
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    value={entry.points}
                    onChange={(e) => handleChange(teamIndex, "points", Number(e.target.value))}
                    className="w-16"
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div className="mt-4">
          <h3 className="text-lg font-semibold mb-2">Player Details</h3>
          {editableData.map((team, teamIndex) => (
            <div key={team.teamName} className="mb-4">
              <h4 className="font-medium mb-2">{team.teamName}</h4>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Player</TableHead>
                    <TableHead>Kills</TableHead>
                    <TableHead>MVPs</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {team.players.map((player, playerIndex) => (
                    <TableRow key={playerIndex}>
                      <TableCell>
                        <Input
                          value={player.name}
                          onChange={(e) => handlePlayerChange(teamIndex, playerIndex, "name", e.target.value)}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={player.kills}
                          onChange={(e) => handlePlayerChange(teamIndex, playerIndex, "kills", Number(e.target.value))}
                          className="w-16"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={player.mvps}
                          onChange={(e) => handlePlayerChange(teamIndex, playerIndex, "mvps", Number(e.target.value))}
                          className="w-16"
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow>
                    <TableCell>Bot</TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={team.bot.kills}
                        onChange={(e) => handleBotChange(teamIndex, "kills", Number(e.target.value))}
                        className="w-16"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={team.bot.mvps}
                        onChange={(e) => handleBotChange(teamIndex, "mvps", Number(e.target.value))}
                        className="w-16"
                      />
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          ))}
        </div>
        <div className="flex justify-end space-x-4 mt-4">
          <Button onClick={onReject} variant="outline">
            Reject
          </Button>
          <Button onClick={() => onConfirm(editableData)}>Confirm</Button>
        </div>
      </CardContent>
    </Card>
  )
}
