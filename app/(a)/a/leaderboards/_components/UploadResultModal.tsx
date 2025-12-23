"use client";

import React, { useRef, useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  IconUpload,
  IconLoader2,
  IconCircleCheck,
  IconFileDescription,
  IconX,
  IconFile,
} from "@tabler/icons-react";
import { env } from "@/lib/env";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { Loader } from "@/components/Loader";

export const UploadResultModal = ({
  onClose,
  open,
  currentGroup,
}: {
  open: boolean;
  onClose: () => void;
  currentGroup: any;
}) => {
  const { token } = useAuth();
  const [selectedMatchId, setSelectedMatchId] = useState<string>("");

  // Track single file and its metadata
  const [file, setFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);

  const [pending, startTransition] = useTransition();
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 🧠 Logic for single file handling
  const handleFileProcess = (selectedFile: File) => {
    setFile(selectedFile);
    setIsCompleted(false);
    setUploadProgress(0);

    // Simulated progress UI
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 30;
      if (progress >= 100) {
        setUploadProgress(100);
        setIsCompleted(true);
        clearInterval(interval);
      } else {
        setUploadProgress(progress);
      }
    }, 200);
  };

  const handleRemoveFile = () => {
    setFile(null);
    setUploadProgress(0);
    setIsCompleted(false);
    // Reset the input value so the same file can be re-selected if needed
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      handleFileProcess(e.target.files[0]);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files?.[0]) {
      handleFileProcess(e.dataTransfer.files[0]);
    }
  };

  const removeFile = () => {
    setFile(null);
    setUploadProgress(0);
    setIsCompleted(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleUpload = async () => {
    if (!selectedMatchId || !file) {
      toast.error("Please select a match and a file");
      return;
    }

    const formData = new FormData();
    formData.append("match_id", selectedMatchId);
    formData.append("file", file);

    startTransition(async () => {
      try {
        const res = await fetch(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/upload-solo-match-result/`,
          {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
            body: formData,
          }
        );

        if (res.ok) {
          toast.success("Result uploaded successfully!");
          onClose();
          window.location.reload();
        } else {
          const error = await res.json();
          toast.error(error.message || "Failed to upload result");
        }
      } catch (error) {
        toast.error("An unexpected error occurred");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <IconUpload className="size-5 text-primary" />
            Upload Match Result
          </DialogTitle>
          <DialogDescription className="text-left truncate">
            Target:{" "}
            <span className="text-white font-medium">
              {currentGroup?.group_name}
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 py-4">
          {/* Match Selection */}
          <div className="space-y-2">
            <Label>Target Match</Label>
            <Select value={selectedMatchId} onValueChange={setSelectedMatchId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a match" />
              </SelectTrigger>
              <SelectContent>
                {currentGroup?.matches?.map((match: any) => (
                  <SelectItem
                    key={match.match_id}
                    value={match.match_id.toString()}
                  >
                    Match {match.match_number} ({match.match_map})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Result File (.txt / debugger)</Label>

            {!file ? (
              /* Initial Dropzone View */
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed rounded-md p-10 text-center cursor-pointer hover:bg-muted/10 transition-colors"
              >
                {/* Dropzone Content */}
                <p className="text-sm text-muted-foreground">
                  Drag and drop your file here, or{" "}
                  <span className="text-primary font-medium">
                    click to browse
                  </span>
                </p>
              </div>
            ) : (
              /* Selected Document View with "Change" Option */
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg border border-border">
                  <div className="size-10 rounded bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <IconFileDescription size={20} className="text-primary" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center mb-1">
                      <p className="text-sm font-medium line-clamp-1 max-w-[220px] pr-2">
                        {file.name}
                      </p>
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                        {(file.size / 1024).toFixed(0)} KB
                      </span>
                    </div>
                    <Progress value={uploadProgress} className="h-1" />
                  </div>

                  <div className="flex-shrink-0">
                    {isCompleted ? (
                      <IconCircleCheck size={20} className="text-green-500" />
                    ) : (
                      <button
                        onClick={handleRemoveFile}
                        className="p-1 hover:bg-destructive/10 rounded-full text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <IconX size={18} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Explicit "Change Document" button once upload simulation is done */}
                {isCompleted && (
                  <button
                    onClick={handleRemoveFile}
                    className="text-xs text-blue-500 hover:text-blue-400 font-medium text-left ml-1 flex items-center gap-1"
                  >
                    <IconFile size={12} />
                    Change document
                  </button>
                )}
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileSelect}
              className="hidden"
              accept=".txt,.debugger,.log,.json"
            />
          </div>
        </div>

        <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button
            onClick={handleUpload}
            disabled={pending || !file || !selectedMatchId || !isCompleted}
          >
            {pending ? <Loader text="Uploading..." /> : "Upload Result"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
