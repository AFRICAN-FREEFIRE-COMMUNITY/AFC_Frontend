"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { UserMinus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { env } from "@/lib/env";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";

export function RemoveNomineeModal({
  nominee,
  onNomineeRemoved,
}: {
  nominee: any;
  onNomineeRemoved: () => void;
}) {
  const { token } = useAuth();

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("");

  const nomineeCategories = nominee.categories || [];

  const handleRemoveNominee = async () => {
    if (!selectedCategory) {
      toast.error("Please select a category");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        `https://api.africanfreefirecommunity.com/awards/category-nominee/remove/`,
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            category_id: selectedCategory,
            nominee_id: `${nominee.id || nominee._id}`,
          }),
        }
      );

      const data = await response.json();

      if (response.ok) {
        toast.success("Nominee removed from category successfully!");
        setSelectedCategory("");
        setOpen(false);
        onNomineeRemoved();
      } else {
        toast.error(
          data.message || data.error || "Failed to remove nominee from category"
        );
      }
    } catch (error) {
      toast.error("An error occurred. Please try again.");
      console.error("Error removing nominee:", error);
    } finally {
      setLoading(false);
    }
  };

  // Don't show button if nominee has no categories
  if (nomineeCategories.length === 0) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" title="Remove from category">
          <UserMinus className="w-4 h-4 text-red-500" />
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-lg bg-[#111827] border border-gray-700 text-white">
        <DialogHeader>
          <DialogTitle className="flex items-center text-xl">
            <UserMinus className="w-5 h-5 text-red-500 mr-2" /> Remove Nominee
            from Category
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          <div className="bg-gray-800 rounded-md p-4 border border-gray-700">
            <p className="text-sm text-gray-300 mb-1">Nominee:</p>
            <p className="font-semibold text-white">{nominee.name}</p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-3 text-gray-300">
              Select Category to Remove From *
            </label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full border border-gray-600 rounded-md px-4 py-3 bg-gray-800 text-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
            >
              <option value="">-- Choose a category --</option>
              {nomineeCategories.map((cat: any) => (
                <option key={cat.id || cat._id} value={cat.id || cat._id}>
                  {cat.name} {cat.section && `(${cat.section})`}
                </option>
              ))}
            </select>
          </div>

          {selectedCategory && (
            <div className="bg-red-900/20 border border-red-800 rounded-md p-3">
              <p className="text-sm text-red-400">
                Warning: This will remove <strong>{nominee.name}</strong> from
                the selected category. This action cannot be undone.
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="mt-6 flex justify-end gap-3">
          <Button
            variant="ghost"
            onClick={() => {
              setOpen(false);
              setSelectedCategory("");
            }}
            disabled={loading}
          >
            Cancel
          </Button>

          <Button
            onClick={handleRemoveNominee}
            disabled={loading || !selectedCategory}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            {loading ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                Removing...
              </>
            ) : (
              <>
                <Trash2 className="w-5 h-5 mr-2" /> Remove
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
