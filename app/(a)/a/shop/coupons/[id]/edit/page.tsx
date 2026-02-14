"use client";

import React, { use, useEffect, useState, useTransition } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useFieldArray } from "react-hook-form";

import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { IconTrash } from "@tabler/icons-react";
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
import { EditCouponSchema, EditCouponSchemaType } from "@/lib/zodSchemas";
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
import { useRouter } from "next/navigation";
import { DeleteCouponModal } from "../../../_components/DeleteCouponModal";

type Params = Promise<{
  id: string;
}>;

interface CouponDetails {
  id: number; // Changed from string to number based on your API response
  code: string;
  discount_type: "percent" | "fixed";
  discount_value: string; // API returns string "10.00"
  min_order_amount: string; // API returns string "10.00"
  max_uses: number;
  used_count: number;
  expiry_date: string;
  is_active: boolean;
  description: string;
}

const Page = ({ params }: { params: Params }) => {
  const { id } = use(params);
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [loadingCoupon, setLoadingCoupon] = useState(true);
  const [couponDetails, setCouponDetails] = useState<CouponDetails | null>(
    null,
  );
  const [openDeleteModal, setOpenDeleteModal] = useState(false);

  const { token } = useAuth();

  const form = useForm<EditCouponSchemaType>({
    resolver: zodResolver(EditCouponSchema),
    defaultValues: {
      code: "",
      description: "",
      discount_type: "percent",
      discount_value: 0,
      active: true,
      min_order_amount: 0,
      max_uses: 100,
      end_at: "",
    },
  });

  const fetchCoupon = async () => {
    if (!id) return;

    try {
      setLoadingCoupon(true);
      const decodedId = decodeURIComponent(id);

      // Updated endpoint and parameter name
      const res = await axios.post(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/shop/get-coupon-details/`,
        { coupon_id: decodedId },
        {
          headers: { Authorization: `Bearer ${token}` }, // Added token if required
        },
      );

      // The API wraps data in "coupon_details"
      setCouponDetails(res.data.coupon_details);
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.message || "Failed to fetch coupon details";
      toast.error(errorMessage);
    } finally {
      setLoadingCoupon(false);
    }
  };

  useEffect(() => {
    fetchCoupon();
  }, [id]);

  useEffect(() => {
    if (couponDetails) {
      // Sync form with API data
      form.reset({
        code: couponDetails.code,
        discount_type: couponDetails.discount_type,
        // Convert strings "10.00" to numbers for the form
        discount_value: parseFloat(couponDetails.discount_value),
        min_order_amount: parseFloat(couponDetails.min_order_amount),
        max_uses: couponDetails.max_uses,
        active: couponDetails.is_active,
        description: couponDetails.description,
        // Format ISO date (2026-03-06T00:00:00Z) to YYYY-MM-DD for the date input
        end_at: couponDetails.expiry_date
          ? couponDetails.expiry_date.split("T")[0]
          : "",
      });
    }
  }, [couponDetails, form]);

  function onSubmit(data: EditCouponSchemaType) {
    if (!couponDetails?.id) {
      toast.error("Coupon ID is missing");
      return;
    }

    startTransition(async () => {
      try {
        const response = await axios.post(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/shop/edit-coupon/`,
          { ...data, coupon_id: couponDetails.id },
          {
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
          },
        );

        toast.success(response.data?.message || "Coupon updated successfully");
        await fetchCoupon();
      } catch (error: any) {
        console.error("Edit error:", error.response?.data);

        const errorMessage =
          error.response?.data?.message ||
          error.response?.data?.detail ||
          error.response?.data?.error ||
          "Failed to update coupon";

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

  if (loadingCoupon) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader text="Loading coupon..." />
      </div>
    );
  }

  if (!couponDetails) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <p className="text-muted-foreground">Coupon not found</p>
        <Button onClick={() => router.push("/a/shop/coupons")}>
          Back to Coupons
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

  const watchedValues = form.watch();

  const discountDisplay =
    watchedValues.discount_type === "percent"
      ? `${watchedValues.discount_value}% OFF`
      : `$${watchedValues.discount_value} OFF`;

  return (
    <div className="space-y-4">
      <div className="flex items-start md:items-center justify-between gap-2 flex-col md:flex-row">
        <PageHeader back title={`Edit: ${couponDetails?.code}`} />
        <DeleteCouponModal
          couponId={String(couponDetails?.id)}
          couponCode={couponDetails?.code || ""}
          open={openDeleteModal}
          onOpenChange={setOpenDeleteModal}
          onSuccess={() => router.push("/a/shop/coupons")}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="col-span-1 lg:col-span-3">
          <Card>
            <CardHeader>
              <CardTitle>Coupon Details</CardTitle>
              <CardDescription>
                Edit the coupon information and settings
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit(onSubmit)}
                  className="space-y-6"
                >
                  {/* Base Coupon Info */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="code"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Coupon Code *</FormLabel>
                          <FormControl>
                            <Input placeholder="SUMMER20" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="discount_type"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Discount Type *</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="percent">
                                Percentage (%)
                              </SelectItem>
                              <SelectItem value="fixed">
                                Fixed Amount ($)
                              </SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="discount_value"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Discount Value *</FormLabel>
                          <FormControl>
                            <Input type="number" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="max_uses"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Maximum Uses *</FormLabel>
                          <FormControl>
                            <Input type="number" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="min_order_amount"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Min Order Amount ($)</FormLabel>
                          <FormControl>
                            <Input type="number" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="end_at"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Expiry Date (End At) *</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
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
                            placeholder="Enter coupon description..."
                            rows={4}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="active"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <FormLabel>Activate Coupon immediately</FormLabel>
                      </FormItem>
                    )}
                  />

                  <Button type="submit" disabled={isPending} className="w-full">
                    {isPending ? <Loader text="Saving..." /> : "Save Changes"}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>

        <div className="col-span-1 space-y-4 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Coupon Statistics</CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground text-sm space-y-4">
              <p className="flex items-center justify-between gap-2">
                <span>Status</span>
                <Badge
                  variant={couponDetails?.is_active ? "default" : "secondary"}
                  className="capitalize"
                >
                  {couponDetails?.is_active ? "Active" : "Inactive"}
                </Badge>
              </p>
              <Separator />
              <p className="flex items-center justify-between gap-2">
                <span>Uses</span>
                <span className="text-white font-medium">
                  {couponDetails?.used_count} / {couponDetails?.max_uses}
                </span>
              </p>
              <p className="flex items-center justify-between gap-2">
                <span>Expiry</span>
                <span className="text-white font-medium">
                  {couponDetails?.expiry_date
                    ? formatDate(couponDetails.expiry_date)
                    : "N/A"}
                </span>
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Preview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-primary/10 rounded-md p-8 flex flex-col items-center justify-center text-center space-y-2 border border-primary/20">
                <h4 className="text-muted-foreground text-sm font-semibold tracking-widest uppercase opacity-50">
                  {watchedValues.code || "COUPONCODE"}
                </h4>
                <p className="text-zinc-400 text-xs">
                  {watchedValues.description ||
                    `Get ${discountDisplay} on your purchase`}
                </p>
                <div className="text-3xl font-black text-primary">
                  {discountDisplay}
                </div>
                <div className="text-zinc-500 text-xs font-medium uppercase tracking-tighter">
                  Min. order: ${watchedValues.min_order_amount || 0}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Page;
