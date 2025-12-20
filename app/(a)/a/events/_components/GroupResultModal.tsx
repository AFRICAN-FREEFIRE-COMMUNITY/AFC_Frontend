import { ComingSoon } from "@/components/ComingSoon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn, formatDate } from "@/lib/utils";
import { Edit } from "lucide-react"; // Ensure you import Edit
import React from "react";

// Added Props interface for type safety
interface GroupResultModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  activeGroup: any;
}

export const GroupResultModal = ({
  isOpen,
  onOpenChange,
  activeGroup,
}: GroupResultModalProps) => {
  const mockResults = [
    {
      team: "Phoenix Rising",
      kills: 45,
      placement: 1,
      points: 120,
      status: "qualified",
    },
    {
      team: "Storm Breakers",
      kills: 38,
      placement: 2,
      points: 105,
      status: "qualified",
    },
    {
      team: "Shadow Hunters",
      kills: 22,
      placement: 7,
      points: 55,
      status: "eliminated",
    },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {activeGroup?.group_name || "Group"} Results - Qualifiers
          </DialogTitle>
        </DialogHeader>

        <div className="bg-primary/10 p-4 rounded-lg mb-1 text-xs space-y-1.5">
          <p>
            <span className="font-medium">Date:</span>{" "}
            {formatDate(new Date("2024-02-01"))} at 14:00
          </p>
          <p>
            <span className="font-medium">Maps:</span> Bermuda, Kalahari,
            Purgatory
          </p>
          <p>
            <span className="font-medium text-white">Teams Qualify:</span> 6
          </p>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12 ">#</TableHead>
              <TableHead className="">Team</TableHead>
              <TableHead className="text-center ">Kills</TableHead>
              <TableHead className="text-center ">Placement</TableHead>
              <TableHead className="text-center ">Points</TableHead>
              <TableHead className="text-right ">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody></TableBody>
        </Table>

        <DialogFooter className="mt-4 gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button disabled>
            <Edit /> Edit Results
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
