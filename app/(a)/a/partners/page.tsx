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
// The Data API tab below mirrors the admin Organizations list idiom
// (app/(a)/a/organizations/page.tsx): search box + shadcn Table + the shared
// Pagination component, plus a "Create partner" dialog. It paginates SERVER-side via
// partnersApi.listPartners({ search, limit, offset }) because that endpoint already
// returns { results, total_count, has_more }. Each row links to /a/partners/[slug]
// for the scope/toggles/keys detail view.

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

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

  // TWO translators on purpose:
  //   t  - the `ssoAdmin` namespace, which owns the two TAB labels. They were authored
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

  // Which partner program is on screen. Controlled state (not defaultValue) so the
  // header description can follow the active tab. "data" first: it is the older,
  // busier program and the anchors the admin tour walks live in it.
  const [tab, setTab] = useState("data");

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
  }, [search, page]);

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

  // first load only - keep the table on-screen during search/page refetches
  if (loading && partners.length === 0) return <FullLoader />;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        // Wrap the title so the page-level ⓘ sits right after it (PageHeader takes a ReactNode).
        // Heading reads "API Keys" (owner request 2026-06-09) to match the renamed
        // sidebar entry. It now covers BOTH partner programs (see the file header), so the
        // description follows the active tab rather than always counting data-API keys.
        title={
          <span className="inline-flex items-center">
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

      {/* Two programs and the queue that feeds both, on one page. Controlled value so the
          header description above can follow the tab; shadcn pill/segment style, per the
          AFC design constants. */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="w-full">
          <TabsTrigger value="data" className="w-full">
            {t("tabs.dataApi")}
          </TabsTrigger>
          <TabsTrigger value="sso" className="w-full">
            {t("tabs.sso")}
          </TabsTrigger>
          {/* Applications sits LAST because it is where a partner starts and the other two
              tabs are where one ends up: the owner reads this page left to right as the two
              products, then the inbox that provisions into them. */}
          <TabsTrigger value="applications" className="w-full">
            {ta("admin.tab")}
          </TabsTrigger>
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
                          <span className="inline-flex items-center">
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
