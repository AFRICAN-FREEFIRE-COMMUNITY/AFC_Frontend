// ─────────────────────────────────────────────────────────────────────────────
// ProductFormDialog — the shared CREATE / EDIT product form for the vendor PRODUCTS
// section. One dialog drives both flows (mode="create" | "edit") so a vendor adds
// and edits a product through an identical UI, mirroring the admin AddProductModal
// field idiom (name, category Select, description, limited-stock switch, an optional
// primary image, and a repeatable variants block of {title, sku, price, stock}).
//
// HOW IT CONNECTS
//   - Parent: app/(vendor)/vendor/products/page.tsx renders this. On a successful
//     save it calls onSaved(productId) so the page can refetch the list AND offer
//     "Submit for approval" on the freshly saved (still draft/rejected) product.
//   - Data layer: lib/vendor.ts::vendorProductApi.createProduct / updateProduct
//     (multipart; variants ride as a JSON string, image as a file). Those hit
//     POST /shop/vendor/products/create|update/ (afc_shop/vendors.py cluster C),
//     which force ownership to the caller's vendor + approval_status="draft".
//   - Categories: the product_type Select is populated from the live admin-managed
//     categories (lib/shopCategories.fetchActiveCategories), exactly like the admin
//     AddProductModal, with shopProductTypes as the empty-fetch fallback.
//   - Editing is only ever opened for a draft/rejected product (the page hides Edit
//     otherwise) because the backend rejects an edit on a submitted/approved product.
//
// AFC design: shadcn Dialog + Form, rounded-md cards via the variants block, text-xs
// helper copy, sonner toasts on save/fail. NO em/en dashes anywhere in copy.
// ─────────────────────────────────────────────────────────────────────────────

"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { IconPlus, IconTrash, IconPhotoPlus } from "@tabler/icons-react";

import {
  vendorProductApi,
  VendorProduct,
  VendorVariantInput,
} from "@/lib/vendor";
import {
  ShopCategoryLite,
  fetchActiveCategories,
} from "@/lib/shopCategories";
import {
  shopProductTypes,
  SHOP_MAX_IMAGE_BYTES,
} from "@/constants";

// One editable variant row in the form. On EDIT each existing variant carries its
// backend `id` so vendorProductApi.updateProduct can patch it in place; a brand-new
// row (or every row on CREATE) has no id. We keep prices/quantities as strings while
// editing (text inputs) and coerce only on submit.
interface VariantRow {
  id?: number;
  title: string;
  sku: string;
  price: string;
  stock_qty: string;
}

// An empty variant row (the form always shows at least one — the backend requires a
// non-empty variants list on create).
const emptyVariant = (): VariantRow => ({
  title: "",
  sku: "",
  price: "",
  stock_qty: "",
});

interface ProductFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // "create" → POST create; "edit" → POST update for the supplied product.
  mode: "create" | "edit";
  // The product being edited (mode="edit" only). Pre-fills the form.
  product?: VendorProduct | null;
  // Called after a successful save with the saved product's id, so the parent can
  // refetch the list and (for a draft/rejected product) prompt to submit.
  onSaved: (productId: number) => void;
}

