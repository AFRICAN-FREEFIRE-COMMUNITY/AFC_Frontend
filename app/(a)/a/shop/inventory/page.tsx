"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useFieldArray } from "react-hook-form";

import { useEffect, useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PageHeader } from "@/components/PageHeader";
import {
  IconCirclePlus,
  IconDownload,
  IconChartBar,
  IconFilter,
  IconUpload,
  IconDiamond,
  IconDots,
  IconPencil,
  IconTrash,
  IconFlameOff,
  IconBan,
  IconDeviceDesktopAnalytics,
} from "@tabler/icons-react";
import { MoreHorizontal, ArrowLeft, CheckCircle } from "lucide-react";
import Link from "next/link";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { AddProductModal } from "../_components/AddProductModal";

import { Skeleton } from "@/components/ui/skeleton"; // For loading states
import axios from "axios";
import { env } from "@/lib/env";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { formatDate } from "@/lib/utils";
import { DeleteProductModal } from "../_components/DeleteProductModal";
import { ToggleProductStatusModal } from "../_components/ToggleProductStatusModal";
import { CreateCouponSchema, CreateCouponSchemaType } from "@/lib/zodSchemas";
import { Label } from "@/components/ui/label";
import { Loader } from "@/components/Loader";
import React from "react";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { ComingSoon } from "@/components/ComingSoon";
import { DeleteCouponModal } from "../_components/DeleteCouponModal";
import { ToggleCouponStatusModal } from "../_components/ToggleCouponStatusModal";
import { ManageCategoriesModal } from "../_components/ManageCategoriesModal";
import { InfoTip } from "@/components/ui/info-tip";
import { IconBox } from "@tabler/icons-react";

interface Variant {
  id: number;
  sku: string;
  title: string;
  price: string;
  diamonds_amount: number;
  stock_qty: number;
  is_active: boolean;
  in_stock: boolean;
}

// Structured category attached to a product (null for legacy diamond rows).
interface ProductCategory {
  id: number;
  name: string;
  slug: string;
  is_physical: boolean;
  is_active: boolean;
}

interface Product {
  id: number;
  name: string;
  type: string;
  category: ProductCategory | null;
  status: string;
  is_limited_stock: boolean;
  variants: Variant[];
  updated_at: Date;
  created_at?: string;
  // ── Marketplace ownership + approval (from view_all_products) ──
  // vendor_id is null for first-party AFC stock (diamonds etc.); set for vendor products.
  // approval_status is the vendor-approval lifecycle, SEPARATE from `status`
  // (active/inactive): a vendor product can be status="active" yet still "submitted"
  // (not approved, so hidden from buyers). We surface both so a pending vendor product
  // is not mistaken for a live one (owner request 2026-06-09).
  vendor_id?: number | null;
  vendor_name?: string | null;
  approval_status?: "draft" | "submitted" | "approved" | "rejected";
  approved_at?: string | null;
  approved_by?: string | null;
}

interface Coupon {
  id: number;
  code: string;
  discount_type: "percent" | "fixed";
  discount_value: string;
  active: boolean;
  start_at: string;
  end_at: string;
  min_order_amount: string;
  max_uses: number;
  used_count: number;
  is_valid_now: boolean;
}

