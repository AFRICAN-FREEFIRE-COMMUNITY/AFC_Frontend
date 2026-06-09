// ─────────────────────────────────────────────────────────────────────────────
// ProductFormDialog — the shared CREATE / EDIT product form for the vendor PRODUCTS
// section. One dialog drives both flows (mode="create" | "edit") so a vendor adds
// and edits a product through an identical UI, mirroring the admin AddProductModal
// field idiom (name, category Select, description, limited-stock switch, an optional
// primary image, a "Photos and videos" gallery, and a repeatable variants block of
// {title, sku, price, stock}).
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
// MULTI-MEDIA GALLERY (images + videos)
//   - Below the single primary `image` (the card thumbnail) we reuse the admin
//     ProductMediaManager (app/(a)/a/shop/_components/ProductMediaManager) for the
//     multi-image + video gallery, pointed at the VENDOR-gated media routes
//     (POST /shop/vendor/products/media/{add,delete}/, which the backend only allows
//     on the caller's OWN draft/rejected product).
//   - The manager NEEDS a saved product id (media attaches to a real product). So:
//       • EDIT mode: the product already exists, so the manager renders immediately
//         against product.id with product.media.
//       • CREATE mode: there is no id until createProduct succeeds. We therefore do
//         NOT close the dialog after creating; we keep it open and flip to a local
//         "just-created" view that shows the manager for the new id (a fresh product
//         is a draft, which is editable), with a hint to add media then submit.
//   - onChanged (fired by the manager after each upload/delete) refetches the
//     caller-vendor's products (vendorProductApi.getMyProducts), finds THIS product
//     by id, and updates the gallery's local media so the grid refreshes. The parent
//     list is also refreshed (onSaved) so its row stays in sync.
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

