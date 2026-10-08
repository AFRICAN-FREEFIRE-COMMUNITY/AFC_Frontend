"use client";

/**
 * components/support/desk/SupportDesk.tsx - the support desk by PERSON, shared by two pages.
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
 * WHY IT IS SHARED (owner 2026-10-08, inbox #167 / #175)
 *   "We want to give organizers their own support feature ... they should be able to answer and
 *   view things sent to them, including attachments." An organizer's desk is the SAME desk scoped to
 *   one organization: `organization` set means every call carries ?organization=<slug> and the
 *   backend (AFC-B afc_support/org_scope.py) shows only that organization's questions to its
 *   answerers and to AFC head / super admins. Without it this is AFC's own desk.
 *   Rendered by app/(a)/a/support/page.tsx (AFC's desk, plus a desk picker for anybody who may also
 *   read organizer desks) and app/(organizer)/organizer/support/page.tsx (the organizer's own).
 *   The caller decides who may open it (support/access/); this component assumes they may.
 *
 * WHAT IT TALKS TO (lib/api/support.ts -> backend afc_support/views_people.py and views.py)
 *   GET  support/people/                     the people, filtered (DeskFilters)
 *   GET  support/people/<key>/               one person, every ticket (PersonPanel)
 *   GET  support/people/by-ticket/?ticket=   the heads-up email / notification link to a TICKET
 *   POST support/people/<key>/reply/         one reply on several requests (PersonPanel)
 *   POST support/people/bulk-reply/          the same reply to several people (BulkReplyDialog)
 *   POST support/tickets/<number>/status/    a request's status, assign to me (PersonPanel)
 */
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

import { Loader } from "@/components/Loader";
import { Card, CardContent } from "@/components/ui/card";
import {
  getSupportPeople,
  getSupportPerson,
  getSupportPersonByTicket,
  type SupportPeople,
  type SupportPerson,
  type SupportPersonDetail,
} from "@/lib/api/support";
import { localInputToIso } from "@/lib/i18n/time";
import { cn } from "@/lib/utils";

import { BulkReplyDialog } from "./BulkReplyDialog";
import { DEFAULT_FILTERS, DeskFilters, type DeskFilterState } from "./DeskFilters";
import { PeopleList } from "./PeopleList";
import { PersonPanel } from "./PersonPanel";

const PAGE_SIZE = 30;
const SEARCH_DELAY_MS = 350;

export function SupportDesk({
  token,
  header,
  organization,
  readOnly = false,
}: {
  token: string;
  /** The page's own heading (title, badge, desk picker), drawn at the top of the desk's column. */
  header: ReactNode;
  /** Inbox #175: work this organization's desk instead of AFC's. */
  organization?: { slug: string; name: string };
  /** Inbox #175: AFC head / super admins overseeing an organizer's desk read but never answer. */
  readOnly?: boolean;
}) {
  const t = useTranslations("support");
  const params = useSearchParams();
  const orgSlug = organization?.slug;

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
      organization: orgSlug,
    }),
    [query, filters.statuses, filters.from, filters.to, filters.country, filters.source, filters.assigned, filters.hasFiles, orgSlug],
  );

  const loadPeople = useCallback(
    async (append = false) => {
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
    loadPeople(false);
  }, [loadPeople]);

  // The heads-up email, Discord DM and organizer notification link to ?ticket=<number>: open
  // that ticket's person.
  useEffect(() => {
    const ticket = params.get("ticket");
    if (!ticket || openedFromLink.current) return;
    openedFromLink.current = true;
    getSupportPersonByTicket(token, ticket, orgSlug)
      .then((d) => {
        setSelected(d.person.key);
        setDetail(d);
        setShowPersonOnPhone(true);
      })
      .catch(() => undefined);
  }, [token, params, orgSlug]);

  const loadDetail = useCallback(
    async (key: string) => {
      setLoadingDetail(true);
      try {
        setDetail(await getSupportPerson(token, key, orgSlug));
      } catch {
        setDetail(null);
      } finally {
        setLoadingDetail(false);
      }
    },
    [token, orgSlug],
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
  const emptyText = filtered ? t("desk.noMatch") : organization ? t("desk.emptyOrganizer") : t("desk.empty");

  return (
    // The desk fills the window down to just above the site-wide Help button (bottom right, ~70px),
    // so the reply box and its Send button are never under it.
    <div className="flex flex-col lg:h-[calc(100vh-11rem)]">
      {header}

      <DeskFilters
        value={filters}
        onChange={setFilters}
        countries={meta?.countries ?? []}
        statusCounts={meta?.status_counts}
        countLine={countLine}
        hideSource={!!organization}
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
              emptyText={emptyText}
              hasMore={!!meta?.has_more}
              onLoadMore={() => loadPeople(true)}
              selectable={!readOnly}
            />
          </div>
        </Card>

        <Card className={cn("min-h-0 gap-0 py-0 lg:flex lg:flex-col", showPersonOnPhone ? "" : "hidden lg:flex")}>
          {detail && detail.person.key === selected ? (
            <PersonPanel
              token={token}
              organization={organization}
              readOnly={readOnly}
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
                <p className="text-muted-foreground text-sm">{people.length ? t("desk.pickPerson") : emptyText}</p>
              )}
            </CardContent>
          )}
        </Card>
      </div>

      <BulkReplyDialog
        token={token}
        organization={orgSlug}
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
