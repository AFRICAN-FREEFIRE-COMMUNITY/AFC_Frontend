"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Admin Shop — Product Approvals  (route: /a/shop/approvals)
//
// Purpose: the AFC admin queue for vendor-submitted products. A vendor product is
// hidden from the storefront until an admin approves it here. This page lets a shop
// admin:
//   • see every SUBMITTED product (name, vendor, price, submitted date) in one queue
//                                                  ← marketplaceAdminApi.listPendingProducts
//   • approve a product (submitted -> approved; it can then go live)
//                                                  ← marketplaceAdminApi.approveProduct
//   • reject a product WITH a reason (submitted -> rejected; the reason is shown back
//     to the vendor, who may fix and re-submit)    ← marketplaceAdminApi.rejectProduct
//
// AUTH: all three calls are require_admin server-side (Bearer token, role == "admin").
// The token is read from the auth_token cookie inside lib/marketplaceAdmin.ts.
//
// CONNECTS TO:
//   • lib/marketplaceAdmin.ts  → the typed client wrapping afc_shop/vendors.py
//     cluster B (admin_list_pending_products / admin_approve_product /
//     admin_reject_product).
//   • /a/shop                  → linked FROM the Admin Shop dashboard ("Product
//     Approvals" card). PageHeader `back` returns there.
//   • /a/shop/vendors          → the sibling marketplace surface (vendor roster).
//
// PRICE display: a product can carry several variants, each with its own price. We
// show the price RANGE (min–max, or the single price) computed from the variants in
// the serialised payload, since the queue is a quick scan not a full editor.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PageHeader } from "@/components/PageHeader";
import { Loader } from "@/components/Loader";
import { Loader2 } from "lucide-react";
import { IconCheck, IconEye, IconX } from "@tabler/icons-react";

import { useAuth } from "@/contexts/AuthContext";
import { formatDate, formatMoneyInput } from "@/lib/utils";
import {
  PendingProduct,
  PendingProductMedia,
  ProductApprovalStatus,
  marketplaceAdminApi,
} from "@/lib/marketplaceAdmin";

