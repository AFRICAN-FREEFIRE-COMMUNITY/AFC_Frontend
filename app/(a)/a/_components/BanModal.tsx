"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { useState, useTransition } from "react";
import axios from "axios";
import { toast } from "sonner";

import { BanTeamFormSchema, BanTeamFormSchemaType } from "@/lib/zodSchemas";
import { env } from "@/lib/env";
import { useAuth } from "@/contexts/AuthContext";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader } from "@/components/Loader";
import { cn } from "@/lib/utils";

import {
  Ban,
  ShieldCheck,
  Clock,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";

const banDurationPresets = [
  { value: "1", label: "1 hour" },
  { value: "6", label: "6 hours" },
  { value: "12", label: "12 hours" },
  { value: "24", label: "1 day" },
  { value: "72", label: "3 days" },
  { value: "168", label: "1 week" },
  { value: "720", label: "30 days" },
  { value: "custom", label: "Custom" },
];

const quickReasons = [
  { id: "conduct", label: "Toxic Behavior", icon: AlertTriangle },
  { id: "cheating", label: "Cheating", icon: Ban },
  { id: "collusion", label: "Collusion", icon: AlertTriangle },
  { id: "account_sharing", label: "Account Sharing", icon: AlertTriangle },
  {
    id: "confidentiality",
    label: "Breach of Confidentiality",
    icon: AlertTriangle,
  },
];

export const BanModal = ({
  is_banned,
  teamName,
  team_id,
  onSuccess,
}: {
  is_banned: boolean;
  teamName: string;
  team_id: string;
  onSuccess?: () => void;
}) => {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [durationMode, setDurationMode] = useState<"preset" | "custom">(
    "preset",
  );
  const { token } = useAuth();

  const form = useForm<BanTeamFormSchemaType>({
    resolver: zodResolver(BanTeamFormSchema),
    defaultValues: {
      ban_duration: "24",
      reason: "",
      team_id: `${team_id}`,
    },
  });

  const reasonValue = form.watch("reason");

  const handleDurationSelect = (value: string) => {
    if (value === "custom") {
      setDurationMode("custom");
      form.setValue("ban_duration", "");
    } else {
      setDurationMode("preset");
      form.setValue("ban_duration", value);
    }
  };

  const handleQuickReasonSelect = (label: string) => {
    form.setValue("reason", label === reasonValue ? "" : label);
  };

  const onSubmit = (data: BanTeamFormSchemaType) => {
    startTransition(async () => {
      try {
        const res = await axios.post(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/auth/ban-team/`,
          data,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );

        toast.success(res.data.message || "Team banned successfully");
        setOpen(false);
        form.reset();
        onSuccess?.();
      } catch (e: any) {
        toast.error(e.response?.data?.message || "Failed to ban team");
      }
    });
  };

  const unbanTeam = () => {
    startTransition(async () => {
      try {
        const res = await axios.post(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/auth/unban-team/`,
          { team_id },
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );

        toast.success(res.data.message || "Team unbanned successfully");
        setOpen(false);
        onSuccess?.();
      } catch (e: any) {
        toast.error(e.response?.data?.message || "Failed to unban team");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant={is_banned ? "outline" : "destructive"}
          size="sm"
          className={cn(
            "gap-2 font-medium",
            is_banned &&
              "border-green-500/50 text-green-600 hover:bg-green-50 hover:text-green-700",
          )}
        >
          {is_banned ? (
            <>
              <ShieldCheck className="h-4 w-4" />
              Unban
            </>
          ) : (
            <>
              <Ban className="h-4 w-4" />
              Ban
            </>
          )}
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden flex flex-col max-h-[90vh]">
        {is_banned ? (
          // UNBAN CONFIRMATION
          <div className="p-6 text-center">
            <div className="h-14 w-14 mx-auto mb-3 rounded-full bg-green-100 flex items-center justify-center">
              <ShieldCheck className="h-7 w-7 text-green-600" />
            </div>

            <DialogTitle className="text-xl">Unban Team</DialogTitle>
            <DialogDescription className="mt-1 text-base">
              Are you sure you want to unban <b>{teamName}</b>?
            </DialogDescription>

            <p className="text-sm text-muted-foreground mt-4">
              The team will regain full platform access immediately.
            </p>

            <div className="flex gap-3 mt-6">
              <Button
                variant="outline"
                className="flex-1"
                disabled={pending}
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 bg-green-600 hover:bg-green-700"
                onClick={unbanTeam}
                disabled={pending}
              >
                {pending ? (
                  <Loader text="Unbanning..." />
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" /> Confirm
                  </>
                )}
              </Button>
            </div>
          </div>
        ) : (
          // BAN FORM
          <>
            <div className="bg-gradient-to-r from-red-500 to-orange-500 text-white p-6">
              <DialogTitle className="text-xl">Ban Team</DialogTitle>
              <DialogDescription className="text-white/90">
                Banning <b>{teamName}</b>
              </DialogDescription>
            </div>

            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="p-6 space-y-6 overflow-y-auto flex-1"
              >
                {/* Duration */}
                <FormField
                  control={form.control}
                  name="ban_duration"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        Ban Duration
                      </FormLabel>

                      <Select
                        value={field.value || ""}
                        onValueChange={(value) => {
                          handleDurationSelect(value);
                          field.onChange(value);
                        }}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select duration" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {banDurationPresets.map((p) => (
                            <SelectItem key={p.value} value={p.value}>
                              {p.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      {durationMode === "custom" && (
                        <Input
                          type="number"
                          min="1"
                          value={field.value}
                          onChange={(e) => field.onChange(e.target.value)}
                          placeholder="Enter hours"
                          className="mt-2"
                        />
                      )}

                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Quick Reasons */}
                <div className="space-y-2">
                  <FormLabel className="flex items-start md:items-center gap-2 font-semibold">
                    <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                    Reason (optional)
                  </FormLabel>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {quickReasons.map((r) => {
                      const Icon = r.icon;
                      const selected = reasonValue === r.label;

                      return (
                        <button
                          type="button"
                          key={r.id}
                          onClick={() => handleQuickReasonSelect(r.label)}
                          className={cn(
                            "flex justify-start md:justify-center text-left md:text-center items-center gap-2 border p-3 rounded-md text-sm",
                            selected
                              ? "border-red-500 bg-red-50 text-red-700"
                              : "hover:bg-red-50/60",
                          )}
                        >
                          <Icon
                            className={cn(
                              "h-4 w-4",
                              selected
                                ? "text-red-500"
                                : "text-muted-foreground",
                            )}
                          />
                          {r.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Custom reason */}
                <FormField
                  control={form.control}
                  name="reason"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-muted-foreground">
                        Additional details (optional)
                      </FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          placeholder="Enter custom reason..."
                          className="resize-none"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Actions */}
                <div className="flex gap-3 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => setOpen(false)}
                    disabled={pending}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="destructive"
                    className="flex-1"
                    disabled={pending}
                  >
                    {pending ? (
                      <Loader text="Banning..." />
                    ) : (
                      <>
                        <Ban className="h-4 w-4 mr-2" /> Ban Team
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </Form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
