"use client";

import React, { Suspense, useEffect, useState, useTransition } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useRouter } from "next/navigation";
import axios from "axios";
import { toast } from "sonner";
import { env } from "@/lib/env";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Loader } from "@/components/Loader";
import { Trash2, AlertTriangle, EyeOffIcon, EyeIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { IconPencil, IconPencilDiscount } from "@tabler/icons-react";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { EditMatchFormSchema, EditMatchFormSchemaType } from "@/lib/zodSchemas";

export const EditMatchModal = ({
  matchId,
  onSuccess,
  roomId,
  roomName,
  roomPassword,
}: {
  matchId: string;
  onSuccess?: () => void;
  roomId: string | null;
  roomName: string | null;
  roomPassword: string | null;
}) => {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const { token } = useAuth();

  const [isVisible, setIsVisible] = useState<boolean>(false);
  const toggleVisibility = () => setIsVisible((prevState) => !prevState);

  const form = useForm<EditMatchFormSchemaType>({
    resolver: zodResolver(EditMatchFormSchema),
    defaultValues: {
      roomId: roomId || "",
      roomName: roomName || "",
      roomPassword: roomPassword || "",
    },
  });

  const onSubmit = (data: EditMatchFormSchemaType) => {
    startTransition(async () => {
      try {
        const res = await axios.post(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/edit-match-details/`,
          {
            room_id: data.roomId,
            room_name: data.roomName,
            room_password: data.roomPassword,
            match_id: matchId,
          },
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        // if(res.statusText === 'OK')

        toast.success(res.data.message || "Match edit successfully");
        setOpen(false);

        onSuccess?.();
      } catch (e: any) {
        console.log(e);
        toast.error(e.response?.data?.message || "Failed to edited match");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon">
          <IconPencil className="size-3" />
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-[400px]">
        <div className="text-center">
          <div className="h-14 w-14 mx-auto mb-4 rounded-full bg-blue-100 flex items-center justify-center">
            <IconPencil className="h-7 w-7 text-blue-600" />
          </div>

          <DialogTitle>Edit Match Details</DialogTitle>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="roomId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Room ID</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter room ID" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="roomName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Room Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter room name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="roomPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Room password</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type={isVisible ? "text" : "password"}
                          className="bg-input border-border"
                          placeholder="Enter your password"
                          {...field}
                        />
                        <Button
                          className="absolute top-[50%] translate-y-[-50%] end-1 text-muted-foreground/80"
                          variant={"ghost"}
                          size="icon"
                          type="button"
                          onClick={toggleVisibility}
                          aria-label={
                            isVisible ? "Hide password" : "Show password"
                          }
                          aria-pressed={isVisible}
                          aria-controls="password"
                        >
                          {isVisible ? (
                            <EyeOffIcon className="size-4" aria-hidden="true" />
                          ) : (
                            <EyeIcon className="size-4" aria-hidden="true" />
                          )}
                        </Button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex gap-2 mt-6">
                <Button
                  variant="outline"
                  className="flex-1"
                  disabled={pending}
                  onClick={() => setOpen(false)}
                >
                  Cancel
                </Button>
                <Button className="flex-1" type="submit" disabled={pending}>
                  {pending ? <Loader text="Saving..." /> : "Save"}
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </DialogContent>
    </Dialog>
  );
};