export default function InventoryManagementPage() {
  const { token } = useAuth();
  const [isPending, startTransition] = useTransition();

  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [isCouponsLoading, setIsCouponsLoading] = useState(true);

  const fetchCoupons = async () => {
    try {
      setIsCouponsLoading(true);
      const response = await axios.get(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/shop/view-all-coupons/`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setCoupons(response.data.coupons);
    } catch (error: any) {
      console.error("Error fetching coupons:", error);
    } finally {
      setIsCouponsLoading(false);
    }
  };

  // Initialize the Form
  const form = useForm<CreateCouponSchemaType>({
    resolver: zodResolver(CreateCouponSchema),
    defaultValues: {
      code: "",
      discount_type: "percent",
      discount_value: 0,
      active: true,
      min_order_amount: 0,
      max_uses: 100,
      start_at: new Date().toISOString().split("T")[0], // Today
      end_at: "",
    },
  });

  const [couponTab, setCouponTab] = useState("active");
  const [isLoading, setIsLoading] = useState(true);
  const [productsPage, setProductsPage] = useState(1);
  const [couponsPage, setCouponsPage] = useState(1);
  const PRODUCTS_PER_PAGE = 10;
  const COUPONS_PER_PAGE = 10;
  const [openDeleteModal, setOpenDeleteModal] = useState(false);
  const [openDeleteCouponModal, setOpenDeleteCouponModal] = useState(false);
  const [openStatusModal, setOpenStatusModal] = useState(false); // Rename state for clarity
  const [openCouponStatusModal, setOpenCouponStatusModal] = useState(false); // Rename state for clarity
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedCoupon, setSelectedCoupon] = useState<Coupon | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [statusFilter, setStatusFilter] = useState("all");

  const onSubmitCoupon = (data: CreateCouponSchemaType) => {
    startTransition(async () => {
      try {
        await axios.post(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/shop/create-coupon/`,
          data,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        toast.success("Coupon created successfully!");
        form.reset();
        fetchCoupons(); // <--- Refresh the list here
        setCouponTab("active"); // Switch back to list view
        // Optional: fetchCoupons() if you have a real list endpoint
      } catch (error: any) {
        toast.error(error.response?.data?.message || "Failed to create coupon");
      }
    });
  };

  const handleDeleteSuccess = () => {
    setOpenDeleteModal(false);
    setSelectedProduct(null);
    fetchProducts(); // Refresh the table
  };

  const handleDeleteCouponSuccess = () => {
    setOpenDeleteCouponModal(false);
    setSelectedCoupon(null);
    fetchCoupons(); // Refresh the table
  };

  const fetchProducts = async () => {
    try {
      setIsLoading(true);
      const response = await axios.get(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/shop/view-all-products/`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );
      setProducts(response.data.products);
    } catch (error: any) {
      toast.error(error.response.data.message);
      console.error("Error fetching products:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
    fetchCoupons();
  }, []);

  const filteredProducts = products.filter((product) => {
    if (statusFilter === "all") return true;
    return product.status.toLowerCase() === statusFilter.toLowerCase();
  });

  const productsTotalPages = Math.ceil(
    filteredProducts.length / PRODUCTS_PER_PAGE,
  );
  const paginatedProducts = filteredProducts.slice(
    (productsPage - 1) * PRODUCTS_PER_PAGE,
    productsPage * PRODUCTS_PER_PAGE,
  );

  const couponsTotalPages = Math.ceil(coupons.length / COUPONS_PER_PAGE);
  const paginatedCoupons = coupons.slice(
    (couponsPage - 1) * COUPONS_PER_PAGE,
    couponsPage * COUPONS_PER_PAGE,
  );

  useEffect(() => {
    setProductsPage(1);
  }, [statusFilter]);

  useEffect(() => {
    setCouponsPage(1);
  }, [coupons]);

  // Helper to calculate total stock from variants
  const getTotalStock = (variants: Variant[]) =>
    variants.reduce((acc, curr) => acc + curr.stock_qty, 0);

  // Helper to get price range
  const getPriceDisplay = (variants: Variant[]) => {
    if (variants.length === 0) return "$0.00";
    const prices = variants.map((v) => parseFloat(v.price));
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    return min === max
      ? `$${min.toFixed(2)}`
      : `$${min.toFixed(2)} - $${max.toFixed(2)}`;
  };

  // Approval badge for VENDOR products only. The plain `status` badge can read "active"
  // while a vendor product is still awaiting approval (and therefore hidden from buyers),
  // so this surfaces where the product sits in the approval lifecycle. First-party AFC
  // products (vendor_id null) return null and just show their status as before.
  const approvalMeta: Record<string, { label: string; cls: string }> = {
    submitted: { label: "Pending approval", cls: "border-amber-500 text-amber-500" },
    approved: { label: "Approved", cls: "border-primary text-primary" },
    rejected: { label: "Rejected", cls: "border-destructive text-destructive" },
    draft: { label: "Draft", cls: "border-muted-foreground text-muted-foreground" },
  };
  const getApprovalBadge = (product: Product) => {
    if (!product.vendor_id || !product.approval_status) return null;
    const m = approvalMeta[product.approval_status];
    if (!m) return null;
    return (
      <Badge
        variant="outline"
        className={`rounded-full px-2 py-0.5 text-[10px] w-fit ${m.cls}`}
        title={
          product.approval_status === "approved" && product.approved_at
            ? `Approved ${formatDate(product.approved_at)}${product.approved_by ? ` by ${product.approved_by}` : ""}`
            : undefined
        }
      >
        {m.label}
      </Badge>
    );
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <PageHeader
          back
          // Title is a ReactNode so the page-level ⓘ can sit right after it.
          title={
            <span className="inline-flex items-center">
              Inventory Management
              <InfoTip id="shop.inventory._page" className="ml-1.5" />
            </span>
          }
        />
        <div className="w-full md:w-auto flex flex-wrap items-center gap-2">
          <Button variant="outline" asChild data-tour="shop-inventory-coupon-link">
            <Link href="/a/shop/coupons">
              <IconChartBar />
              Coupon Metrics
            </Link>
          </Button>
          {/* Category management: add / edit / remove the categories products
              are filed under (drives the user shop tabs). Wrapped in a stable
              span so the tour can anchor the trigger the modal renders. */}
          <span data-tour="shop-inventory-manage-categories">
            <ManageCategoriesModal onChanged={() => fetchProducts()} />
          </span>
          {/* ⓘ sits beside the add-product trigger (sibling - the modal renders its own button).
              Wrapped in a stable span so the tour can anchor the modal's trigger button. */}
          <span data-tour="shop-inventory-add-product">
            <AddProductModal onSuccess={() => fetchProducts()} />
          </span>
          <InfoTip id="shop.add_product" />
        </div>
      </div>

      {/* Filter Tabs */}
      <Tabs
        value={statusFilter}
        onValueChange={setStatusFilter}
        data-tour="shop-inventory-status-filter"
      >
        <ScrollArea>
          <TabsList className="w-full">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="active">Active</TabsTrigger>
            <TabsTrigger value="inactive">Inactive</TabsTrigger>
          </TabsList>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </Tabs>

      {/* Products Table */}
      <Card>
        <CardHeader>
          {/* Section ⓘ inline with the products heading. */}
          <CardTitle className="flex items-center">
            Catalog Products
            <InfoTip id="shop.products._section" className="ml-1.5" />
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Manage diamonds and physical merchandise, their variants, and stock.
          </p>
        </CardHeader>
        <CardContent>
          <Table data-tour="shop-inventory-products-table">
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Stock</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Variants</TableHead>
                <TableHead>Last Updated</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                // Simple loading skeleton
                <TableRow>
                  <TableCell colSpan={9} className="text-center">
                    Loading products...
                  </TableCell>
                </TableRow>
              ) : paginatedProducts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center">
                    No products found.
                  </TableCell>
                </TableRow>
              ) : (
                paginatedProducts.map((product) => {
                  // physical goods show a box icon; digital topups (diamonds)
                  // keep the diamond icon. Falls back on the legacy type string.
                  const isPhysical =
                    product.category?.is_physical ??
                    product.type !== "diamonds";
                  const categoryLabel =
                    product.category?.name || product.type;
                  return (
                  <TableRow key={product.id}>
                    <TableCell>
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          {isPhysical ? (
                            <IconBox className="h-4 w-4 text-blue-400" />
                          ) : (
                            <IconDiamond className="h-4 w-4 text-primary" />
                          )}
                          <span className="font-medium">{product.name}</span>
                        </div>
                        <span className="capitalize text-xs text-muted-foreground ml-6">
                          {isPhysical ? "Physical good" : "Digital topup"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className="rounded-full px-2 py-0.5 text-xs capitalize"
                      >
                        {categoryLabel}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {/* Owner: which vendor owns this product, or AFC for first-party
                          stock. Pairs with the approval badge in the Status cell so an
                          admin can see at a glance whose pending submission this is. */}
                      {product.vendor_id ? (
                        <div className="flex flex-col">
                          <span className="text-xs font-medium">
                            {product.vendor_name}
                          </span>
                          {product.created_at && (
                            <span className="text-[10px] text-muted-foreground">
                              Added {formatDate(product.created_at)}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">AFC</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col items-start gap-1">
                        <Badge
                          variant={
                            product.status === "active" ? "default" : "secondary"
                          }
                          className="capitalize"
                        >
                          {product.status}
                        </Badge>
                        {/* Vendor-approval lifecycle badge (Pending/Approved/Rejected/
                            Draft). Only renders for vendor products. */}
                        {getApprovalBadge(product)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-start gap-1">
                        <span>{getTotalStock(product.variants)}</span>
                        {product.is_limited_stock && (
                          <Badge
                            variant="outline"
                            className="text-[10px] w-fit"
                          >
                            Limited
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{getPriceDisplay(product.variants)}</TableCell>
                    <TableCell>
                      <span className="text-xs">
                        {product.variants.length} Variant(s)
                      </span>
                    </TableCell>
                    <TableCell>{formatDate(product.updated_at)}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <IconDots />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={`/a/shop/inventory/${product.id}`}>
                              <IconPencil />
                              Edit
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              setSelectedProduct(product);
                              setOpenDeleteModal(true);
                            }}
                            className="text-destructive"
                          >
                            <IconTrash /> Delete
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              setSelectedProduct(product);
                              setOpenStatusModal(true);
                            }}
                          >
                            {product.status === "active" ? (
                              <>
                                <IconBan /> Deactivate
                              </>
                            ) : (
                              <>
                                <CheckCircle /> Activate
                              </>
                            )}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
          <div className="flex items-center justify-between mt-4">
            <p className="text-sm text-muted-foreground">
              Showing{" "}
              {filteredProducts.length === 0
                ? 0
                : (productsPage - 1) * PRODUCTS_PER_PAGE + 1}
              -
              {Math.min(
                productsPage * PRODUCTS_PER_PAGE,
                filteredProducts.length,
              )}{" "}
              of {filteredProducts.length} products
            </p>
            {productsTotalPages > 1 && (
              <Pagination className="w-full md:w-auto mx-0">
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      onClick={() => setProductsPage((p) => Math.max(1, p - 1))}
                      className={
                        productsPage === 1
                          ? "pointer-events-none opacity-50"
                          : "cursor-pointer"
                      }
                    />
                  </PaginationItem>
                  {Array.from({ length: productsTotalPages }, (_, i) => i + 1)
                    .filter(
                      (page) =>
                        page === 1 ||
                        page === productsTotalPages ||
                        Math.abs(page - productsPage) <= 1,
                    )
                    .map((page, idx, arr) => (
                      <React.Fragment key={page}>
                        {idx > 0 && arr[idx - 1] !== page - 1 && (
                          <PaginationItem>
                            <PaginationEllipsis />
                          </PaginationItem>
                        )}
                        <PaginationItem>
                          <PaginationLink
                            isActive={productsPage === page}
                            onClick={() => setProductsPage(page)}
                            className="cursor-pointer"
                          >
                            {page}
                          </PaginationLink>
                        </PaginationItem>
                      </React.Fragment>
                    ))}
                  <PaginationItem>
                    <PaginationNext
                      onClick={() =>
                        setProductsPage((p) =>
                          Math.min(productsTotalPages, p + 1),
                        )
                      }
                      className={
                        productsPage === productsTotalPages
                          ? "pointer-events-none opacity-50"
                          : "cursor-pointer"
                      }
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Upload Diamond Codes */}
      <Card>
        <CardHeader>
          {/* Section ⓘ inline with the upload-codes heading. */}
          <CardTitle className="flex items-center">
            Upload Diamond Codes
            <InfoTip id="shop.upload_codes._section" className="ml-1.5" />
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Upload a CSV file containing new diamond codes to replenish topup
            stock. Physical stock is managed per variant on the product page.
          </p>
        </CardHeader>
        <CardContent className="relative">
          <ComingSoon />
          <div className="space-y-4">
            <div>
              <Label htmlFor="selectProduct">Select Products *</Label>
              <Select>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select diamond products to restock" />
                </SelectTrigger>
                <SelectContent></SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="csvFile">Diamond Codes CSV *</Label>
              <Input id="csvFile" type="file" accept=".csv" className="mt-1" />
              <p className="text-xs text-muted-foreground mt-1">
                Upload a CSV file with one diamond code per{" "}
                <Link href="#" className="text-primary underline">
                  line
                </Link>
                .
              </p>
            </div>
            <Button variant="outline" className="w-full">
              <IconUpload />
              Upload Codes
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Coupons and Discounts */}
      <Card data-tour="shop-inventory-coupons-section">
        <CardHeader>
          {/* Section ⓘ inline with the coupons heading. */}
          <CardTitle className="flex items-center">
            Coupons and Discounts
            <InfoTip id="shop.coupons._section" className="ml-1.5" />
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Manage your active and inactive coupons.
          </p>
        </CardHeader>
        <CardContent>
          <Tabs value={couponTab} onValueChange={setCouponTab}>
            <TabsList className="w-full grid grid-cols-2">
              <TabsTrigger value="active">Active Coupons</TabsTrigger>
              <TabsTrigger value="create">Create New Coupon</TabsTrigger>
            </TabsList>

            <TabsContent value="active" className="mt-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Discount</TableHead>
                    <TableHead>Usage</TableHead>
                    <TableHead>Validity</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isCouponsLoading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-4">
                        Loading coupons...
                      </TableCell>
                    </TableRow>
                  ) : coupons.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-4">
                        No coupons found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedCoupons.map((coupon) => (
                      <TableRow key={coupon.id}>
                        <TableCell className="font-mono font-bold text-primary">
                          {coupon.code}
                        </TableCell>
                        <TableCell>
                          {coupon.discount_type === "percent"
                            ? `${parseFloat(coupon.discount_value)}%`
                            : `$${parseFloat(coupon.discount_value)}`}
                        </TableCell>
                        <TableCell className="text-xs">
                          {coupon.used_count} / {coupon.max_uses}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {formatDate(coupon.end_at)}
                        </TableCell>
                        <TableCell>
                          {/* Logic: Check if manually active AND not expired */}
                          {coupon.active && coupon.is_valid_now ? (
                            <Badge variant="default">Active</Badge>
                          ) : !coupon.active ? (
                            <Badge variant="secondary">Disabled</Badge>
                          ) : (
                            <Badge variant="destructive">Expired</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem asChild>
                                <Link href={`/a/shop/coupons/${coupon.id}`}>
                                  <IconDeviceDesktopAnalytics />
                                  View Stats
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem asChild>
                                <Link
                                  href={`/a/shop/coupons/${coupon.id}/edit`}
                                >
                                  <IconPencil />
                                  Edit
                                </Link>
                              </DropdownMenuItem>

                              <DropdownMenuItem
                                className={
                                  coupon.active
                                    ? "text-warning"
                                    : "text-primary"
                                }
                                onClick={() => {
                                  setSelectedCoupon(coupon);
                                  setOpenCouponStatusModal(true);
                                }}
                              >
                                {coupon.active ? (
                                  <>
                                    <IconBan /> Deactivate
                                  </>
                                ) : (
                                  <>
                                    <CheckCircle /> Activate
                                  </>
                                )}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => {
                                  setSelectedCoupon(coupon);
                                  setOpenDeleteCouponModal(true);
                                }}
                                className="text-destructive"
                              >
                                <IconTrash /> Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              {couponsTotalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="hidden md:block text-sm text-muted-foreground">
                    Showing {(couponsPage - 1) * COUPONS_PER_PAGE + 1}-
                    {Math.min(couponsPage * COUPONS_PER_PAGE, coupons.length)}{" "}
                    of {coupons.length}
                  </p>
                  <Pagination className="w-full md:w-auto mx-0">
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious
                          onClick={() =>
                            setCouponsPage((p) => Math.max(1, p - 1))
                          }
                          className={
                            couponsPage === 1
                              ? "pointer-events-none opacity-50"
                              : "cursor-pointer"
                          }
                        />
                      </PaginationItem>
                      {Array.from(
                        { length: couponsTotalPages },
                        (_, i) => i + 1,
                      )
                        .filter(
                          (page) =>
                            page === 1 ||
                            page === couponsTotalPages ||
                            Math.abs(page - couponsPage) <= 1,
                        )
                        .map((page, idx, arr) => (
                          <React.Fragment key={page}>
                            {idx > 0 && arr[idx - 1] !== page - 1 && (
                              <PaginationItem>
                                <PaginationEllipsis />
                              </PaginationItem>
                            )}
                            <PaginationItem>
                              <PaginationLink
                                isActive={couponsPage === page}
                                onClick={() => setCouponsPage(page)}
                                className="cursor-pointer"
                              >
                                {page}
                              </PaginationLink>
                            </PaginationItem>
                          </React.Fragment>
                        ))}
                      <PaginationItem>
                        <PaginationNext
                          onClick={() =>
                            setCouponsPage((p) =>
                              Math.min(couponsTotalPages, p + 1),
                            )
                          }
                          className={
                            couponsPage === couponsTotalPages
                              ? "pointer-events-none opacity-50"
                              : "cursor-pointer"
                          }
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              )}
            </TabsContent>

            <TabsContent value="create" className="mt-4">
              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit(onSubmitCoupon)}
                  className="space-y-4"
                >
                  <div className="grid grid-cols- 1 md:grid-cols-2 gap-2">
                    <FormField
                      control={form.control}
                      name="code"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Coupon Code *</FormLabel>
                          <FormControl>
                            <Input
                              className="uppercase"
                              placeholder="SUMMER20"
                              {...field}
                            />
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
                          {/* Field ⓘ nested in the FormLabel (stopPropagation guard handles the click). */}
                          <FormLabel>
                            Discount Type *
                            <InfoTip id="shop.coupon_discount_type" className="ml-1" />
                          </FormLabel>
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
                          <FormLabel>
                            Maximum Uses *
                            <InfoTip id="shop.coupon_max_uses" className="ml-1" />
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
                      name="min_order_amount"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            Min Order Amount ($)
                            <InfoTip id="shop.coupon_min_order" className="ml-1" />
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

                  <Button type="submit" className="w-full" disabled={isPending}>
                    {isPending ? (
                      <Loader text="Creating..." />
                    ) : (
                      "Create Coupon"
                    )}
                  </Button>
                </form>
              </Form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
      {openDeleteModal && selectedProduct && (
        <DeleteProductModal
          productId={String(selectedProduct.id)}
          productName={selectedProduct.name}
          open={openDeleteModal}
          onOpenChange={setOpenDeleteModal}
          onSuccess={handleDeleteSuccess}
        />
      )}
      {openDeleteCouponModal && selectedCoupon && (
        <DeleteCouponModal
          couponId={String(selectedCoupon.id)}
          couponCode={selectedCoupon.code}
          open={openDeleteCouponModal}
          onOpenChange={setOpenDeleteCouponModal}
          onSuccess={handleDeleteCouponSuccess}
        />
      )}
      {openStatusModal && selectedProduct && (
        <ToggleProductStatusModal
          productId={String(selectedProduct.id)}
          productName={selectedProduct.name}
          currentStatus={selectedProduct.status}
          open={openStatusModal}
          onOpenChange={setOpenStatusModal}
          onSuccess={() => {
            setOpenStatusModal(false);
            fetchProducts();
          }}
        />
      )}
      {openCouponStatusModal && selectedCoupon && (
        <ToggleCouponStatusModal
          couponId={String(selectedCoupon.id)}
          couponCode={selectedCoupon.code}
          currentStatus={selectedCoupon.active ? "active" : "inactive"}
          open={openCouponStatusModal}
          onOpenChange={setOpenCouponStatusModal}
          onSuccess={() => {
            setOpenCouponStatusModal(false);
            fetchCoupons();
          }}
        />
      )}
    </div>
  );
}