export function ProductFormDialog({
  open,
  onOpenChange,
  mode,
  product,
  onSaved,
}: ProductFormDialogProps) {
  // ── Form field state ──
  const [name, setName] = useState("");
  const [productType, setProductType] = useState("");
  const [description, setDescription] = useState("");
  const [isLimitedStock, setIsLimitedStock] = useState(false);
  const [variants, setVariants] = useState<VariantRow[]>([emptyVariant()]);
  const [image, setImage] = useState<File | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);

  // Live categories drive the product_type Select (same source as the admin form).
  const [categories, setCategories] = useState<ShopCategoryLite[]>([]);
  const categoryOptions =
    categories.length > 0
      ? categories.map((c) => ({ value: c.slug, label: c.name }))
      : shopProductTypes.map((t) => ({ value: t, label: t }));

  const [submitting, setSubmitting] = useState(false);

  // ── Prime the form whenever the dialog opens ──
  // CREATE → blank form (one empty variant). EDIT → mirror the product into the
  // fields. We also (re)fetch the categories so the Select is current.
  useEffect(() => {
    if (!open) return;

    // Load the category options (falls back to the constant on failure).
    (async () => {
      try {
        setCategories(await fetchActiveCategories());
      } catch {
        setCategories([]);
      }
    })();

    if (mode === "edit" && product) {
      setName(product.name);
      setProductType(product.type || "");
      setDescription(product.description || "");
      setIsLimitedStock(product.is_limited_stock);
      setImage(null); // only set if the vendor picks a replacement
      setVariants(
        product.variants.length > 0
          ? product.variants.map((v) => ({
              id: v.id,
              title: v.title || "",
              sku: v.sku || "",
              price: v.price ?? "",
              stock_qty: String(v.stock_qty ?? 0),
            }))
          : [emptyVariant()],
      );
    } else {
      // create (or edit with no product, which should not happen)
      setName("");
      setProductType("");
      setDescription("");
      setIsLimitedStock(false);
      setImage(null);
      setVariants([emptyVariant()]);
    }
  }, [open, mode, product]);

  // ── Variant row helpers ──
  const addVariant = () => setVariants((prev) => [...prev, emptyVariant()]);
  const removeVariant = (index: number) =>
    setVariants((prev) => prev.filter((_, i) => i !== index));
  const setVariantField = (
    index: number,
    field: keyof VariantRow,
    value: string,
  ) =>
    setVariants((prev) =>
      prev.map((v, i) => (i === index ? { ...v, [field]: value } : v)),
    );

  // ── Image pick (validate the 5 MB cap, mirroring the admin form) ──
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (imageInputRef.current) imageInputRef.current.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file.");
      return;
    }
    if (file.size > SHOP_MAX_IMAGE_BYTES) {
      toast.error(`${file.name}: image exceeds the 5 MB limit.`);
      return;
    }
    setImage(file);
  };

  // ── Save (create or update) ──
  const handleSave = async () => {
    // Minimal client validation, matching what the backend enforces (name +
    // product_type required; each variant needs a sku and a price).
    if (!name.trim()) {
      toast.error("Please enter a product name.");
      return;
    }
    if (!productType) {
      toast.error("Please choose a category.");
      return;
    }
    const cleaned = variants.filter((v) => v.sku.trim() || v.price.trim());
    if (cleaned.length === 0) {
      toast.error("Add at least one variant with a SKU and price.");
      return;
    }
    for (const v of cleaned) {
      if (!v.sku.trim() || v.price.trim() === "") {
        toast.error("Each variant needs a SKU and a price.");
        return;
      }
    }

    // Shape the variants for the API (coerce numerics; keep ids on edit).
    const variantPayload: VendorVariantInput[] = cleaned.map((v) => ({
      ...(v.id ? { id: v.id } : {}),
      sku: v.sku.trim(),
      title: v.title.trim(),
      price: v.price.trim(),
      stock_qty: Number(v.stock_qty || 0),
    }));

    setSubmitting(true);
    try {
      if (mode === "edit" && product) {
        await vendorProductApi.updateProduct({
          product_id: product.id,
          name: name.trim(),
          product_type: productType,
          description: description,
          is_limited_stock: isLimitedStock,
          variants: variantPayload,
          image: image,
        });
        toast.success("Product updated.");
        onSaved(product.id);
      } else {
        const res = await vendorProductApi.createProduct({
          name: name.trim(),
          product_type: productType,
          description: description,
          is_limited_stock: isLimitedStock,
          variants: variantPayload,
          image: image,
        });
        toast.success("Product created as a draft.");
        onSaved(res?.product_id);
      }
      onOpenChange(false);
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message || "Could not save the product.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === "edit" ? "Edit product" : "Create product"}
          </DialogTitle>
          <DialogDescription>
            {mode === "edit"
              ? "Update this product, then submit it for AFC approval when it is ready."
              : "Add a product to your catalogue. It starts as a draft. Submit it for AFC approval before it can go live."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* ── Base info ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="product-name">Product name</Label>
              <Input
                id="product-name"
                placeholder="Gaming Headset"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="product-category">Category</Label>
              <Select value={productType} onValueChange={setProductType}>
                <SelectTrigger id="product-category" className="w-full">
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  {categoryOptions.map((opt) => (
                    <SelectItem
                      key={opt.value}
                      value={opt.value}
                      className="capitalize"
                    >
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="product-description">Description</Label>
            <Textarea
              id="product-description"
              placeholder="Describe the product for buyers."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          <div className="flex items-center gap-2">
            <Switch
              id="product-limited"
              checked={isLimitedStock}
              onCheckedChange={setIsLimitedStock}
            />
            <Label htmlFor="product-limited" className="mt-0">
              Limited stock
            </Label>
          </div>

          {/* ── Primary image (optional) ── */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Primary image</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => imageInputRef.current?.click()}
              >
                <IconPhotoPlus className="size-4" />
                {mode === "edit" ? "Replace image" : "Add image"}
              </Button>
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageSelect}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Optional. One main image, up to 5 MB.
              {mode === "edit" && product?.image
                ? " Leave empty to keep the current image."
                : ""}
            </p>
            {image && (
              <p className="text-xs text-muted-foreground">
                Selected: {image.name}
              </p>
            )}
          </div>

          {/* ── Variants ── */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Variants</h3>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addVariant}
              >
                <IconPlus className="size-4" />
                Add variant
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Each variant is a buyable option with its own SKU and price (for
              example a size or a bundle). Add at least one.
            </p>

            {variants.map((v, index) => (
              <div
                key={index}
                className="relative rounded-md border p-4 space-y-4"
              >
                {variants.length > 1 && (
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute right-2 top-2 size-7"
                    onClick={() => removeVariant(index)}
                  >
                    <IconTrash className="size-4" />
                  </Button>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor={`variant-title-${index}`}>
                      Variant title
                    </Label>
                    <Input
                      id={`variant-title-${index}`}
                      placeholder="Standard"
                      value={v.title}
                      onChange={(e) =>
                        setVariantField(index, "title", e.target.value)
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`variant-sku-${index}`}>SKU</Label>
                    <Input
                      id={`variant-sku-${index}`}
                      placeholder="HEAD-STD"
                      value={v.sku}
                      onChange={(e) =>
                        setVariantField(index, "sku", e.target.value)
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`variant-price-${index}`}>Price ($)</Label>
                    <Input
                      id={`variant-price-${index}`}
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      value={v.price}
                      onChange={(e) =>
                        setVariantField(index, "price", e.target.value)
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`variant-stock-${index}`}>Stock qty</Label>
                    <Input
                      id={`variant-stock-${index}`}
                      type="number"
                      min="0"
                      placeholder="0"
                      value={v.stock_qty}
                      onChange={(e) =>
                        setVariantField(index, "stock_qty", e.target.value)
                      }
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} disabled={submitting}>
            {submitting
              ? "Saving..."
              : mode === "edit"
                ? "Save changes"
                : "Create product"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
