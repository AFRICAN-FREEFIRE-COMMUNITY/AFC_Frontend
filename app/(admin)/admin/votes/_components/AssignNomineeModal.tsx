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
import { Plus, UserPlus, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { env } from "@/lib/env";
import { useAuth } from "@/contexts/AuthContext";

export function AssignNomineeModal({
  categories,
  nominees,
  setStats,
}: {
  categories: any[];
  nominees: any[];
  setStats: (fn: (prev: any) => any) => void;
}) {
  const { token } = useAuth();

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    category_id: "",
    nominee_id: "",
  });
  const [message, setMessage] = useState({ type: "", text: "" });

  const handleAssignNominee = async () => {
    if (!formData.category_id || !formData.nominee_id) {
      setMessage({
        type: "error",
        text: "Please select both category and nominee",
      });
      return;
    }

    setLoading(true);
    setMessage({ type: "", text: "" });

    try {
      const response = await fetch(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/awards/category-nominee/add/`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(formData),
        }
      );

      const data = await response.json();

      if (response.ok) {
        setMessage({
          type: "success",
          text: "Nominee added to category successfully!",
        });
        setFormData({ category_id: "", nominee_id: "" });
        setStats((prev) => ({
          ...prev,
          totalAssignments: prev.totalAssignments + 1,
        }));
        toast.success("Nominee assigned successfully 🎉");
      } else {
        setMessage({
          type: "error",
          text: data.message || "Failed to add nominee to category",
        });
        toast.error(data.message || "Failed to add nominee to category");
      }
    } catch (error) {
      setMessage({
        type: "error",
        text: "An error occurred. Please try again.",
      });
      toast.error("An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setFormData({ category_id: "", nominee_id: "" });
    setMessage({ type: "", text: "" });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-green-600 hover:bg-green-700 text-white">
          <UserPlus className="w-4 h-4 mr-2" /> Assign Nominee
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-lg bg-[#111827] border border-gray-700 text-white">
        <DialogHeader>
          <DialogTitle className="flex items-center text-xl">
            <UserPlus className="w-5 h-5 text-green-500 mr-2" /> Assign Nominee
            to Category
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Category Selector */}
          <div>
            <label className="block text-sm font-medium mb-3 text-gray-300">
              Select Category *
            </label>
            <select
              value={formData.category_id}
              onChange={(e) =>
                setFormData({ ...formData, category_id: e.target.value })
              }
              className="w-full border border-gray-600 text-black rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
            >
              <option value="">-- Choose a category --</option>
              {categories.map((cat) => (
                <option key={cat.id || cat._id} value={cat.id || cat._id}>
                  {cat.name || cat.title}
                </option>
              ))}
            </select>
          </div>

          {/* Nominee Selector */}
          <div>
            <label className="block text-sm font-medium mb-3 text-gray-300">
              Select Nominee *
            </label>
            <select
              value={formData.nominee_id}
              onChange={(e) =>
                setFormData({ ...formData, nominee_id: e.target.value })
              }
              className="w-full border border-gray-600 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-black"
            >
              <option value="">-- Choose a nominee --</option>
              {nominees.map((nom) => (
                <option key={nom.id || nom._id} value={nom.id || nom._id}>
                  {nom.name}
                </option>
              ))}
            </select>
          </div>

          {/* Message */}
          {message.text && (
            <p
              className={`text-sm mt-2 ${
                message.type === "error" ? "text-red-400" : "text-green-400"
              }`}
            >
              {message.text}
            </p>
          )}
        </div>

        <DialogFooter className="mt-6 flex justify-end gap-3">
          <Button
            onClick={handleAssignNominee}
            disabled={loading}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            {loading ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                Assigning...
              </>
            ) : (
              <>
                <Plus className="w-5 h-5 mr-2" /> Assign
              </>
            )}
          </Button>

          <Button variant="ghost" onClick={handleReset}>
            <X className="w-5 h-5 mr-2" /> Reset
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
