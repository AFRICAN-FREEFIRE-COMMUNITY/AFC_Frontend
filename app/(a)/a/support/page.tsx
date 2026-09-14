"use client";

/**
 * app/(a)/a/support/page.tsx - the support desk: every message anybody has sent AFC, and the reply
 * box that answers it.
 *
 * WHY THIS PAGE EXISTS (owner 2026-09-14)
 *   "i want there to now be a support dashboard and role that can access and reply to it ... the
 *   suport page should see all contact us sent also and they should be able to reply from there and
 *   also see replies from people there also."
 *
 * WHO MAY OPEN IT
 *   The backend decides, not this file: GET support/access/ answers {can_work_tickets,
 *   can_read_audit} and the page renders the refusal state when it is false (R26: a control nobody
 *   can use is never drawn). The sidebar entry is gated by the same roles in constants/nav-links.ts.
 *
 * WHAT IT TALKS TO (lib/api/support.ts -> backend afc_support)
 *   GET  support/tickets/                    the queue, searched and filtered
 *   GET  support/tickets/<number>/           the conversation
 *   POST support/tickets/<number>/reply/     answer, which emails and DMs the person
 *   POST support/tickets/<number>/status/    set the status, take the ticket
 *
 * A reply from this page is an admin mutation, so afc_auth.middleware.AuditLogMiddleware records
 * it on the sitewide History page automatically. The support-only audit (every message, every
 * file) is the sibling page at /a/support/audit, head admins only.
 */
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  IconBrandDiscord,
  IconInbox,
  IconRefresh,
  IconShieldLock,
} from "@tabler/icons-react";

import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FullLoader, Loader } from "@/components/Loader";
import { LocalTime } from "@/components/LocalTime";
import { NewBadge } from "@/components/NewBadge";
import { SupportComposer, SupportThread } from "@/components/support/SupportThread";
import { useAuth } from "@/contexts/AuthContext";
import {
  getSupportAccess,
  getTicket,
  getTicketQueue,
  replyAsStaff,
  setTicketStatus,
  type SupportQueue,
  type SupportTicket,
} from "@/lib/api/support";

const STATUS_VARIANTS: Record<string, string> = {
  open: "bg-primary/15 text-primary",
  waiting: "bg-amber-500/15 text-amber-500",
  resolved: "bg-muted text-muted-foreground",
  closed: "bg-muted text-muted-foreground",
};

/**
 * The page itself is only the Suspense boundary. SupportDesk below reads the ?ticket= query with
 * useSearchParams, which SUSPENDS, and a suspending client component with no boundary above it
 * leaves the whole segment showing a placeholder for ever (which is exactly what happened to the
 * public ticket page on the day this shipped).
 */
export default function SupportDeskPage() {
  return (
    <Suspense fallback={<FullLoader />}>
      <SupportDesk />
    </Suspense>
  );
}

