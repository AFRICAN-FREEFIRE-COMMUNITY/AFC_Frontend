import { useState, useEffect } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

// Mock function to fetch scrims
const fetchScrims = async (filters) => {
  // In a real app, this would be an API call with the filters applied
  return [
    { id: 1, name: "Weekly Practice", date: "2023-07-10", format: "Battle Royale", location: "online" },
    { id: 2, name: "Team Alpha vs Team Beta", date: "2023-07-17", format: "Clash Squad", location: "physical" },
    { id: 3, name: "Casual Fridays", date: "2023-07-21", format: "Battle Royale", location: "hybrid" },
  ]
}

export function ScrimList({ searchQuery, eventType, timeFrame, format, dateRange, location }) {
  const [scrims, setScrims] = useState([])

  useEffect(() => {
    const getScrims = async () => {
      const fetchedScrims = await fetchScrims({
        searchQuery,
        eventType,
        timeFrame,
        format,
        dateRange,
        location,
      })
      setScrims(fetchedScrims)
    }
    getScrims()
  }, [searchQuery, eventType, timeFrame, format, dateRange, location])

  return (
    <div className="grid gap-4">
      {scrims.map((scrim) => (
        <Card key={scrim.id}>
          <CardHeader>
            <CardTitle>{scrim.name}</CardTitle>
          </CardHeader>
          <CardContent>
            <p>Date: {scrim.date}</p>
            <p>Format: {scrim.format}</p>
            <p>Location: {scrim.location}</p>
            <Button asChild className="mt-2">
              <Link href={`/scrims/${scrim.id}`}>View Scrim</Link>
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
