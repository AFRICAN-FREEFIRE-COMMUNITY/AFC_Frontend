"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Edit, X } from "lucide-react";
import { useState, useEffect } from "react";
import axios from "axios";
import { toast } from "sonner";
import { env } from "@/lib/env";
import { useAuth } from "@/contexts/AuthContext";

interface Category {
  id?: string;
  _id?: string;
  name: string;
  section: string;
  section_id?: string;
}

interface Section {
  id?: string;
  _id?: string;
  name: string;
  title?: string;
}

interface EditCategoryModalProps {
  category: Category;
  sections: Section[];
  onCategoryUpdated: () => void;
}

export function EditCategoryModal({
  category,
  sections,
  onCategoryUpdated,
}: EditCategoryModalProps) {
  const { token } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    category_id: "",
    name: "",
    section_id: "",
  });

  // Initialize form data when modal opens
  useEffect(() => {
    if (open) {
      setFormData({
        category_id: category.id || category._id || "",
        name: category.name || "",
        section_id: category.section_id || "",
      });
    }
  }, [open, category]);

  const handleEditCategory = async () => {
    if (!formData.name.trim() || !formData.section_id) {
      toast.error("Category name and section are required");
      return;
    }

    try {
      setLoading(true);
      await axios.post(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/awards/categories/edit/`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      toast.success("Category updated successfully 🎉");
      setOpen(false);
      onCategoryUpdated(); // refresh categories
    } catch (error: any) {
      console.error(error);
      toast.error(error.response?.data?.message || "Failed to update category");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon">
          <Edit className="h-4 w-4" />
          <span className="sr-only">Edit</span>
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-lg bg-[#111827] border border-gray-700 text-white">
        <DialogHeader>
          <DialogTitle className="flex items-center text-xl">
            <Edit className="w-5 h-5 text-blue-500 mr-2" /> Edit Category
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          <div>
            <label className="block text-sm font-medium mb-3 text-gray-300">
              Category Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              placeholder="e.g., Best Content Creator"
              className="w-full border border-gray-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-3 text-gray-300">
              Section *
            </label>
            <Select
              value={formData.section_id}
              onValueChange={(value) =>
                setFormData({ ...formData, section_id: value })
              }
            >
              <SelectTrigger className="w-full border-gray-600 bg-transparent text-white">
                <SelectValue placeholder="Select a section" />
              </SelectTrigger>
              <SelectContent className="bg-[#1f2937] border-gray-600">
                {sections.map((section) => (
                  <SelectItem
                    key={section.id || section._id}
                    value={section.id || section._id || ""}
                    className="text-white hover:bg-gray-700"
                  >
                    {section.name || section.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-gray-500 text-xs mt-2">
              Choose the section this category belongs to
            </p>
          </div>
        </div>

        <DialogFooter className="mt-6 flex justify-end gap-3">
          <Button
            onClick={handleEditCategory}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {loading ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                Updating...
              </>
            ) : (
              <>
                <Edit className="w-5 h-5 mr-2" /> Update Category
              </>
            )}
          </Button>

          <Button variant="ghost" onClick={() => setOpen(false)}>
            <X className="w-5 h-5 mr-2" /> Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
