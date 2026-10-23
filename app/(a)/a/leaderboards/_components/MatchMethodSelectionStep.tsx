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
import { useTranslations } from "next-intl";

type MatchMethod = "manual" | "image_upload" | "room_file_upload";

interface Props {
  matchName: string;
  onSelect: (method: MatchMethod) => void;
  onBack: () => void;
}

// The three ways to enter a map's results. The words live in messages/<locale>/resultEntry.json
// under method.<key> (inbox #257, 2026-10-16: these organizer screens were English only).
const METHODS = [
  { id: "manual" as MatchMethod, key: "manual", icon: IconUsers, disabled: false },
  { id: "image_upload" as MatchMethod, key: "image", icon: IconPhoto, disabled: false },
  { id: "room_file_upload" as MatchMethod, key: "room", icon: IconUpload, disabled: false },
];

export function MatchMethodSelectionStep({ matchName, onSelect, onBack }: Props) {
  const t = useTranslations("resultEntry");
  return (
    <Card className="gap-0">
      <CardHeader>
        <CardTitle>{t("method.title", { match: matchName })}</CardTitle>
        <CardDescription>{t("method.description")}</CardDescription>
      </CardHeader>
      <CardContent className="pt-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {METHODS.map((m) => (
            <button
              key={m.id}
              disabled={m.disabled}
              onClick={() => onSelect(m.id)}
              className="text-left rounded-lg p-4 flex flex-col gap-3 hover:bg-muted/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed bg-muted/30"
            >
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <m.icon size={18} className="text-muted-foreground shrink-0" />
                  <span className="font-semibold text-sm">{t(`method.${m.key}.name`)}</span>
                </div>
                <p className="text-xs text-primary">{t(`method.${m.key}.short`)}</p>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed flex-1">
                {t(`method.${m.key}.long`)}
              </p>
            </button>
          ))}
        </div>

        <div className="pt-2">
          <Button variant="outline" onClick={onBack}>
            {t("method.back")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
