"use client";

import { useEffect, useState, useTransition } from "react";
import { useParams, useRouter } from "next/navigation";
import axios from "axios";
import { env } from "@/lib/env";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { FullLoader, Loader } from "@/components/Loader";
import { Check, X, Users, Trophy, Calendar } from "lucide-react";
import Link from "next/link";

export default function InvitePage() {
  const params = useParams();
  const router = useRouter();
  const { user, token } = useAuth();
  const inviteId = params.id as string;

  const [teamDetails, setTeamDetails] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [pendingAccept, startAcceptTransition] = useTransition();
  const [pendingReject, startRejectTransition] = useTransition();

  useEffect(() => {
    if (!inviteId) return;

    const fetchTeamDetails = async () => {
      try {
        // Extract invite ID from the URL and fetch team details
        const response = await axios(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/team/get-team-details-based-on-invite/${inviteId}`
        );
        setTeamDetails(response.data.team);
      } catch (error: any) {
        toast.error(
          error?.response?.data?.message || "Failed to fetch team details"
        );
      } finally {
        setLoading(false);
      }
    };

    fetchTeamDetails();
  }, [inviteId]);

  const handleAcceptInvite = () => {
    startAcceptTransition(async () => {
      try {
        const response = await axios.post(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/team/respond-invite/${inviteId}/`,
          { action: "accept" },
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        toast.success(response.data.message || "Successfully joined the team!");
        router.push(`/teams/${teamDetails?.team_name}`);
      } catch (error: any) {
        toast.error(
          error?.response?.data?.message || "Failed to accept invite"
        );
      }
    });
  };

  const handleRejectInvite = () => {
    startRejectTransition(async () => {
      try {
        const response = await axios.post(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/team/respond-invite/${inviteId}/`,
          { action: "decline" },
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        toast.success(response.data.message || "Invite declined");
        router.push("/teams");
      } catch (error: any) {
        toast.error(
          error?.response?.data?.message || "Failed to decline invite"
        );
      }
    });
  };

  if (loading) {
    return (
      <Layout>
        <FullLoader text="Loading invite details..." />
      </Layout>
    );
  }

  if (!teamDetails) {
    return (
      <Layout>
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
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <Card className="max-w-2xl mx-auto">
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
                    {teamDetails?.team_name?.[0]}
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
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
                  <p className="text-2xl font-bold">{teamDetails?.country}</p>
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
                        key={index}
                        className="flex items-center justify-between p-3 bg-muted rounded-md"
                      >
                        <div className="flex items-center space-x-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={member.avatar} />
                            <AvatarFallback>
                              {member.username?.[0]}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium text-sm">
                              {member.username}
                            </p>
                            {member.management_role && (
                              <p className="text-xs text-muted-foreground">
                                {member.management_role}
                              </p>
                            )}
                          </div>
                        </div>
                        {member.in_game_role && (
                          <Badge variant="outline" className="text-xs">
                            {member.in_game_role}
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-4 pt-4">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={handleRejectInvite}
                  disabled={pendingAccept || pendingReject}
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
                  disabled={pendingAccept || pendingReject}
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

              {!user && (
                <p className="text-center text-sm text-muted-foreground">
                  You need to{" "}
                  <Link
                    href={`/login?redirect=/invite/${inviteId}`}
                    className="text-primary underline"
                  >
                    log in
                  </Link>{" "}
                  to accept this invite
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
