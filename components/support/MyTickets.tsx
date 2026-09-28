"use client";

/**
 * components/support/MyTickets.tsx - "My tickets" on the /support page (inbox #71, 2026-09-28).
 *
 * The signed-in player's own support tickets: the ones linked to their account, and the ones they
 * sent signed out from their account's email (owner's answer: "Account + same email"). Each row
 * opens the ticket's own page, app/(user)/support/t/[token], the same page the support emails link
 * to, where they read the whole conversation, reply and attach files (owner's answer: "The ticket's
 * own page"). Nothing here duplicates that conversation view.
 *
 * Data: GET support/mine/ (afc_support.views.support_mine) through lib/api/support.ts
 * getMySupportTickets, 20 at a time with "Show more". Rendered by SupportWorkspace only when the
 * session has resolved to signed in (R26: nothing is decided while it loads).
 *
 * States: skeleton rows while loading, a written line when there are none, a written error with
 * Try again. Filled rows, no outlines (owner's design rule); dates in the viewer's timezone.
 */
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { IconChevronRight } from "@tabler/icons-react";

import { useAuth } from "@/contexts/AuthContext";
import { LocalTime } from "@/components/LocalTime";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getMySupportTickets, type MySupportTicket } from "@/lib/api/support";

const PAGE_SIZE = 20;

// The status pill: filled colours that carry meaning (gold = over to you), never an outline.
const STATUS_STYLE: Record<MySupportTicket["status"], string> = {
  waiting: "bg-gold text-black",
  open: "bg-muted text-foreground",
  resolved: "bg-primary/20 text-primary",
  closed: "bg-background text-muted-foreground",
};

export function MyTickets({ email }: { email: string }) {
  const t = useTranslations("supportPage");
  const { token } = useAuth();
  const [rows, setRows] = useState<MySupportTicket[]>([]);
  const [total, setTotal] = useState(0);
  const [waiting, setWaiting] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");
  const [loadingMore, setLoadingMore] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setState("loading");
    try {
      const page = await getMySupportTickets(token, { limit: PAGE_SIZE, offset: 0 });
      setRows(page.results);
      setTotal(page.total_count);
      setWaiting(page.waiting_count);
      setHasMore(page.has_more);
      setState("ok");
    } catch {
      setState("error");
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const more = async () => {
    if (!token) return;
    setLoadingMore(true);
    try {
      const page = await getMySupportTickets(token, { limit: PAGE_SIZE, offset: rows.length });
      setRows((prev) => [...prev, ...page.results]);
      setHasMore(page.has_more);
    } catch {
      setState("error");
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <section aria-labelledby="my-tickets-h" className="rounded-xl bg-muted/40 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id="my-tickets-h" className="text-lg font-semibold">{t("mine.title")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t.rich("mine.subtitle", { email, b: (chunks) => <b className="text-foreground">{chunks}</b> })}
          </p>
        </div>
        {state === "ok" && total > 0 && (
          <p className="text-sm text-muted-foreground">
            {t("mine.count", { total })}
            {waiting > 0 && <>, {t("mine.waiting", { count: waiting })}</>}
          </p>
        )}
      </div>

      {state === "loading" && (
        <div className="mt-4 flex flex-col gap-1.5" aria-label={t("mine.loading")} aria-busy="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-12 rounded-lg bg-muted/60" />
          ))}
        </div>
      )}

      {state === "error" && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-destructive/20 px-4 py-3 text-sm" role="alert">
          <span>{t("mine.error")}</span>
          <Button size="sm" variant="secondary" onClick={load}>{t("mine.retry")}</Button>
        </div>
      )}

      {state === "ok" && rows.length === 0 && (
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{t("mine.empty")}</p>
      )}

      {state === "ok" && rows.length > 0 && (
        <ul className="mt-4 flex flex-col gap-1.5">
          {rows.map((row) => (
            <li key={row.ticket_number}>
              <Link
                href={`/support/t/${encodeURIComponent(row.token)}`}
                aria-label={t("mine.open", { number: row.ticket_number })}
                className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1.5 rounded-lg bg-muted/60 px-4 py-3 hover:bg-muted md:grid-cols-[auto_1fr_auto_auto_auto] md:gap-x-4"
              >
                <span className="font-mono text-xs text-muted-foreground">{row.ticket_number}</span>
                <span className={cn("justify-self-end whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-bold md:order-3", STATUS_STYLE[row.status])}>
                  {t(`status.${row.status}`)}
                </span>
                <span className="col-span-2 min-w-0 text-sm font-semibold md:order-2 md:col-span-1 md:truncate">
                  {row.subject || t("mine.noSubject")}
                </span>
                <span className="col-span-2 text-xs text-muted-foreground tabular-nums md:order-4 md:col-span-1 md:whitespace-nowrap">
                  <LocalTime value={row.last_message_at} />
                </span>
                <IconChevronRight className="hidden size-4 text-muted-foreground md:order-5 md:block" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}

      {state === "ok" && hasMore && (
        <div className="mt-3">
          <Button size="sm" variant="secondary" onClick={more} disabled={loadingMore}>{t("mine.more")}</Button>
        </div>
      )}
    </section>
  );
}
