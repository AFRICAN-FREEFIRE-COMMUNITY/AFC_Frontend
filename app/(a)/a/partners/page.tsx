"use client";

// ── Admin · API Keys ─────────────────────────────────────────────────────────
// One page, TWO partner programs, one per tab (owner 2026-08-03, "where do we control
// the sso for our partners, can it be under api keys"):
//
//   Data API           - every afc_partner_api Partner: an AFC-approved external
//                        consumer of completed/published tournament data, with its
//                        per-partner field toggles and issued API keys. This file.
//   Sign in with AFC   - every afc_sso AFCSSOApplication: a partner site that lets
//                        players sign in with their AFC account, with the eight
//                        toggles deciding what it may read about them. Rendered by
//                        _components/SsoAppsPanel.tsx (backend afc_sso/admin_api.py).
//
// They sit together because they are the same idea for different products, and staff
// approve both through the same process.
//
// Owner 2026-08-05 ("site feedback should go under api keys") added a FOURTH tab that is
// not a partner program at all: the site feedback triage queue, moved here from its own
// sidebar entry at /a/feedback (which now redirects to ?tab=feedback, see next.config.ts).
// Rendered by _components/SiteFeedbackPanel.tsx.
//
// The Data API tab below mirrors the admin Organizations list idiom
// (app/(a)/a/organizations/page.tsx): search box + shadcn Table + the shared
// Pagination component, plus a "Create partner" dialog. It paginates SERVER-side via
// partnersApi.listPartners({ search, limit, offset }) because that endpoint already
// returns { results, total_count, has_more }. Each row links to /a/partners/[slug]
// for the scope/toggles/keys detail view.

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { useAuth } from "@/contexts/AuthContext";

import { FullLoader } from "@/components/Loader";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ITEMS_PER_PAGE } from "@/constants";
import { IconPlus, IconSearch, IconX } from "@tabler/icons-react";
import { partnersApi, type PartnerSummary } from "@/lib/partners";
import { InfoTip } from "@/components/ui/info-tip";
import SsoAppsPanel from "./_components/SsoAppsPanel";
// The queue of organisations that applied at the public /partners/apply form. Approving one
// provisions a partner for either product, so it belongs on this page rather than its own.
import PartnerApplicationsPanel from "./_components/PartnerApplicationsPanel";
// The site feedback triage queue, folded in from the retired /a/feedback page (owner 2026-08-05).
import SiteFeedbackPanel from "./_components/SiteFeedbackPanel";

// ── Per-tab role gating ──────────────────────────────────────────────────────
// The sidebar entry for this page is now the UNION of two different audiences (the partner
// team and the feedback team), so a viewer must not be shown a tab their roles never covered.
// Each tab declares the roles that owned its surface BEFORE it was folded in; head_admin and
// super_admin always pass (mirrors the canAccess logic in components/nav-main.tsx, same shape
// as TAB_DEFS in app/(a)/a/teams/page.tsx). The union of these IS the nav gate in
// constants/nav-links.ts, and ProtectedRoute reads that same list to guard the route.
const TAB_DEFS = [
  // The three partner surfaces: head_admin / partner_admin, matching the backend's
  // _is_partner_admin check.
  { value: "data", roles: ["partner_admin"] },
  { value: "sso", roles: ["partner_admin"] },
  { value: "applications", roles: ["partner_admin"] },
  // Site feedback: the COARSE admin / moderator / support roles, mirroring
  // afc_feedback.views.is_feedback_admin. Area admins are deliberately excluded there too.
  { value: "feedback", roles: ["admin", "moderator", "support"] },
] as const;

