"use client";

import { useState } from "react";
import { Plus, X, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import axios from "axios";
import { toast } from "sonner";
import { env } from "@/lib/env";
import { useAuth } from "@/contexts/AuthContext";

export function AddSectionModal({
  onSectionAdded,
}: {
  onSectionAdded: () => void;
}) {
  const { token } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    max_votes: 12,
  });

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      toast.error("Section name is required");
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/awards/sections/add/`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      toast.success("Section created successfully");
      setFormData({ name: "", max_votes: 12 });
      setOpen(false);
      onSectionAdded(); // refresh the section list
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to create section");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Trigger Button */}
      <Button
        onClick={() => setOpen(true)}
        className="bg-purple-600 flex-1 hover:bg-purple-700 text-white flex items-center gap-2"
      >
        <Plus className="w-4 h-4" />
        New Section
      </Button>

      {/* Modal */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md bg-[#111827] text-white border border-gray-700 rounded-md">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              <Plus className="w-5 h-5 text-purple-500" />
              Create New Section
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-3">
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-300">
                Section Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="e.g., Content Creator Awards"
                className="w-full border border-gray-600 rounded-md px-4 py-3 bg-transparent text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2 text-gray-300">
                Max Votes *
              </label>
              <input
                type="number"
                min={1}
                max={50}
                value={formData.max_votes}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    max_votes: Number(e.target.value),
                  })
                }
                placeholder="Enter max votes"
                className="w-full border border-gray-600 rounded-md px-4 py-3 bg-transparent text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
              <p className="text-gray-500 text-xs mt-2">
                Maximum number of votes allowed per user in this section
              </p>
            </div>
          </div>

          <DialogFooter className="flex justify-end gap-3 mt-4">
            <Button
              variant="ghost"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 border border-gray-700 hover:bg-gray-800"
            >
              <X className="w-4 h-4" /> Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={loading}
              className="bg-purple-600 hover:bg-purple-700 text-white flex items-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Creating...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" /> Create Section
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
