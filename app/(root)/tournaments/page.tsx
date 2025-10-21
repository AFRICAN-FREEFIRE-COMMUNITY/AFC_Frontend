"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

// Mock function to simulate fetching tournaments
const getTournaments = async () => {
  // In a real app, this would be an API call
  return [
    { id: 1, name: "Summer Showdown", date: "2023-07-15", prizePool: 10000 },
    { id: 2, name: "Fall Classic", date: "2023-09-20", prizePool: 15000 },
    { id: 3, name: "Winter Cup", date: "2023-12-10", prizePool: 20000 },
  ];
};

export default function TournamentsPage() {
  const [tournaments, setTournaments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchTournaments = async () => {
      try {
        const data = await getTournaments();
        setTournaments(data);
        setIsLoading(false);
      } catch (err) {
        setError("Failed to fetch tournaments");
        setIsLoading(false);
      }
    };

    fetchTournaments();
  }, []);

  if (isLoading) return <Layout>Loading tournaments...</Layout>;
  if (error) return <Layout>Error: {error}</Layout>;

  return (
    <Layout>
      <h1 className="text-3xl font-bold mb-6">Tournaments</h1>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {tournaments.map((tournament) => (
          <Card key={tournament.id}>
            <CardHeader>
              <CardTitle>{tournament.name}</CardTitle>
            </CardHeader>
            <CardContent>
              <p>Date: {tournament.date}</p>
              <p>Prize Pool: ${tournament.prizePool}</p>
              <Button asChild className="mt-4">
                <Link href={`/tournaments/${tournament.id}`}>
                  View Tournament
                </Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </Layout>
  );
}
