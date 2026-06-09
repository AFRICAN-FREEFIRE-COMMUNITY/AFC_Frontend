// ─────────────────────────────────────────────────────────────────────────────
// Vendor › Products (the vendor's own CATALOGUE).
//
// The vendor's self-serve product list — every product they own, in any approval
// state. Each row shows the product name, its lowest variant price, an approval
// status badge (draft / submitted / approved / rejected), and, on a rejected
// product, the AFC rejection reason so the vendor knows what to fix. Row actions:
//   • Edit               (draft / rejected only — the backend locks submitted/approved)
//   • Submit for approval (draft / rejected → submitted, into the AFC review queue)
// plus a top-right "Create product" button. An inline notice explains that AFC
// reviews every product before it goes live.
//
// DATA SOURCE — UNLIKE the orders queue (which the layout pre-loads via
// VendorContext), the product list is owned by THIS page: VendorContext only carries
// the fulfilment orders, so products are fetched here from GET /shop/vendor/products/
// (lib/vendor.ts::vendorProductApi.getMyProducts). load() doubles as the refetch the
// form dialog + the submit action call after a successful write. The page still sits
// inside the vendor gate (the layout's my-orders 200/403 check), so only a confirmed
// vendor ever reaches it.
//
// HOW IT CONNECTS
//   - lib/vendor.ts::vendorProductApi  → list / create / update / submit endpoints
//     (afc_shop/vendors.py cluster C, gated to the caller's own active Vendor).
//   - ./products/_components/ProductFormDialog → the create/edit form (multipart).
//   - ../_components/ApprovalBadge      → the approval-status pill (sibling of StateBadge).
//
// Design mirrors the vendor orders list (PageHeader, a single Card wrapping a Table,
// text-xs rows, outline rounded-full badges) per AFC constants. Toasts via sonner.
// NO em/en dashes in any copy.
// ─────────────────────────────────────────────────────────────────────────────

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FullLoader } from "@/components/Loader";
import {
  IconAlertTriangle,
  IconInfoCircle,
  IconPencil,
  IconPlus,
  IconSearch,
  IconSend,
  IconShoppingBag,
} from "@tabler/icons-react";
import { vendorProductApi, VendorProduct } from "@/lib/vendor";
import { ApprovalBadge } from "../_components/ApprovalBadge";
import { ProductFormDialog } from "./_components/ProductFormDialog";

// The approval-status options the filter dropdown offers. "all" is the default.
const STATUS_FILTERS: { value: string; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "draft", label: "Draft" },
  { value: "submitted", label: "Submitted" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
];

// Lowest active variant price, shown in the row as a "from $X" summary. Prices come
// back as decimal strings, so we parse to compare and re-format to 2 decimals.
function fromPrice(product: VendorProduct): string {
  const prices = product.variants
    .map((v) => Number(v.price))
    .filter((n) => !Number.isNaN(n));
  if (prices.length === 0) return "-";
  return `$${Math.min(...prices).toFixed(2)}`;
}

