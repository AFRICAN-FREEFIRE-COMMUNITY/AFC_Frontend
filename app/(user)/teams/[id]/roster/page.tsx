"use client";

import { useState, useEffect, useTransition, use } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import axios from "axios";
import { env } from "@/lib/env";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { FullLoader, Loader } from "@/components/Loader";
import { useAuth } from "@/contexts/AuthContext";
import { UserX, AlertTriangle, Shield } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatWord } from "@/lib/utils";
import { PageHeader } from "@/components/PageHeader";
import { InfoTip } from "@/components/ui/info-tip";
// Subtle clickable player name -> public player profile.
import { PlayerLink } from "@/components/ui/entity-link";

interface MemberUpdate {
  member_id: number;
  management_role: string;
  in_game_role: string;
}

type Params = Promise<{
  id: string;
}>;

export default function page({ params }: { params: Params }) {
  const { id } = use(params);

  // i18n: manage-roster page copy (messages/en/teamsplayers.json -> "roster").
  const t = useTranslations("teamsplayers");
  const router = useRouter();
  const { token, user } = useAuth();

  const [teamDetails, setTeamDetails] = useState<any>();
  const [pending, startTransition] = useTransition();
  const [savePending, startSaveTransition] = useTransition();
  const [kickPending, startKickTransition] = useTransition();
  const [roleChanges, setRoleChanges] = useState<Map<number, MemberUpdate>>(
    new Map()
  );
  const [kickModalOpen, setKickModalOpen] = useState(false);
  const [memberToKick, setMemberToKick] = useState<any>(null);

  useEffect(() => {
    if (!id) return; // Don't run if id is not available yet

    startTransition(async () => {
      try {
        const decodedId = decodeURIComponent(id);
        const res = await axios.post(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/team/get-team-details/`,
          { team_name: decodedId }
        );
        setTeamDetails(res.data.team);
      } catch (error: any) {
        // Optional-chain the error body: a bodyless/network/500 failure has no
        // response.data, so the old `error.response.data.message` threw a
        // TypeError and white-screened the page instead of showing a toast.
        toast.error(error?.response?.data?.message || t("roster.loadFailed"));
      }
    });
  }, [id]);

  useEffect(() => {
    // In a real app, fetch team data based on params.id
    // setTeamData(fetchedTeamData)
  }, []);

  const handleRoleChange = (
    memberId: number,
    roleType: "inGameRole" | "managementRole",
    newRole: string
  ) => {
    setRoleChanges((prevChanges) => {
      const newChanges = new Map(prevChanges);
      const existingChange = newChanges.get(memberId);

      // Find the current member to get their current roles
      const currentMember = teamDetails?.members?.find(
        (m: any) => m.id === memberId
      );

      if (currentMember) {
        // Staff roles (coach/manager/analyst) never hold an in-game position. When the management
        // role is being moved TO staff, clear in_game_role in the payload - otherwise we'd re-send the
        // member's stale playing position and the backend returns a partial "only players can have
        // in-game roles" error (the backend drops it anyway). Keeps owner->staff + member->staff clean.
        const STAFF_ROLES = new Set(["coach", "manager", "analyst"]);
        const nextManagementRole =
          roleType === "managementRole"
            ? newRole
            : existingChange?.management_role ?? currentMember.management_role;

        const update: MemberUpdate = {
          member_id: memberId,
          management_role: nextManagementRole,
          in_game_role: STAFF_ROLES.has(nextManagementRole)
            ? ""
            : roleType === "inGameRole"
              ? newRole
              : existingChange?.in_game_role ?? currentMember.in_game_role ?? "",
        };

        newChanges.set(memberId, update);
      }

      return newChanges;
    });
  };

  const openKickModal = (member: any) => {
    setMemberToKick(member);
    setKickModalOpen(true);
  };

  const handleKickMember = async () => {
    if (!memberToKick) return;

    startKickTransition(async () => {
      try {
        await axios.post(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/team/kick-team-member/`,
          {
            team_id: teamDetails?.team_id.toString(),
            member_id: memberToKick.id.toString(),
          },
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        toast.success(
          t("roster.memberRemoved", { name: memberToKick.username })
        );
        setKickModalOpen(false);
        setMemberToKick(null);

        // Refresh team details
        const res = await axios.post(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/team/get-team-details/`,
          { team_name: decodeURIComponent(id) }
        );
        setTeamDetails(res.data.team);
      } catch (error: any) {
        // reads the `error` key first because team/kick-team-member returns the
        // transfer-window-closed block under that key; the window state is also
        // shown on /teams and /rankings. Fall back to `message` then a generic
        // string so the specific reason still shows.
        toast.error(
          error?.response?.data?.error ||
            error?.response?.data?.message ||
            t("roster.kickFailed")
        );
      }
    });
  };

  // Check if a member is the team owner or creator (cannot be kicked)
  const isOwnerOrCreator = (member: any) => {
    return (
      member.username === teamDetails?.team_owner ||
      member.username === teamDetails?.team_creator
    );
  };

  // Check if current user is the one being displayed (cannot kick yourself)
  const isSelf = (member: any) => {
    return member.username === user?.username;
  };

  const handleSave = async () => {
    if (roleChanges.size === 0) {
      toast.info(t("roster.noChanges"));
      return;
    }

    startSaveTransition(async () => {
      try {
        const updates = Array.from(roleChanges.values());

        const res = await axios.post(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/team/manage-team-roster/`,
          { team_id: teamDetails?.team_id, updates },
          { headers: { Authorization: `Bearer ${token}` } }
        );

        const { results = [], has_errors } = res.data;

        if (!has_errors) {
          toast.success(t("roster.rosterUpdated"));
          setRoleChanges(new Map());
          router.push(`/teams/${id}`);
        } else {
          // Show a toast per failure so the user knows exactly what didn't save
          results.forEach((r: any) => {
            if (r.status === "failed" || r.status === "partial") {
              r.reasons?.forEach((reason: string) => {
                toast.error(`${r.username}: ${reason}`);
              });
            }
          });

          const succeeded = results.filter((r: any) => r.status === "success").length;
          if (succeeded > 0) {
            toast.success(t("roster.updatesSaved", { count: succeeded }));
            // Refresh so saved changes reflect immediately
            const refresh = await axios.post(
              `${env.NEXT_PUBLIC_BACKEND_API_URL}/team/get-team-details/`,
              { team_name: decodeURIComponent(id) }
            );
            setTeamDetails(refresh.data.team);
          }

          // Keep only the failed changes in state so user can fix them
          const failedIds = new Set(
            results
              .filter((r: any) => r.status === "failed" || r.status === "partial")
              .map((r: any) => r.member_id)
          );
          setRoleChanges((prev) => {
            const next = new Map(prev);
            for (const id of prev.keys()) {
              if (!failedIds.has(id)) next.delete(id);
            }
            return next;
          });
        }
      } catch (error: any) {
        toast.error(error?.response?.data?.message || t("roster.updateRosterFailed"));
      }
    });
  };

  if (pending) return <FullLoader />;

  if (teamDetails)
    return (
      <div>
        <PageHeader title={t("roster.pageTitle", { team: teamDetails.team_name })} back />
        <Card>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("roster.name")}</TableHead>
                  <TableHead>
                    {t("roster.inGameRole")} <InfoTip id="teams.roster.in_game_role" />
                  </TableHead>
                  <TableHead>
                    {t("roster.managementRole")}{" "}
                    <InfoTip id="teams.roster.management_role" />
                  </TableHead>
                  <TableHead>{t("roster.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {teamDetails?.members?.map((member: any) => {
                  const pendingChange = roleChanges.get(member.id);
                  const currentInGameRole =
                    pendingChange !== undefined
                      ? (pendingChange.in_game_role ?? "")
                      : (member.in_game_role ?? "");
                  const currentManagementRole =
                    pendingChange?.management_role || member.management_role;

                  return (
                    <TableRow key={member.id}>
                      <TableCell>
                        {/* Member name links to the public player profile. */}
                        <PlayerLink name={member.username} />
                      </TableCell>
                      <TableCell>
                        <Select
                          key={`in-game-${member.id}`}
                          // Radix <SelectItem> forbids an empty-string value (it crashes the
                          // page). "No role" therefore uses a "none" sentinel in the UI and is
                          // translated back to "" (the backend's "no role") on change.
                          value={currentInGameRole || "none"}
                          onValueChange={(value) =>
                            handleRoleChange(
                              member.id,
                              "inGameRole",
                              value === "none" ? "" : value
                            )
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder={t("roster.noRole")} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">{t("roster.noRoleOption")}</SelectItem>
                            <SelectItem value="rusher">{t("roster.rusher")}</SelectItem>
                            <SelectItem value="support">{t("roster.support")}</SelectItem>
                            <SelectItem value="grenader">{t("roster.grenader")}</SelectItem>
                            <SelectItem value="sniper">{t("roster.sniper")}</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Select
                          key={`management-${member.id}`}
                          value={currentManagementRole}
                          onValueChange={(value) =>
                            handleRoleChange(member.id, "managementRole", value)
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="member">{t("roster.member")}</SelectItem>
                            <SelectItem value="team_captain">
                              {t("roster.teamCaptain")}
                            </SelectItem>
                            <SelectItem value="vice_captain">
                              {t("roster.viceCaptain")}
                            </SelectItem>
                            <SelectItem value="coach">{t("roster.coach")}</SelectItem>
                            <SelectItem value="manager">{t("roster.manager")}</SelectItem>
                            <SelectItem value="analyst">{t("roster.analyst")}</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        {isOwnerOrCreator(member) ? (
                          <Badge variant="secondary" className="gap-1">
                            <Shield className="h-3 w-3" />
                            {member.username === teamDetails?.team_owner
                              ? t("roster.owner")
                              : t("roster.creator")}
                          </Badge>
                        ) : isSelf(member) ? (
                          <Badge
                            variant="outline"
                            className="text-muted-foreground"
                          >
                            {t("roster.you")}
                          </Badge>
                        ) : (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => openKickModal(member)}
                          >
                            <UserX className="h-4 w-4 mr-1" />
                            {t("roster.kick")}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <div className="flex gap-2 items-center justify-center justify-between mt-4">
              <Button
                className="flex-1"
                variant="outline"
                onClick={() => router.push(`/teams/${id}`)}
                disabled={savePending}
              >
                {t("roster.back")}
              </Button>
              <Button
                className="flex-1"
                onClick={handleSave}
                disabled={savePending}
              >
                {savePending ? t("roster.saving") : t("roster.saveChanges")}
                {roleChanges.size > 0 && ` (${roleChanges.size})`}
              </Button>
            </div>
          </CardContent>
        </Card>
        {/* Kick Member Modal */}
        <Dialog open={kickModalOpen} onOpenChange={setKickModalOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="h-12 w-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                  <UserX className="h-6 w-6 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <DialogTitle className="text-xl">{t("roster.removeMember")}</DialogTitle>
                  <DialogDescription>
                    {t("roster.cannotBeUndone")}
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            {memberToKick && (
              <div className="py-4">
                <div className="flex items-center gap-4 p-4 bg-muted rounded-lg mb-4">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={memberToKick.avatar} />
                    <AvatarFallback className="text-lg">
                      {memberToKick.username?.[0]?.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="font-semibold">{memberToKick.username}</p>
                    <div className="flex gap-2 mt-1">
                      {memberToKick.in_game_role && (
                        <Badge variant="outline" className="text-xs">
                          {formatWord(memberToKick.in_game_role)}
                        </Badge>
                      )}
                      {memberToKick.management_role && (
                        <Badge variant="secondary" className="text-xs">
                          {formatWord(memberToKick.management_role)}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
                  <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-amber-800 dark:text-amber-200">
                    <p className="font-medium">{t("roster.areYouSure")}</p>
                    <p className="text-amber-700 dark:text-amber-300 mt-1">
                      {/* t.rich keeps the bolded team name inline within the warning. */}
                      {t.rich("roster.kickWarning", {
                        name: memberToKick.username,
                        team: teamDetails?.team_name,
                        strong: (chunks) => <strong>{chunks}</strong>,
                      })}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                variant="outline"
                onClick={() => {
                  setKickModalOpen(false);
                  setMemberToKick(null);
                }}
                disabled={kickPending}
              >
                {t("roster.cancel")}
              </Button>
              <Button
                variant="destructive"
                onClick={handleKickMember}
                disabled={kickPending}
              >
                {kickPending ? (
                  <Loader text={t("roster.removing")} />
                ) : (
                  <>
                    <UserX className="h-4 w-4 mr-2" />
                    {t("roster.removeFromTeam")}
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
}
