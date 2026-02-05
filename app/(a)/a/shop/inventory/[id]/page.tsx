"use client";

import React, { use, useEffect, useState, useTransition } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useFieldArray } from "react-hook-form";

import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { IconTrash } from "@tabler/icons-react";
import { DeleteProductModal } from "../../_components/DeleteProductModal";
import { AddVariantModal } from "../../_components/AddVariantModal"; // Import the new modal
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { formatDate } from "@/lib/utils";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { AddProductSchema, AddProductSchemaType } from "@/lib/zodSchemas";
import axios from "axios";
import { env } from "@/lib/env";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Loader } from "@/components/Loader";
import { shopProductTypes } from "@/constants";
import { useRouter } from "next/navigation";
import { DeleteVariantModal } from "../../_components/DeleteVariantModal";

type Params = Promise<{
  id: string;
}>;

// Define proper type for product details
interface ProductVariant {
  id: number;
  sku: string;
  title: string;
  price: string;
  diamonds_amount: number;
  stock_qty: number;
  is_active: boolean;
  in_stock: boolean;
  meta: Record<string, any>;
}

interface ProductDetails {
  id: number;
  name: string;
  type: string;
  description: string;
  status: string;
  is_limited_stock: boolean;
  created_at: string;
  updated_at: string;
  variants: ProductVariant[];
}

