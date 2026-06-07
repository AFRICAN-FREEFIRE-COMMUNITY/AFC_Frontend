"use client";

// ─────────────────────────────────────────────────────────────────────────────
// ManageCategoriesModal  (admin)
//
// Purpose:
//   The admin surface to ADD / EDIT / REMOVE product categories. This is what
//   generalises the shop past the old hard-coded ["diamonds"] list: every
//   category created here becomes (a) a filing option in the Add/Edit Product
//   forms and (b) a tab on the user shop (when active).
//
// How it connects:
//   - Reads/writes via lib/shopCategories.ts (view-all-categories + the
//     create/edit/delete category endpoints, all admin-gated).
//   - Rendered from the inventory page header next to "Add Product".
//   - `onChanged` lets the parent refresh anything that depends on categories
//     (e.g. the product type Select cache) after a change.
//   - Delete is blocked server-side when products still reference the category;
//     the returned message is surfaced as a toast.
//
// Design: shadcn Dialog + Table (text-xs density, h-10 header rows, outline
// rounded-full badges), sonner toasts. No em/en dashes in any copy.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Loader } from "@/components/Loader";
import {
  IconCategoryPlus,
  IconPencil,
  IconTrash,
  IconX,
  IconCheck,
} from "@tabler/icons-react";
import { Loader2 } from "lucide-react";
import {
  ShopCategory,
  fetchAllCategories,
  createCategory,
  editCategory,
  deleteCategory,
} from "@/lib/shopCategories";

interface ManageCategoriesModalProps {
  // called after any category create/edit/delete so the parent can refresh
  onChanged?: () => void;
}

// Empty draft for the "Add category" row.
const emptyDraft = {
  name: "",
  is_physical: true,
  is_active: true,
  ordering: 0,
};

export function ManageCategoriesModal({
  onChanged,
}: ManageCategoriesModalProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<ShopCategory[]>([]);
  const [isPending, startTransition] = useTransition();

  // new category draft
  const [draft, setDraft] = useState({ ...emptyDraft });

  // inline edit state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState({ ...emptyDraft });
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      const cats = await fetchAllCategories();
      setCategories(cats);
    } catch (error: any) {
      toast.error(
        error.response?.data?.message || "Failed to load categories",
      );
    } finally {
      setLoading(false);
    }
  };

  // load categories whenever the modal opens
  useEffect(() => {
    if (open) load();
  }, [open]);

  const refresh = () => {
    load();
    onChanged?.();
  };

  const handleCreate = () => {
    if (!draft.name.trim()) {
      toast.error("Enter a category name");
      return;
    }
    startTransition(async () => {
      try {
        await createCategory({
          name: draft.name.trim(),
          is_physical: draft.is_physical,
          is_active: draft.is_active,
          ordering: draft.ordering,
        });
        toast.success("Category created");
        setDraft({ ...emptyDraft });
        refresh();
      } catch (error: any) {
        toast.error(
          error.response?.data?.message || "Failed to create category",
        );
      }
    });
  };

  const startEdit = (cat: ShopCategory) => {
    setEditingId(cat.id);
    setEditDraft({
      name: cat.name,
      is_physical: cat.is_physical,
      is_active: cat.is_active,
      ordering: cat.ordering,
    });
  };

  const saveEdit = (categoryId: number) => {
    if (!editDraft.name.trim()) {
      toast.error("Name cannot be empty");
      return;
    }
    startTransition(async () => {
      try {
        await editCategory(categoryId, {
          name: editDraft.name.trim(),
          is_physical: editDraft.is_physical,
          is_active: editDraft.is_active,
          ordering: editDraft.ordering,
        });
        toast.success("Category updated");
        setEditingId(null);
        refresh();
      } catch (error: any) {
        toast.error(
          error.response?.data?.message || "Failed to update category",
        );
      }
    });
  };

  const handleDelete = async (categoryId: number) => {
    try {
      setDeletingId(categoryId);
      await deleteCategory(categoryId);
      toast.success("Category deleted");
      refresh();
    } catch (error: any) {
      // Server blocks deletion when products still reference the category.
      toast.error(error.response?.data?.message || "Failed to delete category");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <IconCategoryPlus />
          Manage Categories
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manage Categories</DialogTitle>
          <DialogDescription>
            Add, edit, or remove the categories products are filed under. Active
            categories appear as tabs on the user shop.
          </DialogDescription>
        </DialogHeader>

        {/* ── Add category row ── */}
        <div className="rounded-md border p-4 space-y-3">
          <h4 className="text-sm font-semibold">Add a category</h4>
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-3 items-end">
            <div className="space-y-1.5">
              <Label htmlFor="cat-name" className="text-xs">
                Name
              </Label>
              <Input
                id="cat-name"
                placeholder="e.g. Jerseys"
                value={draft.name}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, name: e.target.value }))
                }
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="cat-physical"
                checked={draft.is_physical}
                onCheckedChange={(v) =>
                  setDraft((d) => ({ ...d, is_physical: v }))
                }
              />
              <Label htmlFor="cat-physical" className="text-xs">
                Physical
              </Label>
            </div>
            <Button
              type="button"
              onClick={handleCreate}
              disabled={isPending}
            >
              {isPending ? <Loader text="Adding..." /> : "Add"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Physical categories collect a delivery address at checkout. Turn it
            off for digital goods like diamond topups.
          </p>
        </div>

        {/* ── Existing categories table ── */}
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Visible</TableHead>
                <TableHead>Products</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-6">
                    Loading categories...
                  </TableCell>
                </TableRow>
              ) : categories.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-6">
                    No categories yet. Add one above.
                  </TableCell>
                </TableRow>
              ) : (
                categories.map((cat) =>
                  editingId === cat.id ? (
                    // ── inline edit row ──
                    <TableRow key={cat.id}>
                      <TableCell>
                        <Input
                          value={editDraft.name}
                          onChange={(e) =>
                            setEditDraft((d) => ({
                              ...d,
                              name: e.target.value,
                            }))
                          }
                          className="h-8"
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <Switch
                            checked={editDraft.is_physical}
                            onCheckedChange={(v) =>
                              setEditDraft((d) => ({ ...d, is_physical: v }))
                            }
                          />
                          <span className="text-xs">
                            {editDraft.is_physical ? "Physical" : "Digital"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={editDraft.is_active}
                          onCheckedChange={(v) =>
                            setEditDraft((d) => ({ ...d, is_active: v }))
                          }
                        />
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {cat.product_count}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => saveEdit(cat.id)}
                            disabled={isPending}
                          >
                            <IconCheck className="text-primary" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => setEditingId(null)}
                          >
                            <IconX />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    // ── read row ──
                    <TableRow key={cat.id}>
                      <TableCell className="font-medium">{cat.name}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className="rounded-full px-2 py-0.5 text-xs"
                        >
                          {cat.is_physical ? "Physical" : "Digital"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {cat.is_active ? (
                          <Badge
                            variant="outline"
                            className="rounded-full px-2 py-0.5 text-xs text-primary border-primary/50"
                          >
                            Active
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="rounded-full px-2 py-0.5 text-xs text-muted-foreground"
                          >
                            Hidden
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {cat.product_count}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => startEdit(cat)}
                            aria-label="Edit category"
                          >
                            <IconPencil />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="text-destructive"
                            onClick={() => handleDelete(cat.id)}
                            disabled={deletingId === cat.id}
                            aria-label="Delete category"
                          >
                            {deletingId === cat.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <IconTrash />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ),
                )
              )}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
