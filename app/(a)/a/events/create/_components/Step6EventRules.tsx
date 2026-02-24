"use client";

import React, { useRef, useState } from "react";
import { UseFormReturn } from "react-hook-form";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { IconFile, IconFileText, IconUpload, IconX } from "@tabler/icons-react";
import { EventFormType } from "./types";

interface Step6Props {
  form: UseFormReturn<EventFormType>;
  rulesInputMethod: "type" | "upload";
  setRulesInputMethod: (method: "type" | "upload") => void;
  selectedRuleFile: File | null;
  setSelectedRuleFile: (file: File | null) => void;
  previewRuleUrl: string;
  setPreviewRuleUrl: (url: string) => void;
}

const SUPPORTED_DOC_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

export function Step6EventRules({
  form,
  rulesInputMethod,
  setRulesInputMethod,
  selectedRuleFile,
  setSelectedRuleFile,
  previewRuleUrl,
  setPreviewRuleUrl,
}: Step6Props) {
  const [isDragging, setIsDragging] = useState(false);
  const rulesFileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (file: File, fieldOnChange: (val: any) => void) => {
    if (!SUPPORTED_DOC_TYPES.includes(file.type)) {
      toast.error("Only PDF, DOC, or DOCX files are supported.");
      return;
    }
    setSelectedRuleFile(file);
    fieldOnChange(file);
    setPreviewRuleUrl(URL.createObjectURL(file));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Step 6: Event Rules</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Method Toggle */}
        <div>
          <FormLabel>Rules Input Method</FormLabel>
          <RadioGroup
            value={rulesInputMethod}
            onValueChange={(v: "type" | "upload") => setRulesInputMethod(v)}
            className="flex gap-6 mt-2"
          >
            <div className="flex items-center gap-2 text-sm">
              <RadioGroupItem value="type" />
              <span>Type Rules</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <RadioGroupItem value="upload" />
              <span>Upload Document</span>
            </div>
          </RadioGroup>
        </div>

        {/* Typed Rules */}
        {rulesInputMethod === "type" ? (
          <FormField
            // @ts-ignore
            control={form.control}
            name="event_rules"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Event Rules</FormLabel>
                <FormControl>
                  <Textarea
                    {...field}
                    rows={10}
                    placeholder="Enter event rules..."
                    onFocus={() => form.setValue("rules_document", "")}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        ) : (
          /* File Upload */
          <FormField
            // @ts-ignore
            control={form.control}
            name="rules_document"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Upload Rules Document</FormLabel>
                <FormControl>
                  <div className="space-y-4">
                    {!previewRuleUrl ? (
                      <div
                        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                        onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
                        onDrop={(e) => {
                          e.preventDefault();
                          setIsDragging(false);
                          const file = e.dataTransfer.files?.[0];
                          if (file) handleFileSelect(file, field.onChange);
                        }}
                        className={`border-2 bg-muted border-dashed rounded-md p-12 text-center transition-colors cursor-pointer ${
                          isDragging ? "border-primary bg-primary/5" : "border-gray-300 bg-gray-50"
                        }`}
                        onClick={() => rulesFileInputRef.current?.click()}
                      >
                        <div className="flex flex-col items-center gap-3">
                          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                            <IconFileText size={32} className="text-primary dark:text-white" />
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Drop your document here, or{" "}
                            <span className="text-primary font-medium hover:underline">browse</span>
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
                            {selectedRuleFile?.name || "Rules Document Uploaded"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            File Size: {((selectedRuleFile?.size || 0) / 1024 / 1024).toFixed(2)} MB
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
                              if (rulesFileInputRef.current) rulesFileInputRef.current.value = "";
                            }}
                          >
                            <IconX size={16} className="mr-2" /> Remove
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            className="flex-1"
                            onClick={() => rulesFileInputRef.current?.click()}
                          >
                            <IconUpload size={16} className="mr-2" /> Replace
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
                        if (file) handleFileSelect(file, field.onChange);
                      }}
                    />
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}
      </CardContent>
    </Card>
  );
}
