"use client";

import React, { useTransition } from "react";
import axios from "axios";
import { toast } from "sonner";
import { env } from "@/lib/env";
import { useAuth } from "@/contexts/AuthContext";
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
import { Button } from "@/components/ui/button";
import { IconTrash } from "@tabler/icons-react";
import { Loader } from "@/components/Loader";

interface DeleteVariantModalProps {
  variantId: number;
  variantTitle: string;
  onSuccess: () => void;
}

export function DeleteVariantModal({
  variantId,
  variantTitle,
  onSuccess,
}: DeleteVariantModalProps) {
  const [isPending, startTransition] = useTransition();
  const { token } = useAuth();

  const onDelete = () => {
    startTransition(async () => {
      try {
        await axios.post(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/shop/delete-product-variant/`,
          { variant_id: variantId },
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );

        toast.success("Variant deleted successfully");
        onSuccess();
      } catch (error: any) {
        const errorMessage =
          error.response?.data?.message || "Failed to delete variant";
        toast.error(errorMessage);
      }
    });
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive hover:text-destructive hover:bg-destructive/10"
        >
          <IconTrash size={16} />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently delete the variant{" "}
            <strong>{variantTitle}</strong>. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              onDelete();
            }}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={isPending}
          >
            {isPending ? <Loader text="Deleting..." /> : "Delete Variant"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
