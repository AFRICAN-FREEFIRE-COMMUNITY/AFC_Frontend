"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Admin Shop — Manage Vendors  (route: /a/shop/vendors)
//
// Purpose: the AFC admin surface for the marketplace vendor roster. Lets a shop
// admin:
//   • see every vendor (display name, contact email, WhatsApp, status, products,
//     created) in one table                       ← marketplaceAdminApi.listVendors
//   • grant vendor access to an EXISTING user (invite-only "Add vendor" dialog;
//     enter a user email or id + the seller's display name / contact / WhatsApp)
//                                                  ← marketplaceAdminApi.createVendor
//   • suspend or reactivate a vendor (one-click toggle, gated behind a confirm
//     dialog because it revokes selling + fulfilment access)
//                                                  ← marketplaceAdminApi.setVendorStatus
//   • re-home a product to a vendor (or clear it back to first-party AFC stock)
//     via the "Assign product" dialog              ← marketplaceAdminApi.assignProduct
//
// AUTH: all four calls are require_admin server-side (Bearer token, role == "admin").
// The token is read from the auth_token cookie inside lib/marketplaceAdmin.ts, so this
// page never threads it through props.
//
// CONNECTS TO:
//   • lib/marketplaceAdmin.ts  → the typed client wrapping afc_shop/vendors.py
//     cluster A (admin_create_vendor / admin_list_vendors / admin_set_vendor_status /
//     admin_assign_product_vendor).
//   • /a/shop                  → linked FROM the Admin Shop dashboard ("Manage Vendors"
//     card). PageHeader `back` returns there.
//   • /a/shop/approvals        → the sibling marketplace surface (product approval
//     queue). A vendor approved here can then have a product approved there.
//
// The product list for the "Assign product" dialog comes from the shop's existing
// admin endpoint GET /shop/view-all-products/ (every status) — the SAME source the
// inventory page uses — so we don't add a new endpoint just to pick a product.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { toast } from "sonner";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/PageHeader";
import { Loader } from "@/components/Loader";
import { IconCirclePlus, IconUsers } from "@tabler/icons-react";
import { Loader2 } from "lucide-react";

import { env } from "@/lib/env";
import { useAuth } from "@/contexts/AuthContext";
import { formatDate } from "@/lib/utils";
import {
  AdminVendor,
  marketplaceAdminApi,
} from "@/lib/marketplaceAdmin";

// Minimal shape we need from GET /shop/view-all-products/ to populate the
// "Assign product" dialog's Select (id + name + the current vendor, if any).
interface ProductLite {
  id: number;
  name: string;
  vendor_id?: number | null;
  vendor_name?: string | null;
}

