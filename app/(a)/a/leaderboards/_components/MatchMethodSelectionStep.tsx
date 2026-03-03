"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { IconUsers, IconPhoto, IconUpload } from "@tabler/icons-react";

type MatchMethod = "manual" | "image_upload" | "room_file_upload";

interface Props {
  matchName: string;
  onSelect: (method: MatchMethod) => void;
  onBack: () => void;
}

const METHODS = [
  {
    id: "manual" as MatchMethod,
    icon: IconUsers,
    name: "Manual Input",
    short: "Input data manually for this match",
    long: "Directly enter placement, kills, assists, and damage for teams and players.",
    disabled: false,
  },
  {
    id: "image_upload" as MatchMethod,
    icon: IconPhoto,
    name: "Image Upload",
    short: "Upload match result screenshots",
    long: "Upload screenshots of match results from games.",
    disabled: false,
  },
  {
    id: "room_file_upload" as MatchMethod,
    icon: IconUpload,
    name: "3D Room File",
    short: "Upload .txt and debugger files",
    long: "Upload 3D room files to extract match data automatically.",
    disabled: false,
  },
];

export function MatchMethodSelectionStep({ matchName, onSelect, onBack }: Props) {
  return (
    <Card className="gap-0">
      <CardHeader>
        <CardTitle>{matchName}: Select Upload Method</CardTitle>
        <CardDescription>
          Choose how you want to upload results for this specific match (map).
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {METHODS.map((m) => (
            <button
              key={m.id}
              disabled={m.disabled}
              onClick={() => onSelect(m.id)}
              className="text-left rounded-lg border p-4 flex flex-col gap-3 hover:border-primary/60 hover:bg-muted/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <m.icon size={18} className="text-muted-foreground shrink-0" />
                  <span className="font-semibold text-sm">{m.name}</span>
                </div>
                <p className="text-xs text-primary">{m.short}</p>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed flex-1">
                {m.long}
              </p>
            </button>
          ))}
        </div>

        <div className="pt-2">
          <Button variant="outline" onClick={onBack}>
            Back to Overview
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
