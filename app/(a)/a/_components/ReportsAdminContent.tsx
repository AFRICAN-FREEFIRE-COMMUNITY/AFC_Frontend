"use client";

// ─────────────────────────────────────────────────────────────────────────────
// ReportsAdminContent (owner 2026-06-20)
//
// The "Reports" tab body on the admin Teams & Players page (/a/teams?tab=reports).
// Triage for player-to-player AND team reports in one queue: admins see every report,
// the uploaded EVIDENCE image, a repeat-offender flag (3+ reports on the same subject
// in 2 weeks), and can ANSWER each (the reporter reads the answer on /profile?tab=reports).
//
// Admin pages live under (a)/ and are operated in English, so this is intentionally
// NOT internationalized (per WEBSITE/CLAUDE.md i18n exemption).
//
// Data (afc_auth.views_player_reports):
//   • GET   /auth/admin/player-reports/        list + filters (status/category/subject_type/flagged)
//   • PATCH /auth/admin/player-reports/<id>/    answer + status
// Auth: Bearer token from the auth_token cookie. Rendered by app/(a)/a/teams/page.tsx
// (Reports tab); the old standalone /a/player-reports route now redirects here.
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import Cookies from "js-cookie";
import { toast } from "sonner";
import { env } from "@/lib/env";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
import { FullLoader } from "@/components/Loader";
import { LocalTime } from "@/components/LocalTime";
import { IconFlag, IconAlertTriangle, IconUser, IconUsersGroup } from "@tabler/icons-react";

interface AdminReport {
  id: number;
  subject_type: "player" | "team";
  reported_user_id: number | null;
  reported_team_id: number | null;
  reported_name: string | null;
  reporter_id: number | null;
  reporter_username: string | null;
  reviewed_by_username: string | null;
  category: string;
  details: string;
  evidence: string | null;
  status: "open" | "reviewing" | "resolved" | "dismissed";
  admin_response: string;
  recent_report_count: number;
  is_repeat_offender: boolean;
  created_at: string | null;
}

const STATUS_OPTIONS = ["all", "open", "reviewing", "resolved", "dismissed"] as const;
const SUBJECT_OPTIONS = ["all", "player", "team"] as const;
const CATEGORY_OPTIONS = [
  "all",
  "cheating",
  "toxicity",
  "harassment",
  "impersonation",
  "scam",
  "other",
] as const;

const STATUS_BADGE: Record<string, string> = {
  open: "border-primary/50 text-primary",
  reviewing: "border-yellow-500/60 text-yellow-600 dark:text-yellow-400",
  resolved: "border-green-600/60 text-green-600 dark:text-green-400",
  dismissed: "border-muted-foreground/40 text-muted-foreground",
};

const PAGE_SIZE = 25;