// The status tabs on this page. BUGFIX (2026-06-10): the page used to show ONLY the
// pending (submitted) queue, so once an admin approved a product it vanished and there
// was no way to see it was accepted or by whom. These tabs let the admin switch the
// ?status= filter so Approved (with approved_by/approved_at) and Rejected (with
// rejection_reason) are visible too. Values mirror the backend ProductApprovalStatus.
const STATUS_TABS: { value: ProductApprovalStatus; label: string }[] = [
  { value: "submitted", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
];

// Build a human price label from a product's variants. The backend serialises each
// variant price as a decimal STRING; we parse, drop empties, and show a single price
// or a min to max style range (rendered with " to " so there's no en dash in copy).
function priceLabel(product: PendingProduct): string {
  const prices = (product.variants || [])
    .map((v) => parseFloat(v.price))
    .filter((n) => !Number.isNaN(n));
  if (prices.length === 0) return "-";
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  if (min === max) return formatMoneyInput(min);
  return `${formatMoneyInput(min)} to ${formatMoneyInput(max)}`;
}

// Resolve the media gallery the detail modal renders, ordered for display.
//
// The backend already orders `media` by `ordering` then id, but we sort defensively
// here (the modal is the only place a wrong order would show). When a product has no
// `media` rows yet (older products predate the gallery), we fall back to the single
// primary `image` so there is still something to show. Returns [] only when both the
// gallery and the primary image are empty, which the modal renders as a "No media"
// placeholder. Consumed solely by the detail Dialog below.
function galleryFor(product: PendingProduct): PendingProductMedia[] {
  const media = [...(product.media || [])]
    .filter((m) => !!m.url)
    .sort((a, b) => a.ordering - b.ordering);
  if (media.length > 0) return media;
  // Fallback: synthesise a single image entry from the primary `image`.
  if (product.image) {
    return [{ id: -1, url: product.image, media_type: "image", ordering: 0 }];
  }
  return [];
}

export default function ProductApprovalsPage() {
  const { token } = useAuth();

  // ── Queue state ──
  const [products, setProducts] = useState<PendingProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  // Which approval state is shown. Drives the ?status= filter on the fetch below.
  // "submitted" is the default (the original pending queue) for back-compat.
  const [activeStatus, setActiveStatus] =
    useState<ProductApprovalStatus>("submitted");

  // The product whose Approve action is in flight (spins just that row's button).
  const [approveBusyId, setApproveBusyId] = useState<number | null>(null);

  // ── Reject dialog state ──
  const [rejectTarget, setRejectTarget] = useState<PendingProduct | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejecting, setRejecting] = useState(false);

  // ── Detail modal state ──
  // The product whose full detail (gallery + description + variants) is open, or null
  // when the modal is closed. `detailMediaIndex` tracks which gallery item is in the
  // large frame so the thumbnail strip can drive it. Opened from the per-row "View"
  // button; the Approve/Reject buttons in its footer reuse the same handlers as the
  // table row (handleApprove / the reject-reason dialog).
  const [detailTarget, setDetailTarget] = useState<PendingProduct | null>(null);
  const [detailMediaIndex, setDetailMediaIndex] = useState(0);

  // Fetch products for the active status tab (submitted / approved / rejected). The
  // client reads the Bearer token from the cookie itself; we only gate on having a token
  // at all. Re-fetches whenever the tab changes so each tab shows its own slice.
  const fetchPending = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await marketplaceAdminApi.listPendingProducts(activeStatus);
      setProducts(data.products ?? []);
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to load the queue.");
      setProducts([]);
    } finally {
      setIsLoading(false);
    }
  }, [activeStatus]);

  useEffect(() => {
    if (token) fetchPending();
  }, [token, fetchPending]);

  // Open the detail modal for a product, resetting the gallery to its first item.
  // Shared by the per-row "View" button and the row-click affordance.
  const openDetail = (product: PendingProduct) => {
    setDetailTarget(product);
    setDetailMediaIndex(0);
  };

  // ── Approve ──
  const handleApprove = async (product: PendingProduct) => {
    try {
      setApproveBusyId(product.id);
      await marketplaceAdminApi.approveProduct(product.id);
      toast.success(`"${product.name}" approved.`);
      // Drop it from the queue locally (it leaves the "submitted" set on the backend).
      setProducts((prev) => prev.filter((p) => p.id !== product.id));
      // If the detail modal was showing this product, close it (it is no longer pending).
      setDetailTarget((cur) => (cur?.id === product.id ? null : cur));
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to approve product.");
    } finally {
      setApproveBusyId(null);
    }
  };

  // ── Reject (reason required) ──
  const handleReject = async () => {
    if (!rejectTarget) return;
    const reason = rejectReason.trim();
    if (!reason) {
      toast.error("A rejection reason is required.");
      return;
    }
    try {
      setRejecting(true);
      await marketplaceAdminApi.rejectProduct(rejectTarget.id, reason);
      toast.success(`"${rejectTarget.name}" rejected.`);
      setProducts((prev) => prev.filter((p) => p.id !== rejectTarget.id));
      // Close the detail modal too if it was open on the same product (the Reject in
      // the modal footer hands off to this dialog, so both can reference one product).
      setDetailTarget((cur) => (cur?.id === rejectTarget.id ? null : cur));
      setRejectTarget(null);
      setRejectReason("");
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to reject product.");
    } finally {
      setRejecting(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        back
        title="Product Approvals"
        description="Review products vendors have submitted. Approve to let them go live, or reject with a reason the vendor can act on. Use the tabs to see what was already approved (and by whom) or rejected."
      />

      {/* Status tabs: switch the ?status= filter between the pending queue and the
          already-decided products. Matches the pill/segment Tabs idiom the sibling shop
          orders page uses (Tabs + TabsList + TabsTrigger). */}
      <Tabs
        value={activeStatus}
        onValueChange={(v) => setActiveStatus(v as ProductApprovalStatus)}
      >
        <TabsList className="w-full justify-start overflow-x-auto">
          {STATUS_TABS.map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="flex-shrink-0"
            >
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <Card data-tour="shop-approvals-queue-table">
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader text="Loading products..." />
            </div>
          ) : products.length === 0 ? (
            <p
              className="py-16 text-center text-sm text-muted-foreground"
              data-tour="shop-approvals-empty-state"
            >
              {activeStatus === "submitted"
                ? "The approval queue is empty. Submitted vendor products will appear here."
                : activeStatus === "approved"
                  ? "No approved vendor products yet."
                  : "No rejected vendor products."}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-foreground">Product</TableHead>
                  <TableHead className="text-foreground">Vendor</TableHead>
                  <TableHead className="text-foreground">Price</TableHead>
                  <TableHead className="text-foreground">Variants</TableHead>
                  {/* The Details column is status-aware: Submitted date on the pending
                      tab, the approver + approval date on the approved tab, and the
                      rejection reason on the rejected tab. */}
                  <TableHead className="text-foreground">
                    {activeStatus === "approved"
                      ? "Approved by"
                      : activeStatus === "rejected"
                        ? "Reason"
                        : "Submitted"}
                  </TableHead>
                  <TableHead className="text-foreground text-right">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="text-xs">
                {products.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{product.name}</span>
                        {product.type && (
                          <span className="text-xs capitalize text-muted-foreground">
                            {product.type}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {product.vendor_name ? (
                        <Badge
                          variant="outline"
                          className="rounded-full border-blue-500 text-blue-600"
                        >
                          {product.vendor_name}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="font-semibold">
                      {priceLabel(product)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {product.variants?.length ?? 0}
                    </TableCell>
                    {/* Details cell, status-aware (see the matching header above). */}
                    <TableCell className="text-muted-foreground">
                      {activeStatus === "approved" ? (
                        // BUGFIX (2026-06-10): surface WHO approved + WHEN, the data the
                        // backend serialiser now returns (approved_by / approved_at).
                        <div className="flex flex-col">
                          <span className="font-medium text-foreground">
                            {product.approved_by || "Unknown"}
                          </span>
                          {product.approved_at && (
                            <span className="text-xs">
                              {formatDate(product.approved_at)}
                            </span>
                          )}
                        </div>
                      ) : activeStatus === "rejected" ? (
                        // Show the reason the vendor was given so an admin can review it.
                        <span className="whitespace-pre-line">
                          {product.rejection_reason?.trim() || "-"}
                        </span>
                      ) : product.submitted_at ? (
                        formatDate(product.submitted_at)
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {/* View: opens the full detail modal (gallery + description +
                            variants) so the admin can review before deciding. Available
                            on every tab. */}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openDetail(product)}
                          data-tour="shop-approvals-view-button"
                        >
                          <IconEye className="mr-1 h-4 w-4" /> View
                        </Button>
                        {/* Approve / Reject only make sense for a SUBMITTED product (the
                            backend rejects approving/rejecting anything else), so they
                            show only on the Pending tab. The Approved/Rejected tabs are
                            read-only history. */}
                        {activeStatus === "submitted" && (
                          <>
                            <Button
                              size="sm"
                              disabled={approveBusyId === product.id}
                              onClick={() => handleApprove(product)}
                              data-tour="shop-approvals-approve-button"
                            >
                              {approveBusyId === product.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <>
                                  <IconCheck className="mr-1 h-4 w-4" /> Approve
                                </>
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-destructive text-destructive hover:bg-destructive hover:text-white"
                              onClick={() => {
                                setRejectTarget(product);
                                setRejectReason("");
                              }}
                              data-tour="shop-approvals-reject-button"
                            >
                              <IconX className="mr-1 h-4 w-4" /> Reject
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* ── Detail modal ──────────────────────────────────────────────────────
          Opened by a row's "View" button (openDetail). Shows EVERYTHING the
          serialiser returns for a pending product: the media gallery (a large frame
          driven by a thumbnail strip), the name/type/vendor/category/description, and
          a full variants table. The footer's Approve/Reject reuse the table's flow:
          Approve calls handleApprove (which closes this modal on success); Reject
          closes this modal and opens the existing reject-reason dialog so a reason is
          still mandatory. All data is already in `detailTarget`, so opening adds no
          fetch. */}
      <Dialog
        open={detailTarget !== null}
        onOpenChange={(o) => {
          if (!o) setDetailTarget(null);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          {detailTarget &&
            (() => {
              // Resolve the gallery once per render of the open modal.
              const gallery = galleryFor(detailTarget);
              // Clamp the active index in case the gallery is shorter than the stored
              // index (defensive; index resets to 0 on open).
              const activeIndex = Math.min(
                detailMediaIndex,
                Math.max(gallery.length - 1, 0),
              );
              const active = gallery[activeIndex];

              return (
                <>
                  <DialogHeader>
                    <DialogTitle className="text-primary">
                      {detailTarget.name}
                    </DialogTitle>
                    <DialogDescription>
                      Review the full product before approving. Submitted{" "}
                      {detailTarget.submitted_at
                        ? formatDate(detailTarget.submitted_at)
                        : "date unknown"}
                      .
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-4 py-2">
                    {/* ── Media gallery: large frame + thumbnail strip ── */}
                    {gallery.length > 0 ? (
                      <div className="space-y-2">
                        {/* Main frame: an <img> for images, a <video> for videos. */}
                        <div className="flex aspect-video w-full items-center justify-center overflow-hidden rounded-md border bg-muted">
                          {active.media_type === "video" ? (
                            <video
                              src={active.url ?? undefined}
                              controls
                              className="h-full w-full object-contain"
                            />
                          ) : (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={active.url ?? undefined}
                              alt={detailTarget.name}
                              className="h-full w-full object-contain"
                            />
                          )}
                        </div>

                        {/* Thumbnail strip: only when there is more than one item.
                            Each thumb selects which item fills the main frame. */}
                        {gallery.length > 1 && (
                          <div className="flex flex-wrap gap-2">
                            {gallery.map((m, i) => (
                              <button
                                key={m.id}
                                type="button"
                                onClick={() => setDetailMediaIndex(i)}
                                className={`relative h-14 w-14 overflow-hidden rounded-md border bg-muted transition ${
                                  i === activeIndex
                                    ? "border-primary ring-1 ring-primary"
                                    : "border-border hover:border-primary/60"
                                }`}
                                aria-label={`View media ${i + 1}`}
                              >
                                {m.media_type === "video" ? (
                                  // Video thumb: a muted preview frame stands in for
                                  // a poster image (the gallery has no separate poster).
                                  <video
                                    src={m.url ?? undefined}
                                    muted
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={m.url ?? undefined}
                                    alt=""
                                    className="h-full w-full object-cover"
                                  />
                                )}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      // No gallery and no primary image: muted placeholder.
                      <div className="flex aspect-video w-full items-center justify-center rounded-md border bg-muted text-sm text-muted-foreground">
                        No media
                      </div>
                    )}

                    {/* ── Product meta: type, vendor, category ── */}
                    <div className="flex flex-wrap items-center gap-2">
                      {detailTarget.type && (
                        <Badge
                          variant="outline"
                          className="rounded-full capitalize"
                        >
                          {detailTarget.type}
                        </Badge>
                      )}
                      {detailTarget.vendor_name && (
                        <Badge
                          variant="outline"
                          className="rounded-full border-blue-500 text-blue-600"
                        >
                          {detailTarget.vendor_name}
                        </Badge>
                      )}
                      {detailTarget.category?.name && (
                        <Badge
                          variant="outline"
                          className="rounded-full border-green-500 text-green-600"
                        >
                          {detailTarget.category.name}
                        </Badge>
                      )}
                    </div>

                    {/* ── Description ── */}
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-foreground">
                        Description
                      </p>
                      <p className="whitespace-pre-line text-sm text-muted-foreground">
                        {detailTarget.description?.trim()
                          ? detailTarget.description
                          : "No description provided."}
                      </p>
                    </div>

                    {/* ── Variants table: every variant, not just the count ── */}
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-foreground">
                        Variants ({detailTarget.variants?.length ?? 0})
                      </p>
                      {detailTarget.variants?.length ? (
                        <div className="rounded-md border">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="text-foreground">
                                  SKU
                                </TableHead>
                                <TableHead className="text-foreground">
                                  Title
                                </TableHead>
                                <TableHead className="text-foreground">
                                  Price
                                </TableHead>
                                <TableHead className="text-foreground">
                                  Diamonds
                                </TableHead>
                                <TableHead className="text-foreground">
                                  Stock
                                </TableHead>
                                <TableHead className="text-foreground">
                                  Active
                                </TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody className="text-xs">
                              {detailTarget.variants.map((v) => (
                                <TableRow key={v.id}>
                                  <TableCell className="font-mono text-muted-foreground">
                                    {v.sku || "-"}
                                  </TableCell>
                                  <TableCell>{v.title || "-"}</TableCell>
                                  <TableCell className="font-semibold">
                                    {Number.isNaN(parseFloat(v.price))
                                      ? "-"
                                      : formatMoneyInput(parseFloat(v.price))}
                                  </TableCell>
                                  <TableCell className="text-muted-foreground">
                                    {v.diamonds_amount ?? 0}
                                  </TableCell>
                                  <TableCell className="text-muted-foreground">
                                    {v.stock_qty ?? 0}
                                  </TableCell>
                                  <TableCell>
                                    <Badge
                                      variant="outline"
                                      className={
                                        v.is_active
                                          ? "rounded-full border-green-500 text-green-600"
                                          : "rounded-full border-orange-500 text-orange-600"
                                      }
                                    >
                                      {v.is_active ? "Active" : "Inactive"}
                                    </Badge>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          This product has no variants.
                        </p>
                      )}
                    </div>
                  </div>

                  {/* ── Footer: Approve + Reject, reusing the table's flow ──
                      Only a SUBMITTED product can be approved/rejected (the backend
                      enforces this), so the action buttons show only when viewing a
                      pending product. For an already-approved/rejected product the modal
                      is read-only review, so no footer actions are rendered. */}
                  {detailTarget.approval_status === "submitted" && (
                    <DialogFooter>
                      <Button
                        variant="outline"
                        className="border-destructive text-destructive hover:bg-destructive hover:text-white"
                        onClick={() => {
                          // Hand off to the existing reject-reason dialog. Close the
                          // detail modal first so only one dialog is open at a time.
                          const target = detailTarget;
                          setDetailTarget(null);
                          setRejectTarget(target);
                          setRejectReason("");
                        }}
                      >
                        <IconX className="mr-1 h-4 w-4" /> Reject
                      </Button>
                      <Button
                        disabled={approveBusyId === detailTarget.id}
                        onClick={() => handleApprove(detailTarget)}
                      >
                        {approveBusyId === detailTarget.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <IconCheck className="mr-1 h-4 w-4" /> Approve
                          </>
                        )}
                      </Button>
                    </DialogFooter>
                  )}
                </>
              );
            })()}
        </DialogContent>
      </Dialog>

      {/* Reject dialog: a reason is mandatory (the backend rejects an empty reason). */}
      <Dialog
        open={rejectTarget !== null}
        onOpenChange={(o) => {
          if (!o) {
            setRejectTarget(null);
            setRejectReason("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject product</DialogTitle>
            <DialogDescription>
              {rejectTarget
                ? `Tell the vendor why "${rejectTarget.name}" was rejected. They can fix it and re-submit.`
                : ""}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-2">
            <Label htmlFor="reject-reason">Reason</Label>
            <Textarea
              id="reject-reason"
              placeholder="e.g. The price does not match the diamond amount listed."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={4}
              data-tour="shop-approvals-reject-reason"
            />
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRejectTarget(null);
                setRejectReason("");
              }}
              disabled={rejecting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={rejecting}
            >
              {rejecting ? <Loader text="Rejecting..." /> : "Reject Product"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