export default function VendorProductsPage() {
  const [products, setProducts] = useState<VendorProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Per-product in-flight flag for the Submit action (disables that row's button).
  const [submittingId, setSubmittingId] = useState<number | null>(null);

  // Dialog state: which mode + which product is being edited.
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [editingProduct, setEditingProduct] = useState<VendorProduct | null>(
    null,
  );

  // ── Load the caller-vendor's products ──
  // Doubles as the refetch the dialog + submit action call after a write.
  const load = useCallback(async () => {
    try {
      const res = await vendorProductApi.getMyProducts();
      setProducts(res.products ?? []);
      setLoadError(false);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // ── Client-side filter over the loaded list ──
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      if (statusFilter !== "all" && p.approval_status !== statusFilter)
        return false;
      if (!q) return true;
      const haystack = [p.name, p.type, ...p.variants.map((v) => v.sku)]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [products, search, statusFilter]);

  // ── Open the create / edit dialog ──
  const openCreate = () => {
    setDialogMode("create");
    setEditingProduct(null);
    setDialogOpen(true);
  };
  const openEdit = (product: VendorProduct) => {
    setDialogMode("edit");
    setEditingProduct(product);
    setDialogOpen(true);
  };

  // ── Submit a draft/rejected product for AFC approval ──
  const handleSubmit = async (product: VendorProduct) => {
    setSubmittingId(product.id);
    try {
      await vendorProductApi.submitProduct(product.id);
      toast.success("Product submitted for approval.");
      await load();
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message || "Could not submit the product.",
      );
    } finally {
      setSubmittingId(null);
    }
  };

  // After a create/edit save: refresh the list. A newly created (or edited) product
  // is still a draft/rejected, so we leave it to the vendor to submit from the row.
  const handleSaved = async () => {
    await load();
  };

  if (loading) {
    return <FullLoader text="Loading your products..." />;
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Products"
        description="Your product catalogue. Create a product, then submit it for AFC approval to go live."
        action={
          <Button onClick={openCreate} className="w-full md:w-auto">
            <IconPlus className="size-4" />
            Create product
          </Button>
        }
      />

      {/* AFC reviews every product before it reaches buyers. */}
      <div className="flex items-start gap-2 rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-muted-foreground">
        <IconInfoCircle className="mt-0.5 size-4 shrink-0 text-primary" />
        <p>
          AFC reviews every product before it goes live. A product starts as a
          draft, and only appears in the shop once you submit it and AFC approves
          it. If a product is rejected, you will see the reason here so you can fix
          it and submit again.
        </p>
      </div>

      {/* Filters: search + approval status. */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, category, or SKU"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-56">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_FILTERS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader className="border-b">
          <CardTitle>Your Products</CardTitle>
        </CardHeader>
        <CardContent>
          {loadError ? (
            // ── Load failed (network / server). Offer a retry. ──
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <div className="flex size-12 items-center justify-center rounded-md bg-muted text-muted-foreground">
                <IconAlertTriangle className="size-6" />
              </div>
              <p className="text-sm text-muted-foreground">
                We could not load your products. Please try again.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setLoading(true);
                  load();
                }}
              >
                Retry
              </Button>
            </div>
          ) : products.length === 0 ? (
            // ── Empty state ── no products yet. ──
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <div className="flex size-12 items-center justify-center rounded-md bg-primary/10 text-primary">
                <IconShoppingBag className="size-6" />
              </div>
              <p className="text-sm text-muted-foreground">
                You have no products yet. Create your first one to get started.
              </p>
              <Button onClick={openCreate} size="sm">
                <IconPlus className="size-4" />
                Create product
              </Button>
            </div>
          ) : filtered.length === 0 ? (
            // ── No rows match the current search/filter. ──
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <p className="text-sm text-muted-foreground">
                No products match your search.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Variants</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((product) => {
                  // Edit + Submit are only valid while a product is draft/rejected.
                  const editable =
                    product.approval_status === "draft" ||
                    product.approval_status === "rejected";
                  return (
                    <TableRow key={product.id}>
                      <TableCell className="font-medium">
                        {product.name}
                        {/* Rejected → show the AFC reason inline so the vendor
                            knows exactly what to fix before re-submitting. */}
                        {product.approval_status === "rejected" &&
                          product.rejection_reason && (
                            <div className="mt-1 flex items-start gap-1 text-xs text-red-600">
                              <IconAlertTriangle className="mt-0.5 size-3 shrink-0" />
                              <span>{product.rejection_reason}</span>
                            </div>
                          )}
                      </TableCell>
                      <TableCell className="capitalize text-muted-foreground">
                        {product.type || "-"}
                      </TableCell>
                      <TableCell>{fromPrice(product)}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {product.variants.length}
                      </TableCell>
                      <TableCell>
                        <ApprovalBadge status={product.approval_status} />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-2">
                          {editable && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openEdit(product)}
                            >
                              <IconPencil className="size-4" />
                              Edit
                            </Button>
                          )}
                          {editable && (
                            <Button
                              size="sm"
                              onClick={() => handleSubmit(product)}
                              disabled={submittingId === product.id}
                            >
                              <IconSend className="size-4" />
                              {submittingId === product.id
                                ? "Submitting..."
                                : "Submit for approval"}
                            </Button>
                          )}
                          {/* submitted / approved have no vendor action. */}
                          {!editable && (
                            <span className="text-xs text-muted-foreground">
                              {product.approval_status === "submitted"
                                ? "Awaiting AFC review"
                                : "Live"}
                            </span>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Shared create / edit dialog. */}
      <ProductFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        mode={dialogMode}
        product={editingProduct}
        onSaved={handleSaved}
      />
    </div>
  );
}