function SupportDesk() {
  const t = useTranslations("support");
  const { token } = useAuth();
  const params = useSearchParams();

  const [access, setAccess] = useState<{ can_work_tickets: boolean; can_read_audit: boolean } | null>(
    null,
  );
  const [queue, setQueue] = useState<SupportQueue | null>(null);
  const [loadingQueue, setLoadingQueue] = useState(true);
  const [queueError, setQueueError] = useState("");
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [selected, setSelected] = useState<string | null>(params.get("ticket"));
  const [ticket, setTicket] = useState<SupportTicket | null>(null);
  const [loadingTicket, setLoadingTicket] = useState(false);
  const [sending, setSending] = useState(false);

  // ── who is asking ──────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!token) return;
    getSupportAccess(token)
      .then(setAccess)
      .catch(() => setAccess({ can_work_tickets: false, can_read_audit: false }));
  }, [token]);

  // ── the queue ──────────────────────────────────────────────────────────────────────────────
  const loadQueue = useCallback(async () => {
    if (!token) return;
    setLoadingQueue(true);
    setQueueError("");
    try {
      const data = await getTicketQueue(token, {
        q: q.trim() || undefined,
        status: statusFilter === "all" ? undefined : statusFilter,
        limit: 50,
      });
      setQueue(data);
      // Open the first conversation by default, so the page never lands on an empty right half.
      setSelected((prev) => prev ?? data.results[0]?.ticket_number ?? null);
    } catch (err: any) {
      setQueueError(err?.response?.data?.message || t("errors.queue"));
    } finally {
      setLoadingQueue(false);
    }
  }, [token, q, statusFilter, t]);

  useEffect(() => {
    if (access?.can_work_tickets) loadQueue();
  }, [access, loadQueue]);

  // ── one conversation ───────────────────────────────────────────────────────────────────────
  const loadTicket = useCallback(
    async (number: string) => {
      if (!token) return;
      setLoadingTicket(true);
      try {
        setTicket(await getTicket(token, number));
      } catch (err: any) {
        toast.error(err?.response?.data?.message || t("errors.ticket"));
      } finally {
        setLoadingTicket(false);
      }
    },
    [token, t],
  );

  useEffect(() => {
    if (selected) loadTicket(selected);
    else setTicket(null);
  }, [selected, loadTicket]);

  const sendReply = async (message: string, files: File[]) => {
    if (!token || !ticket) return false;
    setSending(true);
    try {
      const res = await replyAsStaff(token, ticket.ticket_number, message, files);
      setTicket(res.ticket);
      res.rejected_files?.forEach((f) =>
        toast.error(t(`errors.rejected.${f.reason}`, { name: f.name })),
      );
      toast.success(
        res.discord_dm ? t("reply.sentWithDiscord") : t("reply.sent"),
      );
      loadQueue();
      return true;
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t("errors.reply"));
      return false;
    } finally {
      setSending(false);
    }
  };

  const changeStatus = async (next: string) => {
    if (!token || !ticket) return;
    try {
      const res = await setTicketStatus(token, ticket.ticket_number, { status: next });
      setTicket({ ...ticket, status: res.ticket.status });
      toast.success(t("status.changed"));
      loadQueue();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t("errors.status"));
    }
  };

  const statusLabel = useMemo(
    () => (s: string) => t(`status.${s}` as "status.open"),
    [t],
  );

  // ── gates ──────────────────────────────────────────────────────────────────────────────────
  if (!token || access === null) return <FullLoader />;
  if (!access.can_work_tickets) {
    return (
      <div>
        <PageHeader title={t("title")} />
        <Card>
          <CardContent className="py-10 text-center">
            <IconShieldLock className="text-muted-foreground mx-auto mb-3 size-8" />
            <p className="text-sm">{t("noAccess")}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            {t("title")} <NewBadge since="2026-09-14" />
          </span>
        }
        description={t("subtitle")}
      />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && loadQueue()}
          placeholder={t("search")}
          className="max-w-[280px]"
        />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[190px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("filters.all")}</SelectItem>
            <SelectItem value="open">{t("status.open")}</SelectItem>
            <SelectItem value="waiting">{t("status.waiting")}</SelectItem>
            <SelectItem value="resolved">{t("status.resolved")}</SelectItem>
            <SelectItem value="closed">{t("status.closed")}</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={loadQueue} disabled={loadingQueue}>
          <IconRefresh className="mr-1 size-4" /> {t("refresh")}
        </Button>
        {queue ? (
          <span className="text-muted-foreground text-xs">
            {t("counts", { open: queue.open_count, total: queue.total_count })}
          </span>
        ) : null}
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,340px)_1fr]">
        {/* ── the queue ── */}
        <Card className="max-h-[70vh] overflow-y-auto">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{t("queue")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {loadingQueue ? (
              <Loader text={t("loading")} />
            ) : queueError ? (
              <p className="text-destructive text-sm">{queueError}</p>
            ) : !queue?.results.length ? (
              <div className="py-8 text-center">
                <IconInbox className="text-muted-foreground mx-auto mb-2 size-7" />
                <p className="text-muted-foreground text-sm">{t("empty")}</p>
              </div>
            ) : (
              queue.results.map((row) => (
                <button
                  key={row.ticket_number}
                  type="button"
                  onClick={() => setSelected(row.ticket_number)}
                  className={`w-full rounded-md p-2.5 text-left ${
                    row.ticket_number === selected ? "bg-primary/10" : "bg-muted/40 hover:bg-muted"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium">{row.name}</span>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] ${
                        STATUS_VARIANTS[row.status] ?? "bg-muted"
                      }`}
                    >
                      {statusLabel(row.status)}
                    </span>
                  </div>
                  <div className="text-muted-foreground mt-0.5 flex items-center justify-between gap-2 text-xs">
                    <span className="truncate">{row.ticket_number}</span>
                    <LocalTime value={row.last_message_at} />
                  </div>
                  <p className="text-muted-foreground mt-1 line-clamp-2 text-xs">{row.subject}</p>
                </button>
              ))
            )}
          </CardContent>
        </Card>

        {/* ── the conversation ── */}
        <Card className="max-h-[70vh] overflow-y-auto">
          {!ticket ? (
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground text-sm">
                {loadingTicket ? t("loading") : t("pickOne")}
              </p>
            </CardContent>
          ) : (
            <>
              <CardHeader className="pb-2">
                <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                  {ticket.name}
                  <span className="text-muted-foreground text-xs font-normal">
                    {ticket.ticket_number}
                  </span>
                  {ticket.has_discord ? (
                    <span
                      className="text-muted-foreground flex items-center gap-1 text-xs font-normal"
                      title={t("hasDiscord")}
                    >
                      <IconBrandDiscord className="size-3.5" /> {t("hasDiscord")}
                    </span>
                  ) : null}
                </CardTitle>
                <div className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                  <a className="hover:text-primary" href={`mailto:${ticket.email}`}>
                    {ticket.email}
                  </a>
                  {ticket.username ? <span>{t("account", { name: ticket.username })}</span> : null}
                  <span>
                    {t("openedOn")} <LocalTime value={ticket.created_at} />
                  </span>
                  {ticket.assigned_to ? (
                    <span>{t("assignedTo", { name: ticket.assigned_to })}</span>
                  ) : null}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Select value={ticket.status} onValueChange={changeStatus}>
                    <SelectTrigger className="h-8 w-[190px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open">{t("status.open")}</SelectItem>
                      <SelectItem value="waiting">{t("status.waiting")}</SelectItem>
                      <SelectItem value="resolved">{t("status.resolved")}</SelectItem>
                      <SelectItem value="closed">{t("status.closed")}</SelectItem>
                    </SelectContent>
                  </Select>
                  {ticket.ticket_url ? (
                    <a
                      className="text-muted-foreground hover:text-primary text-xs"
                      href={ticket.ticket_url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {t("theirPage")}
                    </a>
                  ) : null}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <SupportThread messages={ticket.messages ?? []} showInternalNotes />
                <SupportComposer
                  onSend={sendReply}
                  sending={sending}
                  placeholder={t("composer.staffPlaceholder")}
                />
                <p className="text-muted-foreground text-xs">{t("reply.explainer")}</p>
              </CardContent>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
