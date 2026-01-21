"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { env } from "@/lib/env";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { FullLoader, Loader } from "@/components/Loader";
import { Check, X, Users, Trophy, Calendar, AlertTriangle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import Link from "next/link";
import { Footer } from "@/app/_components/Footer";
import { Header } from "@/app/(user)/_components/Header";

type TeamInviteClientProps = {
  inviteId: string;
  initialData?: any; // Server-fetched team data
};

export function TeamInviteClient({
  inviteId,
  initialData,
}: TeamInviteClientProps) {
  const router = useRouter();
  const { user, token } = useAuth();

  const [teamDetails, setTeamDetails] = useState(initialData || null);
  const [loading, setLoading] = useState(!initialData);
  const [pendingAccept, startAcceptTransition] = useTransition();
  const [pendingReject, startRejectTransition] = useTransition();

  // Only fetch if we don't have initialData
  useEffect(() => {
    if (!initialData && inviteId) {
      fetchTeamDetails();
    }
  }, [inviteId, initialData]);

  const fetchTeamDetails = async () => {
    if (!inviteId) return;

    setLoading(true);
    try {
      const response = await fetch(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/team/get-team-details-based-on-invite/${inviteId}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        },
      );

      if (!response.ok) {
        throw new Error("Failed to fetch team details");
      }

      const data = await response.json();
      setTeamDetails(data.team);
    } catch (error: any) {
      console.error("Error fetching team details:", error);
      toast.error(error?.message || "Failed to fetch team details");
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptInvite = () => {
    if (!user) {
      toast.error("Please log in to accept this invite");
      router.push(`/login?redirect=/invite/${inviteId}`);
      return;
    }

    startAcceptTransition(async () => {
      try {
        const response = await axios.post(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/team/respond-invite/${inviteId}/`,
          { action: "accept" },
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        );
        toast.success(response.data.message || "Successfully joined the team!");
        router.push(`/teams/${teamDetails?.team_name}`);
      } catch (error: any) {
        toast.error(
          error?.response?.data?.message || "Failed to accept invite",
        );
      }
    });
  };

  const handleRejectInvite = () => {
    if (!user) {
      toast.error("Please log in to decline this invite");
      router.push(`/login?redirect=/invite/${inviteId}`);
      return;
    }

    startRejectTransition(async () => {
      try {
        const response = await axios.post(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/team/respond-invite/${inviteId}/`,
          { action: "decline" },
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        );
        toast.success(response.data.message || "Invite declined");
        router.push("/teams");
      } catch (error: any) {
        toast.error(
          error?.response?.data?.message || "Failed to decline invite",
        );
      }
    });
  };

  if (loading) {
    return <FullLoader />;
  }

  if (!teamDetails) {
    return (
      <div>
        <Header />
        <div className="container mx-auto px-4 py-8">
          <Card>
            <CardContent className="py-12 text-center">
              <h2 className="text-2xl font-bold mb-4">Invalid Invite</h2>
              <p className="text-muted-foreground mb-6">
                This invite link is invalid or has expired.
              </p>
              <Button asChild>
                <Link href="/teams">Browse Teams</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div>
      <Header />
      <Card className="container my-20 mx-auto">
        <CardHeader>
          <CardTitle className="text-center text-2xl">
            Team Invitation
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Team Info */}
            <div className="flex flex-col items-center text-center space-y-4">
              <Avatar className="w-24 h-24">
                <AvatarImage
                  src={teamDetails?.team_logo}
                  alt={teamDetails?.team_name}
                  className="object-cover"
                />
                <AvatarFallback className="text-2xl">
                  {teamDetails?.team_name?.[0] || "T"}
                </AvatarFallback>
              </Avatar>
              <div>
                <h2 className="text-3xl font-bold mb-2">
                  {teamDetails?.team_name}
                </h2>
                {teamDetails?.team_tag && (
                  <Badge variant="secondary" className="mb-2">
                    {teamDetails?.team_tag}
                  </Badge>
                )}
                <p className="text-muted-foreground">
                  You have been invited to join this team!
                </p>
              </div>
            </div>

            {/* Banned Team Alert */}
            {teamDetails?.is_banned && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>This team is currently banned</AlertTitle>
                <AlertDescription>
                  You cannot join a banned team. The invite link is no longer
                  valid.
                  {teamDetails?.ban_reason && (
                    <>
                      <br />
                      Reason: {teamDetails.ban_reason}
                    </>
                  )}
                </AlertDescription>
              </Alert>
            )}

            {/* Team Description */}
            {teamDetails?.team_description && (
              <div className="bg-muted p-4 rounded-md">
                <h3 className="font-semibold mb-2">About the Team</h3>
                <p className="text-sm text-muted-foreground">
                  {teamDetails?.team_description}
                </p>
              </div>
            )}

            {/* Team Stats */}
            <div className="grid grid-cols-2 2xl:grid-cols-4 gap-2">
              <div className="text-center p-4 bg-muted rounded-md">
                <Users className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
                <p className="text-2xl font-bold">
                  {teamDetails?.members?.length || 0}/6
                </p>
                <p className="text-xs text-muted-foreground">Members</p>
              </div>
              <div className="text-center p-4 bg-muted rounded-md">
                <Trophy className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
                <p className="text-2xl font-bold">
                  {teamDetails?.stats?.tournament_wins || 0}
                </p>
                <p className="text-xs text-muted-foreground">Wins</p>
              </div>
              <div className="text-center p-4 bg-muted rounded-md">
                <Badge
                  variant="outline"
                  className="h-6 w-6 mx-auto mb-2 flex items-center justify-center"
                >
                  T{teamDetails?.team_tier || 1}
                </Badge>
                <p className="text-2xl font-bold">
                  {teamDetails?.team_tier || 1}
                </p>
                <p className="text-xs text-muted-foreground">Tier</p>
              </div>
              <div className="text-center p-4 bg-muted rounded-md">
                <Calendar className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
                <p className="text-2xl font-bold">
                  {teamDetails?.country || "Global"}
                </p>
                <p className="text-xs text-muted-foreground">Country</p>
              </div>
            </div>

            {/* Current Members */}
            {teamDetails?.members && teamDetails?.members.length > 0 && (
              <div>
                <h3 className="font-semibold mb-3">Current Members</h3>
                <div className="space-y-2">
                  {teamDetails?.members.map((member: any, index: number) => (
                    <div
                      key={member.id || index}
                      className="flex items-center justify-between p-3 bg-muted rounded-md"
                    >
                      <div className="flex items-center space-x-3">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={member.avatar} />
                          <AvatarFallback>
                            {member.username?.[0] || "U"}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium text-sm">
                            {member.username}
                          </p>
                          {member.management_role && (
                            <p className="text-xs text-muted-foreground capitalize">
                              {member.management_role}
                            </p>
                          )}
                        </div>
                      </div>
                      {member.in_game_role && (
                        <Badge variant="outline" className="text-xs capitalize">
                          {member.in_game_role}
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            {teamDetails?.is_banned ? (
              <div className="pt-4">
                <Button asChild className="w-full">
                  <Link href="/teams">Browse Other Teams</Link>
                </Button>
              </div>
            ) : (
              <div className="flex gap-4 pt-4">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={handleRejectInvite}
                  disabled={pendingAccept || pendingReject || !user}
                >
                  {pendingReject ? (
                    <Loader text="Declining..." />
                  ) : (
                    <>
                      <X className="mr-2 h-4 w-4" />
                      Decline
                    </>
                  )}
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleAcceptInvite}
                  disabled={pendingAccept || pendingReject || !user}
                >
                  {pendingAccept ? (
                    <Loader text="Joining..." />
                  ) : (
                    <>
                      <Check className="mr-2 h-4 w-4" />
                      Accept & Join
                    </>
                  )}
                </Button>
              </div>
            )}

            {/* Login Prompt */}
            {!user && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Authentication Required</AlertTitle>
                <AlertDescription>
                  You need to{" "}
                  <Link
                    href={`/login?redirect=/invite/${inviteId}`}
                    className="text-primary underline font-medium"
                  >
                    log in
                  </Link>{" "}
                  to accept or decline this invite.
                </AlertDescription>
              </Alert>
            )}
          </div>
        </CardContent>
      </Card>
      <Footer />
    </div>
  );
}
