// ─────────────────────────────────────────────────────────────────────────────
// Organizer › Events › [slug] › OCR (session list + review / commit / discard).
//
// Organizer parity port (owner 2026-07-02) of the ADMIN OCR page
// app/(a)/a/events/[slug]/ocr/page.tsx: the sessions table (one row per OCR'd
// result screenshot), the Review dialog (session status + extracted rows), and
// the per-row Commit / Discard actions - scoped to THIS organizer's own event.
//
// ── WHAT CHANGED vs THE ADMIN PAGE ──
//   • Ownership guard: the slug must resolve to one of THIS org's events
//     (GET /events/get-all-events/?organization_id=<id>, the same "notMine"
//     pattern as the sibling detail / groups / leaderboard pages); the matched
//     row also gives us the numeric event_id the list endpoint needs.
//   • event_id is ALWAYS sent to the list endpoint: for organizers the backend
//     REQUIRES it (afc_ocr.views.list_ocr_sessions org branch, owner 2026-07-02)
//     and scopes the result to that event; the org never sees the platform-wide
//     list AFC admins get.
//   • Permission gate: membership.permissions.can_upload_results || isOwner -
//     the EXACT org grant the backend enforces on every OCR endpoint
//     (org_can_event(user, "can_upload_results", event) via _require_results_access).
//   • The admin page's standalone "Upload Screenshot" card is NOT ported: the
//     backend upload (POST /events/ocr-match-result/) is keyed by match_id +
//     map_index, which this page has no picker for. Organizers already upload
//     result screenshots per match through this event's LEADERBOARD page
//     (ImageUploadStep inside /organizer/events/<slug>/leaderboard), so a small
//     pointer card links there instead of duplicating a match picker here.
//   • Statuses follow the real OCRSession model (pending_review / committed /
//     discarded, afc_ocr/models.py) for the badge colors, the Commit-button
//     visibility, and the translated labels.
//   • i18n: organizer portal is a user-facing surface, so every string comes
//     from the "organizer" namespace (eventOcr.*), en → fr/pt via
//     pnpm i18n:translate; Created timestamps render in the VIEWER's timezone
//     via <LocalTime /> (never a raw toLocale* call).
//
// ── CONSUMES (backend afc_ocr, all org-allowed per the 2026-07-02 parity audit) ──
//   GET    /events/ocr-sessions/?event_id=<id>   → the sessions list (org-scoped)
//   GET    /events/ocr-session/<id>/             → one session's draft rows (Review dialog)
//   POST   /events/ocr-session/<id>/commit/      → write the rows to the leaderboard
//   DELETE /events/ocr-session/<id>/             → discard the draft
//
// Linked from the organizer event detail page's quick links
// (app/(organizer)/organizer/events/[slug]/page.tsx, "OCR Results" button).
// ─────────────────────────────────────────────────────────────────────────────

"use client";

