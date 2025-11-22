"use client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { env } from "@/lib/env";
import { formatMoneyInput } from "@/lib/utils";
import axios from "axios";
import { BarChart2, Calendar, Trophy, Users } from "lucide-react";
import { useEffect, useState } from "react";

export const HomeBoxes = () => {
  const [totalUsers, setTotalUsers] = useState<number>();

  useEffect(() => {
    const fetchUsers = async () => {
      const users = await axios(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/auth/get-total-number-of-users/`
      );
      setTotalUsers(users?.data?.total_users);
    };

    fetchUsers();
  }, []);

  return (
    <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4 mb-8">
      <Card className="card-hover">
        <CardHeader>
          <Trophy className="h-8 w-8 text-[hsl(var(--gold))] mb-2" />
          <CardTitle>Total Kills</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-4xl font-bold gold-text">0</p>
        </CardContent>
      </Card>
      <Card className="card-hover">
        <CardHeader>
          <Users className="h-8 w-8 text-[hsl(var(--gold))] mb-2" />
          <CardTitle>Active Players</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-4xl font-bold gold-text">
            {formatMoneyInput(totalUsers)}
          </p>
        </CardContent>
      </Card>
      <Card className="card-hover">
        <CardHeader>
          <Calendar className="h-8 w-8 text-[hsl(var(--gold))] mb-2" />
          <CardTitle>Upcoming Tournaments</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-4xl font-bold gold-text">3</p>
        </CardContent>
      </Card>
      <Card className="card-hover">
        <CardHeader>
          <BarChart2 className="h-8 w-8 text-[hsl(var(--gold))] mb-2" />
          <CardTitle>Total Prize Pool</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-4xl font-bold gold-text">$8,000</p>
        </CardContent>
      </Card>
    </div>
  );
};
