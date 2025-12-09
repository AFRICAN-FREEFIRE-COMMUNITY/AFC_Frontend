"use client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { env } from "@/lib/env";
import { formatMoneyInput } from "@/lib/utils";
import {
  IconCalendar,
  IconMoneybag,
  IconTrophy,
  IconUsers,
} from "@tabler/icons-react";
import axios from "axios";
import { BarChart2, Calendar, Trophy, Users } from "lucide-react";
import { useEffect, useState } from "react";

export const HomeBoxes = () => {
  const [totalUsers, setTotalUsers] = useState<number>(0);

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
    <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-4 mb-8">
      <Card className="border-primary">
        <CardHeader>
          <IconTrophy className="h-8 w-8 text-gold mb-1" />
          <CardTitle>Total Kills</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-4xl font-bold text-gold">0</p>
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
          <CardTitle>Upcoming Tournaments</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-4xl font-bold text-gold">3</p>
        </CardContent>
      </Card>
      <Card className="border-primary">
        <CardHeader>
          <IconMoneybag className="h-8 w-8 text-gold mb-1" />
          <CardTitle>Total Prize Pool</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-4xl font-bold text-gold">$8,000</p>
        </CardContent>
      </Card>
    </div>
  );
};
