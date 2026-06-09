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
import { IconCheck, IconX } from "@tabler/icons-react";

import { useAuth } from "@/contexts/AuthContext";
import { formatDate, formatMoneyInput } from "@/lib/utils";
import {
  PendingProduct,
  marketplaceAdminApi,
} from "@/lib/marketplaceAdmin";

// Build a human price label from a product's variants. The backend serialises each
// variant price as a decimal STRING; we parse, drop empties, and show a single price
// or a min–max style range (rendered with " to " so there's no en dash in copy).
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

export default function ProductApprovalsPage() {
  const { token } = useAuth();

  // ── Queue state ──
  const [products, setProducts] = useState<PendingProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // The product whose Approve action is in flight (spins just that row's button).
  const [approveBusyId, setApproveBusyId] = useState<number | null>(null);

  // ── Reject dialog state ──
  const [rejectTarget, setRejectTarget] = useState<PendingProduct | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejecting, setRejecting] = useState(false);

  // Fetch the approval queue (submitted vendor products). The client reads the Bearer
  // token from the cookie itself; we only gate on having a token at all.
  const fetchPending = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await marketplaceAdminApi.listPendingProducts();
      setProducts(data.products ?? []);
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to load the queue.");
      setProducts([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (token) fetchPending();
  }, [token, fetchPending]);

  // ── Approve ──
  const handleApprove = async (product: PendingProduct) => {
    try {
      setApproveBusyId(product.id);
      await marketplaceAdminApi.approveProduct(product.id);
      toast.success(`"${product.name}" approved.`);
      // Drop it from the queue locally (it leaves the "submitted" set on the backend).
      setProducts((prev) => prev.filter((p) => p.id !== product.id));
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
        description="Review products vendors have submitted. Approve to let them go live, or reject with a reason the vendor can act on."
      />

      <Card data-tour="shop-approvals-queue-table">
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader text="Loading the approval queue..." />
            </div>
          ) : products.length === 0 ? (
            <p
              className="py-16 text-center text-sm text-muted-foreground"
              data-tour="shop-approvals-empty-state"
            >
              The approval queue is empty. Submitted vendor products will appear
              here.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-foreground">Product</TableHead>
                  <TableHead className="text-foreground">Vendor</TableHead>
                  <TableHead className="text-foreground">Price</TableHead>
                  <TableHead className="text-foreground">Variants</TableHead>
                  <TableHead className="text-foreground">Submitted</TableHead>
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
                    <TableCell className="text-muted-foreground">
                      {product.submitted_at
                        ? formatDate(product.submitted_at)
                        : "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
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
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

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