export default function ManageVendorsPage() {
  const { token } = useAuth();

  // ── Vendor table state ──
  const [vendors, setVendors] = useState<AdminVendor[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // The vendor whose status is mid-flip (disables just that row's button + spins it).
  const [statusBusyId, setStatusBusyId] = useState<number | null>(null);

  // ── "Add vendor" dialog state (invite-only: link an existing user) ──
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    identifier: "", // user email OR numeric user id (we detect which below)
    display_name: "",
    contact_email: "",
    whatsapp_number: "",
  });

  // ── "Assign product to vendor" dialog state ──
  const [assignOpen, setAssignOpen] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [products, setProducts] = useState<ProductLite[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [assignProductId, setAssignProductId] = useState<string>("");
  // Vendor target for the assignment. "__none__" clears the link (first-party AFC).
  const [assignVendorId, setAssignVendorId] = useState<string>("");

  // Fetch the vendor roster (the table). marketplaceAdminApi reads the Bearer token
  // from the auth_token cookie itself, so we only gate on having a token at all.
  const fetchVendors = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await marketplaceAdminApi.listVendors();
      setVendors(data.vendors ?? []);
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to load vendors.");
      setVendors([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (token) fetchVendors();
  }, [token, fetchVendors]);

  // Lazy-load the product list only when the Assign dialog opens (it isn't needed for
  // the table). Reuses the admin "every status" product endpoint the inventory page
  // already calls, so no new backend surface is introduced.
  const loadProducts = useCallback(async () => {
    try {
      setProductsLoading(true);
      const res = await axios.get(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/shop/view-all-products/`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      // The endpoint returns { products: [...] }; we keep only the fields the Select needs.
      const list: ProductLite[] = (res.data.products ?? []).map((p: any) => ({
        id: p.id,
        name: p.name,
        vendor_id: p.vendor_id ?? null,
        vendor_name: p.vendor_name ?? null,
      }));
      setProducts(list);
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to load products.");
      setProducts([]);
    } finally {
      setProductsLoading(false);
    }
  }, [token]);

  // Active vendors are the only valid assignment targets (a suspended vendor cannot
  // sell), so the Assign dialog's vendor Select only lists active ones (plus "clear").
  const activeVendors = useMemo(
    () => vendors.filter((v) => v.status === "active"),
    [vendors],
  );

  // ── Create vendor (invite-only) ──
  // We accept either an email or a numeric id in one field and route it to the
  // matching backend key (email vs user_id), so the admin doesn't pick a mode.
  const handleCreate = async () => {
    const identifier = form.identifier.trim();
    const displayName = form.display_name.trim();
    if (!identifier) {
      toast.error("Enter the user's email or id to grant vendor access.");
      return;
    }
    if (!displayName) {
      toast.error("A display name is required.");
      return;
    }

    // A bare run of digits is treated as a user id; anything else is treated as email.
    const isNumericId = /^\d+$/.test(identifier);

    try {
      setCreating(true);
      await marketplaceAdminApi.createVendor({
        ...(isNumericId ? { user_id: identifier } : { email: identifier }),
        display_name: displayName,
        contact_email: form.contact_email.trim() || undefined,
        whatsapp_number: form.whatsapp_number.trim() || undefined,
      });
      toast.success("Vendor access granted.");
      setCreateOpen(false);
      setForm({
        identifier: "",
        display_name: "",
        contact_email: "",
        whatsapp_number: "",
      });
      fetchVendors();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to create vendor.");
    } finally {
      setCreating(false);
    }
  };

  // ── Suspend / reactivate ──
  const handleToggleStatus = async (vendor: AdminVendor) => {
    const next = vendor.status === "active" ? "suspended" : "active";
    try {
      setStatusBusyId(vendor.id);
      await marketplaceAdminApi.setVendorStatus(vendor.id, next);
      toast.success(
        next === "suspended" ? "Vendor suspended." : "Vendor reactivated.",
      );
      // Patch the row in place so the toggle reflects instantly without a full refetch.
      setVendors((prev) =>
        prev.map((v) => (v.id === vendor.id ? { ...v, status: next } : v)),
      );
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to update vendor.");
    } finally {
      setStatusBusyId(null);
    }
  };

  // ── Assign product to vendor (or clear back to first-party AFC stock) ──
  const handleAssign = async () => {
    if (!assignProductId) {
      toast.error("Pick a product to assign.");
      return;
    }
    // "__none__" is the explicit "clear vendor" sentinel; everything else is a vendor id.
    const vendorId =
      assignVendorId === "__none__" || assignVendorId === ""
        ? null
        : Number(assignVendorId);
    try {
      setAssigning(true);
      await marketplaceAdminApi.assignProduct(Number(assignProductId), vendorId);
      toast.success(
        vendorId === null
          ? "Product cleared to first-party AFC stock."
          : "Product assigned to vendor.",
      );
      setAssignOpen(false);
      setAssignProductId("");
      setAssignVendorId("");
      fetchVendors(); // product_count on the affected vendor(s) may have changed
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to assign product.");
    } finally {
      setAssigning(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        back
        title="Manage Vendors"
        description="Grant marketplace selling access to existing users, suspend or reactivate vendors, and assign products to a vendor."
        action={
          <div className="flex flex-col sm:flex-row gap-2">
            {/* Assign product to vendor */}
            <Dialog
              open={assignOpen}
              onOpenChange={(o) => {
                setAssignOpen(o);
                if (o && products.length === 0) loadProducts();
              }}
            >
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full sm:w-auto"
                  data-tour="shop-vendors-assign-product"
                >
                  <IconUsers className="mr-2 h-4 w-4" /> Assign Product
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Assign a product to a vendor</DialogTitle>
                  <DialogDescription>
                    Set which vendor owns a product, or clear it back to
                    first-party AFC stock. This only changes ownership, not the
                    product&apos;s approval state.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2">
                  <div className="space-y-2">
                    <Label>Product</Label>
                    <Select
                      value={assignProductId}
                      onValueChange={setAssignProductId}
                      disabled={productsLoading}
                    >
                      <SelectTrigger>
                        <SelectValue
                          placeholder={
                            productsLoading
                              ? "Loading products..."
                              : "Select a product"
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {products.map((p) => (
                          <SelectItem key={p.id} value={String(p.id)}>
                            {p.name}
                            {p.vendor_name ? ` (now: ${p.vendor_name})` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Vendor</Label>
                    <Select
                      value={assignVendorId}
                      onValueChange={setAssignVendorId}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a vendor" />
                      </SelectTrigger>
                      <SelectContent>
                        {/* Sentinel that clears the link (first-party AFC stock). */}
                        <SelectItem value="__none__">
                          None (first-party AFC stock)
                        </SelectItem>
                        {activeVendors.map((v) => (
                          <SelectItem key={v.id} value={String(v.id)}>
                            {v.display_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setAssignOpen(false)}
                    disabled={assigning}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleAssign} disabled={assigning}>
                    {assigning ? <Loader text="Assigning..." /> : "Assign"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Add (invite) vendor */}
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button className="w-full sm:w-auto" data-tour="shop-vendors-add">
                  <IconCirclePlus className="mr-2 h-4 w-4" /> Add Vendor
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add a vendor</DialogTitle>
                  <DialogDescription>
                    Invite-only: enter the email or id of an existing AFC user to
                    grant them marketplace selling access.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2">
                  <div className="space-y-2">
                    <Label htmlFor="vendor-identifier">User email or id</Label>
                    <Input
                      id="vendor-identifier"
                      placeholder="seller@example.com"
                      value={form.identifier}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, identifier: e.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="vendor-display-name">Display name</Label>
                    <Input
                      id="vendor-display-name"
                      placeholder="Acme Diamonds"
                      value={form.display_name}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, display_name: e.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="vendor-contact-email">
                      Contact email (optional)
                    </Label>
                    <Input
                      id="vendor-contact-email"
                      placeholder="support@acme.com"
                      value={form.contact_email}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          contact_email: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="vendor-whatsapp">
                      WhatsApp number (optional)
                    </Label>
                    <Input
                      id="vendor-whatsapp"
                      placeholder="+234..."
                      value={form.whatsapp_number}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          whatsapp_number: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>

                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setCreateOpen(false)}
                    disabled={creating}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleCreate} disabled={creating}>
                    {creating ? <Loader text="Granting..." /> : "Grant Access"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      <Card data-tour="shop-vendors-table">
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader text="Loading vendors..." />
            </div>
          ) : vendors.length === 0 ? (
            <p className="py-16 text-center text-sm text-muted-foreground">
              No vendors yet. Use &quot;Add Vendor&quot; to grant selling access
              to an existing user.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-foreground">Vendor</TableHead>
                  <TableHead className="text-foreground">Contact email</TableHead>
                  <TableHead className="text-foreground">WhatsApp</TableHead>
                  <TableHead className="text-foreground">Products</TableHead>
                  <TableHead className="text-foreground">Status</TableHead>
                  <TableHead className="text-foreground">Created</TableHead>
                  <TableHead className="text-foreground text-right">
                    Action
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="text-xs">
                {vendors.map((vendor) => (
                  <TableRow key={vendor.id}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">
                          {vendor.display_name}
                        </span>
                        {vendor.username && (
                          <span className="text-xs text-muted-foreground">
                            @{vendor.username}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell
                      className="text-muted-foreground"
                      data-tour="shop-vendors-contact-info"
                    >
                      {vendor.contact_email || "-"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {vendor.whatsapp_number || "-"}
                    </TableCell>
                    <TableCell>{vendor.product_count}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          vendor.status === "active"
                            ? "rounded-full border-green-500 text-green-600"
                            : "rounded-full border-orange-500 text-orange-600"
                        }
                      >
                        {vendor.status === "active" ? "Active" : "Suspended"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(vendor.created_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant={
                          vendor.status === "active" ? "outline" : "default"
                        }
                        disabled={statusBusyId === vendor.id}
                        onClick={() => handleToggleStatus(vendor)}
                        data-tour="shop-vendors-status-toggle"
                      >
                        {statusBusyId === vendor.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : vendor.status === "active" ? (
                          "Suspend"
                        ) : (
                          "Reactivate"
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