import { use, useEffect, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { env } from "@/lib/env";
import { PageHeader } from "@/components/PageHeader";
import { FullLoader } from "@/components/Loader";
import { LocalTime } from "@/components/LocalTime";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { IconCheck, IconLock, IconTrash, IconRefresh, IconTrophy } from "@tabler/icons-react";
import { useOrganizer } from "../../../_components/OrganizerContext";

type Params = { slug: string };

// One row of GET /events/ocr-sessions/ (afc_ocr.views.list_ocr_sessions); the
// Review dialog re-fetches the detail shape which adds draft_rows.
interface OcrSession {
  session_id: string;
  match_id?: number;
  map_index?: number;
  event_type?: string;
  status: string;
  created_by?: string;
  created_at: string;
  // Detail-only (GET /events/ocr-session/<id>/): the extracted, reviewable rows.
  draft_rows?: any[];
}

// Badge colors keyed by the REAL OCRSession statuses (afc_ocr/models.py
// STATUS_CHOICES). Unknown statuses fall back to an unstyled outline badge.
const STATUS_COLORS: Record<string, string> = {
  pending_review: "bg-yellow-900/20 text-yellow-400 border-yellow-800",
  committed: "bg-purple-900/20 text-purple-400 border-purple-800",
  discarded: "bg-red-900/20 text-red-400 border-red-800",
};

export default function OrganizerOcrPage({ params }: { params: Promise<Params> }) {
  const { slug } = use(params);
  const { token } = useAuth();
  const { membership, isOwner } = useOrganizer();
  // i18n: organizer-facing surface, namespace "organizer" (eventOcr.*);
  // English values live in messages/en/organizer.json -> fr/pt via pnpm i18n:translate.
  const t = useTranslations("organizer");

  // Same org permission the backend enforces on every OCR endpoint
  // (org_can_event(user, "can_upload_results", event)).
  const canUploadResults = membership.permissions.can_upload_results || isOwner;
  const organizationId = membership.organization.organization_id;

  // ── slug → event resolution state (same pattern as the sibling pages) ──
  const [resolving, setResolving] = useState(true);
  const [notMine, setNotMine] = useState(false);
  const [eventId, setEventId] = useState<string>("");
  const [eventName, setEventName] = useState<string>("");

  const [sessions, setSessions] = useState<OcrSession[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [viewSession, setViewSession] = useState<OcrSession | null>(null);
  const [committing, setCommitting] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  // ── 1) Resolve the slug to one of THIS org's events ──────────────────────────
  // The matched row supplies the numeric event_id the list endpoint requires for
  // organizers; a slug not in the org's own list is treated as notMine.
  useEffect(() => {
    if (!canUploadResults || !token) {
      setResolving(false);
      return;
    }
    const resolve = async () => {
      setResolving(true);
      try {
        const res = await axios.get(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/get-all-events/`,
          {
            headers: { Authorization: `Bearer ${token}` },
            params: { organization_id: organizationId },
          },
        );
        const match = (res.data?.events ?? []).find(
          (e: any) => e.slug === slug,
        );
        if (!match) {
          setNotMine(true);
        } else {
          setEventId(String(match.event_id));
          setEventName(match.event_name ?? slug);
        }
      } catch {
        // A failed resolution is treated as "not yours" rather than crashing -
        // the org can't review what we couldn't confirm is theirs.
        setNotMine(true);
      } finally {
        setResolving(false);
      }
    };
    resolve();
  }, [slug, organizationId, token, canUploadResults]);

  // ── 2) Sessions list, ALWAYS event-scoped ─────────────────────────────────────
  // event_id is mandatory for organizers (the backend 400s without it and only
  // ever returns THIS event's sessions with it).
  const fetchSessions = async (evId: string) => {
    setLoadingSessions(true);
    try {
      const res = await axios.get(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/ocr-sessions/`,
        {
          headers: { Authorization: `Bearer ${token}` },
          params: { event_id: evId },
        },
      );
      setSessions(res.data ?? []);
    } catch {
      toast.error(t("eventOcr.loadError"));
    } finally {
      setLoadingSessions(false);
    }
  };

  useEffect(() => {
    if (token && eventId) fetchSessions(eventId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, eventId]);

  const handleCommit = async (sessionId: string) => {
    setCommitting(sessionId);
    try {
      await axios.post(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/ocr-session/${sessionId}/commit/`,
        {},
        { headers: { Authorization: `Bearer ${token}` } },
      );
      toast.success(t("eventOcr.commitSuccess"));
      fetchSessions(eventId);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t("eventOcr.commitError"));
    } finally {
      setCommitting(null);
    }
  };

  // DELETE marks the session "discarded" server-side (soft discard, not a hard
  // delete); we drop it from the on-screen list, matching the admin page.
  const handleDelete = async (sessionId: string) => {
    setDeleting(sessionId);
    try {
      await axios.delete(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/ocr-session/${sessionId}/`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      toast.success(t("eventOcr.deleteSuccess"));
      setSessions((prev) => prev.filter((s) => s.session_id !== sessionId));
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t("eventOcr.deleteError"));
    } finally {
      setDeleting(null);
    }
  };

  const handleViewSession = async (sessionId: string) => {
    try {
      const res = await axios.get(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/ocr-session/${sessionId}/`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setViewSession(res.data);
    } catch {
      toast.error(t("eventOcr.detailError"));
    }
  };

  // Translated status label, falling back to the raw server value for any
  // status this page doesn't know about yet.
  const statusLabel = (status: string) =>
    ["pending_review", "committed", "discarded"].includes(status)
      ? t(`eventOcr.status.${status}` as any)
      : status;

  // ── permission lock (mirrors the sibling detail/groups/leaderboard pages) ──
  if (!canUploadResults) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeader back title={t("eventOcr.title")} />
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <IconLock className="size-8 text-muted-foreground" />
            <p className="max-w-sm text-sm text-muted-foreground">
              {t("eventOcr.noPermission")}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (resolving) return <FullLoader text={t("eventOcr.loadingEvent")} />;

  // The slug didn't resolve to one of THIS org's events.
  if (notMine) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeader back title={t("eventOcr.title")} />
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <p className="max-w-sm text-sm text-muted-foreground">
              {t("eventOcr.notMine")}
            </p>
            <Button asChild variant="outline" size="sm">
              <Link href="/organizer/events">{t("eventOcr.backToEvents")}</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <PageHeader
          back
          title={t("eventOcr.title")}
          description={t("eventOcr.description", { event: eventName })}
        />
        <Button
          size="sm"
          variant="outline"
          onClick={() => fetchSessions(eventId)}
          disabled={loadingSessions}
        >
          <IconRefresh className="h-4 w-4 mr-1.5" />
          {t("eventOcr.refresh")}
        </Button>
      </div>

      {/* Upload pointer card - replaces the admin page's upload form (see the
          header note): screenshot upload is per-match, so it lives inside this
          event's leaderboard page (ImageUploadStep). */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("eventOcr.uploadTitle")}</CardTitle>
          <CardDescription>{t("eventOcr.uploadDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline" size="sm">
            <Link href={`/organizer/events/${slug}/leaderboard`}>
              <IconTrophy className="h-4 w-4 mr-1.5" />
              {t("eventOcr.openLeaderboard")}
            </Link>
          </Button>
        </CardContent>
      </Card>

      {/* Sessions table (ported from the admin page; statuses follow the real model) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("eventOcr.sessionsTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("eventOcr.table.session")}</TableHead>
                <TableHead>{t("eventOcr.table.status")}</TableHead>
                <TableHead>{t("eventOcr.table.created")}</TableHead>
                <TableHead>{t("eventOcr.table.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingSessions ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-10 text-muted-foreground text-sm">
                    {t("eventOcr.loading")}
                  </TableCell>
                </TableRow>
              ) : sessions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-10 text-muted-foreground text-sm">
                    {t("eventOcr.empty")}
                  </TableCell>
                </TableRow>
              ) : (
                sessions.map((session) => (
                  <TableRow key={session.session_id}>
                    <TableCell className="font-mono text-xs">
                      {session.session_id.slice(0, 8)}…
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-xs ${STATUS_COLORS[session.status] ?? ""}`}>
                        {statusLabel(session.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {/* Viewer-timezone render (i18n hard rule) - never a raw toLocale*. */}
                      {session.created_at ? <LocalTime value={session.created_at} /> : "-"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleViewSession(session.session_id)}
                        >
                          {t("eventOcr.review")}
                        </Button>
                        {/* Commit only while the draft is still reviewable. */}
                        {session.status === "pending_review" && (
                          <Button
                            size="sm"
                            onClick={() => handleCommit(session.session_id)}
                            disabled={committing === session.session_id}
                          >
                            <IconCheck className="h-3.5 w-3.5 mr-1" />
                            {committing === session.session_id
                              ? t("eventOcr.committing")
                              : t("eventOcr.commit")}
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={deleting === session.session_id}
                          onClick={() => handleDelete(session.session_id)}
                        >
                          <IconTrash className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Review dialog: session status + the extracted draft rows (the detail GET
          returns draft_rows; rendered as formatted JSON, same as the admin page's
          extracted-data block). */}
      <Dialog open={!!viewSession} onOpenChange={(o) => { if (!o) setViewSession(null); }}>
        {viewSession && (
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{t("eventOcr.dialogTitle")}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Badge variant="outline" className={`text-xs ${STATUS_COLORS[viewSession.status] ?? ""}`}>
                  {statusLabel(viewSession.status)}
                </Badge>
                <span className="text-xs text-muted-foreground font-mono">{viewSession.session_id}</span>
              </div>
              {!!viewSession.draft_rows?.length && (
                <div>
                  <p className="text-sm font-semibold mb-2">{t("eventOcr.extractedData")}</p>
                  <pre className="text-xs bg-muted rounded-md p-3 overflow-x-auto whitespace-pre-wrap">
                    {JSON.stringify(viewSession.draft_rows, null, 2)}
                  </pre>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setViewSession(null)}>
                {t("eventOcr.close")}
              </Button>
              {viewSession.status === "pending_review" && (
                <Button
                  onClick={() => { handleCommit(viewSession.session_id); setViewSession(null); }}
                  disabled={committing === viewSession.session_id}
                >
                  <IconCheck className="h-4 w-4 mr-1.5" />
                  {t("eventOcr.commitResults")}
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
