"use client";

import React, { use, useEffect, useState, useTransition } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useFieldArray } from "react-hook-form";

import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { IconTrash } from "@tabler/icons-react";
import { DeleteProductModal } from "../../_components/DeleteProductModal";
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

type Params = Promise<{
  id: string;
}>;

const page = ({ params }: { params: Params }) => {
  const { id } = use(params);
  const [isPending, startTransition] = useTransition();
  const [productDetails, setProductDetails] = useState<any>();
  const [openDeleteModal, setOpenDeleteModal] = useState(false);

  const { token } = useAuth();

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

  const fetchProduct = () => {
    if (!id) return; // Don't run if id is not available yet

    startTransition(async () => {
      try {
        const decodedId = decodeURIComponent(id);
        const res = await axios.post(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/shop/get-product-detail/`,
          { product_id: decodedId }
        );
        setProductDetails(res.data.news);
      } catch (error: any) {
        toast.error(error.response.data.message || "Oops! An error occurred");
      }
    });
  };

  useEffect(() => {
    fetchProduct();
  }, [id]);

  useEffect(() => {
    if (productDetails) {
      form.reset({
        id: productDetails.news_id || "",
        name: productDetails.name || "",
        description: productDetails.description || "",
        product_type: productDetails.type || "",
        status: productDetails.status || "",
        is_limited_stock: productDetails.is_limited_stock || "",
        variants: productDetails.variants || "",
      });
    }
  }, [productDetails, form]);

  // This handles the array of variants
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "variants",
  });

  function onSubmit(data: AddProductSchemaType) {
    startTransition(async () => {
      try {
        await axios.post(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/shop/edit-product/`,
          data,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
        toast.success("Product edited successfully");
      } catch (error: any) {
        toast.error(error.response?.data?.message || "Failed to edit product");
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start md:items-center justify-between gap-2 flex-col md:flex-row">
        <PageHeader back title={"Edit product"} />
        <DeleteProductModal
          productId={String(productDetails?.id)}
          productName={productDetails?.name}
          open={openDeleteModal}
          onOpenChange={setOpenDeleteModal}
          onSuccess={() => fetchProduct()}
        />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-2">
        <div className="col-span-1 lg:col-span-3">
          <Card>
            <CardHeader>
              <CardTitle>Product details</CardTitle>
              <CardDescription>
                Edit the product information and settings
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form
                  // @ts-ignore
                  onSubmit={form.handleSubmit(onSubmit)}
                  className="space-y-6"
                >
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
                          <FormLabel className="mt-0">Limited Stock?</FormLabel>
                        </FormItem>
                      )}
                    />
                  </div>

                  <hr />
                  <div className="flex justify-between items-center">
                    <h3 className="font-semibold text-sm">Product Variants</h3>
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
                              <FormLabel>SKU</FormLabel>
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

                  <Button type="submit" disabled={isPending}>
                    {isPending ? <Loader text="Saving..." /> : "Save Product"}
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
                <Badge variant={"secondary"}></Badge>
              </p>
              <Separator />
              <p className="flex items-center justify-between gap-2">
                <span>Total Sold</span>
                <span className="text-white">5,420</span>
              </p>
              <p className="flex items-center justify-between gap-2">
                <span>Revenue</span>
                <span className="text-white">$5,420</span>
              </p>
              <p className="flex items-center justify-between gap-2">
                <span>Stock Level</span>
                <span className="text-white">1,420</span>
              </p>
              <Separator />
              <p className="flex items-center justify-between gap-2">
                <span>Created</span>{" "}
                <span className="text-white">{formatDate(new Date())}</span>
              </p>
              <p className="flex items-center justify-between gap-2">
                <span>Last updated</span>{" "}
                <span className="text-white">{formatDate(new Date())}</span>
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default page;
