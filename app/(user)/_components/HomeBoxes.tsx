"use client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { env } from "@/lib/env";
import { formatMoneyInput } from "@/lib/utils";
import {
  IconCalendar,
  IconMoneybag,
  IconTrophy,
  IconUsers,
} from "@tabler/icons-react";
import axios from "axios";
import { useEffect, useState } from "react";

export const HomeBoxes = () => {
  const [totalUsers, setTotalUsers] = useState<number>(0);
  const [totalTournaments, setTotalTournaments] = useState<number>(0);
  const [totalKills, setTotalKills] = useState<number>(0);

  useEffect(() => {
    const fetchUsers = async () => {
      const users = await axios(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/auth/get-total-number-of-users/`,
      );
      const tournaments = await axios(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/get-total-tournaments-count/`,
      );
      const totalKills = await axios(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/get-total-kills/`,
      );

      setTotalUsers(users?.data?.total_users);
      setTotalTournaments(tournaments?.data?.total_tournaments);
      setTotalKills(totalKills?.data?.total_kills);
    };

    fetchUsers();
  }, []);

  return (
    <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-4 mb-4">
      <Card className="border-primary">
        <CardHeader>
          <IconTrophy className="h-8 w-8 text-gold mb-1" />
          <CardTitle>Total Kills</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-4xl font-bold text-gold">
            {formatMoneyInput(totalKills)}
          </p>
        </CardContent>
      </Card>
      <Card className="border-primary">
        <CardHeader>
          <IconUsers className="h-8 w-8 text-gold mb-1" />
          <CardTitle>Active Players</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-4xl font-bold text-gold">
            {formatMoneyInput(totalUsers)}
          </p>
        </CardContent>
      </Card>
      <Card className="border-primary">
        <CardHeader>
          <IconCalendar className="h-8 w-8 text-gold mb-1" />
          <CardTitle>Hosted Tournaments</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-4xl font-bold text-gold">
            {formatMoneyInput(totalTournaments)}
          </p>
        </CardContent>
      </Card>
      <Card className="border-primary">
        <CardHeader>
          <IconMoneybag className="h-8 w-8 text-gold mb-1" />
          <CardTitle>Total Prize Pool</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-4xl font-bold text-gold">$1,750</p>
        </CardContent>
      </Card>
    </div>
  );
};
