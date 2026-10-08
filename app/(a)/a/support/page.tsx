"use client";

/**
 * app/(a)/a/support/page.tsx - the support desk: every message anybody has sent AFC, by PERSON.
 *
 * WHY THIS PAGE EXISTS (owner 2026-09-14)
 *   "i want there to now be a support dashboard and role that can access and reply to it ... the
 *   suport page should see all contact us sent also and they should be able to reply from there and
 *   also see replies from people there also."
 *
 * WHY IT IS BY PERSON (owner 2026-10-08, inbox #169 / #174, preview approved: "Approve, build it")
 *   "Support admins or admins should be able to view all messages from each user in a single place
 *   without having to scroll, they should still be able to filter requests by dates, time, country
 *   etc. They should be able to reply all messages together or at least reply one by one."
 *   Preview: WEBSITE/mockups/support-desk-v2/support-desk-preview.html. The list shows PEOPLE (one
 *   row however many times they wrote); the panel shows everything they sent with files; the reply
 *   box answers all their open requests at once (one email) or one of them; ticking several people
 *   sends one answer to all of them. On desktop the desk fills the window: the list and the
 *   conversation scroll inside their panels and the reply box stays on screen.
 *
 * WHO MAY OPEN IT
 *   The backend decides, not this file: GET support/access/ answers {can_work_tickets,
 *   can_read_audit} and the page renders the refusal state when it is false (R26: a control nobody
 *   can use is never drawn). The sidebar entry is gated by the same roles in constants/nav-links.ts.
 *
 * WHAT IT TALKS TO (lib/api/support.ts -> backend afc_support/views_people.py and views.py)
 *   GET  support/people/                     the people, filtered (DeskFilters)
 *   GET  support/people/<key>/               one person, every ticket (PersonPanel)
 *   GET  support/people/by-ticket/?ticket=   the staff email / Discord heads-up link a TICKET
 *   POST support/people/<key>/reply/         one reply on several requests (PersonPanel)
 *   POST support/people/bulk-reply/          the same reply to several people (BulkReplyDialog)
 *   POST support/tickets/<number>/status/    a request's status, assign to me (PersonPanel)
 *
 * A reply from this page is an admin mutation, so afc_auth.middleware.AuditLogMiddleware records
 * it on the sitewide History page automatically. The support-only audit (every message, every
 * file) is the sibling page at /a/support/audit, head admins only.
 */
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { IconShieldLock } from "@tabler/icons-react";

import { PageHeader } from "@/components/PageHeader";
import { FullLoader, Loader } from "@/components/Loader";
import { NewBadge } from "@/components/NewBadge";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import {
  getSupportAccess,
  getSupportPeople,
  getSupportPerson,
  getSupportPersonByTicket,
  type SupportPeople,
  type SupportPerson,
  type SupportPersonDetail,
} from "@/lib/api/support";
import { localInputToIso } from "@/lib/i18n/time";
import { cn } from "@/lib/utils";

import { BulkReplyDialog } from "./_components/BulkReplyDialog";
import { DEFAULT_FILTERS, DeskFilters, type DeskFilterState } from "./_components/DeskFilters";
import { PeopleList } from "./_components/PeopleList";
import { PersonPanel } from "./_components/PersonPanel";

