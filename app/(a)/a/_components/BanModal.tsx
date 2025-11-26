// "use client";

// import {
//   Dialog,
//   DialogContent,
//   DialogDescription,
//   DialogHeader,
//   DialogTitle,
//   DialogTrigger,
// } from "@/components/ui/dialog";
// import { zodResolver } from "@hookform/resolvers/zod";
// import { useForm } from "react-hook-form";
// import { Input } from "@/components/ui/input";
// import { Textarea } from "@/components/ui/textarea";
// import { useState, useTransition } from "react";
// import { Button } from "@/components/ui/button";
// import {
//   Form,
//   FormControl,
//   FormField,
//   FormItem,
//   FormLabel,
//   FormMessage,
// } from "@/components/ui/form";
// import {
//   Select,
//   SelectContent,
//   SelectItem,
//   SelectTrigger,
//   SelectValue,
// } from "@/components/ui/select";
// import { BanTeamFormSchema, BanTeamFormSchemaType } from "@/lib/zodSchemas";
// import { toast } from "sonner";
// import axios from "axios";
// import { env } from "@/lib/env";
// import { useAuth } from "@/contexts/AuthContext";
// import { Loader } from "@/components/Loader";
// import {
//   Ban,
//   ShieldCheck,
//   Clock,
//   AlertTriangle,
//   CheckCircle2,
// } from "lucide-react";
// import { cn } from "@/lib/utils";

// const banDurationPresets = [
//   { value: "1", label: "1 hour" },
//   { value: "6", label: "6 hours" },
//   { value: "12", label: "12 hours" },
//   { value: "24", label: "1 day" },
//   { value: "72", label: "3 days" },
//   { value: "168", label: "1 week" },
//   { value: "720", label: "30 days" },
//   { value: "custom", label: "Custom" },
// ];

// const quickReasons = [
//   { id: "conduct", label: "Toxic Behavior", icon: AlertTriangle },
//   { id: "cheating", label: "Cheating", icon: Ban },
//   { id: "collusion", label: "Collusion", icon: AlertTriangle },
//   { id: "account_sharing", label: "Account Sharing", icon: AlertTriangle },
//   {
//     id: "confidentiality",
//     label: "Breach of Confidentiality",
//     icon: AlertTriangle,
//   },
// ];

// export const BanModal = ({
//   isBanned,
//   teamName,
//   team_id,
//   onSuccess,
// }: {
//   isBanned: boolean;
//   teamName: string;
//   team_id: string;
//   onSuccess?: () => void;
// }) => {
//   const [pending, startTransition] = useTransition();
//   const [modalOpen, setModalOpen] = useState(false);
//   const [durationMode, setDurationMode] = useState<"preset" | "custom">(
//     "preset"
//   );

//   const { token } = useAuth();

//   const form = useForm<BanTeamFormSchemaType>({
//     resolver: zodResolver(BanTeamFormSchema),
//     defaultValues: {
//       ban_duration: "24",
//       team_id: team_id,
//       reason: "",
//     },
//   });

//   const reasonValue = form.watch("reason");

//   const handleQuickReasonSelect = (reasonLabel: string) => {
//     const currentReason = form.getValues("reason");
//     if (currentReason === reasonLabel) {
//       form.setValue("reason", "", { shouldValidate: true });
//     } else {
//       form.setValue("reason", reasonLabel, { shouldValidate: true });
//     }
//   };

//   function onSubmit(data: BanTeamFormSchemaType) {
//     console.log(data);
//     startTransition(async () => {
//       try {
//         const response = await axios.post(
//           `${env.NEXT_PUBLIC_BACKEND_API_URL}/auth/ban-team/`,
//           {
//             team_id: data.team_id,
//             ban_duration: data.ban_duration,
//             reason: data.reason || "",
//           },
//           {
//             headers: {
//               Authorization: `Bearer ${token}`,
//             },
//           }
//         );
//         toast.success(response.data.message || "Team banned successfully");
//         setModalOpen(false);
//         form.reset();
//         onSuccess?.();
//       } catch (error: any) {
//         toast.error(error?.response?.data?.message || "Failed to ban team");
//       }
//     });
//   }

//   const handleUnbanTeam = async () => {
//     startTransition(async () => {
//       try {
//         const response = await axios.post(
//           `${env.NEXT_PUBLIC_BACKEND_API_URL}/auth/unban-team/`,
//           { team_id },
//           {
//             headers: {
//               Authorization: `Bearer ${token}`,
//             },
//           }
//         );
//         toast.success(response.data.message || "Team unbanned successfully");
//         setModalOpen(false);
//         onSuccess?.();
//       } catch (error: any) {
//         toast.error(error?.response?.data?.message || "Failed to unban team");
//       }
//     });
//   };

