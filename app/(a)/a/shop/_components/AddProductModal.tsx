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
import { IconCirclePlus, IconTrash } from "@tabler/icons-react";

import { AddProductSchema, AddProductSchemaType } from "@/lib/zodSchemas";
import { env } from "@/lib/env";
import { Loader } from "@/components/Loader";
import { useAuth } from "@/contexts/AuthContext";
import { shopProductTypes } from "@/constants";

export const AddProductModal = ({ onSuccess }: { onSuccess: () => void }) => {
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = React.useState(false);

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

  // This handles the array of variants
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "variants",
  });

  function onSubmit(data: AddProductSchemaType) {
    startTransition(async () => {
      try {
        await axios.post(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/shop/add-product/`,
          data,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
        toast.success("Product added successfully");
        setOpen(false);
        onSuccess();
        form.reset();
      } catch (error: any) {
        toast.error(error.response?.data?.message || "Failed to add product");
      }
    });
  }

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
