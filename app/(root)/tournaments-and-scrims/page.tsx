"use client"

import { useState } from "react"
import Layout from "@/components/Layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DatePickerWithRange } from "@/components/ui/date-picker-with-range"
import { TournamentList } from "@/components/TournamentList"
import { ScrimList } from "@/components/ScrimList"
import { addDays } from "date-fns"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { ExternalLink } from "lucide-react"

export default function TournamentsAndScrimsPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [eventType, setEventType] = useState("all")
  const [timeFrame, setTimeFrame] = useState("all")
  const [prizePool, setPrizePool] = useState("all")
  const [format, setFormat] = useState("all")
  const [dateRange, setDateRange] = useState({
    from: addDays(new Date(), -30),
    to: new Date(),
  })
  const [location, setLocation] = useState("all")

  const TournamentCard = ({ tournament }) => (
    <Card key={tournament.id}>
      <CardHeader>
        <CardTitle>{tournament.name}</CardTitle>
      </CardHeader>
      <CardContent>
        <p>Date: {tournament.date}</p>
        <p>Format: {tournament.format}</p>
        <p>Location: {tournament.location}</p>
        {tournament.registrationLink && (
          <Button asChild className="mt-2">
            <a href={tournament.registrationLink} target="_blank" rel="noopener noreferrer">
              Register <ExternalLink className="ml-2 h-4 w-4" />
            </a>
          </Button>
        )}
        <Button asChild className="mt-2 ml-2">
          <Link href={`/tournaments/${tournament.id}`}>View Details</Link>
        </Button>
      </CardContent>
    </Card>
  )

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold mb-8">Tournaments & Scrims</h1>

        <Tabs defaultValue="all">
          <TabsList className="mb-4">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
            <TabsTrigger value="past">Past</TabsTrigger>
          </TabsList>

          <div className="grid gap-4 mb-6">
            <Input
              placeholder="Search tournaments or scrims..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Select value={eventType} onValueChange={setEventType}>
                <SelectTrigger>
                  <SelectValue placeholder="Event Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Events</SelectItem>
                  <SelectItem value="tournament">Tournaments</SelectItem>
                  <SelectItem value="scrim">Scrims</SelectItem>
                </SelectContent>
              </Select>
              <Select value={timeFrame} onValueChange={setTimeFrame}>
                <SelectTrigger>
                  <SelectValue placeholder="Time Frame" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Time</SelectItem>
                  <SelectItem value="past-week">Past Week</SelectItem>
                  <SelectItem value="past-month">Past Month</SelectItem>
                  <SelectItem value="past-year">Past Year</SelectItem>
                </SelectContent>
              </Select>
              <Select value={prizePool} onValueChange={setPrizePool}>
                <SelectTrigger>
                  <SelectValue placeholder="Prize Pool" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Prize Pools</SelectItem>
                  <SelectItem value="0-1000">$0 - $1,000</SelectItem>
                  <SelectItem value="1001-5000">$1,001 - $5,000</SelectItem>
                  <SelectItem value="5001-10000">$5,001 - $10,000</SelectItem>
                  <SelectItem value="10001+">$10,001+</SelectItem>
                </SelectContent>
              </Select>
              <Select value={format} onValueChange={setFormat}>
                <SelectTrigger>
                  <SelectValue placeholder="Format" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Formats</SelectItem>
                  <SelectItem value="battle-royale">Battle Royale</SelectItem>
                  <SelectItem value="clash-squad">Clash Squad</SelectItem>
                  <SelectItem value="hybrid">Hybrid</SelectItem>
                </SelectContent>
              </Select>
              <Select value={location} onValueChange={setLocation}>
                <SelectTrigger>
                  <SelectValue placeholder="Location" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Locations</SelectItem>
                  <SelectItem value="online">Online</SelectItem>
                  <SelectItem value="physical">Physical</SelectItem>
                  <SelectItem value="hybrid">Hybrid</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DatePickerWithRange dateRange={dateRange} setDateRange={setDateRange} />
          </div>

          <TabsContent value="all">
            <div className="grid md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Tournaments</CardTitle>
                </CardHeader>
                <CardContent>
                  <TournamentList
                    searchQuery={searchQuery}
                    eventType={eventType}
                    timeFrame={timeFrame}
                    prizePool={prizePool}
                    format={format}
                    dateRange={dateRange}
                    location={location}
                    TournamentCard={TournamentCard}
                  />
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Scrims</CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrimList
                    searchQuery={searchQuery}
                    eventType={eventType}
                    timeFrame={timeFrame}
                    prizePool={prizePool}
                    format={format}
                    dateRange={dateRange}
                    location={location}
                  />
                </CardContent>
              </Card>
            </div>
          </TabsContent>
          <TabsContent value="upcoming">
            <TournamentList
              searchQuery={searchQuery}
              eventType={eventType}
              timeFrame="upcoming"
              prizePool={prizePool}
              format={format}
              dateRange={dateRange}
              location={location}
              TournamentCard={TournamentCard}
            />
          </TabsContent>
          <TabsContent value="past">
            <TournamentList
              searchQuery={searchQuery}
              eventType={eventType}
              timeFrame="past"
              prizePool={prizePool}
              format={format}
              dateRange={dateRange}
              location={location}
              TournamentCard={TournamentCard}
            />
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  )
}