const Page = ({ params }: { params: Params }) => {
  const { id } = use(params);
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [loadingProduct, setLoadingProduct] = useState(true);
  const [productDetails, setProductDetails] = useState<ProductDetails | null>(
    null,
  );
  const [openDeleteModal, setOpenDeleteModal] = useState(false);

  const { token } = useAuth();

  const form = useForm<AddProductSchemaType>({
    resolver: zodResolver(AddProductSchema),
    defaultValues: {
      name: "",
      product_type: "diamonds",
      description: "",
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
          meta: {},
        },
      ],
    },
  });

  const fetchProduct = async () => {
    if (!id) return;

    try {
      setLoadingProduct(true);
      const decodedId = decodeURIComponent(id);

      const res = await axios.get(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/shop/view-product-details/`,
        {
          params: { product_id: decodedId },
        },
      );

      setProductDetails(res.data.product);
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.message || "Failed to fetch product details";
      toast.error(errorMessage);
      if (error.response?.status === 404) {
        router.push("/a/shop/products");
      }
    } finally {
      setLoadingProduct(false);
    }
  };

  useEffect(() => {
    fetchProduct();
  }, [id]);

  useEffect(() => {
    if (productDetails) {
      form.reset({
        id: productDetails.id,
        name: productDetails.name,
        description: productDetails.description,
        product_type: productDetails.type,
        status: productDetails.status,
        is_limited_stock: productDetails.is_limited_stock,
        variants: productDetails.variants.map((variant) => ({
          db_id: variant.id,
          id: variant.id,
          sku: variant.sku,
          title: variant.title,
          price: parseFloat(variant.price),
          diamonds_amount: variant.diamonds_amount,
          stock_qty: variant.stock_qty,
          is_active: variant.is_active,
          meta: variant.meta || {},
        })),
      });
    }
  }, [productDetails, form]);

  const { fields, remove } = useFieldArray({
    control: form.control,
    name: "variants",
  });

  function onSubmit(data: AddProductSchemaType) {
    if (!productDetails?.id) {
      toast.error("Product ID is missing");
      return;
    }

    startTransition(async () => {
      try {
        const payload = {
          product_id: productDetails.id,
          name: data.name,
          description: data.description,
          product_type: data.product_type,
          status: data.status,
          is_limited_stock: data.is_limited_stock,
          // variants: data.variants.map((variant) => ({
          //   id: variant.id || null,
          //   sku: variant.sku,
          //   title: variant.title,
          //   price: variant.price.toString(),
          //   diamonds_amount: variant.diamonds_amount,
          //   stock_qty: variant.stock_qty,
          //   is_active: variant.is_active,
          //   meta: variant.meta || {},
          // })),
          variants: data.variants.map((v) => ({
            ...v,
            price: v.price.toString(),
          })),
        };

        const response = await axios.post(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/shop/edit-product/`,
          payload,
          {
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
          },
        );

        toast.success(response.data?.message || "Product updated successfully");
        await fetchProduct();
      } catch (error: any) {
        console.error("Edit error:", error.response?.data);

        const errorMessage =
          error.response?.data?.message ||
          error.response?.data?.detail ||
          error.response?.data?.error ||
          "Failed to update product";

        toast.error(errorMessage);

        if (error.response?.data?.errors) {
          Object.entries(error.response.data.errors).forEach(
            ([field, messages]) => {
              if (Array.isArray(messages)) {
                messages.forEach((msg) => toast.error(`${field}: ${msg}`));
              }
            },
          );
        }
      }
    });
  }

  if (loadingProduct) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader text="Loading product..." />
      </div>
    );
  }

  if (!productDetails) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <p className="text-muted-foreground">Product not found</p>
        <Button onClick={() => router.push("/a/shop/products")}>
          Back to Products
        </Button>
      </div>
    );
  }

  const getStatusVariant = (status: string) => {
    switch (status) {
      case "active":
        return "default";
      case "archived":
        return "secondary";
      case "draft":
        return "outline";
      default:
        return "secondary";
    }
  };

  const calculateStats = () => {
    const totalStock = productDetails.variants.reduce(
      (sum, variant) => sum + variant.stock_qty,
      0,
    );
    return { totalStock };
  };

  const stats = calculateStats();

  return (
    <div className="space-y-4">
      <div className="flex items-start md:items-center justify-between gap-2 flex-col md:flex-row">
        <PageHeader back title={`Edit: ${productDetails.name}`} />
        <DeleteProductModal
          productId={String(productDetails.id)}
          productName={productDetails.name}
          open={openDeleteModal}
          onOpenChange={setOpenDeleteModal}
          onSuccess={() => router.push("/a/shop/products")}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="col-span-1 lg:col-span-3">
          <Card>
            <CardHeader>
              <CardTitle>Product Details</CardTitle>
              <CardDescription>
                Edit the product information and settings
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit(onSubmit)}
                  className="space-y-6"
                >
                  {/* Base Product Info */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
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
                      control={form.control}
                      name="product_type"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Category</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            value={field.value}
                          >
                            <FormControl>
                              <SelectTrigger className="capitalize">
                                <SelectValue placeholder="Select type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {shopProductTypes.map((type, index) => (
                                <SelectItem
                                  key={index}
                                  className="capitalize"
                                  value={type}
                                >
                                  {type}
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
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Enter product description..."
                            rows={4}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="status"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Status</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            value={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select status" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="active">Active</SelectItem>
                              <SelectItem value="archived">Archived</SelectItem>
                              <SelectItem value="draft">Draft</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="is_limited_stock"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                          <div className="space-y-0.5">
                            <FormLabel>Limited Stock</FormLabel>
                            <p className="text-xs text-muted-foreground">
                              Track inventory for this product
                            </p>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>

                  <Separator />

                  {/* UPDATED: Replace the old Add Variant button with the modal */}
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="font-semibold text-base">
                        Product Variants
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Manage different variants of this product
                      </p>
                    </div>
                    <AddVariantModal
                      productId={productDetails.id}
                      onSuccess={fetchProduct}
                    />
                  </div>

                  {/* Variants Display - Read Only */}
                  <div className="space-y-4">
                    {fields.map((field, index) => (
                      <div
                        key={field.id}
                        className="p-4 border rounded-lg space-y-4 bg-muted/20"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-bold text-muted-foreground">
                            Variant #{index + 1}{" "}
                          </span>

                          {/* If the variant exists in the DB (has an ID), show Delete Modal */}
                          {field.id ? (
                            <DeleteVariantModal
                              variantId={field.db_id}
                              variantTitle={field.title}
                              onSuccess={fetchProduct} // Refresh the product details
                            />
                          ) : (
                            // If it's a locally added variant not yet saved, just remove from form
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => remove(index)}
                            >
                              <IconTrash size={16} />
                            </Button>
                          )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name={`variants.${index}.title`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs">Title</FormLabel>
                                <FormControl>
                                  <Input {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name={`variants.${index}.sku`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs">SKU</FormLabel>
                                <FormControl>
                                  <Input {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name={`variants.${index}.price`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs">
                                  Price ($)
                                </FormLabel>
                                <FormControl>
                                  <Input type="number" step="0.01" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name={`variants.${index}.stock_qty`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs">
                                  Stock Qty
                                </FormLabel>
                                <FormControl>
                                  <Input type="number" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name={`variants.${index}.diamonds_amount`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs">
                                  Diamonds
                                </FormLabel>
                                <FormControl>
                                  <Input type="number" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name={`variants.${index}.is_active`}
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-center justify-between rounded-md border p-3 mt-auto">
                                <FormLabel className="text-xs">
                                  Active
                                </FormLabel>
                                <FormControl>
                                  <Switch
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  <Button type="submit" disabled={isPending} className="w-full">
                    {isPending ? <Loader text="Saving..." /> : "Save Changes"}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>

        <div className="col-span-1 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Product Statistics</CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground text-sm space-y-4">
              <p className="flex items-center justify-between gap-2">
                <span>Status</span>
                <Badge
                  variant={getStatusVariant(productDetails.status)}
                  className="capitalize"
                >
                  {productDetails.status}
                </Badge>
              </p>
              <Separator />
              <p className="flex items-center justify-between gap-2">
                <span>Total Variants</span>
                <span className="text-white font-medium">
                  {productDetails.variants.length}
                </span>
              </p>
              <p className="flex items-center justify-between gap-2">
                <span>Stock Level</span>
                <span className="text-white font-medium">
                  {stats.totalStock} units
                </span>
              </p>
              <p className="flex items-center justify-between gap-2">
                <span>Active Variants</span>
                <span className="text-white font-medium">
                  {productDetails.variants.filter((v) => v.is_active).length}
                </span>
              </p>
              <Separator />
              <p className="flex items-center justify-between gap-2">
                <span>Created</span>
                <span className="text-white font-medium">
                  {formatDate(productDetails.created_at)}
                </span>
              </p>
              <p className="flex items-center justify-between gap-2">
                <span>Last Updated</span>
                <span className="text-white font-medium">
                  {formatDate(productDetails.updated_at)}
                </span>
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Page;
