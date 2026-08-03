"use client";

/**
 * /a/feedback - the site feedback triage queue (owner backlog item 29).
 * ─────────────────────────────────────────────────────────────────────
 * Reads what visitors sent through the always-on footer form, filters by form and status, and marks
 * a submission handled.
 *
 * WHY A STANDALONE PAGE AND NOT A TAB
 *   The repo's habit is to fold a triage queue into an existing page as a tab (player reports live
 *   under Teams & Players, blacklists and watchlist likewise). That works when the queue is SCOPED to
 *   that page's subject. Site feedback is not: a submission can be about the shop, an event, the
 *   rankings or signing up, and its permission set is platform-wide rather than an area admin's. So
 *   it gets its own entry, placed next to Broadcasts in the sidebar: outbound messages there,
 *   inbound ones here.
 *
 * ENDPOINTS (backend afc_feedback/views.py)
 *   GET   /feedback/admin/forms/                  the form filter + open counts
 *   GET   /feedback/admin/submissions/            the table (form, status, search, limit, offset)
 *   PATCH /feedback/admin/submissions/<id>/       mark handled / reopen, plus an internal note
 *
 * NOT INTERNATIONALIZED, deliberately: admin pages under (a)/ are operated in English per the repo's
 * i18n exemption. The player-facing widget IS translated (messages/{en,fr,pt}/feedback.json).
 */

import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import Cookies from "js-cookie";
import { toast } from "sonner";
import { env } from "@/lib/env";
import { PageHeader } from "@/components/PageHeader";
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
import { IconMessage2, IconUser, IconUserOff, IconStarFilled } from "@tabler/icons-react";

const PAGE_SIZE = 25;

/** One row of afc_feedback/views.py::_serialize_submission. */
interface FeedbackSubmission {
  id: number;
  form_key: string;
  form_title: string;
  answers: Record<string, string | number>;
  fields_snapshot: { key: string; label: string; field_type: string }[];
  page_path: string;
  locale: string;
  user_agent: string;
  username: string | null;
  is_anonymous: boolean;
  status: string;
  admin_note: string;
  handled_by: string | null;
  handled_at: string | null;
  created_at: string;
}

interface FeedbackFormSummary {
  key: string;
  title: string;
  is_active: boolean;
  total_count: number;
  open_count: number;
}

const STATUS_BADGE: Record<string, string> = {
  open: "border-primary/50 text-primary",
  handled: "border-green-600/60 text-green-600 dark:text-green-400",
};

