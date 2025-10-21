"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { BanTeamFormSchema, BanTeamFormSchemaType } from "@/lib/zodSchemas";
import { toast } from "sonner";
import { availableBanReasons } from "@/constants";
import axios from "axios";
import { env } from "@/lib/env";
import { useAuth } from "@/contexts/AuthContext";
import { Loader } from "@/components/Loader";

export const BanModal = ({
  isBanned,
  teamName,
  team_id,
}: {
  isBanned: boolean;
  teamName: string;
  team_id: string;
}) => {
  const [pending, startTransition] = useTransition();

  const { user, token } = useAuth();

  const form = useForm<BanTeamFormSchemaType>({
    resolver: zodResolver(BanTeamFormSchema),
    defaultValues: {
      ban_duration: "7",
      team_id: team_id || teamName,
      reasons: [],
    },
  });

  const [banModalOpen, setBanModalOpen] = useState(false);

  const handleDurationChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    field: any
  ) => {
    let inputValue = e.target.value;

    // If the input starts with a "0" and is followed by another number, remove the "0"
    if (
      inputValue.startsWith("0") &&
      inputValue.length > 1 &&
      inputValue[1] !== "."
    ) {
      inputValue = inputValue.slice(1);
    }

    // Prevent the input from starting with a period
    if (inputValue.startsWith(".")) {
      return;
    }

    inputValue = inputValue.replace(/[^0-9.]/g, "");
    const parts = inputValue.split(".");
    if (parts.length > 2) {
      inputValue = parts.shift() + "." + parts.join("");
    }
    if (parts[1]) {
      parts[1] = parts[1].substring(0, 2);
      inputValue = parts.join(".");
    }

    if (/^[0-9,]*\.?[0-9]*$/.test(inputValue)) {
      field.onChange(inputValue);
    }
  };

  function onSubmit(data: BanTeamFormSchemaType) {
    startTransition(async () => {
      try {
        const response = await axios.post(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/auth/ban-team/`,
          { ...data },
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
        toast.success(response.data.message);
        setBanModalOpen(false);
      } catch (error: any) {
        toast.error(error?.response?.data?.message || "Internal server error");
        return;
      }
    });
  }

  const handleUnbanTeam = async () => {
    try {
      startTransition(async () => {
        try {
          const response = await axios.post(
            `${env.NEXT_PUBLIC_BACKEND_API_URL}/auth/unban-team/`,
            { team_id },
            {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            }
          );
          toast.success(response.data.message);
          setBanModalOpen(false);
        } catch (error: any) {
          toast.error(
            error?.response?.data?.message || "Internal server error"
          );
          return;
        }
      });
    } catch (error) {
      toast.error("Failed to unban the team. Please try again.");
    }
  };

  return (
    <AlertDialog open={banModalOpen} onOpenChange={setBanModalOpen}>
      <AlertDialogTrigger asChild>
        <Button variant={isBanned ? "secondary" : "destructive"}>
          {isBanned ? "Unban" : "Ban"}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <AlertDialogHeader className="flex-shrink-0">
          <AlertDialogTitle>
            {isBanned ? "Unban Team" : "Ban Team"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {isBanned
              ? `Are you sure you want to unban ${teamName}?`
              : `Are you sure you want to ban ${teamName}?`}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {isBanned ? (
          // Simple unban confirmation
          <AlertDialogFooter className="flex-shrink-0">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button
              disabled={pending}
              onClick={handleUnbanTeam}
              variant="secondary"
            >
              {pending ? <Loader text="Unbanning..." /> : "Unban Team"}
            </Button>
          </AlertDialogFooter>
        ) : (
          // Ban form with scrollable content
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="flex flex-col flex-1 min-h-0"
            >
              <div className="flex-1 overflow-y-auto px-1 space-y-4">
                <FormField
                  control={form.control}
                  name="ban_duration"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ban duration (hours)</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          onChange={(e) => handleDurationChange(e, field)}
                          placeholder="7"
                          type="text"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="reasons"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Reason(s) for Ban</FormLabel>
                      <div className="space-y-4">
                        {availableBanReasons.map((reason) => {
                          const selectedValues: string[] = field.value || [];

                          return (
                            <div
                              key={reason.id}
                              className="flex items-start space-x-3"
                            >
                              <Checkbox
                                checked={selectedValues.includes(reason.id)}
                                onCheckedChange={(checked) => {
                                  const updatedReasons = checked
                                    ? [...selectedValues, reason.id]
                                    : selectedValues.filter(
                                        (value) => value !== reason.id
                                      );

                                  field.onChange(updatedReasons);
                                }}
                              />
                              <div className="space-y-1 flex-1">
                                <label className="font-normal text-sm cursor-pointer block">
                                  {reason.label}
                                </label>
                                <p className="text-xs text-muted-foreground">
                                  {reason.description}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <AlertDialogFooter className="flex-shrink-0 mt-6 pt-4 border-t">
                <AlertDialogCancel type="button">Cancel</AlertDialogCancel>
                <Button disabled={pending} type="submit" variant="destructive">
                  {pending ? <Loader text="Banning..." /> : "Ban Team"}
                </Button>
              </AlertDialogFooter>
            </form>
          </Form>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
};
