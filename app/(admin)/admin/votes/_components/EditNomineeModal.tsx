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
import { Edit, X } from "lucide-react";
import { useState, useEffect } from "react";
import axios from "axios";
import { toast } from "sonner";
import { env } from "@/lib/env";
import { useAuth } from "@/contexts/AuthContext";

interface Nominee {
  id?: string;
  _id?: string;
  name: string;
  video_url?: string;
  bio?: string;
  description?: string;
}

interface EditNomineeModalProps {
  nominee: Nominee;
  onNomineeUpdated: () => void;
}

export function EditNomineeModal({
  nominee,
  onNomineeUpdated,
}: EditNomineeModalProps) {
  const { token } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    nominee_id: "",
    name: "",
    video_url: "",
  });

  // Initialize form data when modal opens
  useEffect(() => {
    if (open) {
      setFormData({
        nominee_id: nominee.id || nominee._id || "",
        name: nominee.name || "",
        video_url: nominee.video_url || "",
      });
    }
  }, [open, nominee]);

  const handleEditNominee = async () => {
    if (!formData.name.trim()) {
      toast.error("Nominee name is required");
      return;
    }

    try {
      setLoading(true);
      await axios.post(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/awards/nominees/edit/`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      toast.success("Nominee updated successfully 🎉");
      setOpen(false);
      onNomineeUpdated(); // refresh nominees
    } catch (error: any) {
      console.error(error);
      toast.error(error.response?.data?.message || "Failed to update nominee");
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
            <Edit className="w-5 h-5 text-blue-500 mr-2" /> Edit Nominee
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          <div>
            <label className="block text-sm font-medium mb-3 text-gray-300">
              Nominee Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              placeholder="e.g., John Doe"
              className="w-full border border-gray-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-3 text-gray-300">
              Video URL <span className="text-gray-500">(Optional)</span>
            </label>
            <input
              type="url"
              value={formData.video_url}
              onChange={(e) =>
                setFormData({ ...formData, video_url: e.target.value })
              }
              placeholder="https://youtube.com/watch?v=..."
              className="w-full border border-gray-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-transparent"
            />
            <p className="text-gray-500 text-xs mt-2">
              Add a video URL for video-based award categories
            </p>
          </div>
        </div>

        <DialogFooter className="mt-6 flex justify-end gap-3">
          <Button
            onClick={handleEditNominee}
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
                <Edit className="w-5 h-5 mr-2" /> Update Nominee
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
