"use client";

import React from "react";
import { UseFormReturn } from "react-hook-form";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";
import { InfoTip } from "@/components/ui/info-tip";
import { EventFormType } from "./types";

interface Step7Props {
  form: UseFormReturn<EventFormType>;
}

export function Step7PublishSave({ form }: Step7Props) {
  const t = useTranslations("evSteps");
  const saveToDraftsWatch = form.watch("save_to_drafts");
  const publishToTournamentsWatch = form.watch("publish_to_tournaments");
  const publishToNewsWatch = form.watch("publish_to_news");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          {t("step7.title")}
          <InfoTip id="events.create.publish._section" className="ml-1.5" />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2 pt-4 border-t">
          <p className="text-sm font-medium">{t("step7.whereToPublish")}</p>

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
                <FormLabel className="!mt-0 cursor-pointer">
                  {t("step7.publishToTournaments")}
                  <InfoTip id="events.create.publish_to_tournaments" className="ml-1" />
                </FormLabel>
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
                <FormLabel className="!mt-0 cursor-pointer">
                  {t("step7.saveAsDraft")}
                  <InfoTip id="events.create.save_to_drafts" className="ml-1" />
                </FormLabel>
              </FormItem>
            )}
          />
        </div>
      </CardContent>
    </Card>
  );
}