const PAGE_SIZE = 30;
const SEARCH_DELAY_MS = 350;

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

  const [access, setAccess] = useState<{ can_work_tickets: boolean; can_read_audit: boolean } | null>(null);
  const [filters, setFilters] = useState<DeskFilterState>(DEFAULT_FILTERS);
  const [query, setQuery] = useState("");
  const [people, setPeople] = useState<SupportPerson[]>([]);
  const [meta, setMeta] = useState<Pick<SupportPeople, "total_count" | "has_more" | "next_offset" | "countries" | "status_counts"> | null>(null);
  const [loadingPeople, setLoadingPeople] = useState(true);
  const [peopleError, setPeopleError] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<SupportPersonDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);
  const [showPersonOnPhone, setShowPersonOnPhone] = useState(false);
  const openedFromLink = useRef(false);

  useEffect(() => {
    if (!token) return;
    getSupportAccess(token)
      .then(setAccess)
      .catch(() => setAccess({ can_work_tickets: false, can_read_audit: false }));
  }, [token]);

  // Typing waits a moment before it searches, so every keystroke is not a request.
  useEffect(() => {
    const id = setTimeout(() => setQuery(filters.q.trim()), SEARCH_DELAY_MS);
    return () => clearTimeout(id);
  }, [filters.q]);

  const apiFilters = useMemo(
    () => ({
      q: query || undefined,
      status: filters.statuses.length ? filters.statuses.join(",") : undefined,
      date_from: localInputToIso(filters.from) ?? undefined,
      date_to: localInputToIso(filters.to) ?? undefined,
      country: filters.country === "all" ? undefined : filters.country,
      source: filters.source === "all" ? undefined : filters.source,
      assigned: filters.assigned === "any" ? undefined : filters.assigned,
      has_files: filters.hasFiles ? "1" : undefined,
    }),
    [query, filters.statuses, filters.from, filters.to, filters.country, filters.source, filters.assigned, filters.hasFiles],
  );

  const loadPeople = useCallback(
    async (append = false) => {
      if (!token) return;
      setLoadingPeople(true);
      setPeopleError("");
      try {
        const data = await getSupportPeople(token, {
          ...apiFilters,
          limit: PAGE_SIZE,
          offset: append ? (meta?.next_offset ?? 0) : 0,
        });
        setPeople((prev) => (append ? [...prev, ...data.results] : data.results));
        setMeta({
          total_count: data.total_count,
          has_more: data.has_more,
          next_offset: data.next_offset,
          countries: data.countries,
          status_counts: data.status_counts,
        });
        if (!append) setSelected((prev) => prev ?? data.results[0]?.key ?? null);
      } catch (err: any) {
        setPeopleError(err?.response?.data?.message || t("desk.errors.people"));
      } finally {
        setLoadingPeople(false);
      }
    },
    // meta.next_offset is read only when appending; leaving it out keeps a filter change from looping.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [token, apiFilters, t],
  );

  useEffect(() => {
    if (access?.can_work_tickets) loadPeople(false);
  }, [access, loadPeople]);

  // The staff heads-up email and Discord DM link to ?ticket=<number>: open that ticket's person.
  useEffect(() => {
    const ticket = params.get("ticket");
    if (!token || !access?.can_work_tickets || !ticket || openedFromLink.current) return;
    openedFromLink.current = true;
    getSupportPersonByTicket(token, ticket)
      .then((d) => {
        setSelected(d.person.key);
        setDetail(d);
        setShowPersonOnPhone(true);
      })
      .catch(() => undefined);
  }, [token, access, params]);

  const loadDetail = useCallback(
    async (key: string) => {
      if (!token) return;
      setLoadingDetail(true);
      try {
        setDetail(await getSupportPerson(token, key));
      } catch {
        setDetail(null);
      } finally {
        setLoadingDetail(false);
      }
    },
    [token],
  );

  useEffect(() => {
    if (selected && detail?.person.key !== selected) loadDetail(selected);
  }, [selected, detail?.person.key, loadDetail]);

  const openPerson = (key: string) => {
    setSelected(key);
    setShowPersonOnPhone(true);
    if (typeof window !== "undefined" && window.innerWidth < 1024) window.scrollTo({ top: 0 });
  };

  const togglePick = (key: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const countLine = meta
    ? t("desk.counts", {
        people: meta.total_count,
        open: (meta.status_counts?.open ?? 0) + (meta.status_counts?.waiting ?? 0),
      })
    : "";
  const filtered = JSON.stringify({ ...filters, q: "" }) !== JSON.stringify({ ...DEFAULT_FILTERS, q: "" }) || !!query;

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
    // The desk fills the window down to just above the site-wide Help button (bottom right, ~70px),
    // so the reply box and its Send button are never under it.
    <div className="flex flex-col lg:h-[calc(100vh-11rem)]">
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            {t("title")} <NewBadge since="2026-10-08" />
          </span>
        }
        description={t("desk.subtitle")}
      />

      <DeskFilters
        value={filters}
        onChange={setFilters}
        countries={meta?.countries ?? []}
        statusCounts={meta?.status_counts}
        countLine={countLine}
      />

      <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[minmax(0,360px)_1fr]">
        <Card className={cn("min-h-0 gap-0 py-2 lg:flex lg:flex-col", showPersonOnPhone ? "hidden lg:flex" : "")}>
          <div className="min-h-0 flex-1 overflow-y-auto px-2">
            <PeopleList
              people={people}
              loading={loadingPeople}
              error={peopleError}
              selected={selected}
              onSelect={openPerson}
              picked={picked}
              onTogglePick={togglePick}
              onBulkReply={() => setBulkOpen(true)}
              onClearPicked={() => setPicked(new Set())}
              emptyText={filtered ? t("desk.noMatch") : t("desk.empty")}
              hasMore={!!meta?.has_more}
              onLoadMore={() => loadPeople(true)}
            />
          </div>
        </Card>

        <Card className={cn("min-h-0 gap-0 py-0 lg:flex lg:flex-col", showPersonOnPhone ? "" : "hidden lg:flex")}>
          {detail && detail.person.key === selected ? (
            <PersonPanel
              token={token}
              detail={detail}
              onBack={() => setShowPersonOnPhone(false)}
              onChanged={(next) => {
                if (next) setDetail(next);
                else if (selected) loadDetail(selected);
                loadPeople(false);
              }}
            />
          ) : (
            <CardContent className="py-12 text-center">
              {loadingDetail ? (
                <Loader text={t("loading")} />
              ) : (
                <p className="text-muted-foreground text-sm">{people.length ? t("desk.pickPerson") : t("desk.empty")}</p>
              )}
            </CardContent>
          )}
        </Card>
      </div>

      <BulkReplyDialog
        token={token}
        keys={[...picked]}
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        onSent={() => {
          setBulkOpen(false);
          setPicked(new Set());
          loadPeople(false);
          if (selected) loadDetail(selected);
        }}
      />
    </div>
  );
}