// The SAME multi-media gallery manager the admin edit-product page uses
// (app/(a)/a/shop/inventory/[id]/page.tsx). We reuse it as-is and only point its
// upload/delete at the VENDOR-gated media routes via its uploadUrl/deleteUrl props.
import {
  ProductMediaManager,
  ProductMediaItem,
} from "@/app/(a)/a/shop/_components/ProductMediaManager";

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

  // ── Multi-media gallery state (images + videos) ──
  // galleryProductId is the SAVED product the ProductMediaManager edits. It is the
  // edited product's id in EDIT mode, or — in CREATE mode — gets set to the new id
  // once createProduct succeeds (the "just-created" view). While null, the gallery
  // cannot render (media needs a real product to attach to). galleryMedia is the
  // current media list; onChanged refetches it so the grid refreshes after each
  // upload/delete.
  const [galleryProductId, setGalleryProductId] = useState<number | null>(null);
  const [galleryMedia, setGalleryMedia] = useState<ProductMediaItem[]>([]);
  // True once we have created a product inside THIS create session (so we can show
  // the gallery + a "just created, now add media" hint without closing the dialog).
  const [justCreated, setJustCreated] = useState(false);

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
      // EDIT: the product already exists, so the gallery can render straight away
      // against its id + media. (The page only opens Edit on draft/rejected, which
      // is the editable state the vendor media endpoints require.)
      setGalleryProductId(product.id);
      setGalleryMedia((product.media ?? []) as ProductMediaItem[]);
      setJustCreated(false);
    } else {
      // create (or edit with no product, which should not happen)
      setName("");
      setProductType("");
      setDescription("");
      setIsLimitedStock(false);
      setImage(null);
      setVariants([emptyVariant()]);
      // CREATE: no product yet, so the gallery stays hidden until createProduct
      // returns an id (see handleSave → the "just-created" view).
      setGalleryProductId(null);
      setGalleryMedia([]);
      setJustCreated(false);
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

  // ── Gallery refetch (the ProductMediaManager's onChanged) ──
  // Fired after each gallery upload/delete. There is no single-product GET in
  // lib/vendor.ts, so we re-call the list (getMyProducts) and pull THIS product out
  // by id to read its fresh media. That refreshes the gallery grid, and we also ask
  // the parent to refresh its own list (onSaved) so the row stays in sync. Mirrors
  // the admin page's onChanged={fetchProduct} idiom, adapted to the list endpoint.
  const refreshGalleryMedia = async () => {
    if (galleryProductId == null) return;
    try {
      const res = await vendorProductApi.getMyProducts();
      const fresh = (res.products ?? []).find((p) => p.id === galleryProductId);
      setGalleryMedia((fresh?.media ?? []) as ProductMediaItem[]);
    } catch {
      // A failed refetch leaves the last-known media in place; the manager already
      // toasts upload/delete failures, so we stay quiet here rather than double-toast.
    }
    // Keep the parent product list current too (the freshly saved/edited product).
    onSaved(galleryProductId);
  };

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
        // EDIT: the base fields are saved. Close the dialog. The vendor manages the
        // gallery inline (it was already visible while editing), and the parent row
        // reflects any change after onSaved refetches.
        onOpenChange(false);
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
        // Refresh the parent list so the new draft shows up there...
        onSaved(res?.product_id);
        // ...but DO NOT close the dialog. The gallery manager needs a real product
        // id, which we only just got. Flip into the "just-created" view so the
        // vendor can attach photos and videos to the new draft before submitting.
        // A freshly created product is a draft, which is the editable state the
        // vendor media endpoints require, so the gallery can render now.
        const newId = res?.product_id;
        if (typeof newId === "number") {
          setGalleryProductId(newId);
          setGalleryMedia([]); // brand-new product has no media yet
          setJustCreated(true);
        } else {
          // No id came back (unexpected) — fall back to the old behaviour and close,
          // so the vendor is not stranded in a dialog with no working gallery.
          onOpenChange(false);
        }
      }
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message || "Could not save the product.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  // ── Gallery visibility ──
  // Show the multi-media manager only when there is a SAVED product to attach media
  // to AND that product is in an editable (draft/rejected) state — the vendor media
  // endpoints reject anything else. In EDIT we can read approval_status off the
  // product; the just-created case is always a draft, so it qualifies. (galleryProductId
  // is non-null exactly in those two cases.)
  const productIsEditable =
    justCreated ||
    (mode === "edit" &&
      (product?.approval_status === "draft" ||
        product?.approval_status === "rejected"));
  const showGallery = galleryProductId != null && productIsEditable;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {justCreated
              ? "Add photos and videos"
              : mode === "edit"
                ? "Edit product"
                : "Create product"}
          </DialogTitle>
          <DialogDescription>
            {justCreated
              ? "Your product was saved as a draft. Add photos and videos below, then submit it for AFC approval when it is ready."
              : mode === "edit"
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

          {/* ── Photos and videos (the multi-media GALLERY) ── */}
          {/* Separate from the single primary image above: that one is the card
              thumbnail, this is the full gallery. Reuses the admin ProductMediaManager,
              pointed at the vendor-gated media routes. It only renders once a saved
              (draft/rejected) product exists, because media attaches to a real product
              id (see showGallery). In CREATE mode it appears after the product is
              created (the "just-created" view). */}
          {showGallery ? (
            <div className="space-y-2">
              <Label>Photos and videos</Label>
              <p className="text-xs text-muted-foreground">
                Add several images and short videos for the product gallery. This is
                separate from the primary image above.
              </p>
              <ProductMediaManager
                productId={galleryProductId as number}
                media={galleryMedia}
                onChanged={refreshGalleryMedia}
                uploadUrl="/shop/vendor/products/media/add/"
                deleteUrl="/shop/vendor/products/media/delete/"
              />
            </div>
          ) : mode === "create" && !justCreated ? (
            // CREATE, not yet saved: the gallery cannot exist without a product id.
            // Tell the vendor it unlocks after the first save.
            <div className="space-y-2">
              <Label>Photos and videos</Label>
              <p className="text-xs text-muted-foreground">
                Create the product first, then you can add a gallery of photos and
                videos here before submitting it for approval.
              </p>
            </div>
          ) : null}

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
          {justCreated ? (
            // The product is already saved (we are in the post-create gallery view).
            // Re-running handleSave here would create a DUPLICATE, so the footer
            // collapses to a single "Done" that just closes the dialog. The vendor
            // submits the product for approval from the products list row.
            <Button type="button" onClick={() => onOpenChange(false)}>
              Done
            </Button>
          ) : (
            <>
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
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
