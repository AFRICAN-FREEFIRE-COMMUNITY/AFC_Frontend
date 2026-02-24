"use client";

import React, { useState } from "react";
import { useFormContext } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Trash2 } from "lucide-react";
import {
  IconFile,
  IconFileText,
  IconUpload,
  IconX,
} from "@tabler/icons-react";
import { Loader } from "@/components/Loader";
import type { EventFormType } from "../types";

interface PrizeRulesTabProps {
  rulesInputMethod: "type" | "upload";
  setRulesInputMethod: (v: "type" | "upload") => void;
  previewRuleUrl: string;
  setPreviewRuleUrl: (url: string) => void;
  selectedRuleFile: File | null;
  setSelectedRuleFile: (f: File | null) => void;
  rulesFileInputRef: React.RefObject<HTMLInputElement | null>;
  addPrizePosition: () => void;
  removePrizePosition: (key: string) => void;
  formatPrizeKey: (key: string) => string;
  onSaveChanges: () => void;
  loadingEvent: boolean;
  pendingSubmit: boolean;
}

export default function PrizeRulesTab({
  rulesInputMethod,
  setRulesInputMethod,
  previewRuleUrl,
  setPreviewRuleUrl,
  selectedRuleFile,
  setSelectedRuleFile,
  rulesFileInputRef,
  addPrizePosition,
  removePrizePosition,
  formatPrizeKey,
  onSaveChanges,
  loadingEvent,
  pendingSubmit,
}: PrizeRulesTabProps) {
  const form = useFormContext<EventFormType>();
  const [isDragging, setIsDragging] = useState(false);

  const prizeDistribution = form.watch("prize_distribution") || {};

  return (
    <Card>
      <CardHeader>
        <CardTitle>Prize Pool & Rules</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <FormField
          control={form.control}
          name="prizepool"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Total Prize Pool</FormLabel>
              <Input
                type="text"
                {...field}
                placeholder="e.g., $5,000 USD or 5000 Diamonds"
              />
              <FormMessage />
            </FormItem>
          )}
        />

        <Separator />

        <div className="space-y-3">
          <FormLabel>Prize Distribution</FormLabel>
          {Object.entries(prizeDistribution).map(([key, value]) => (
            <div key={key} className="grid grid-cols-4 gap-2">
              <Input
                value={formatPrizeKey(key)}
                disabled
                className="col-span-1"
              />
              <div className="col-span-3 flex items-center justify-end gap-1">
                <Input
                  type="text"
                  value={value || ""}
                  onChange={(e) => {
                    const inputVal = e.target.value;
                    const updated = { ...prizeDistribution };
                    updated[key] = inputVal;
                    form.setValue("prize_distribution", updated, {
                      shouldDirty: true,
                    });
                  }}
                  placeholder="e.g., $2,000 or 2000 Diamonds"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removePrizePosition(key)}
                  disabled={Object.keys(prizeDistribution).length <= 1}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            onClick={addPrizePosition}
          >
            + Add Prize Position
          </Button>
        </div>

        <Separator />

        <div className="space-y-4">
          <FormLabel>Tournament Rules</FormLabel>
          <div className="flex gap-2">
            <Button
              type="button"
              variant={rulesInputMethod === "type" ? "default" : "outline"}
              onClick={() => setRulesInputMethod("type")}
            >
              Type Rules
            </Button>
            <Button
              type="button"
              variant={rulesInputMethod === "upload" ? "default" : "outline"}
              onClick={() => setRulesInputMethod("upload")}
            >
              Upload Document
            </Button>
          </div>

          {rulesInputMethod === "type" ? (
            <FormField
              control={form.control}
              name="event_rules"
              render={({ field }) => (
                <FormItem>
                  <Textarea
                    {...field}
                    rows={10}
                    placeholder="Enter event rules..."
                    onFocus={() => form.setValue("rules_document", "")}
                  />
                  <FormMessage />
                </FormItem>
              )}
            />
          ) : (
            <FormField
              control={form.control}
              name="rules_document"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Upload Rules Document</FormLabel>
                  <FormControl>
                    <div className="space-y-4">
                      {!previewRuleUrl ? (
                        <div
                          onDragOver={(e) => {
                            e.preventDefault();
                            setIsDragging(true);
                          }}
                          onDragLeave={(e) => {
                            e.preventDefault();
                            setIsDragging(false);
                          }}
                          onDrop={(e) => {
                            e.preventDefault();
                            setIsDragging(false);
                            const file = e.dataTransfer.files?.[0];
                            if (file) {
                              const supportedTypes = [
                                "application/pdf",
                                "application/msword",
                                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                              ];
                              if (!supportedTypes.includes(file.type)) {
                                toast.error(
                                  "Only PDF, DOC, or DOCX files are supported.",
                                );
                                return;
                              }
                              setSelectedRuleFile(file);
                              setPreviewRuleUrl(URL.createObjectURL(file));
                            }
                          }}
                          className={`border-2 bg-muted border-dashed rounded-md p-12 text-center transition-colors cursor-pointer ${
                            isDragging
                              ? "border-primary bg-primary/5"
                              : "border-gray-300 bg-gray-50"
                          }`}
                          onClick={() => rulesFileInputRef.current?.click()}
                        >
                          <div className="flex flex-col items-center gap-3">
                            <div className="w-16 h-16   rounded-full flex items-center justify-center">
                              <IconFileText
                                size={32}
                                className="text-primary dark:text-white"
                              />
                            </div>
                            <p className="text-sm text-muted-foreground">
                              Drop your document here, or{" "}
                              <span className="text-primary font-medium hover:underline">
                                browse
                              </span>
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              Supports: PDF, DOC, DOCX
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <div className="relative w-full aspect-video bg-gray-50 border rounded-md flex flex-col items-center justify-center p-8">
                            <IconFile size={64} className="text-primary" />
                            <p className="text-sm font-medium mt-2">
                              {selectedRuleFile?.name ||
                                "Rules Document Uploaded"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              File Size:{" "}
                              {(
                                (selectedRuleFile?.size || 0) /
                                1024 /
                                1024
                              ).toFixed(2)}{" "}
                              MB
                            </p>
                          </div>

                          <div className="flex gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              className="flex-1"
                              onClick={() => {
                                setSelectedRuleFile(null);
                                setPreviewRuleUrl("");
                                field.onChange("");
                                if (rulesFileInputRef.current) {
                                  rulesFileInputRef.current.value = "";
                                }
                              }}
                            >
                              <IconX size={16} className="mr-2" />
                              Remove
                            </Button>

                            <Button
                              type="button"
                              variant="outline"
                              className="flex-1"
                              onClick={() =>
                                rulesFileInputRef.current?.click()
                              }
                            >
                              <IconUpload size={16} className="mr-2" />
                              Replace
                            </Button>
                          </div>
                        </div>
                      )}

                      <input
                        ref={rulesFileInputRef}
                        type="file"
                        accept=".pdf,application/pdf,.doc,application/msword,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;

                          const supportedTypes = [
                            "application/pdf",
                            "application/msword",
                            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                          ];

                          if (!supportedTypes.includes(file.type)) {
                            toast.error(
                              "Only PDF, DOC, or DOCX files are supported.",
                            );
                            return;
                          }

                          setSelectedRuleFile(file);
                          field.onChange(file);
                          setPreviewRuleUrl(URL.createObjectURL(file));
                        }}
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
        </div>

        <Button
          type="button"
          onClick={onSaveChanges}
          disabled={loadingEvent || pendingSubmit}
        >
          {loadingEvent || pendingSubmit ? (
            <Loader text="Saving..." />
          ) : (
            "Save Changes"
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
