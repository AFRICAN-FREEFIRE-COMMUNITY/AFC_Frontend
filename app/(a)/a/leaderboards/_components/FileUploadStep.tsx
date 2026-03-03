"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { IconUpload, IconFile, IconX, IconLoader2 } from "@tabler/icons-react";
import { env } from "@/lib/env";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface Props {
  match: { match_id: number; match_name: string };
  formData: any;
  onNext: () => void;
  onBack: () => void;
  /** Skips the event-details fetch when participant type is already known */
  participantTypeOverride?: "solo" | "team";
}

export function FileUploadStep({ match, formData, onNext, onBack, participantTypeOverride }: Props) {
  const { token } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [fileType, setFileType] = useState("match_result_file");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [participantType, setParticipantType] = useState<"team" | "solo" | null>(null);
  const [loadingType, setLoadingType] = useState(true);
  const [uploading, setUploading] = useState(false);

  // Resolve participant type — use override if provided, otherwise fetch from event details
  useEffect(() => {
    if (participantTypeOverride) {
      setParticipantType(participantTypeOverride);
      setLoadingType(false);
      return;
    }

    const fetchParticipantType = async () => {
      try {
        const res = await fetch(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/get-event-details/`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ slug: formData.event_slug }),
          },
        );
        const data = await res.json();
        const details = data.event_details ?? data;
        setParticipantType(
          details.participant_type === "solo" ? "solo" : "team",
        );
      } catch (err) {
        console.error(err);
        setParticipantType("team");
      } finally {
        setLoadingType(false);
      }
    };

    fetchParticipantType();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setSelectedFile(file);
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error("Please select a file to upload");
      return;
    }
    if (!participantType) return;

    const endpoint =
      participantType === "solo"
        ? `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/upload-solo-match-result/`
        : `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/upload-team-match-result/`;

    const formPayload = new FormData();
    formPayload.append("match_id", match.match_id.toString());
    formPayload.append("file", selectedFile);
    formPayload.append("file_type", fileType);

    setUploading(true);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          // Do NOT set Content-Type — browser sets it with the boundary
        },
        body: formPayload,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.detail || "Upload failed");
      }

      toast.success("Match results uploaded successfully!");
      onNext();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  if (loadingType) {
    return (
      <Card className="gap-0">
        <CardContent className="flex items-center justify-center py-20">
          <IconLoader2 className="animate-spin size-8 text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="gap-0">
      <CardHeader>
        <CardTitle>{match.match_name} — 3D Room File Upload</CardTitle>
        <CardDescription>
          Choose the data source type and upload the file for leaderboard
          extraction.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-2 space-y-6">
        {/* File type selection */}
        <div className="space-y-2">
          <Label className="font-medium">File Type</Label>
          <RadioGroup
            value={fileType}
            onValueChange={setFileType}
            className="space-y-0"
          >
            <Label
              htmlFor="match"
              className={`flex items-start gap-2 p-4 rounded-lg border cursor-pointer transition-colors ${
                fileType === "match_result_file"
                  ? "border-primary bg-primary/10"
                  : ""
              }`}
            >
              <RadioGroupItem
                value="match_result_file"
                id="match"
                className="mt-1"
              />
              <div className="grid gap-0.5">
                <span className="font-semibold text-sm">Match Results File</span>
                <span className="text-xs text-muted-foreground">
                  Extracts Rank and Kills only.
                </span>
              </div>
            </Label>

            <Label
              htmlFor="debug"
              className={`flex items-start gap-2 p-4 rounded-lg border cursor-pointer transition-colors ${
                fileType === "debugger_file"
                  ? "border-primary bg-primary/10"
                  : ""
              }`}
            >
              <RadioGroupItem
                value="debugger_file"
                id="debug"
                className="mt-1"
              />
              <div className="grid gap-0.5">
                <span className="font-semibold text-sm">Debugger File</span>
                <span className="text-xs text-muted-foreground">
                  Extracts all metrics (Kills, Assists, Damage, etc).
                </span>
              </div>
            </Label>
          </RadioGroup>
        </div>

        {/* File picker */}
        <div className="space-y-2">
          <Label className="font-medium">Upload File</Label>
          {selectedFile ? (
            <div className="flex items-center gap-3 rounded-lg border px-4 py-3">
              <IconFile size={20} className="text-primary shrink-0" />
              <span className="text-sm flex-1 truncate">{selectedFile.name}</span>
              <button
                onClick={handleRemoveFile}
                className="text-muted-foreground hover:text-destructive"
              >
                <IconX size={16} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full rounded-lg border border-dashed p-8 flex flex-col items-center gap-2 text-muted-foreground hover:border-primary/60 hover:text-primary transition-colors"
            >
              <IconUpload size={24} />
              <span className="text-sm font-medium">Click to select file</span>
              <span className="text-xs">.txt or debugger files</span>
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>

        <div className="flex justify-between pt-2">
          <Button variant="ghost" onClick={onBack} disabled={uploading}>
            Back
          </Button>
          <Button
            onClick={handleUpload}
            disabled={!selectedFile || uploading}
          >
            {uploading ? (
              <span className="flex items-center gap-2">
                <IconLoader2 size={16} className="animate-spin" />
                Uploading…
              </span>
            ) : (
              "Upload & Continue"
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
