"use client";

import React from "react";
import { UseFormReturn } from "react-hook-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";
import { EventFormType } from "./types";

interface Step7Props {
  form: UseFormReturn<EventFormType>;
}

export function Step7PublishSave({ form }: Step7Props) {
  const saveToDraftsWatch = form.watch("save_to_drafts");
  const publishToTournamentsWatch = form.watch("publish_to_tournaments");
  const publishToNewsWatch = form.watch("publish_to_news");

  return (
    <Card>
      <CardHeader>
        <CardTitle>Step 7: Publish &amp; Save</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2 pt-4 border-t">
          <p className="text-sm font-medium">Where would you like to publish this event?</p>

          <FormField
            // @ts-ignore
            control={form.control}
            name="publish_to_tournaments"
            render={({ field }) => (
              <FormItem className="flex items-center gap-3 p-4 border rounded-lg">
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    disabled={saveToDraftsWatch}
                  />
                </FormControl>
                <FormLabel className="!mt-0 cursor-pointer">Publish to Tournaments</FormLabel>
              </FormItem>
            )}
          />

          <FormField
            // @ts-ignore
            control={form.control}
            name="save_to_drafts"
            render={({ field }) => (
              <FormItem className="flex items-center gap-3 p-4 border rounded-lg">
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    disabled={publishToTournamentsWatch || publishToNewsWatch}
                  />
                </FormControl>
                <FormLabel className="!mt-0 cursor-pointer">Save as Draft</FormLabel>
              </FormItem>
            )}
          />
        </div>
      </CardContent>
    </Card>
  );
}
