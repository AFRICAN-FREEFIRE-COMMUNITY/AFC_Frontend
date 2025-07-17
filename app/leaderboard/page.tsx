import type React from "react"
import Layout from "@/components/Layout"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

const leaderboardData = [
  { rank: 1, name: "FireKing", kills: 1200, wins: 50, mvps: 20 },
  { rank: 2, name: "ShadowSniper", kills: 1150, wins: 48, mvps: 18 },
  { rank: 3, name: "BlazeMaster", kills: 1100, wins: 45, mvps: 16 },
  { rank: 4, name: "StormRider", kills: 1050, wins: 43, mvps: 15 },
  { rank: 5, name: "NinjaWarrior", kills: 1000, wins: 40, mvps: 14 },
]

const Leaderboard: React.FC = () => {
  return (
    <Layout>
      <h1 className="text-3xl font-rajdhani font-bold text-[#FFD700] mb-6">Leaderboard</h1>
      <div className="flex justify-between items-center mb-4">
        <Select>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="kills">Kills</SelectItem>
            <SelectItem value="wins">Tournament Wins</SelectItem>
            <SelectItem value="mvps">MVPs</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[100px]">Rank</TableHead>
            <TableHead>Player</TableHead>
            <TableHead>Kills</TableHead>
            <TableHead>Tournament Wins</TableHead>
            <TableHead>MVPs</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {leaderboardData.map((player) => (
            <TableRow key={player.rank}>
              <TableCell className="font-medium">{player.rank}</TableCell>
              <TableCell>{player.name}</TableCell>
              <TableCell>{player.kills}</TableCell>
              <TableCell>{player.wins}</TableCell>
              <TableCell>{player.mvps}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Layout>
  )
}

export default Leaderboard
