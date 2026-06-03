"use client";

// ── Admin · Partners list ────────────────────────────────────────────────────
// Head-admin / partner-admin view of EVERY data-API partner (afc_partner_api admin
// API). A Partner is an AFC-approved external consumer of completed/published
// tournament data; this list is the entry point into managing one. Mirrors the
// admin Organizations list idiom (app/(a)/a/organizations/page.tsx): search box +
// shadcn Table + the shared Pagination component, plus a "Create partner" dialog.
// Paginates SERVER-side via partnersApi.listPartners({ search, limit, offset })
// because that endpoint already returns { results, total_count, has_more }.
// Each row links to /a/partners/[slug] for the scope/toggles/keys detail view.

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
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
import { ITEMS_PER_PAGE } from "@/constants";
import { IconPlus, IconSearch, IconX } from "@tabler/icons-react";
import { partnersApi, type PartnerSummary } from "@/lib/partners";
import { InfoTip } from "@/components/ui/info-tip";

// Shared status pill — outline badge whose border/text colour tracks the partner
// status (active = green, suspended = orange, anything else = neutral). Same idiom
// as the Organizations list's StatusBadge so the two admin surfaces read identically.
function StatusBadge({ status }: { status: string }) {
  if (status === "active")
    return (
      <Badge variant="outline" className="border-green-600/60 text-green-400">
        Active
      </Badge>
    );
  if (status === "suspended")
    return (
      <Badge variant="outline" className="border-orange-500/40 text-orange-400">
        Suspended
      </Badge>
    );
  return (
    <Badge variant="outline" className="capitalize">
      {status || "—"}
    </Badge>
  );
}

export default function PartnersAdminPage() {
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
      toast.error(err?.response?.data?.message || "Failed to load partners.");
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
      await partnersApi.createPartner({
        name: createName.trim(),
        contact_email: createEmail.trim() || undefined,
      });
      toast.success("Partner created.");
      // reset the form, close, and refresh the list from page 1
      setCreateName("");
      setCreateEmail("");
      setCreateOpen(false);
      setPage(1);
      fetchPartners();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to create partner.");
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

  // first load only — keep the table on-screen during search/page refetches
  if (loading && partners.length === 0) return <FullLoader />;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-1">
        <PageHeader
          // Wrap the title so the page-level ⓘ sits right after it (PageHeader takes a ReactNode).
          title={
            <span className="inline-flex items-center">
              Partners
              <InfoTip id="partners._page" className="ml-1.5" />
            </span>
          }
          description={`${totalCount} partner${totalCount !== 1 ? "s" : ""}`}
        />
        {/* ⓘ sits beside the create button (sibling, not nested). */}
        <div className="flex w-full items-center gap-1 md:w-auto">
          <Button className="w-full md:w-auto" onClick={() => setCreateOpen(true)}>
            <IconPlus />
            Create partner
          </Button>
          <InfoTip id="partners.create" />
        </div>
      </div>

      {/* Search — debounce-free; each keystroke triggers a server refetch via the
          fetchPartners dependency on `search` (matches the organizations search UX). */}
      <div className="relative">
        <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          placeholder="Search by name or slug..."
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
            {search
              ? "No partners match your search."
              : "No partners yet. Create one to get started."}
          </CardContent>
        </Card>
      ) : (
        <Card className="pt-2">
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Slug</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>
                      <span className="inline-flex items-center">
                        Active keys
                        <InfoTip id="partners.active_keys" className="ml-1" />
                      </span>
                    </TableHead>
                    <TableHead>Created</TableHead>
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
                        {p.created_at ? p.created_at.slice(0, 10) : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {totalPages > 1 && (
              <div className="px-4 py-3 border-t flex flex-col sm:flex-row items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground">
                  Showing {(page - 1) * ITEMS_PER_PAGE + 1}–
                  {Math.min(page * ITEMS_PER_PAGE, totalCount)} of {totalCount}
                </p>
                <Pagination>
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

      {/* ── Create partner dialog (name + optional contact email) ── */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create partner</DialogTitle>
            <DialogDescription>
              Provision a new data-API partner. It starts with every toggle off and
              no scope — grant access from its detail page after creating it.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="partner-name">Partner name</Label>
              <Input
                id="partner-name"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                placeholder="e.g. ESL"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="partner-email">
                Contact email{" "}
                <span className="text-muted-foreground">(optional)</span>
                <InfoTip id="partners.contact_email" className="ml-1" />
              </Label>
              <Input
                id="partner-email"
                type="email"
                value={createEmail}
                onChange={(e) => setCreateEmail(e.target.value)}
                placeholder="contact@partner.com"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button disabled={!createReady || creating} onClick={handleCreate}>
              {creating ? "Creating..." : "Create partner"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
