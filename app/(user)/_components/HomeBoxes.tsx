"use client";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { env } from "@/lib/env";
import { formatMoneyInput } from "@/lib/utils";
// Money = the multi-currency chokepoint: the total prize pool is summed on the backend in USD
// (events/get-total-prize-pool/) and shown here in the VIEWER's currency (CurrencyContext).
import { Money } from "@/components/Money";
import {
  IconCalendar,
  IconMoneybag,
  IconTrophy,
  IconUsers,
} from "@tabler/icons-react";
import axios from "axios";
import { useEffect, useState } from "react";
// Live refresh (owner 2026-07-02): site-wide heartbeat - re-pulls the stat counts
// while the tab is visible so the boxes update without a manual reload.
import { useLiveTick } from "@/hooks/useLiveTick";

export const HomeBoxes = () => {
  // Stat-box labels on the authed home page (namespace == messages/en/home.json).
  const t = useTranslations("home");
  const [totalUsers, setTotalUsers] = useState<number>(0);
  const [totalTournaments, setTotalTournaments] = useState<number>(0);
  const [totalKills, setTotalKills] = useState<number>(0);
  // Total prize pool across all hosted events, summed on the backend in USD
  // (events/get-total-prize-pool/) and rendered via <Money from="USD"/> below.
  const [totalPrizeUsd, setTotalPrizeUsd] = useState<number>(0);
  // Live refresh (owner 2026-07-02): re-run the count fetches on the shared tick.
  const tick = useLiveTick();

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
      const prize = await axios(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/get-total-prize-pool/`,
      );

      setTotalUsers(users?.data?.total_users);
      setTotalTournaments(tournaments?.data?.total_tournaments);
      setTotalKills(totalKills?.data?.total_kills);
      setTotalPrizeUsd(prize?.data?.total_prize_pool_usd ?? 0);
    };

    fetchUsers();
    // Live refresh (owner 2026-07-02): tick re-runs these read-only count fetches
    // in place (no spinner state on this component, so nothing flashes).
  }, [tick]);

  return (
    <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-4 mb-4">
      <Card className="border-primary">
        <CardHeader>
          <IconTrophy className="h-8 w-8 text-gold mb-1" />
          <CardTitle>{t("boxes.totalKills")}</CardTitle>
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
          <CardTitle>{t("boxes.activePlayers")}</CardTitle>
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
          <CardTitle>{t("boxes.hostedTournaments")}</CardTitle>
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
          <CardTitle>{t("boxes.totalPrizePool")}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-4xl font-bold text-gold">
            <Money amount={totalPrizeUsd} from="USD" />
          </p>
        </CardContent>
      </Card>
    </div>
  );
};