//   return (
//     <Dialog open={modalOpen} onOpenChange={setModalOpen}>
//       <DialogTrigger asChild>
//         <Button
//           variant={isBanned ? "outline" : "destructive"}
//           size="sm"
//           className={cn(
//             "gap-2 font-medium transition-all",
//             isBanned &&
//               "border-green-500/50 text-green-600 hover:bg-green-50 hover:text-green-700 dark:hover:bg-green-950"
//           )}
//         >
//           {isBanned ? (
//             <>
//               <ShieldCheck className="h-4 w-4" />
//               Unban
//             </>
//           ) : (
//             <>
//               <Ban className="h-4 w-4" />
//               Ban
//             </>
//           )}
//         </Button>
//       </DialogTrigger>
//       <DialogContent className="sm:max-w-[500px] p-0 max-h-[90vh] overflow-hidden flex flex-col">
//         {isBanned ? (
//           // Unban confirmation
//           <div className="p-6">
//             <div className="flex flex-col items-center text-center mb-6">
//               <div className="h-16 w-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-4">
//                 <ShieldCheck className="h-8 w-8 text-green-600 dark:text-green-400" />
//               </div>
//               <DialogHeader className="space-y-2">
//                 <DialogTitle className="text-xl">Unban Team</DialogTitle>
//                 <DialogDescription className="text-base">
//                   Are you sure you want to unban{" "}
//                   <span className="font-semibold text-foreground">
//                     {teamName}
//                   </span>
//                   ?
//                 </DialogDescription>
//               </DialogHeader>
//             </div>
//             <p className="text-sm text-muted-foreground text-center mb-6">
//               This will restore the team&apos;s access to all platform features
//               immediately.
//             </p>
//             <div className="flex gap-3">
//               <Button
//                 variant="outline"
//                 className="flex-1"
//                 onClick={() => setModalOpen(false)}
//                 disabled={pending}
//               >
//                 Cancel
//               </Button>
//               <Button
//                 variant="default"
//                 className="flex-1 bg-green-600 hover:bg-green-700"
//                 onClick={handleUnbanTeam}
//                 disabled={pending}
//               >
//                 {pending ? (
//                   <Loader text="Unbanning..." />
//                 ) : (
//                   <>
//                     <CheckCircle2 className="h-4 w-4 mr-2" />
//                     Confirm Unban
//                   </>
//                 )}
//               </Button>
//             </div>
//           </div>
//         ) : (
//           // Ban form
//           <>
//             <div className="bg-gradient-to-r from-red-500 to-orange-500 p-6 text-white flex-shrink-0">
//               <div className="flex items-center gap-3">
//                 <div className="h-12 w-12 rounded-full bg-white/20 flex items-center justify-center">
//                   <Ban className="h-6 w-6" />
//                 </div>
//                 <div>
//                   <DialogTitle className="text-xl text-white">
//                     Ban Team
//                   </DialogTitle>
//                   <DialogDescription className="text-white/80">
//                     Banning{" "}
//                     <span className="font-semibold text-white">{teamName}</span>
//                   </DialogDescription>
//                 </div>
//               </div>
//             </div>

//             <Form {...form}>
//               <form
//                 onSubmit={form.handleSubmit(onSubmit)}
//                 className="p-6 space-y-6 overflow-y-auto flex-1"
//               >
//                 {/* Duration Section */}
//                 <FormField
//                   control={form.control}
//                   name="ban_duration"
//                   render={({ field }) => (
//                     <FormItem>
//                       <FormLabel className="flex items-center gap-2 text-base font-semibold">
//                         <Clock className="h-4 w-4 text-muted-foreground" />
//                         Ban Duration
//                       </FormLabel>
//                       <div className="space-y-3">
//                         <Select
//                           onValueChange={(value) => {
//                             if (value === "custom") {
//                               setDurationMode("custom");
//                             } else {
//                               setDurationMode("preset");
//                               field.onChange(value);
//                             }
//                           }}
//                           value={durationMode === "custom" ? "custom" : field.value}
//                         >
//                           <FormControl>
//                             <SelectTrigger className="w-full">
//                               <SelectValue placeholder="Select duration" />
//                             </SelectTrigger>
//                           </FormControl>
//                           <SelectContent>
//                             {banDurationPresets.map((preset) => (
//                               <SelectItem
//                                 key={preset.value}
//                                 value={preset.value}
//                               >
//                                 {preset.label}
//                               </SelectItem>
//                             ))}
//                           </SelectContent>
//                         </Select>

//                         {durationMode === "custom" && (
//                           <div className="flex items-center gap-2">
//                             <Input
//                               value={field.value}
//                               onChange={(e) => field.onChange(e.target.value)}
//                               type="number"
//                               min="1"
//                               placeholder="Enter hours"
//                               className="flex-1"
//                             />
//                             <span className="text-sm text-muted-foreground whitespace-nowrap">
//                               hours
//                             </span>
//                           </div>
//                         )}
//                       </div>
//                       <FormMessage />
//                     </FormItem>
//                   )}
//                 />

