"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import AdminLayout from "@/components/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { useToast } from "@/components/ui/use-toast";
import { Textarea } from "@/components/ui/textarea";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Pencil, Trash2, Plus, ImagePlus } from "lucide-react";

// Mock function to fetch shop items
const fetchShopItems = async () => {
	// In a real app, this would be an API call
	return [
		{
			id: 1,
			name: "Small Diamond Pack",
			description: "Perfect for small purchases and beginners",
			amount: 100,
			price: 1250,
			stock: 1000,
			image: "/placeholder.svg?height=100&width=100",
		},
		{
			id: 2,
			name: "Medium Diamond Pack",
			description: "Great value for regular players",
			amount: 500,
			price: 6000,
			stock: 500,
			image: "/placeholder.svg?height=100&width=100",
		},
		{
			id: 3,
			name: "Large Diamond Pack",
			description: "Ideal for active gamers",
			amount: 1000,
			price: 11000,
			stock: 0,
			image: "/placeholder.svg?height=100&width=100",
		},
	];
};

export function Shop() {
	const [shopItems, setShopItems] = useState<any>([]);
	const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
	const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
	const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
	const [newItem, setNewItem] = useState({
		name: "",
		description: "",
		amount: 0,
		price: 0,
		stock: 0,
		image: "",
	});
	const [editingItem, setEditingItem] = useState<any>(null);
	const [itemToDelete, setItemToDelete] = useState<any>(null);
	const [imagePreview, setImagePreview] = useState("");
	const { toast } = useToast();
	const router = useRouter();

	useEffect(() => {
		const loadShopItems = async () => {
			const items = await fetchShopItems();
			setShopItems(items);
		};
		loadShopItems();
	}, []);

	const handleImageChange = (e: any) => {
		const file = e.target.files[0];
		if (file) {
			const reader: any = new FileReader();
			reader.onloadend = () => {
				if (editingItem) {
					setEditingItem({ ...editingItem, image: reader.result });
				} else {
					setNewItem({ ...newItem, image: reader.result });
				}
				setImagePreview(reader.result);
			};
			reader.readAsDataURL(file);
		}
	};

	const handleAddItem = () => {
		if (
			newItem.name &&
			newItem.amount > 0 &&
			newItem.price > 0 &&
			newItem.stock >= 0
		) {
			setShopItems([...shopItems, { ...newItem, id: Date.now() }]);
			setNewItem({
				name: "",
				description: "",
				amount: 0,
				price: 0,
				stock: 0,
				image: "",
			});
			setImagePreview("");
			setIsAddDialogOpen(false);
			toast({
				title: "Product Added",
				description: "The new product has been added to the shop.",
			});
		} else {
			toast({
				title: "Invalid Input",
				description: "Please fill in all required fields correctly.",
				variant: "destructive",
			});
		}
	};

	const handleEditItem = (item: any) => {
		setEditingItem(item);
		setImagePreview(item.image);
		setIsEditDialogOpen(true);
	};

	const handleUpdateItem = () => {
		if (
			editingItem.name &&
			editingItem.amount > 0 &&
			editingItem.price > 0 &&
			editingItem.stock >= 0
		) {
			setShopItems(
				shopItems.map((item: any) =>
					item.id === editingItem.id ? editingItem : item
				)
			);
			setEditingItem(null);
			setImagePreview("");
			setIsEditDialogOpen(false);
			toast({
				title: "Product Updated",
				description: "The product has been successfully updated.",
			});
		} else {
			toast({
				title: "Invalid Input",
				description: "Please fill in all required fields correctly.",
				variant: "destructive",
			});
		}
	};

	const confirmDelete = (item: any) => {
		setItemToDelete(item);
		setIsDeleteDialogOpen(true);
	};

	const handleDeleteItem = () => {
		setShopItems(
			shopItems.filter((item: any) => item.id !== itemToDelete.id)
		);
		setItemToDelete(null);
		setIsDeleteDialogOpen(false);
		toast({
			title: "Product Deleted",
			description: "The product has been removed from the shop.",
		});
	};

	return (
		<div className="container mx-auto px-4 py-8">
			<div className="flex justify-between items-center mb-8">
				<h1 className="text-3xl font-bold">Shop Management</h1>
				<Button onClick={() => setIsAddDialogOpen(true)}>
					<Plus className="mr-2 h-4 w-4" /> Add New Product
				</Button>
			</div>

			<Card>
				<CardHeader>
					<CardTitle>Shop Products</CardTitle>
				</CardHeader>
				<CardContent>
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Image</TableHead>
								<TableHead>Name</TableHead>
								<TableHead>Diamonds</TableHead>
								<TableHead>Price</TableHead>
								<TableHead>Stock</TableHead>
								<TableHead>Status</TableHead>
								<TableHead>Actions</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{shopItems.map((item: any) => (
								<TableRow key={item.id}>
									<TableCell>
										<img
											src={
												item.image ||
												"/placeholder.svg?height=50&width=50"
											}
											alt={item.name}
											className="w-12 h-12 object-cover rounded"
										/>
									</TableCell>
									<TableCell>
										<div>
											<p className="font-medium">
												{item.name}
											</p>
											<p className="text-xs text-muted-foreground line-clamp-1">
												{item.description}
											</p>
										</div>
									</TableCell>
									<TableCell>{item.amount} 💎</TableCell>
									<TableCell>
										₦{item.price.toLocaleString()}
									</TableCell>
									<TableCell>{item.stock}</TableCell>
									<TableCell>
										<span
											className={`px-2 py-1 rounded text-xs ${
												item.stock > 0
													? "bg-green-100 text-green-800"
													: "bg-red-100 text-red-800"
											}`}
										>
											{item.stock > 0
												? "In Stock"
												: "Out of Stock"}
										</span>
									</TableCell>
									<TableCell>
										<div className="flex space-x-2">
											<Button
												variant="outline"
												size="sm"
												onClick={() =>
													handleEditItem(item)
												}
											>
												<Pencil className="h-4 w-4" />
											</Button>
											<Button
												variant="destructive"
												size="sm"
												onClick={() =>
													confirmDelete(item)
												}
											>
												<Trash2 className="h-4 w-4" />
											</Button>
										</div>
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</CardContent>
			</Card>

			{/* Add Product Dialog */}
			<Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
				<DialogContent className="sm:max-w-[500px]">
					<DialogHeader>
						<DialogTitle>Add New Product</DialogTitle>
						<DialogDescription>
							Add a new product to your shop. Fill in all the
							details below.
						</DialogDescription>
					</DialogHeader>
					<div className="grid gap-4 py-4">
						<div className="grid grid-cols-4 items-center gap-4">
							<Label
								htmlFor="productImage"
								className="text-right"
							>
								Image
							</Label>
							<div className="col-span-3">
								<div className="flex items-center gap-4">
									{imagePreview ? (
										<img
											src={
												imagePreview ||
												"/placeholder.svg"
											}
											alt="Product preview"
											className="w-16 h-16 object-cover rounded"
										/>
									) : (
										<div className="w-16 h-16 bg-gray-100 rounded flex items-center justify-center">
											<ImagePlus className="h-8 w-8 text-gray-400" />
										</div>
									)}
									<label className="cursor-pointer">
										<span className="px-4 py-2 bg-primary text-primary-foreground rounded flex items-center gap-2 hover:bg-primary/90 transition-colors">
											<ImagePlus className="h-4 w-4" />
											Upload Image
										</span>
										<input
											type="file"
											id="productImage"
											accept="image/*"
											className="hidden"
											onChange={handleImageChange}
										/>
									</label>
								</div>
							</div>
						</div>
						<div className="grid grid-cols-4 items-center gap-4">
							<Label htmlFor="productName" className="text-right">
								Name
							</Label>
							<Input
								id="productName"
								value={newItem.name}
								onChange={(e) =>
									setNewItem({
										...newItem,
										name: e.target.value,
									})
								}
								className="col-span-3"
							/>
						</div>
						<div className="grid grid-cols-4 items-start gap-4">
							<Label
								htmlFor="productDescription"
								className="text-right pt-2"
							>
								Description
							</Label>
							<Textarea
								id="productDescription"
								value={newItem.description}
								onChange={(e) =>
									setNewItem({
										...newItem,
										description: e.target.value,
									})
								}
								className="col-span-3"
								rows={3}
							/>
						</div>
						<div className="grid grid-cols-4 items-center gap-4">
							<Label
								htmlFor="productAmount"
								className="text-right"
							>
								Diamonds
							</Label>
							<Input
								id="productAmount"
								type="number"
								value={newItem.amount}
								onChange={(e) =>
									setNewItem({
										...newItem,
										amount: Number(e.target.value),
									})
								}
								className="col-span-3"
							/>
						</div>
						<div className="grid grid-cols-4 items-center gap-4">
							<Label
								htmlFor="productPrice"
								className="text-right"
							>
								Price (₦)
							</Label>
							<Input
								id="productPrice"
								type="number"
								value={newItem.price}
								onChange={(e) =>
									setNewItem({
										...newItem,
										price: Number(e.target.value),
									})
								}
								className="col-span-3"
							/>
						</div>
						<div className="grid grid-cols-4 items-center gap-4">
							<Label
								htmlFor="productStock"
								className="text-right"
							>
								Stock
							</Label>
							<Input
								id="productStock"
								type="number"
								value={newItem.stock}
								onChange={(e) =>
									setNewItem({
										...newItem,
										stock: Number(e.target.value),
									})
								}
								className="col-span-3"
							/>
						</div>
					</div>
					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => setIsAddDialogOpen(false)}
						>
							Cancel
						</Button>
						<Button onClick={handleAddItem}>Add Product</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Edit Product Dialog */}
			<Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
				<DialogContent className="sm:max-w-[500px]">
					<DialogHeader>
						<DialogTitle>Edit Product</DialogTitle>
						<DialogDescription>
							Make changes to the product details below.
						</DialogDescription>
					</DialogHeader>
					{editingItem && (
						<div className="grid gap-4 py-4">
							<div className="grid grid-cols-4 items-center gap-4">
								<Label
									htmlFor="editProductImage"
									className="text-right"
								>
									Image
								</Label>
								<div className="col-span-3">
									<div className="flex items-center gap-4">
										{imagePreview ? (
											<img
												src={
													imagePreview ||
													"/placeholder.svg"
												}
												alt="Product preview"
												className="w-16 h-16 object-cover rounded"
											/>
										) : (
											<div className="w-16 h-16 bg-gray-100 rounded flex items-center justify-center">
												<ImagePlus className="h-8 w-8 text-gray-400" />
											</div>
										)}
										<label className="cursor-pointer">
											<span className="px-4 py-2 bg-primary text-primary-foreground rounded flex items-center gap-2 hover:bg-primary/90 transition-colors">
												<ImagePlus className="h-4 w-4" />
												Upload Image
											</span>
											<input
												type="file"
												id="editProductImage"
												accept="image/*"
												className="hidden"
												onChange={handleImageChange}
											/>
										</label>
									</div>
								</div>
							</div>
							<div className="grid grid-cols-4 items-center gap-4">
								<Label
									htmlFor="editProductName"
									className="text-right"
								>
									Name
								</Label>
								<Input
									id="editProductName"
									value={editingItem.name}
									onChange={(e) =>
										setEditingItem({
											...editingItem,
											name: e.target.value,
										})
									}
									className="col-span-3"
								/>
							</div>
							<div className="grid grid-cols-4 items-start gap-4">
								<Label
									htmlFor="editProductDescription"
									className="text-right pt-2"
								>
									Description
								</Label>
								<Textarea
									id="editProductDescription"
									value={editingItem.description}
									onChange={(e) =>
										setEditingItem({
											...editingItem,
											description: e.target.value,
										})
									}
									className="col-span-3"
									rows={3}
								/>
							</div>
							<div className="grid grid-cols-4 items-center gap-4">
								<Label
									htmlFor="editProductAmount"
									className="text-right"
								>
									Diamonds
								</Label>
								<Input
									id="editProductAmount"
									type="number"
									value={editingItem.amount}
									onChange={(e) =>
										setEditingItem({
											...editingItem,
											amount: Number(e.target.value),
										})
									}
									className="col-span-3"
								/>
							</div>
							<div className="grid grid-cols-4 items-center gap-4">
								<Label
									htmlFor="editProductPrice"
									className="text-right"
								>
									Price (₦)
								</Label>
								<Input
									id="editProductPrice"
									type="number"
									value={editingItem.price}
									onChange={(e) =>
										setEditingItem({
											...editingItem,
											price: Number(e.target.value),
										})
									}
									className="col-span-3"
								/>
							</div>
							<div className="grid grid-cols-4 items-center gap-4">
								<Label
									htmlFor="editProductStock"
									className="text-right"
								>
									Stock
								</Label>
								<Input
									id="editProductStock"
									type="number"
									value={editingItem.stock}
									onChange={(e) =>
										setEditingItem({
											...editingItem,
											stock: Number(e.target.value),
										})
									}
									className="col-span-3"
								/>
							</div>
						</div>
					)}
					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => setIsEditDialogOpen(false)}
						>
							Cancel
						</Button>
						<Button onClick={handleUpdateItem}>Save Changes</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Delete Confirmation Dialog */}
			<Dialog
				open={isDeleteDialogOpen}
				onOpenChange={setIsDeleteDialogOpen}
			>
				<DialogContent className="sm:max-w-[425px]">
					<DialogHeader>
						<DialogTitle>Confirm Deletion</DialogTitle>
						<DialogDescription>
							Are you sure you want to delete this product? This
							action cannot be undone.
						</DialogDescription>
					</DialogHeader>
					{itemToDelete && (
						<div className="py-4">
							<p className="font-medium">{itemToDelete.name}</p>
							<p className="text-sm text-muted-foreground">
								{itemToDelete.amount} Diamonds - ₦
								{itemToDelete.price.toLocaleString()}
							</p>
						</div>
					)}
					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => setIsDeleteDialogOpen(false)}
						>
							Cancel
						</Button>
						<Button
							variant="destructive"
							onClick={handleDeleteItem}
						>
							Delete Product
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
