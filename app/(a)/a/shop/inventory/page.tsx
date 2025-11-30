"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
} from "@tabler/icons-react";
import { MoreHorizontal, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

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
  const [statusFilter, setStatusFilter] = useState("all");
  const [addProductOpen, setAddProductOpen] = useState(false);
  const [couponTab, setCouponTab] = useState("active");

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

  const filteredProducts = mockProducts.filter((product) => {
    if (statusFilter === "all") return true;
    if (statusFilter === "active") return product.status === "Active";
    if (statusFilter === "inactive") return product.status === "Inactive";
    return true;
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
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link href="/a/shop/coupons">
              <IconChartBar className="mr-2 h-4 w-4" />
              Coupon Metrics
            </Link>
          </Button>
          <Button variant="outline">
            <IconDownload className="mr-2 h-4 w-4" />
            Export
          </Button>
          <Dialog open={addProductOpen} onOpenChange={setAddProductOpen}>
            <DialogTrigger asChild>
              <Button>
                <IconCirclePlus className="mr-2 h-4 w-4" />
                Add Product
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Add New Product</DialogTitle>
                <DialogDescription>
                  Fill in the details for the new virtual diamond product.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="productName">Product Name *</Label>
                    <Input
                      id="productName"
                      placeholder="e.g., 2500 Diamonds"
                      value={newProduct.name}
                      onChange={(e) =>
                        setNewProduct({ ...newProduct, name: e.target.value })
                      }
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="price">Price ($) *</Label>
                    <Input
                      id="price"
                      type="number"
                      placeholder="25.00"
                      value={newProduct.price}
                      onChange={(e) =>
                        setNewProduct({ ...newProduct, price: e.target.value })
                      }
                      className="mt-1"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="initialStock">Initial Stock *</Label>
                    <Input
                      id="initialStock"
                      type="number"
                      placeholder="0"
                      value={newProduct.initialStock}
                      onChange={(e) =>
                        setNewProduct({
                          ...newProduct,
                          initialStock: e.target.value,
                        })
                      }
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="category">Category</Label>
                    <Select
                      value={newProduct.category}
                      onValueChange={(value) =>
                        setNewProduct({ ...newProduct, category: value })
                      }
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="diamonds">Diamonds</SelectItem>
                        <SelectItem value="bundles">Bundles</SelectItem>
                        <SelectItem value="skins">Skins</SelectItem>
                        <SelectItem value="characters">Characters</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    placeholder="Brief description of the product and its benefits"
                    value={newProduct.description}
                    onChange={(e) =>
                      setNewProduct({
                        ...newProduct,
                        description: e.target.value,
                      })
                    }
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="productImage">Product Image</Label>
                  <Input id="productImage" type="file" className="mt-1" />
                  <p className="text-xs text-muted-foreground mt-1">
                    Upload a product image (PNG, JPG, or GIF)
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="tags">Tags</Label>
                    <Input
                      id="tags"
                      placeholder="popular, best-value, limited"
                      value={newProduct.tags}
                      onChange={(e) =>
                        setNewProduct({ ...newProduct, tags: e.target.value })
                      }
                      className="mt-1"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Comma-separated tags
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="sortOrder">Sort Order</Label>
                    <Input
                      id="sortOrder"
                      type="number"
                      placeholder="1"
                      value={newProduct.sortOrder}
                      onChange={(e) =>
                        setNewProduct({
                          ...newProduct,
                          sortOrder: e.target.value,
                        })
                      }
                      className="mt-1"
                    />
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="featured"
                    checked={newProduct.featured}
                    onCheckedChange={(checked) =>
                      setNewProduct({ ...newProduct, featured: checked })
                    }
                  />
                  <Label htmlFor="featured">Featured Product</Label>
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setAddProductOpen(false)}
                >
                  Cancel
                </Button>
                <Button onClick={() => setAddProductOpen(false)}>
                  Save Product
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
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
                <TableHead>Last Updated</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProducts.map((product) => (
                <TableRow key={product.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <IconDiamond className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{product.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={getStatusBadgeVariant(product.status)}>
                      {product.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{product.stock}</TableCell>
                  <TableCell>{formatCurrency(product.price)}</TableCell>
                  <TableCell>{product.lastUpdated}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>Edit</DropdownMenuItem>
                        <DropdownMenuItem>View Details</DropdownMenuItem>
                        <DropdownMenuItem>
                          {product.status === "Active"
                            ? "Deactivate"
                            : "Activate"}
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive">
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
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
        <CardContent>
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
                    <TableHead>Type</TableHead>
                    <TableHead>Uses</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mockCoupons.map((coupon) => (
                    <TableRow key={coupon.id}>
                      <TableCell className="font-mono font-medium">
                        {coupon.code}
                      </TableCell>
                      <TableCell>{coupon.discount}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{coupon.type}</Badge>
                      </TableCell>
                      <TableCell>{coupon.uses}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            coupon.status === "Active" ? "default" : "secondary"
                          }
                        >
                          {coupon.status}
                        </Badge>
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
                            <DropdownMenuItem>
                              {coupon.status === "Active"
                                ? "Deactivate"
                                : "Activate"}
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive">
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TabsContent>

            <TabsContent value="create" className="mt-4">
              <div className="grid gap-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="couponCode">Coupon Code *</Label>
                    <Input
                      id="couponCode"
                      placeholder="e.g., SUMMER20"
                      value={newCoupon.code}
                      onChange={(e) =>
                        setNewCoupon({ ...newCoupon, code: e.target.value })
                      }
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="discountType">Discount Type *</Label>
                    <Select
                      value={newCoupon.discountType}
                      onValueChange={(value) =>
                        setNewCoupon({ ...newCoupon, discountType: value })
                      }
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select discount type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="percentage">Percentage</SelectItem>
                        <SelectItem value="fixed">Fixed Amount</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="discountValue">Discount Value *</Label>
                    <Input
                      id="discountValue"
                      placeholder="e.g., 10% or $5"
                      value={newCoupon.discountValue}
                      onChange={(e) =>
                        setNewCoupon({
                          ...newCoupon,
                          discountValue: e.target.value,
                        })
                      }
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="maxUses">Maximum Uses *</Label>
                    <Input
                      id="maxUses"
                      type="number"
                      placeholder="100"
                      value={newCoupon.maxUses}
                      onChange={(e) =>
                        setNewCoupon({ ...newCoupon, maxUses: e.target.value })
                      }
                      className="mt-1"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="minOrder" className="text-primary">
                      Minimum Order Amount ($)
                    </Label>
                    <Input
                      id="minOrder"
                      type="number"
                      placeholder="0"
                      value={newCoupon.minOrder}
                      onChange={(e) =>
                        setNewCoupon({ ...newCoupon, minOrder: e.target.value })
                      }
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="expiryDate">Expiry Date *</Label>
                    <Input
                      id="expiryDate"
                      type="date"
                      value={newCoupon.expiryDate}
                      onChange={(e) =>
                        setNewCoupon({
                          ...newCoupon,
                          expiryDate: e.target.value,
                        })
                      }
                      className="mt-1"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="couponDescription">Description</Label>
                  <Textarea
                    id="couponDescription"
                    placeholder="Brief description of the coupon offer"
                    value={newCoupon.description}
                    onChange={(e) =>
                      setNewCoupon({
                        ...newCoupon,
                        description: e.target.value,
                      })
                    }
                    className="mt-1"
                  />
                </div>
                <Button className="w-full">Create Coupon</Button>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
