"use client";

// ── Admin · Organizations list ───────────────────────────────────────────────
// Head-admin view of EVERY organization (afc_organizers admin API). Mirrors the
// admin sponsors/teams table idiom: search box + shadcn Table + the shared
// Pagination component, plus a "Create organization" dialog (mirrors the teams
// page's create-ghost dialog). Unlike the sponsors page — which paginates a
// fully-loaded array client-side — this list paginates SERVER-side via the
// organizersApi.adminListOrganizations({ search, limit, offset }) endpoint,
// because that endpoint already returns { results, total_count, has_more }.
// Each row links to /a/organizations/[slug] for the detail/edit view.

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
import { Textarea } from "@/components/ui/textarea";
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
import { organizersApi } from "@/lib/organizers";
import { InfoTip } from "@/components/ui/info-tip";

// Row shape returned by adminListOrganizations (afc_organizers admin serializer).
interface OrgRow {
  organization_id: number;
  slug: string;
  name: string;
  status: string;
  email: string | null;
  member_count: number;
  event_count: number;
  created_at: string;
}

// Shared status pill — outline badge whose border/text colour tracks the org
// status (active = green, suspended = orange, anything else = neutral). Mirrors
// the tier-badge idiom on the teams page (variant="outline" + colour classes).
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

export default function OrganizationsAdminPage() {
  const [orgs, setOrgs] = useState<OrgRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  // ── Create-organization dialog state ──────────────────────────────────────
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createOwner, setCreateOwner] = useState("");
  const [createEmail, setCreateEmail] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [creating, setCreating] = useState(false);

  // org needs a name + an owner username; email/description are optional.
  const createReady =
    createName.trim().length > 0 && createOwner.trim().length > 0;

  // ── Server-side fetch (search + limit/offset paging) ──────────────────────
  // page is 1-indexed; offset = (page - 1) * ITEMS_PER_PAGE. The endpoint hands
  // back { results, total_count, has_more } so we drive paging off total_count.
  const fetchOrgs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await organizersApi.adminListOrganizations({
        search: search.trim() || undefined,
        limit: ITEMS_PER_PAGE,
        offset: (page - 1) * ITEMS_PER_PAGE,
      });
      setOrgs(res?.results ?? []);
      setTotalCount(res?.total_count ?? 0);
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message || "Failed to load organizations.",
      );
    } finally {
      setLoading(false);
    }
  }, [search, page]);

  useEffect(() => {
    fetchOrgs();
  }, [fetchOrgs]);

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
      await organizersApi.adminCreateOrganization({
        name: createName.trim(),
        owner_username: createOwner.trim(),
        email: createEmail.trim() || undefined,
        description: createDescription.trim() || undefined,
      });
      toast.success("Organization created.");
      // reset the form, close, and refresh the list from page 1
      setCreateName("");
      setCreateOwner("");
      setCreateEmail("");
      setCreateDescription("");
      setCreateOpen(false);
      setPage(1);
      fetchOrgs();
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message || "Failed to create organization.",
      );
    } finally {
      setCreating(false);
    }
  };

  // page-number list for the Pagination control (1 … current±1 … last).
  const pageNumbers = useMemo(
    () =>
      Array.from({ length: totalPages }, (_, i) => i + 1)
        .filter(
          (p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1,
        )
        .reduce<(number | "ellipsis")[]>((acc, p, idx, arr) => {
          if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push("ellipsis");
          acc.push(p);
          return acc;
        }, []),
    [totalPages, page],
  );

  // first load only — keep the table on-screen during search/page refetches
  if (loading && orgs.length === 0) return <FullLoader />;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-1">
        <PageHeader
          // Wrap the title so the page-level ⓘ sits right after it (PageHeader takes a ReactNode).
          title={
            <span className="inline-flex items-center">
              Organizations
              <InfoTip id="organizations._page" className="ml-1.5" />
            </span>
          }
          description={`${totalCount} organization${totalCount !== 1 ? "s" : ""}`}
        />
        {/* ⓘ sits beside the create button (sibling, not nested). */}
        <div className="flex w-full items-center gap-1 md:w-auto">
          <Button className="w-full md:w-auto" onClick={() => setCreateOpen(true)}>
            <IconPlus />
            Create organization
          </Button>
          <InfoTip id="organizations.create" />
        </div>
      </div>

      {/* Search — debounce-free; each keystroke triggers a server refetch via
          the fetchOrgs dependency on `search` (matches the sponsors search UX). */}
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

      {orgs.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            {search
              ? "No organizations match your search."
              : "No organizations yet. Create one to get started."}
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
                    <TableHead>Email</TableHead>
                    <TableHead>Members</TableHead>
                    <TableHead>Events</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orgs.map((org) => (
                    // whole row links to the detail page (asChild Link wraps the
                    // name cell so the slug stays the click target screen-readers
                    // announce; the rest of the row inherits hover affordance).
                    <TableRow key={org.organization_id}>
                      <TableCell className="font-medium">
                        <Link
                          href={`/a/organizations/${org.slug}`}
                          className="hover:text-primary hover:underline"
                        >
                          {org.name}
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {org.slug}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={org.status} />
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {org.email || "—"}
                      </TableCell>
                      <TableCell>{org.member_count ?? 0}</TableCell>
                      <TableCell>{org.event_count ?? 0}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {org.created_at ? org.created_at.slice(0, 10) : "—"}
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

      {/* ── Create organization dialog (name + owner_username + email? + desc?) ── */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create organization</DialogTitle>
            <DialogDescription>
              Spin up a new organization and assign its owner. The owner gets all
              organizer permissions by default.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="org-name">Organization name</Label>
              <Input
                id="org-name"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                placeholder="e.g. Apex Esports"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="org-owner">
                Owner username
                <InfoTip id="organizations.owner_username" className="ml-1" />
              </Label>
              <Input
                id="org-owner"
                value={createOwner}
                onChange={(e) => setCreateOwner(e.target.value)}
                placeholder="Existing user to own this org"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="org-email">
                Email <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="org-email"
                type="email"
                value={createEmail}
                onChange={(e) => setCreateEmail(e.target.value)}
                placeholder="contact@org.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="org-description">
                Description{" "}
                <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Textarea
                id="org-description"
                value={createDescription}
                onChange={(e) => setCreateDescription(e.target.value)}
                placeholder="Short description of the organization"
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button disabled={!createReady || creating} onClick={handleCreate}>
              {creating ? "Creating..." : "Create organization"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
