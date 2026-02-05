"use client";

import React, { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import axios from "axios";
import { toast } from "sonner";
import { env } from "@/lib/env";
import { useAuth } from "@/contexts/AuthContext";

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
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Loader } from "@/components/Loader";

// Zod schema for variant
const AddVariantSchema = z.object({
  sku: z.string().min(1, "SKU is required"),
  price: z.coerce.number().min(0, "Price must be at least 0"),
  title: z.string().min(1, "Title is required"),
  diamonds_amount: z.coerce
    .number()
    .min(0, "Diamonds amount must be at least 0"),
  stock_qty: z.coerce.number().min(0, "Stock quantity must be at least 0"),
  is_active: z.boolean().default(true),
  meta: z.record(z.string(), z.any()).default({}),
});

type AddVariantSchemaType = z.infer<typeof AddVariantSchema>;

interface AddVariantModalProps {
  productId: number;
  onSuccess: () => void;
}

export function AddVariantModal({
  productId,
  onSuccess,
}: AddVariantModalProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const { token } = useAuth();

  const form = useForm<AddVariantSchemaType>({
    resolver: zodResolver(AddVariantSchema),
    defaultValues: {
      sku: "",
      price: 0,
      title: "",
      diamonds_amount: 0,
      stock_qty: 0,
      is_active: true,
      meta: {},
    },
  });

  const onSubmit = (data: AddVariantSchemaType) => {
    startTransition(async () => {
      try {
        const payload = {
          product_id: productId,
          sku: data.sku,
          price: data.price.toString(), // Convert to string for backend
          title: data.title,
          diamonds_amount: data.diamonds_amount,
          stock_qty: data.stock_qty,
          is_active: data.is_active,
          meta: data.meta,
        };

        const response = await axios.post(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/shop/add-product-variant/`,
          payload,
          {
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
          },
        );

        toast.success(response.data?.message || "Variant added successfully");

        // Reset form and close modal
        form.reset();
        setOpen(false);

        // Call success callback to refresh product data
        onSuccess();
      } catch (error: any) {
        console.error("Add variant error:", error.response?.data);

        const errorMessage =
          error.response?.data?.message ||
          error.response?.data?.detail ||
          error.response?.data?.error ||
          "Failed to add variant";

        toast.error(errorMessage);

        // Handle field-specific errors
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
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          Add Variant
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add New Variant</DialogTitle>
          <DialogDescription>
            Create a new variant for this product. All fields are required.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Variant Title</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Starter Pack" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="sku"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>SKU</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., DIA-100" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Price ($)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        {...field}
                        value={field.value ?? ""}
                        onChange={(e) => {
                          const val = e.target.value;
                          field.onChange(val === "" ? 0 : parseFloat(val));
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="diamonds_amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Diamonds Amount</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        placeholder="0"
                        {...field}
                        value={field.value ?? ""}
                        onChange={(e) => {
                          const val = e.target.value;
                          field.onChange(val === "" ? 0 : parseInt(val));
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="stock_qty"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Stock Quantity</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        placeholder="0"
                        {...field}
                        value={field.value ?? ""}
                        onChange={(e) => {
                          const val = e.target.value;
                          field.onChange(val === "" ? 0 : parseInt(val));
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="is_active"
                render={({ field }) => (
                  <FormItem className="col-span-2 flex flex-row items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Active</FormLabel>
                      <p className="text-sm text-muted-foreground">
                        Make this variant available for purchase
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

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  form.reset();
                  setOpen(false);
                }}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? <Loader text="Adding..." /> : "Add Variant"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
