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
import { useAuth } from "@/contexts/AuthContext";
import { PageHeader } from "@/components/PageHeader";
import { NothingFound } from "@/components/NothingFound";
import { formatDate } from "@/lib/utils";
import { env } from "@/lib/env";
import axios from "axios";
import {
  ReviewApplicationDialog,
  getStatusBadge,
  type ApplicationRecord,
} from "@/app/(user)/_components/ReviewApplicationDialog";
import { Badge } from "@/components/ui/badge";

type Params = Promise<{ id: string }>;

const STATUS_OPTIONS = [
  { value: "all", label: "All" },
  { value: "PENDING", label: "Pending" },
  { value: "SHORTLISTED", label: "Shortlisted" },
  { value: "INVITED", label: "Invited" },
  { value: "TRIAL_EXTENDED", label: "Trial Extended" },
  { value: "ACCEPTED", label: "Accepted" },
  { value: "REJECTED", label: "Rejected" },
];

export default function ApplicationsPage({ params }: { params: Params }) {
  const { id } = use(params);
  const { token } = useAuth();

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
      .catch(() => toast.error("Failed to load applications."))
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
        title="Player Market Applications"
        description={`Applications received for ${decodeURIComponent(id)}`}
      />

      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total", value: stats.total, color: "" },
          { label: "Pending", value: stats.pending, color: "text-yellow-400" },
          { label: "Shortlisted", value: stats.shortlisted, color: "text-cyan-400" },
          { label: "Invited", value: stats.invited, color: "text-green-400" },
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
            <CardTitle className="text-base">All Applications</CardTitle>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-12 text-sm text-muted-foreground">
              Loading...
            </div>
          ) : filtered.length === 0 ? (
            <NothingFound text="No applications match this filter." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Player</TableHead>
                  <TableHead>Applied</TableHead>
                  <TableHead>Primary Role</TableHead>
                  <TableHead>Country</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((app) => (
                  <TableRow key={app.id}>
                    <TableCell className="font-medium">{app.player}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {formatDate(app.applied_at)}
                    </TableCell>
                    <TableCell className="text-sm">{app.primary_role || "—"}</TableCell>
                    <TableCell className="text-sm">{app.country || "—"}</TableCell>
                    <TableCell>{getStatusBadge(app.status)}</TableCell>
                    <TableCell>
                      {app.contact_unlocked ? (
                        <Badge variant="outline" className="text-green-400 border-green-800 text-xs">
                          Unlocked
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground text-xs">
                          Locked
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setReviewApp(app)}
                      >
                        Review
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
