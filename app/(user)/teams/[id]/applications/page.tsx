"use client";

import { useState, useEffect, use } from "react";
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
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { useAuth } from "@/contexts/AuthContext";
import { PageHeader } from "@/components/PageHeader";
import { NothingFound } from "@/components/NothingFound";
// LocalTime renders the stored UTC timestamp in the viewer's own timezone + language.
import { LocalTime } from "@/components/LocalTime";
import { env } from "@/lib/env";
import axios from "axios";
import {
  ReviewApplicationDialog,
  getStatusBadge,
  type ApplicationRecord,
} from "@/app/(user)/_components/ReviewApplicationDialog";
import { Badge } from "@/components/ui/badge";
// Subtle clickable player name -> public player profile.
import { PlayerLink } from "@/components/ui/entity-link";

type Params = Promise<{ id: string }>;

// Status filter options. The label is a translation KEY (resolved at render via
// t(...)) so the dropdown follows the active language; the value is the backend code.
const STATUS_OPTIONS = [
  { value: "all", labelKey: "applications.statusAll" },
  { value: "PENDING", labelKey: "applications.statusPending" },
  { value: "SHORTLISTED", labelKey: "applications.statusShortlisted" },
  { value: "INVITED", labelKey: "applications.statusInvited" },
  { value: "TRIAL_EXTENDED", labelKey: "applications.statusTrialExtended" },
  { value: "ACCEPTED", labelKey: "applications.statusAccepted" },
  { value: "REJECTED", labelKey: "applications.statusRejected" },
];

export default function ApplicationsPage({ params }: { params: Params }) {
  const { id } = use(params);
  const { token } = useAuth();
  // i18n: page chrome for the team-side player-market applications view
  // (messages/en/teamsplayers.json -> "applications").
  const t = useTranslations("teamsplayers");

  const [applications, setApplications] = useState<ApplicationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [reviewApp, setReviewApp] = useState<ApplicationRecord | null>(null);

  useEffect(() => {
    if (!token) return;
    axios
      .get(`${env.NEXT_PUBLIC_BACKEND_API_URL}/player-market/view-applications/`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => setApplications(res.data))
      .catch(() => toast.error(t("applications.loadFailed")))
      .finally(() => setLoading(false));
  }, [token]);

  const filtered =
    statusFilter === "all"
      ? applications
      : applications.filter((a) => a.status === statusFilter);

  const stats = {
    total: applications.length,
    pending: applications.filter((a) => a.status === "PENDING").length,
    shortlisted: applications.filter((a) => a.status === "SHORTLISTED").length,
    invited: applications.filter(
      (a) => a.status === "INVITED" || a.status === "TRIAL_EXTENDED",
    ).length,
  };

  const handleStatusUpdated = (updated: ApplicationRecord) => {
    setApplications((prev) =>
      prev.map((a) => (a.id === updated.id ? updated : a)),
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        back
        title={t("applications.pageTitle")}
        description={t("applications.pageDescription", { team: decodeURIComponent(id) })}
      />

      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: t("applications.total"), value: stats.total, color: "" },
          { label: t("applications.pending"), value: stats.pending, color: "text-yellow-400" },
          { label: t("applications.shortlisted"), value: stats.shortlisted, color: "text-cyan-400" },
          { label: t("applications.invited"), value: stats.invited, color: "text-green-400" },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="pt-4 pb-3">
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <CardTitle className="text-base">{t("applications.allApplications")}</CardTitle>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder={t("applications.filterByStatus")} />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {t(s.labelKey)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-12 text-sm text-muted-foreground">
              {t("applications.loading")}
            </div>
          ) : filtered.length === 0 ? (
            <NothingFound text={t("applications.noMatch")} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("applications.player")}</TableHead>
                  <TableHead>{t("applications.applied")}</TableHead>
                  <TableHead>{t("applications.primaryRole")}</TableHead>
                  <TableHead>{t("applications.country")}</TableHead>
                  <TableHead>{t("applications.status")}</TableHead>
                  <TableHead>{t("applications.contact")}</TableHead>
                  <TableHead>{t("applications.action")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((app) => (
                  <TableRow key={app.id}>
                    <TableCell className="font-medium">
                      {/* Applicant name links to the public player profile. */}
                      <PlayerLink name={app.player} />
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {/* Application date in the viewer's own timezone + language. */}
                      <LocalTime value={app.applied_at} mode="date" />
                    </TableCell>
                    <TableCell className="text-sm">{app.primary_role || "-"}</TableCell>
                    <TableCell className="text-sm">{app.country || "-"}</TableCell>
                    <TableCell>{getStatusBadge(app.status)}</TableCell>
                    <TableCell>
                      {app.contact_unlocked ? (
                        <Badge variant="outline" className="text-green-400 border-green-800 text-xs">
                          {t("applications.unlocked")}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground text-xs">
                          {t("applications.locked")}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setReviewApp(app)}
                      >
                        {t("applications.review")}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <ReviewApplicationDialog
        app={reviewApp}
        token={token}
        onClose={() => setReviewApp(null)}
        onStatusUpdated={handleStatusUpdated}
      />
    </div>
  );
}
