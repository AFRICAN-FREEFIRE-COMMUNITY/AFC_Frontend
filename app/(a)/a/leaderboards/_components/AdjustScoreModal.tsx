"use client";

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { IconDeviceFloppy, IconLoader2 } from "@tabler/icons-react";
import { env } from "@/lib/env";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader } from "@/components/Loader";

export const AdjustScoreModal = ({
  open,
  onClose,
  match, // The specific match object containing stats
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  match: any;
  onSuccess: () => void;
}) => {
  const { token } = useAuth();
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<any[]>([]);

  // Initialize rows from the match statistics
  useEffect(() => {
    if (match?.stats) {
      setRows(
        match.stats.map((s: any) => ({
          competitor_id: s.competitor_id,
          // ✅ Fix: Use the double-underscore key from your API
          username: s.username || "Unknown",
          placement: s.placement?.toString() || "0",
          kills: s.kills?.toString() || "0",
          // ✅ Handle cases where bonus/penalty might be null/undefined in the API
          bonus_points: s.bonus_points?.toString() || "0",
          penalty_points: s.penalty_points?.toString() || "0",
        }))
      );
    }
  }, [match]);

  const handleInputChange = (index: number, field: string, value: string) => {
    const updatedRows = [...rows];
    updatedRows[index][field] = value;
    setRows(updatedRows);
  };

  const handleSave = async () => {
    setLoading(true);

    const payload = {
      match_id: match.match_id.toString(),
      rows: rows.map((r) => ({
        competitor_id: r.competitor_id.toString(),
        placement: parseInt(r.placement) || 0,
        kills: parseInt(r.kills) || 0,
        bonus_points: parseFloat(r.bonus_points) || 0,
        penalty_points: parseFloat(r.penalty_points) || 0,
      })),
    };

    try {
      const res = await fetch(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/edit-solo-match-result/`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        }
      );

      if (res.ok) {
        toast.success("Scores updated successfully");
        onSuccess();
        onClose();
      } else {
        toast.error("Failed to update scores");
      }
    } catch (error) {
      console.error(error);
      toast.error("An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Adjust Scores: Match {match?.match_number} ({match?.match_map})
          </DialogTitle>
        </DialogHeader>

        <div className="max-h-[60vh] overflow-auto border rounded-md">
          <Table>
            <TableHeader className="sticky top-0 z-10">
              <TableRow>
                <TableHead className="text-zinc-400">Competitor</TableHead>
                <TableHead className="text-zinc-400 w-20">Rank</TableHead>
                <TableHead className="text-zinc-400 w-20">Kills</TableHead>
                <TableHead className="text-zinc-400 w-24">Bonus</TableHead>
                <TableHead className="text-zinc-400 w-24">Penalty</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, idx) => (
                <TableRow key={row.competitor_id}>
                  <TableCell className="font-medium">{row.username}</TableCell>
                  <TableCell>
                    <Input
                      value={row.placement}
                      onChange={(e) =>
                        handleInputChange(idx, "placement", e.target.value)
                      }
                      className="h-8"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      value={row.kills}
                      onChange={(e) =>
                        handleInputChange(idx, "kills", e.target.value)
                      }
                      className="h-8"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      value={row.bonus_points}
                      onChange={(e) =>
                        handleInputChange(idx, "bonus_points", e.target.value)
                      }
                      className="h-8"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      value={row.penalty_points}
                      onChange={(e) =>
                        handleInputChange(idx, "penalty_points", e.target.value)
                      }
                      className="h-8 text-red-400"
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <DialogFooter className="pt-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? (
              <Loader text="Saving..." />
            ) : (
              <>
                <IconDeviceFloppy size={18} className="mr-2" />
                Save Changes
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
