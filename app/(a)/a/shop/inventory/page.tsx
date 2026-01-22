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
import { ComingSoon } from "@/components/ComingSoon";

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

interface Product {
  id: number;
  name: string;
  type: string;
  status: string;
  is_limited_stock: boolean;
  variants: Variant[];
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

// Mock data for products
const mockProducts = [
  {
    id: 1,
    name: "100 Diamonds",
    status: "Active",
    stock: 1200,
    price: 1.0,
    lastUpdated: "2023-01-15",
  },
  {
    id: 2,
    name: "500 Diamonds",
    status: "Active",
    stock: 800,
    price: 5.0,
    lastUpdated: "2023-01-15",
  },
  {
    id: 3,
    name: "1000 Diamonds",
    status: "Active",
    stock: 500,
    price: 10.0,
    lastUpdated: "2023-01-15",
  },
  {
    id: 4,
    name: "5000 Diamonds",
    status: "Active",
    stock: 150,
    price: 50.0,
    lastUpdated: "2023-01-15",
  },
  {
    id: 5,
    name: "10000 Diamonds",
    status: "Active",
    stock: 50,
    price: 100.0,
    lastUpdated: "2023-01-15",
  },
  {
    id: 6,
    name: "25 Diamonds (Promo)",
    status: "Inactive",
    stock: 0,
    price: 0.25,
    lastUpdated: "2023-01-15",
  },
];

// Mock coupons data
const mockCoupons = [
  {
    id: 1,
    code: "FREEDIAMONDS10",
    discount: "10%",
    type: "Percentage",
    uses: 100,
    status: "Active",
  },
  {
    id: 2,
    code: "SAVE20",
    discount: "$20",
    type: "Fixed Amount",
    uses: 50,
    status: "Inactive",
  },
];

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
  const [openDeleteModal, setOpenDeleteModal] = useState(false);
  const [openStatusModal, setOpenStatusModal] = useState(false); // Rename state for clarity
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [statusFilter, setStatusFilter] = useState("all");

  const onSubmitCoupon = (data: CreateCouponSchemaType) => {
    console.log(data);

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
        console.log(error);
        toast.error(error.response?.data?.message || "Failed to create coupon");
      }
    });
  };

  const handleDeleteSuccess = () => {
    setOpenDeleteModal(false);
    setSelectedProduct(null);
    fetchProducts(); // Refresh the table
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

  // New product form state
  const [newProduct, setNewProduct] = useState({
    name: "",
    price: "",
    initialStock: "",
    category: "diamonds",
    description: "",
    tags: "",
    sortOrder: "1",
    featured: false,
  });

  // New coupon form state
  const [newCoupon, setNewCoupon] = useState({
    code: "",
    discountType: "",
    discountValue: "",
    maxUses: "100",
    minOrder: "0",
    expiryDate: "",
    description: "",
  });

  const getStatusBadgeVariant = (status: string) => {
    return status === "Active" ? "default" : "secondary";
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <PageHeader back title="Inventory Management" />
        <div className="w-full md:w-auto flex flex-wrap gap-2">
          {/* <Button variant="outline" asChild>
            <Link href="/a/shop/coupons">
              <IconChartBar className="mr-2 h-4 w-4" />
              Coupon Metrics
            </Link>
          </Button>
          <Button variant="outline">
            <IconDownload className="mr-2 h-4 w-4" />
            Export
          </Button> */}
          <AddProductModal onSuccess={() => fetchProducts()} />
        </div>
      </div>

      {/* Filter Tabs */}
      <Tabs value={statusFilter} onValueChange={setStatusFilter}>
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
          <CardTitle>Virtual Diamond Products</CardTitle>
          <p className="text-sm text-muted-foreground">
            Manage your virtual diamond products and their stock.
          </p>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
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
                  <TableCell colSpan={6} className="text-center">
                    Loading products...
                  </TableCell>
                </TableRow>
              ) : filteredProducts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center">
                    No products found.
                  </TableCell>
                </TableRow>
              ) : (
                filteredProducts.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell>
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <IconDiamond className="h-4 w-4 text-primary" />
                          <span className="font-medium">{product.name}</span>
                        </div>
                        <span className="capitalize text-xs text-muted-foreground ml-6">
                          Type: {product.type}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          product.status === "active" ? "default" : "secondary"
                        }
                        className="capitalize"
                      >
                        {product.status}
                      </Badge>
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
                    <TableCell>
                      {product.updatedAt || formatDate(new Date())}
                    </TableCell>
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
                            <IconTrash className="mr-2 h-4 w-4" /> Delete
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              setSelectedProduct(product);
                              setOpenStatusModal(true);
                            }}
                          >
                            {product.status === "active" ? (
                              <>
                                <IconBan className="mr-2 h-4 w-4" /> Deactivate
                              </>
                            ) : (
                              <>
                                <CheckCircle className="mr-2 h-4 w-4" />{" "}
                                Activate
                              </>
                            )}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          <p className="text-sm text-muted-foreground mt-4">
            Showing 1-{filteredProducts.length} of {filteredProducts.length}{" "}
            products
          </p>
        </CardContent>
      </Card>

      {/* Upload Diamond Codes */}
      <Card>
        <CardHeader>
          <CardTitle>Upload Diamond Codes</CardTitle>
          <p className="text-sm text-muted-foreground">
            Upload a CSV file containing new diamond codes to replenish stock.
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
                <SelectContent>
                  {mockProducts
                    .filter((p) => p.status === "Active")
                    .map((product) => (
                      <SelectItem key={product.id} value={String(product.id)}>
                        {product.name}
                      </SelectItem>
                    ))}
                </SelectContent>
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
              <IconUpload className="mr-2 h-4 w-4" />
              Upload Codes
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Coupons and Discounts */}
      <Card>
        <CardHeader>
          <CardTitle>Coupons and Discounts</CardTitle>
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
                    coupons.map((coupon) => (
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
                              <DropdownMenuItem>Edit</DropdownMenuItem>
                              <DropdownMenuItem
                                className={
                                  coupon.active
                                    ? "text-warning"
                                    : "text-primary"
                                }
                              >
                                {coupon.active ? "Deactivate" : "Activate"}
                              </DropdownMenuItem>
                              <DropdownMenuItem className="text-destructive">
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
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
    </div>
  );
}
