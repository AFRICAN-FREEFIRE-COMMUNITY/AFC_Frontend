"use client";

import {
  FormField,
  FormItem,
  FormControl,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useFormContext } from "react-hook-form";

export default function StepBasicInfo() {
  const form = useFormContext();

  return (
    <div className="space-y-4">
      <FormField
        control={form.control}
        name="tournament_name"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Tournament Name</FormLabel>
            <FormControl>
              <Input {...field} placeholder="e.g. Battle Arena Cup" />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="game_title"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Game Title</FormLabel>
            <FormControl>
              <Input {...field} placeholder="e.g. FIFA 24" />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}
