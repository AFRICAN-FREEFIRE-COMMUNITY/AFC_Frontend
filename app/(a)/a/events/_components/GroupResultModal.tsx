import { ComingSoon } from "@/components/ComingSoon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
  activeGroup: any;
  stageName: string;
}

export const GroupResultModal = ({
  activeGroup,
  stageName,
}: GroupResultModalProps) => {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="secondary" type="button" size="md" className="flex-1">
          View Results
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {activeGroup?.group_name || "Group"} Results - {stageName}
          </DialogTitle>
        </DialogHeader>

        <div className="bg-primary/10 p-4 rounded-lg mb-1 text-xs space-y-1.5">
          <p>
            <span className="font-medium">Date:</span>{" "}
            {formatDate(activeGroup.playing_date)} at {activeGroup.playing_time}
          </p>
          <p className="flex items-center justify-start gap-1">
            <span className="font-medium">Maps:</span>{" "}
            {activeGroup.match_maps.join(", ")}
          </p>
          <p>
            <span className="font-medium text-white">Teams Qualify:</span>{" "}
            {activeGroup.teams_qualifying}
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
          <DialogClose asChild>
            <Button variant={"outline"}>Close</Button>
          </DialogClose>
          <Button disabled>
            <Edit /> Edit Results
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