// Shared status pill - outline badge whose border/text colour tracks the partner
// status (active = green, suspended = orange, anything else = neutral). Same idiom
// as the Organizations list's StatusBadge so the two admin surfaces read identically.
// Its own translator (partners.status.*) so callers do not have to thread one in.
// An unrecognised status falls back to the raw value: there is nothing to translate
// for a state the UI does not know about, and printing it is more useful than blank.
function StatusBadge({ status }: { status: string }) {
  const t = useTranslations("partners");
  if (status === "active")
    return (
      <Badge variant="outline" className="border-green-600/60 text-green-400">
        {t("status.active")}
      </Badge>
    );
  if (status === "suspended")
    return (
      <Badge variant="outline" className="border-orange-500/40 text-orange-400">
        {t("status.suspended")}
      </Badge>
    );
  return (
    <Badge variant="outline" className="capitalize">
      {status || "-"}
    </Badge>
  );
}

export default function PartnersAdminPage() {
  // useRouter (next/navigation) so a freshly-created partner can lead the admin
  // straight to its detail page (where the Connection details + Issue key + Scope &
  // Toggles controls live). See handleCreate below.
  const router = useRouter();
  // searchParams + pathname drive the ?tab= deep link (see the tab block below).
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const { user } = useAuth();

  // Several translators on purpose, one per namespace this page borrows from. Each tab's label
  // stays in the namespace its own panel uses, so a tab's copy never lives in two files:
  //   t  - the `ssoAdmin` namespace, which owns the first two TAB labels. They were authored
  //        there with the Sign-in-with-AFC panel and are left where they are so the
  //        SsoAppsPanel keys stay in one place.
  //   tp - the `partners` namespace (messages/{en,fr,pt}/partners.json), which owns every
  //        string on THIS page plus the whole partner detail page. Admin is in scope for
  //        i18n (owner override 2026-07-13), and this surface had none at all.
  //   tc - the shared `common` namespace, for generic verbs like Cancel that every admin
  //        surface already reuses (no point authoring a partners-only "Cancel").
  const t = useTranslations("ssoAdmin");
  const tp = useTranslations("partners");
  const tc = useTranslations("common");
  // partnerApply namespace: the third tab's label. Its panel owns the rest of that copy, and
  // shares the namespace with the PUBLIC application form so the owner's wording and the
  // applicant's cannot drift ("they were told the link works once").
  const ta = useTranslations("partnerApply");
  // feedback namespace: the fourth tab's label. Its panel owns the rest of that copy, and shares
  // the namespace with the PUBLIC footer widget so one file describes the whole feature.
  const tf = useTranslations("feedback");

  // ── Who sees which tab ───────────────────────────────────────────────────
  // Same normalisation nav-main.tsx uses, so a viewer sees exactly the tabs the sidebar
  // would have let them reach when these surfaces were separate pages. `user` is always
  // populated here: the admin layout's ProtectedRoute holds the whole page behind a loader
  // until auth resolves, so this runs once with real roles rather than on an empty session.
  const normalizeRole = (role: string) => role.toLowerCase().replace(/\s+/g, "_");
  const userRoles = [
    ...(Array.isArray(user?.roles) ? user!.roles.map(normalizeRole) : []),
    normalizeRole(user?.role || ""),
  ].filter(Boolean);
  const isSuper = userRoles.includes("super_admin") || userRoles.includes("head_admin");
  const canSeeTab = (roles: readonly string[]) =>
    isSuper || userRoles.some((r) => roles.includes(r));
  const visibleTabs: string[] = TAB_DEFS.filter((td) => canSeeTab(td.roles)).map(
    (td) => td.value,
  );
  // Pulled out as a primitive because fetchPartners depends on it: a fresh array in a dependency
  // list would refetch on every render.
  const canSeeDataTab = visibleTabs.includes("data");

  // Which tab is on screen. Controlled state (not defaultValue) so the header description
  // can follow the active tab, seeded from ?tab= so /a/feedback can redirect straight to the
  // feedback queue and any deep link survives a reload. Falls back to the FIRST tab this
  // viewer can see (for a head_admin that is still "data", the older and busier program that
  // the admin tour's anchors live in) so nobody lands on a tab that is not rendered.
  const tabParam = searchParams.get("tab");
  const [tab, setTab] = useState(
    tabParam && visibleTabs.includes(tabParam) ? tabParam : (visibleTabs[0] ?? "data"),
  );

  // Keep the active tab in the URL so a RELOAD restores it (router.replace so back isn't spammed).
  const onTabChange = (value: string) => {
    setTab(value);
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", value);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const [partners, setPartners] = useState<PartnerSummary[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  // ── Create-partner dialog state ───────────────────────────────────────────
  // A fresh partner needs only a name; the backend derives a unique slug and starts
  // it with every toggle OFF + no scope (it can read nothing until configured).
  // contact_email is optional internal metadata (never crosses the partner firewall).
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createEmail, setCreateEmail] = useState("");
  const [creating, setCreating] = useState(false);

  const createReady = createName.trim().length > 0;

  // ── Server-side fetch (search + limit/offset paging) ──────────────────────
  // page is 1-indexed; offset = (page - 1) * ITEMS_PER_PAGE. The endpoint hands
  // back { results, total_count, has_more } so we drive paging off total_count.
  const fetchPartners = useCallback(async () => {
    // A viewer who is only here for the feedback tab (support / moderator) has no rights on the
    // partner endpoint, so asking would just hand them a 403 toast on arrival. Skip the call and
    // drop out of the loading state so the page renders straight to their tab.
    if (!canSeeDataTab) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await partnersApi.listPartners({
        search: search.trim() || undefined,
        limit: ITEMS_PER_PAGE,
        offset: (page - 1) * ITEMS_PER_PAGE,
      });
      setPartners(res?.results ?? []);
      setTotalCount(res?.total_count ?? 0);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || tp("list.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [search, page, canSeeDataTab]);

  useEffect(() => {
    fetchPartners();
  }, [fetchPartners]);

  // Reset to page 1 whenever the search term changes so we don't land on an
  // out-of-range offset (e.g. searching while on page 5 of the unfiltered list).
  useEffect(() => {
    setPage(1);
  }, [search]);

  const totalPages = Math.max(1, Math.ceil(totalCount / ITEMS_PER_PAGE));

  const handleCreate = async () => {
    if (!createReady || creating) return;
    setCreating(true);
    try {
      const res = await partnersApi.createPartner({
        name: createName.trim(),
        contact_email: createEmail.trim() || undefined,
      });
      toast.success(tp("list.created"));
      // reset the form + close the dialog
      setCreateName("");
      setCreateEmail("");
      setCreateOpen(false);

      // ── Lead the admin straight to the new partner's detail page ──
      // The owner's complaint: after creating a partner there was nowhere obvious to
      // issue/copy a key or set access. The detail page (/a/partners/<slug>) is exactly
      // that surface (Connection details + Issue key + Scope & Toggles), so route there
      // on success. createPartner echoes the new PartnerSummary, which carries the
      // backend-derived slug. If the slug is somehow missing, fall back to a plain list
      // refresh so the new row still shows.
      const newSlug = res?.partner?.slug;
      if (newSlug) {
        router.push(`/a/partners/${newSlug}`);
      } else {
        setPage(1);
        fetchPartners();
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || tp("list.createFailed"));
    } finally {
      setCreating(false);
    }
  };

  // page-number list for the Pagination control (1 … current±1 … last).
  const pageNumbers = useMemo(
    () =>
      Array.from({ length: totalPages }, (_, i) => i + 1)
        .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
        .reduce<(number | "ellipsis")[]>((acc, p, idx, arr) => {
          if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push("ellipsis");
          acc.push(p);
          return acc;
        }, []),
    [totalPages, page],
  );

  // first load only - keep the table on-screen during search/page refetches. Guarded on the
  // Data API tab being visible: a feedback-only viewer never fetches partners, so without this
  // they would watch a loader for a table they are not allowed to see.
  if (canSeeDataTab && loading && partners.length === 0) return <FullLoader />;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        // Wrap the title so the page-level ⓘ sits right after it (PageHeader takes a ReactNode).
        // Heading reads "API Keys" (owner request 2026-06-09) to match the renamed
        // sidebar entry. It now covers BOTH partner programs (see the file header), so the
        // description follows the active tab rather than always counting data-API keys.
        title={
          <span className="inline-flex flex-wrap items-center">
            {tp("list.title")}
            <InfoTip id="partners._page" className="ml-1.5" />
          </span>
        }
        description={
          tab === "data"
            ? tp("list.count", { count: totalCount })
            : undefined
        }
      />

      {/* Two programs, the queue that feeds both, and the site feedback inbox, on one page.
          Controlled value so the header description above can follow the tab; shadcn
          pill/segment style, per the AFC design constants. Each trigger is rendered only for a
          viewer whose roles cover it (visibleTabs), so a support user sees a one-tab page. */}
      <Tabs value={tab} onValueChange={onTabChange}>
        <TabsList className="w-full">
          {visibleTabs.includes("data") && (
            <TabsTrigger value="data" className="w-full">
              {t("tabs.dataApi")}
            </TabsTrigger>
          )}
          {visibleTabs.includes("sso") && (
            <TabsTrigger value="sso" className="w-full">
              {t("tabs.sso")}
            </TabsTrigger>
          )}
          {/* Applications sits after the two products because it is where a partner starts and
              they are where one ends up: the owner reads this page left to right as the two
              products, then the inbox that provisions into them. */}
          {visibleTabs.includes("applications") && (
            <TabsTrigger value="applications" className="w-full">
              {ta("admin.tab")}
            </TabsTrigger>
          )}
          {/* Site Feedback is LAST (owner 2026-08-05): it is the one tab that is not about
              partners at all, so it does not interrupt the partner story told by the first three. */}
          {visibleTabs.includes("feedback") && (
            <TabsTrigger value="feedback" className="w-full">
              {tf("admin.tab")}
            </TabsTrigger>
          )}
        </TabsList>

        {/* ── Data API tab: the existing partner list, unchanged apart from being
            wrapped here (the create action moved in with it so it only shows for
            the program it belongs to). ── */}
        <TabsContent value="data" className="mt-4 flex flex-col gap-6">
          <div className="flex items-center justify-end gap-1">
            {/* ⓘ sits beside the create button (sibling, not nested). */}
            {/* data-tour="orgs-misc-partners-create": admin-tour anchor (orgs-misc area). */}
            <Button
              data-tour="orgs-misc-partners-create"
              className="w-full md:w-auto"
              onClick={() => setCreateOpen(true)}
            >
              <IconPlus />
              {tp("list.create")}
            </Button>
            <InfoTip id="partners.create" />
          </div>

          {/* Search - debounce-free; each keystroke triggers a server refetch via the
              fetchPartners dependency on `search` (matches the organizations search UX). */}
          <div className="relative">
            <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            {/* data-tour="orgs-misc-partners-search": admin-tour anchor (orgs-misc area). */}
            <Input
              data-tour="orgs-misc-partners-search"
              placeholder={tp("list.searchPlaceholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
            {search && (
              <button
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setSearch("")}
              >
                <IconX className="size-4" />
              </button>
            )}
          </div>

          {partners.length === 0 ? (
            <Card>
              <CardContent className="py-16 text-center text-muted-foreground">
                {search ? tp("list.emptySearch") : tp("list.empty")}
              </CardContent>
            </Card>
          ) : (
            <Card className="pt-2">
              <CardContent>
                {/* data-tour="orgs-misc-partners-table": admin-tour anchor (orgs-misc area). */}
                <div className="overflow-x-auto" data-tour="orgs-misc-partners-table">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{tp("list.colName")}</TableHead>
                        <TableHead>{tp("list.colSlug")}</TableHead>
                        <TableHead>{tp("list.colStatus")}</TableHead>
                        {/* data-tour="orgs-misc-partners-active-keys": admin-tour anchor (orgs-misc area). */}
                        <TableHead data-tour="orgs-misc-partners-active-keys">
                          <span className="inline-flex flex-wrap items-center">
                            {tp("list.colActiveKeys")}
                            <InfoTip id="partners.active_keys" className="ml-1" />
                          </span>
                        </TableHead>
                        <TableHead>{tp("list.colCreated")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {partners.map((p) => (
                        <TableRow key={p.partner_id}>
                          <TableCell className="font-medium">
                            <Link
                              href={`/a/partners/${p.slug}`}
                              className="hover:text-primary hover:underline"
                            >
                              {p.name}
                            </Link>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {p.slug}
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={p.status} />
                          </TableCell>
                          <TableCell>{p.active_key_count ?? 0}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {p.created_at ? p.created_at.slice(0, 10) : "-"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {totalPages > 1 && (
                  <div className="px-4 py-3 border-t flex flex-col sm:flex-row items-center justify-between gap-3">
                    <p className="text-xs text-muted-foreground">
                      {tp("list.showing", {
                        from: (page - 1) * ITEMS_PER_PAGE + 1,
                        to: Math.min(page * ITEMS_PER_PAGE, totalCount),
                        total: totalCount,
                      })}
                    </p>
                    {/* data-tour="orgs-misc-partners-pagination": admin-tour anchor (orgs-misc area). */}
                    <Pagination data-tour="orgs-misc-partners-pagination">
                      <PaginationContent>
                        <PaginationItem>
                          <PaginationPrevious
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                            aria-disabled={page === 1}
                            className={
                              page === 1
                                ? "pointer-events-none opacity-50"
                                : "cursor-pointer"
                            }
                          />
                        </PaginationItem>
                        {pageNumbers.map((p, idx) =>
                          p === "ellipsis" ? (
                            <PaginationItem key={`ellipsis-${idx}`}>
                              <PaginationEllipsis />
                            </PaginationItem>
                          ) : (
                            <PaginationItem key={p}>
                              <PaginationLink
                                isActive={page === p}
                                onClick={() => setPage(p as number)}
                                className="cursor-pointer"
                              >
                                {p}
                              </PaginationLink>
                            </PaginationItem>
                          ),
                        )}
                        <PaginationItem>
                          <PaginationNext
                            onClick={() =>
                              setPage((p) => Math.min(totalPages, p + 1))
                            }
                            aria-disabled={page === totalPages}
                            className={
                              page === totalPages
                                ? "pointer-events-none opacity-50"
                                : "cursor-pointer"
                            }
                          />
                        </PaginationItem>
                      </PaginationContent>
                    </Pagination>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── Sign in with AFC tab: the SSO partner applications (afc_sso). Whole
            surface lives in its own component so this file stays the Data API list. ── */}
        <TabsContent value="sso" className="mt-4">
          <SsoAppsPanel />
        </TabsContent>

        {/* ── Applications tab: organisations that applied at the public /partners/apply
            form (afc_partner_apply). Approving one provisions through the SAME path the
            two tabs above use, so an approved partner and a hand-typed one are the same
            kind of row. Whole surface lives in its own component. ── */}
        <TabsContent value="applications" className="mt-4">
          <PartnerApplicationsPanel />
        </TabsContent>

        {/* ── Site Feedback tab: what visitors sent through the always-on footer form
            (afc_feedback). Moved here from the standalone /a/feedback page (owner 2026-08-05);
            that route now redirects to ?tab=feedback. Whole surface lives in its own
            component, like the two tabs above. ── */}
        <TabsContent value="feedback" className="mt-4">
          <SiteFeedbackPanel />
        </TabsContent>
      </Tabs>

      {/* ── Create partner dialog (name + optional contact email) ── */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tp("list.createTitle")}</DialogTitle>
            <DialogDescription>{tp("list.createDescription")}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="partner-name">{tp("list.nameLabel")}</Label>
              <Input
                id="partner-name"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                placeholder={tp("list.namePlaceholder")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="partner-email">
                {tp("list.emailLabel")}{" "}
                <span className="text-muted-foreground">{tp("optional")}</span>
                <InfoTip id="partners.contact_email" className="ml-1" />
              </Label>
              <Input
                id="partner-email"
                type="email"
                value={createEmail}
                onChange={(e) => setCreateEmail(e.target.value)}
                placeholder={tp("list.emailPlaceholder")}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              {tc("cancel")}
            </Button>
            <Button disabled={!createReady || creating} onClick={handleCreate}>
              {creating ? tp("list.creating") : tp("list.create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
