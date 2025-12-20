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
          <TableBody className="relative">
            <ComingSoon />
            {mockResults.map((res, i) => (
              <TableRow key={i}>
                <TableCell className="font-medium">{i + 1}</TableCell>
                <TableCell className="font-bold">{res.team}</TableCell>
                <TableCell className="text-center">{res.kills}</TableCell>
                <TableCell className="text-center">{res.placement}</TableCell>
                <TableCell className="text-center font-bold text-yellow-500">
                  {res.points}
                </TableCell>
                <TableCell className="text-right">
                  <Badge
                    className={cn(
                      "capitalize",
                      res.status === "qualified"
                        ? "bg-white text-black"
                        : "bg-red-500 text-white"
                    )}
                  >
                    {res.status}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {/* <DialogFooter className="mt-4 gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button>
            <Edit /> Edit Results
          </Button>
        </DialogFooter> */}
      </DialogContent>
    </Dialog>
  );
};
