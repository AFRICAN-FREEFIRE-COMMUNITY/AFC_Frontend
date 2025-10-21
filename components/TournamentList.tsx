import { useState, useEffect } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

// Mock function to fetch tournaments
const fetchTournaments = async (filters) => {
  // In a real app, this would be an API call with the filters applied
  return [
    {
      id: 1,
      name: "Summer Showdown",
      date: "2023-07-15",
      prizePool: 10000,
      format: "Battle Royale",
      location: "online",
    },
    {
      id: 2,
      name: "Fall Classic",
      date: "2023-09-20",
      prizePool: 15000,
      format: "Clash Squad",
      location: "physical",
    },
    {
      id: 3,
      name: "Winter Cup",
      date: "2023-12-10",
      prizePool: 20000,
      format: "Battle Royale",
      location: "hybrid",
    },
  ]
}

export function TournamentList({ searchQuery, eventType, timeFrame, prizePool, format, dateRange, location }) {
  const [tournaments, setTournaments] = useState([])

  useEffect(() => {
    const getTournaments = async () => {
      const fetchedTournaments = await fetchTournaments({
        searchQuery,
        eventType,
        timeFrame,
        prizePool,
        format,
        dateRange,
        location,
      })
      setTournaments(fetchedTournaments)
    }
    getTournaments()
  }, [searchQuery, eventType, timeFrame, prizePool, format, dateRange, location])

  return (
    <div className="grid gap-4">
      {tournaments.map((tournament) => (
        <Card key={tournament.id}>
          <CardHeader>
            <CardTitle>{tournament.name}</CardTitle>
          </CardHeader>
          <CardContent>
            <p>Date: {tournament.date}</p>
            <p>Prize Pool: ${tournament.prizePool}</p>
            <p>Format: {tournament.format}</p>
            <p>Location: {tournament.location}</p>
            <Button asChild className="mt-2">
              <Link href={`/tournaments/${tournament.id}`}>View Tournament</Link>
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