export default function AdminFeedbackPage() {
  const [submissions, setSubmissions] = useState<FeedbackSubmission[]>([]);
  const [forms, setForms] = useState<FeedbackFormSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [formFilter, setFormFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [openCount, setOpenCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  // The submission open in the detail dialog, plus its editable note.
  const [active, setActive] = useState<FeedbackSubmission | null>(null);
  const [draftNote, setDraftNote] = useState("");
  const [saving, setSaving] = useState(false);

  const authHeader = () => ({ Authorization: `Bearer ${Cookies.get("auth_token")}` });

  // Debounce the search box so typing does not fire a request per keystroke (same 300ms the
  // broadcasts page uses).
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchSubmissions = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { limit: PAGE_SIZE, offset };
      if (formFilter !== "all") params.form = formFilter;
      if (statusFilter !== "all") params.status = statusFilter;
      if (debouncedSearch) params.search = debouncedSearch;

      const res = await axios.get(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/feedback/admin/submissions/`,
        { headers: authHeader(), params },
      );
      setSubmissions(res.data?.results ?? []);
      setTotalCount(res.data?.total_count ?? 0);
      setOpenCount(res.data?.open_count ?? 0);
      setHasMore(!!res.data?.has_more);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Could not load feedback.");
    } finally {
      setLoading(false);
    }
  }, [formFilter, statusFilter, debouncedSearch, offset]);

  const fetchForms = useCallback(async () => {
    try {
      const res = await axios.get(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/feedback/admin/forms/`,
        { headers: authHeader() },
      );
      setForms(res.data?.forms ?? []);
    } catch {
      // Non-fatal: the filter simply falls back to "All forms". The table is the real content, and
      // failing the whole page because a dropdown could not load would be worse.
    }
  }, []);

  useEffect(() => {
    fetchSubmissions();
  }, [fetchSubmissions]);

  useEffect(() => {
    fetchForms();
  }, [fetchForms]);

  // Any filter change returns to the first page, otherwise a narrow result set can land on an
  // offset past its end and look empty.
  useEffect(() => {
    setOffset(0);
  }, [formFilter, statusFilter, debouncedSearch]);

  const openDetail = (submission: FeedbackSubmission) => {
    setActive(submission);
    setDraftNote(submission.admin_note || "");
  };

  /** PATCH one submission. `newStatus` omitted = save the note only. */
  const updateSubmission = async (
    submission: FeedbackSubmission,
    newStatus?: "open" | "handled",
    note?: string,
  ) => {
    if (saving) return;
    setSaving(true);
    try {
      const body: Record<string, string> = {};
      if (newStatus) body.status = newStatus;
      if (note !== undefined) body.admin_note = note;

      const res = await axios.patch(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/feedback/admin/submissions/${submission.id}/`,
        body,
        { headers: authHeader() },
      );
      const updated: FeedbackSubmission = res.data?.submission;
      toast.success(res.data?.message || "Feedback updated.");

      // Patch the row in place from the response rather than refetching (house idiom), but refresh
      // the counts, which the response cannot know.
      setSubmissions((prev) =>
        prev.map((row) => (row.id === submission.id ? { ...row, ...updated } : row)),
      );
      setOpenCount((prev) => {
        if (!newStatus || newStatus === submission.status) return prev;
        return newStatus === "handled" ? Math.max(0, prev - 1) : prev + 1;
      });
      setActive(null);
      fetchForms();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Could not update the feedback.");
    } finally {
      setSaving(false);
    }
  };

  /**
   * A one-line preview for the table. Prefers the first long-text answer, since that is where the
   * substance is, and falls back to the first answer of any kind.
   */
  const previewOf = (submission: FeedbackSubmission) => {
    const snapshot = submission.fields_snapshot ?? [];
    const longText = snapshot.find(
      (f) => f.field_type === "textarea" && submission.answers?.[f.key],
    );
    const chosen = longText ?? snapshot.find((f) => submission.answers?.[f.key]);
    return chosen ? String(submission.answers[chosen.key]) : "(no answer)";
  };

  /** The rating answer, if this form has one. Rendered as a compact star count in the table. */
  const ratingOf = (submission: FeedbackSubmission) => {
    const field = (submission.fields_snapshot ?? []).find((f) => f.field_type === "rating");
    if (!field) return null;
    const value = submission.answers?.[field.key];
    return typeof value === "number" ? value : null;
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Site Feedback"
        description="What visitors sent through the feedback form in the site footer. Anonymous submissions are expected and are not a bug."
      />

      {/* Counts strip. open_count reflects the CURRENT filter, so the number always matches the
          table underneath it. */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3">
            <IconMessage2 className="size-5 text-primary" />
            <div>
              <p className="text-2xl font-bold">{totalCount}</p>
              <p className="text-muted-foreground text-xs">Submissions in this view</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3">
            <IconMessage2 className="size-5 text-primary" />
            <div>
              <p className="text-2xl font-bold">{openCount}</p>
              <p className="text-muted-foreground text-xs">Still open</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3">
            <IconMessage2 className="size-5 text-primary" />
            <div>
              <p className="text-2xl font-bold">{forms.length}</p>
              <p className="text-muted-foreground text-xs">Forms</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters. Stack on a phone, sit in a row from sm up. */}
      <Card>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Select value={formFilter} onValueChange={setFormFilter}>
            <SelectTrigger className="w-full sm:w-64">
              <SelectValue placeholder="All forms" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All forms</SelectItem>
              {forms.map((form) => (
                <SelectItem key={form.key} value={form.key}>
                  {form.title} ({form.open_count} open)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="handled">Handled</SelectItem>
            </SelectContent>
          </Select>

          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search the text, the page, or a username"
            className="w-full sm:flex-1"
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          {loading ? (
            <div className="py-12">
              <FullLoader />
            </div>
          ) : submissions.length === 0 ? (
            <p className="text-muted-foreground py-12 text-center text-sm">
              No feedback matches these filters.
            </p>
          ) : (
            // Horizontal scroll on the CONTAINER, not the page: a phone must never scroll the whole
            // body sideways because of a table.
            <div className="w-full overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="h-10">
                    <TableHead className="text-foreground">From</TableHead>
                    <TableHead className="text-foreground">Feedback</TableHead>
                    <TableHead className="text-foreground">Page</TableHead>
                    <TableHead className="text-foreground">Sent</TableHead>
                    <TableHead className="text-foreground">Status</TableHead>
                    <TableHead className="text-foreground text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {submissions.map((submission) => {
                    const rating = ratingOf(submission);
                    return (
                      <TableRow key={submission.id} className="text-xs">
                        <TableCell className="p-2 whitespace-nowrap">
                          <span className="flex items-center gap-1.5">
                            {submission.is_anonymous ? (
                              <>
                                <IconUserOff className="size-3.5 text-muted-foreground" />
                                <span className="text-muted-foreground">Anonymous</span>
                              </>
                            ) : (
                              <>
                                <IconUser className="size-3.5 text-muted-foreground" />
                                {submission.username}
                              </>
                            )}
                          </span>
                        </TableCell>
                        <TableCell className="max-w-md p-2">
                          <span className="flex items-center gap-2">
                            {rating !== null && (
                              <span className="flex shrink-0 items-center gap-0.5 text-primary">
                                <IconStarFilled className="size-3" />
                                {rating}
                              </span>
                            )}
                            <span className="line-clamp-2">{previewOf(submission)}</span>
                          </span>
                        </TableCell>
                        <TableCell className="text-muted-foreground p-2 whitespace-nowrap">
                          {submission.page_path || "-"}
                        </TableCell>
                        <TableCell className="p-2 whitespace-nowrap">
                          <LocalTime value={submission.created_at} />
                        </TableCell>
                        <TableCell className="p-2">
                          <Badge
                            variant="outline"
                            className={`rounded-full px-2 py-0.5 text-xs ${
                              STATUS_BADGE[submission.status] ?? ""
                            }`}
                          >
                            {submission.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="p-2 text-right">
                          <Button size="sm" variant="outline" onClick={() => openDetail(submission)}>
                            Open
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {!loading && totalCount > PAGE_SIZE && (
            <div className="mt-4 flex items-center justify-between">
              <Button
                size="sm"
                variant="outline"
                disabled={offset === 0}
                onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
              >
                Previous
              </Button>
              <span className="text-muted-foreground text-xs">
                {offset + 1} to {Math.min(offset + PAGE_SIZE, totalCount)} of {totalCount}
              </span>
              <Button
                size="sm"
                variant="outline"
                disabled={!hasMore}
                onClick={() => setOffset(offset + PAGE_SIZE)}
              >
                Next
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail dialog: the full answers as the submitter saw the questions, plus triage. */}
      <Dialog open={!!active} onOpenChange={(open) => !open && setActive(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          {active && (
            <>
              <DialogHeader>
                <DialogTitle>{active.form_title}</DialogTitle>
                <DialogDescription>
                  {active.is_anonymous ? "Anonymous" : active.username} sent this from{" "}
                  {active.page_path || "an unknown page"}
                  {active.locale ? ` while reading the site in ${active.locale}` : ""}.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                {/* Rendered from fields_snapshot, so the questions read exactly as they did when
                    this was submitted even if the form has been reworded since. */}
                {(active.fields_snapshot ?? []).map((field) => {
                  const answer = active.answers?.[field.key];
                  if (answer === undefined || answer === "") return null;
                  return (
                    <div key={field.key}>
                      <p className="text-muted-foreground text-xs">{field.label}</p>
                      <p className="text-sm whitespace-pre-wrap">
                        {field.field_type === "rating" ? `${answer} / 5` : String(answer)}
                      </p>
                    </div>
                  );
                })}

                <div className="space-y-2 border-t pt-4">
                  <Label htmlFor="feedback-note">Internal note</Label>
                  <Textarea
                    id="feedback-note"
                    value={draftNote}
                    onChange={(e) => setDraftNote(e.target.value)}
                    placeholder="What was done about this. Never shown to the submitter."
                    rows={3}
                  />
                </div>

                {active.handled_by && (
                  <p className="text-muted-foreground text-xs">
                    Handled by {active.handled_by}
                    {active.handled_at ? (
                      <>
                        {" "}
                        on <LocalTime value={active.handled_at} />
                      </>
                    ) : null}
                    .
                  </p>
                )}
              </div>

              <DialogFooter className="gap-2 sm:gap-0">
                <Button
                  variant="outline"
                  onClick={() => updateSubmission(active, undefined, draftNote)}
                  disabled={saving}
                  className="w-full sm:w-auto"
                >
                  Save note
                </Button>
                {active.status === "handled" ? (
                  <Button
                    variant="outline"
                    onClick={() => updateSubmission(active, "open", draftNote)}
                    disabled={saving}
                    className="w-full sm:w-auto"
                  >
                    Reopen
                  </Button>
                ) : (
                  <Button
                    onClick={() => updateSubmission(active, "handled", draftNote)}
                    disabled={saving}
                    className="w-full sm:w-auto"
                  >
                    Mark handled
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