export function ReportsAdminContent() {
  const [reports, setReports] = useState<AdminReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [flaggedTotal, setFlaggedTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);

  // filters
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [subjectFilter, setSubjectFilter] = useState<string>("all");
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const [search, setSearch] = useState("");

  // respond dialog
  const [active, setActive] = useState<AdminReport | null>(null);
  const [draftStatus, setDraftStatus] = useState<string>("reviewing");
  const [draftAnswer, setDraftAnswer] = useState("");
  const [saving, setSaving] = useState(false);

  const authHeader = () => ({ Authorization: `Bearer ${Cookies.get("auth_token")}` });

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { limit: PAGE_SIZE, offset };
      if (statusFilter !== "all") params.status = statusFilter;
      if (categoryFilter !== "all") params.category = categoryFilter;
      if (subjectFilter !== "all") params.subject_type = subjectFilter;
      if (flaggedOnly) params.flagged = "true";
      if (search.trim()) params.search = search.trim();

      const res = await axios.get(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/auth/admin/player-reports/`,
        { headers: authHeader(), params },
      );
      setReports(res.data?.results ?? []);
      setTotalCount(res.data?.total_count ?? 0);
      setFlaggedTotal(res.data?.flagged_total ?? 0);
      setHasMore(!!res.data?.has_more);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Could not load reports.");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, categoryFilter, subjectFilter, flaggedOnly, search, offset]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  // Reset to first page whenever a filter changes.
  useEffect(() => {
    setOffset(0);
  }, [statusFilter, categoryFilter, subjectFilter, flaggedOnly, search]);

  const openRespond = (r: AdminReport) => {
    setActive(r);
    setDraftStatus(r.status === "open" ? "reviewing" : r.status);
    setDraftAnswer(r.admin_response || "");
  };

  const submitRespond = async () => {
    if (!active || saving) return;
    setSaving(true);
    try {
      const res = await axios.patch(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/auth/admin/player-reports/${active.id}/`,
        { status: draftStatus, admin_response: draftAnswer },
        { headers: authHeader() },
      );
      toast.success(res.data?.message || "Report updated.");
      const updated: AdminReport = res.data?.report;
      setReports((prev) => prev.map((r) => (r.id === active.id ? { ...r, ...updated } : r)));
      setActive(null);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Could not update the report.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      {/* Stat strip */}
      <div className="grid grid-cols-2 gap-4 md:max-w-md mb-4" data-tour="reports-stats">
        <Card>
          <CardContent className="py-4">
            <p className="text-xs text-muted-foreground">Total reports</p>
            <p className="text-2xl font-bold">{totalCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="text-xs text-muted-foreground">Repeat offenders</p>
            <p className="text-2xl font-bold text-red-500">{flaggedTotal}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="mb-4" data-tour="reports-filters">
        <CardContent className="py-4 flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Subject</Label>
            <Select value={subjectFilter} onValueChange={setSubjectFilter}>
              <SelectTrigger className="w-32 h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {SUBJECT_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Status</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-32 h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Category</Label>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-40 h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {CATEGORY_OPTIONS.map((c) => (
                  <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1 flex-1 min-w-[180px]">
            <Label className="text-xs">Search</Label>
            <Input
              className="h-9"
              placeholder="Reported player/team or reporter"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button
            variant={flaggedOnly ? "default" : "outline"}
            className="h-9"
            onClick={() => setFlaggedOnly((v) => !v)}
          >
            <IconAlertTriangle className="h-4 w-4 mr-1" />
            Repeat offenders only
          </Button>
        </CardContent>
      </Card>

      {/* Table */}
      <Card data-tour="reports-table">
        <CardContent className="p-0">
          {loading ? (
            <div className="py-12"><FullLoader /></div>
          ) : reports.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              No reports match these filters.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="h-10">
                  <TableHead className="text-foreground text-xs">Reported</TableHead>
                  <TableHead className="text-foreground text-xs">Reporter</TableHead>
                  <TableHead className="text-foreground text-xs">Reason</TableHead>
                  <TableHead className="text-foreground text-xs">Notes</TableHead>
                  <TableHead className="text-foreground text-xs">Proof</TableHead>
                  <TableHead className="text-foreground text-xs">Filed</TableHead>
                  <TableHead className="text-foreground text-xs">Status</TableHead>
                  <TableHead className="text-foreground text-xs text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reports.map((r) => (
                  <TableRow key={r.id} className="text-xs">
                    <TableCell className="p-2">
                      <div className="flex items-center gap-1.5">
                        {/* Subject-type chip so admins see player vs team at a glance. */}
                        <Badge
                          variant="outline"
                          className="rounded-full px-1.5 py-0 text-[10px] gap-0.5"
                        >
                          {r.subject_type === "team" ? (
                            <IconUsersGroup className="h-3 w-3" />
                          ) : (
                            <IconUser className="h-3 w-3" />
                          )}
                          {r.subject_type}
                        </Badge>
                        <span className="font-medium">{r.reported_name || "(removed)"}</span>
                        {r.is_repeat_offender && (
                          <Badge
                            variant="outline"
                            className="border-red-500/60 text-red-500 rounded-full px-2 py-0.5 text-[10px]"
                            title={`${r.recent_report_count} reports in the last 2 weeks`}
                          >
                            <IconFlag className="h-3 w-3 mr-0.5" />
                            {r.recent_report_count}x / 2wk
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="p-2">{r.reporter_username || "(removed)"}</TableCell>
                    <TableCell className="p-2 capitalize">{r.category}</TableCell>
                    <TableCell className="p-2 max-w-[240px]">
                      <span className="line-clamp-2">{r.details}</span>
                    </TableCell>
                    <TableCell className="p-2">
                      {r.evidence ? (
                        <a
                          href={r.evidence}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                        >
                          View
                        </a>
                      ) : (
                        <span className="text-muted-foreground">none</span>
                      )}
                    </TableCell>
                    <TableCell className="p-2 whitespace-nowrap">
                      {r.created_at ? <LocalTime value={r.created_at} /> : "-"}
                    </TableCell>
                    <TableCell className="p-2">
                      <Badge
                        variant="outline"
                        className={`rounded-full px-2 py-0.5 text-[10px] capitalize ${STATUS_BADGE[r.status] || ""}`}
                      >
                        {r.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="p-2 text-right">
                      <Button size="sm" variant="outline" onClick={() => openRespond(r)}>
                        {r.admin_response ? "Edit answer" : "Answer"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {!loading && totalCount > PAGE_SIZE && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-xs text-muted-foreground">
            Showing {offset + 1}-{Math.min(offset + PAGE_SIZE, totalCount)} of {totalCount}
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={offset === 0}
              onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
            >
              Previous
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={!hasMore}
              onClick={() => setOffset((o) => o + PAGE_SIZE)}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Respond dialog */}
      <Dialog open={!!active} onOpenChange={(open) => !open && setActive(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Answer report</DialogTitle>
            <DialogDescription>
              {active && (
                <>
                  {active.reporter_username || "Someone"} reported{" "}
                  <span className="font-medium text-foreground">
                    {active.reported_name || "(removed)"}
                  </span>{" "}
                  ({active.subject_type}) for {active.category}.
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {active && (
            <div className="space-y-4">
              {active.is_repeat_offender && (
                <div className="flex items-center gap-2 rounded-md border border-red-500/40 bg-red-500/5 p-2.5 text-xs text-red-600 dark:text-red-400">
                  <IconAlertTriangle className="h-4 w-4 shrink-0" />
                  Repeat offender: {active.recent_report_count} reports in the last 2 weeks.
                </div>
              )}

              <div className="rounded-md bg-muted/50 p-3 text-sm">
                <p className="text-xs font-medium text-muted-foreground mb-1">Reporter notes</p>
                <p className="whitespace-pre-wrap">{active.details}</p>
              </div>

              {/* EVIDENCE the reporter uploaded (owner 2026-06-20: admins must receive it).
                  Shown inline + clickable to open full size. */}
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Evidence</p>
                {active.evidence ? (
                  <a href={active.evidence} target="_blank" rel="noopener noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={active.evidence}
                      alt="Report evidence"
                      className="max-h-56 rounded-md border object-contain hover:opacity-90"
                    />
                  </a>
                ) : (
                  <p className="text-sm text-muted-foreground italic">
                    No evidence was attached to this report.
                  </p>
                )}
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Status</Label>
                <Select value={draftStatus} onValueChange={setDraftStatus}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["open", "reviewing", "resolved", "dismissed"].map((s) => (
                      <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs" htmlFor="admin-answer">Answer to the reporter</Label>
                <Textarea
                  id="admin-answer"
                  value={draftAnswer}
                  onChange={(e) => setDraftAnswer(e.target.value)}
                  placeholder="This message is shown to the reporter. Explain the outcome."
                  rows={4}
                />
                <p className="text-xs text-muted-foreground">
                  Saving a non-empty answer notifies the reporter.
                </p>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setActive(null)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={submitRespond} disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
