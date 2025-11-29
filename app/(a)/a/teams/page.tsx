"use client";

import { useState, useEffect, useTransition, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { FullLoader } from "@/components/Loader";
import axios from "axios";
import { env } from "@/lib/env";
import { PageHeader } from "@/components/PageHeader";
import { BanModal } from "../_components/BanModal";

const page = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterTier, setFilterTier] = useState("all");
  const [pending, startTransition] = useTransition();
  const [teams, setTeams] = useState<any>();

  const fetchTeams = async () => {
    startTransition(async () => {
      try {
        const res = await axios(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/team/get-all-teams/`
        );

        if (res.statusText === "OK") {
          setTeams(res.data.teams);
        } else {
          toast.error("Oops! An error occurred");
        }
      } catch (error: any) {
        toast.error(error?.response?.data.message);
      }
    });
  };

  useEffect(() => {
    startTransition(async () => {
      try {
        const res = await axios(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/team/get-all-teams/`
        );

        if (res.statusText === "OK") {
          setTeams(res.data.teams);
        } else {
          toast.error("Oops! An error occurred");
        }
      } catch (error: any) {
        toast.error(error?.response?.data.message);
      }
    });
  }, []);

  const filteredTeams = useMemo(() => {
    if (!teams) return [];

    return teams.filter((team: any) => {
      const matchesSearch = team.team_name
        .toLowerCase()
        .includes(searchTerm.toLowerCase());
      const matchesTier =
        filterTier === "all" || String(team.team_tier) === filterTier;

      return matchesSearch && matchesTier;
    });
  }, [teams, searchTerm, filterTier]);

  if (pending) return <FullLoader />;

  return (
    <div>
      <PageHeader title="Team Management" />

      <div className="flex justify-between items-center mb-6">
        <div className="flex flex-col md:flex-row w-full md:w-auto items-start md:items-center gap-2">
          <Input
            placeholder="Search teams..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full md:w-64"
          />
          <Select value={filterTier} onValueChange={setFilterTier}>
            <SelectTrigger className="w-full md:w-40">
              <SelectValue placeholder="Filter by tier" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Tiers</SelectItem>
              <SelectItem value="1">Tier 1</SelectItem>
              <SelectItem value="2">Tier 2</SelectItem>
              <SelectItem value="3">Tier 3</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Teams</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Tier</TableHead>
                <TableHead>Members</TableHead>
                <TableHead>Total Wins</TableHead>
                <TableHead>Total Earnings</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTeams.length > 0 ? (
                filteredTeams.map((team: any) => (
                  <TableRow key={team.team_name}>
                    <TableCell>{team.team_name}</TableCell>
                    <TableCell>{team.team_tier}</TableCell>
                    <TableCell>
                      {team.member_count ? team.member_count : 0}
                    </TableCell>
                    <TableCell>
                      {team.total_wins ? team.total_wins : 0}
                    </TableCell>
                    <TableCell>
                      ${team.total_earnings ? team.total_earnings : 0}
                    </TableCell>
                    <TableCell>
                      {team.is_banned ? (
                        <Badge variant="destructive">Banned</Badge>
                      ) : (
                        <Badge variant="secondary">Active</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <Button
                          asChild
                          variant="outline"
                          size="sm"
                          className="mr-2"
                        >
                          <Link href={`/a/teams/${team.team_name}`}>View</Link>
                        </Button>
                        <BanModal
                          isBanned={team.is_banned}
                          teamName={team.team_name}
                          team_id={team.team_id}
                          onSuccess={fetchTeams}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="text-center py-8 text-muted-foreground"
                  >
                    No teams found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};
export default page;