//                 {/* Quick Reason Selection */}
//                 <div className="space-y-3">
//                   <FormLabel className="flex items-center gap-2 text-base font-semibold">
//                     <AlertTriangle className="h-4 w-4 text-muted-foreground" />
//                     Reason for Ban
//                     <span className="text-xs font-normal text-muted-foreground">
//                       (optional)
//                     </span>
//                   </FormLabel>
//                   <div className="grid md:grid-cols-2 gap-2">
//                     {quickReasons.map((reason) => {
//                       const Icon = reason.icon;
//                       const isSelected = reasonValue === reason.label;
//                       return (
//                         <button
//                           key={reason.id}
//                           type="button"
//                           onClick={() => handleQuickReasonSelect(reason.label)}
//                           className={cn(
//                             "flex items-center gap-2 p-3 rounded-lg border text-sm font-medium transition-all text-left",
//                             isSelected
//                               ? "border-red-500 bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
//                               : "border-border hover:border-red-300 hover:bg-red-50/50 dark:hover:bg-red-950/30"
//                           )}
//                         >
//                           <Icon
//                             className={cn(
//                               "h-4 w-4",
//                               isSelected
//                                 ? "text-red-500"
//                                 : "text-muted-foreground"
//                             )}
//                           />
//                           {reason.label}
//                         </button>
//                       );
//                     })}
//                   </div>
//                 </div>

//                 {/* Custom Reason */}
//                 <FormField
//                   control={form.control}
//                   name="reason"
//                   render={({ field }) => (
//                     <FormItem>
//                       <FormLabel className="text-sm text-muted-foreground">
//                         Or provide a custom reason
//                       </FormLabel>
//                       <FormControl>
//                         <Textarea
//                           {...field}
//                           placeholder="Enter additional details or a custom reason..."
//                           className="resize-none min-h-[80px]"
//                           onChange={(e) => {
//                             field.onChange(e);
//                           }}
//                         />
//                       </FormControl>
//                       <FormMessage />
//                     </FormItem>
//                   )}
//                 />

//                 {/* Action Buttons */}
//                 <div className="flex gap-3 pt-2">
//                   <Button
//                     type="button"
//                     variant="outline"
//                     className="flex-1"
//                     onClick={() => setModalOpen(false)}
//                     disabled={pending}
//                   >
//                     Cancel
//                   </Button>
//                   <Button
//                     type="submit"
//                     variant="destructive"
//                     className="flex-1"
//                     disabled={pending}
//                   >
//                     {pending ? (
//                       <Loader text="Banning..." />
//                     ) : (
//                       <>
//                         <Ban className="h-4 w-4 mr-2" />
//                         Ban Team
//                       </>
//                     )}
//                   </Button>
//                 </div>
//               </form>
//             </Form>
//           </>
//         )}
//       </DialogContent>
//     </Dialog>
//   );
// };

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
  isBanned,
  teamName,
  team_id,
  onSuccess,
}: {
  isBanned: boolean;
  teamName: string;
  team_id: string;
  onSuccess?: () => void;
}) => {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [durationMode, setDurationMode] = useState<"preset" | "custom">(
    "preset"
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
          }
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
          }
        );

        toast.success(res.data.message || "Team unbanned successfully");
        setOpen(false);
        onSuccess?.();
      } catch (e: any) {
        toast.error(e.response?.data?.message || "Failed to unban team");
      }
    });
  };

  console.log("form errors:", form.formState.errors);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant={isBanned ? "outline" : "destructive"}
          size="sm"
          className={cn(
            "gap-2 font-medium",
            isBanned &&
              "border-green-500/50 text-green-600 hover:bg-green-50 hover:text-green-700"
          )}
        >
          {isBanned ? (
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
        {isBanned ? (
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
                      <FormLabel className="flex items-center gap-2 font-semibold">
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
                  <FormLabel className="flex items-center gap-2 font-semibold">
                    <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                    Reason (optional)
                  </FormLabel>

                  <div className="grid grid-cols-2 gap-2">
                    {quickReasons.map((r) => {
                      const Icon = r.icon;
                      const selected = reasonValue === r.label;

                      return (
                        <button
                          type="button"
                          key={r.id}
                          onClick={() => handleQuickReasonSelect(r.label)}
                          className={cn(
                            "flex items-center gap-2 border p-3 rounded-md text-sm",
                            selected
                              ? "border-red-500 bg-red-50 text-red-700"
                              : "hover:bg-red-50/60"
                          )}
                        >
                          <Icon
                            className={cn(
                              "h-4 w-4",
                              selected
                                ? "text-red-500"
                                : "text-muted-foreground"
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
                      <FormLabel className="text-muted-foreground text-sm">
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
