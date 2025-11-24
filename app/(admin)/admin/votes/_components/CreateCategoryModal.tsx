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
import { FolderPlus, Plus, X } from "lucide-react";
import { useState } from "react";

export function CreateCategoryModal({
  sections,
  handleAddNewCategory,
  loadingCategory,
  newCategoryData,
  setNewCategoryData,
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-yellow-600 hover:bg-yellow-700 text-white">
          <Plus className="w-4 h-4 mr-2" /> New Category
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center text-xl">
            <FolderPlus className="w-5 h-5 text-yellow-500 mr-2" /> Create New
            Category
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          <div>
            <label className="block text-sm font-medium mb-3 text-gray-300">
              Category Name *
            </label>
            <input
              type="text"
              value={newCategoryData.name}
              onChange={(e) =>
                setNewCategoryData({ ...newCategoryData, name: e.target.value })
              }
              placeholder="e.g., Best Content Creator"
              className="w-full border border-gray-600 rounded-md px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-3 text-gray-300">
              Section *
            </label>
            <select
              value={newCategoryData.section_id}
              onChange={(e) =>
                setNewCategoryData({
                  ...newCategoryData,
                  section_id: e.target.value,
                })
              }
              className="w-full border border-gray-600 rounded-md px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
            >
              <option value="">-- Select a section --</option>
              {sections.map((section) => (
                <option
                  key={section.id || section._id}
                  value={section.id || section._id}
                >
                  {section.name || section.title}
                </option>
              ))}
            </select>
          </div>
        </div>

        <DialogFooter className="mt-6">
          <Button
            onClick={async () => {
              await handleAddNewCategory();
              setOpen(false);
            }}
            disabled={loadingCategory}
            className="bg-yellow-600 hover:bg-yellow-700 text-white"
          >
            {loadingCategory ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                Creating...
              </>
            ) : (
              <>
                <Plus className="w-5 h-5 mr-2" /> Create Category
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
