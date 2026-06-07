"use client";

import React, { useTransition } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useFieldArray } from "react-hook-form";
import { toast } from "sonner";
import axios from "axios";

import { Button } from "@/components/ui/button";
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
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { IconCirclePlus, IconPhotoPlus, IconTrash } from "@tabler/icons-react";
import { Loader2 } from "lucide-react";

import { AddProductSchema, AddProductSchemaType } from "@/lib/zodSchemas";
import { env } from "@/lib/env";
import { Loader } from "@/components/Loader";
import { InfoTip } from "@/components/ui/info-tip";
import { useAuth } from "@/contexts/AuthContext";
import { shopProductTypes, SHOP_MAX_IMAGE_BYTES, SHOP_MAX_VIDEO_BYTES } from "@/constants";
import {
  ShopCategoryLite,
  fetchActiveCategories,
} from "@/lib/shopCategories";
import { toast as sonnerToast } from "sonner";

export const AddProductModal = ({ onSuccess }: { onSuccess: () => void }) => {
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = React.useState(false);

  // Live categories drive the category Select (replaces shopProductTypes).
  const [categories, setCategories] = React.useState<ShopCategoryLite[]>([]);

  // Queued media files (images + videos) uploaded AFTER the product is created,
  // since add-product-media needs the new product id.
  const [mediaFiles, setMediaFiles] = React.useState<File[]>([]);
  const mediaInputRef = React.useRef<HTMLInputElement | null>(null);

  const { token } = useAuth();

  // Fetch the active categories when the modal opens so the Select shows the
  // admin-managed list. Falls back to the legacy constant if the fetch is empty.
  React.useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        const cats = await fetchActiveCategories();
        setCategories(cats);
      } catch {
        setCategories([]);
      }
    })();
  }, [open]);

  // Options shown in the Select: real category slugs, or the legacy fallback.
  const categoryOptions =
    categories.length > 0
      ? categories.map((c) => ({ value: c.slug, label: c.name }))
      : shopProductTypes.map((t) => ({ value: t, label: t }));

  const form = useForm<AddProductSchemaType>({
    // @ts-ignore
    resolver: zodResolver(AddProductSchema),
    defaultValues: {
      name: "",
      product_type: "diamonds",
      description: "", // Explicitly provide empty string
      is_limited_stock: false,
      status: "active",
      variants: [
        {
          sku: "",
          price: 0,
          title: "",
          diamonds_amount: 0,
          stock_qty: 0,
          is_active: true,
          meta: {}, // Explicitly provide empty object
        },
      ],
    },
  });

  // This handles the array of variants
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "variants",
  });

  function onSubmit(data: AddProductSchemaType) {
    startTransition(async () => {
      try {
        // Step 1: create the product. `product_type` carries the chosen
        // category slug; the backend resolves it to the Category FK and keeps
        // product_type in sync. (category_slug is sent too for clarity.)
        const createRes = await axios.post(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/shop/add-product/`,
          { ...data, category_slug: data.product_type },
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        // Step 2: upload any queued media to the freshly created product.
        const newProductId = createRes.data?.product_id;
        if (newProductId && mediaFiles.length > 0) {
          try {
            const fd = new FormData();
            fd.append("product_id", String(newProductId));
            mediaFiles.forEach((f) => fd.append("files", f));
            await axios.post(
              `${env.NEXT_PUBLIC_BACKEND_API_URL}/shop/add-product-media/`,
              fd,
              { headers: { Authorization: `Bearer ${token}` } },
            );
          } catch (mediaErr: any) {
            // Product was created; only the media failed. Surface a soft warning
            // so the admin can re-upload on the edit page rather than losing it.
            sonnerToast.error(
              mediaErr.response?.data?.message ||
                "Product created, but media upload failed. Add media from the edit page.",
            );
          }
        }

        toast.success("Product added successfully");
        setOpen(false);
        onSuccess();
        form.reset();
        setMediaFiles([]);
      } catch (error: any) {
        toast.error(error.response?.data?.message || "Failed to add product");
      }
    });
  }

  // Validate + queue picked media files (uploaded after the product is created).
  const handleMediaSelect = (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const picked = Array.from(e.target.files || []);
    if (mediaInputRef.current) mediaInputRef.current.value = "";
    for (const f of picked) {
      const isImage = f.type.startsWith("image/");
      const isVideo = f.type.startsWith("video/");
      if (!isImage && !isVideo) {
        toast.error(`${f.name}: only images and videos are allowed.`);
        return;
      }
      if (isImage && f.size > SHOP_MAX_IMAGE_BYTES) {
        toast.error(`${f.name}: image exceeds the 5 MB limit.`);
        return;
      }
      if (isVideo && f.size > SHOP_MAX_VIDEO_BYTES) {
        toast.error(`${f.name}: video exceeds the 50 MB limit.`);
        return;
      }
    }
    setMediaFiles((prev) => [...prev, ...picked]);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="w-full md:w-auto">
          <IconCirclePlus className="mr-2 h-4 w-4" /> Add Product
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Product</DialogTitle>
          <DialogDescription>
            Fill in the product details and its variants.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          {/* @ts-ignore */}
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Base Product Info */}
            <div className="grid grid-cols-2 gap-2">
              <FormField
                // @ts-ignore
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Product Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Diamond Pack" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                // @ts-ignore
                control={form.control}
                name="product_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {categoryOptions.map((opt) => (
                          <SelectItem
                            key={opt.value}
                            className="capitalize"
                            value={opt.value}
                          >
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              // @ts-ignore
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex items-center space-x-2">
              <FormField
                // @ts-ignore
                control={form.control}
                name="is_limited_stock"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center space-x-2">
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <FormLabel className="mt-0">
                      Limited Stock?
                      <InfoTip id="shop.limited_stock" className="ml-1" />
                    </FormLabel>
                  </FormItem>
                )}
              />
            </div>

            <hr />

            {/* ── Media (images + videos): queued here, uploaded after the
                product is created. The full gallery manager lives on the edit
                page once the product exists. ── */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm flex items-center">
                  Images and Videos
                  <InfoTip id="shop.media._section" className="ml-1.5" />
                </h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => mediaInputRef.current?.click()}
                >
                  <IconPhotoPlus className="h-4 w-4" />
                  Add media
                </Button>
                <input
                  ref={mediaInputRef}
                  type="file"
                  accept="image/*,video/*"
                  multiple
                  className="hidden"
                  onChange={handleMediaSelect}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Optional. Images up to 5 MB, videos up to 50 MB. Add several so
                the product shows a gallery.
              </p>
              {mediaFiles.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {mediaFiles.map((f, i) => (
                    <span
                      key={`${f.name}-${i}`}
                      className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs"
                    >
                      {f.type.startsWith("video/") ? "Video" : "Image"}:{" "}
                      {f.name.length > 18 ? f.name.slice(0, 18) + "..." : f.name}
                      <button
                        type="button"
                        aria-label="Remove file"
                        onClick={() =>
                          setMediaFiles((prev) =>
                            prev.filter((_, idx) => idx !== i),
                          )
                        }
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <IconTrash className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <hr />
            <div className="flex justify-between items-center">
              {/* Section ⓘ inline with the variants heading. */}
              <h3 className="font-semibold text-sm flex items-center">
                Product Variants
                <InfoTip id="shop.variant._section" className="ml-1.5" />
              </h3>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  append({
                    sku: "",
                    price: 0,
                    title: "",
                    diamonds_amount: 0,
                    stock_qty: 0,
                    is_active: true,
                    meta: "" as any,
                  })
                }
              >
                Add Variant
              </Button>
            </div>

            {/* Variants Loop */}
            {fields.map((item, index) => (
              <div
                key={item.id}
                className="p-4 border rounded-lg space-y-4 relative"
              >
                {fields.length > 1 && (
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute right-2 top-2"
                    onClick={() => remove(index)}
                  >
                    <IconTrash />
                  </Button>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    // @ts-ignore
                    control={form.control}
                    name={`variants.${index}.title`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Variant Title</FormLabel>
                        <FormControl>
                          <Input placeholder="Starter Pack" {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    // @ts-ignore
                    control={form.control}
                    name={`variants.${index}.sku`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          SKU
                          <InfoTip id="shop.variant_sku" className="ml-1" />
                        </FormLabel>
                        <FormControl>
                          <Input placeholder="DIA-100" {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    // @ts-ignore
                    control={form.control}
                    name={`variants.${index}.price`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Price ($)</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    // @ts-ignore
                    control={form.control}
                    name={`variants.${index}.stock_qty`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Stock Qty</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            ))}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? <Loader text="Saving..." /> : "Save Product"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
