"use client";

import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useFieldArray, useFormContext } from "react-hook-form";

export default function StepPrizePool() {
  const form = useFormContext();
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "prize_pool",
  });

  return (
    <div className="space-y-4">
      <Button type="button" onClick={() => append({ place: "", reward: "" })}>
        Add Prize
      </Button>

      {fields.map((item, index) => (
        <div key={item.id} className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name={`prize_pool.${index}.place`}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Place</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="1st" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name={`prize_pool.${index}.reward`}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Reward</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="$500" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button
            type="button"
            variant="destructive"
            onClick={() => remove(index)}
          >
            Delete
          </Button>
        </div>
      ))}
    </div>
  );
}
