"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { useTransition } from "react";
import axios from "axios";
import { toast } from "sonner";
import { env } from "@/lib/env";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Loader } from "@/components/Loader";
import { AlertTriangle, CheckCircle } from "lucide-react";
import { IconBan } from "@tabler/icons-react";

export const ToggleCouponStatusModal = ({
  couponId,
  couponCode,
  currentStatus,
  open,
  onOpenChange,
  onSuccess,
}: {
  couponId: string;
  couponCode: string;
  currentStatus: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}) => {
  const [pending, startTransition] = useTransition();
  const { token } = useAuth();

  const isActivating = currentStatus.toLowerCase() !== "active";
  const endpoint = isActivating ? "activate-coupon" : "deactivate-coupon";

  const handleToggleStatus = () => {
    startTransition(async () => {
      try {
        const res = await axios.post(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/shop/${endpoint}/`,
          { coupon_id: couponId },
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        );

        toast.success(
          res.data.message ||
            `Coupon ${isActivating ? "activated" : "deactivated"} successfully`,
        );
        onSuccess?.();
      } catch (e: any) {
        toast.error(e.response?.data?.message || `Failed to update status`);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <div className="text-center">
          <div
            className={`h-14 w-14 mx-auto mb-4 rounded-full flex items-center justify-center ${
              isActivating ? "bg-green-100" : "bg-yellow-100"
            }`}
          >
            {isActivating ? (
              <CheckCircle className="h-7 w-7 text-green-600" />
            ) : (
              <AlertTriangle className="h-7 w-7 text-yellow-600" />
            )}
          </div>

          <DialogTitle className="text-xl capitalize">
            {isActivating ? "Activate" : "Deactivate"} coupon
          </DialogTitle>
          <DialogDescription className="mt-2 text-base">
            Are you sure you want to {isActivating ? "activate" : "deactivate"}{" "}
            <b>"{couponCode}"</b>?
          </DialogDescription>

          <div className="flex gap-3 mt-6">
            <Button
              variant="outline"
              className="flex-1"
              disabled={pending}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              variant={isActivating ? "default" : "warning"}
              className="flex-1"
              onClick={handleToggleStatus}
              disabled={pending}
            >
              {pending ? (
                <Loader text="Processing..." />
              ) : (
                <div className="flex items-center">
                  {isActivating ? (
                    <CheckCircle className="h-4 w-4 mr-2" />
                  ) : (
                    <IconBan className="h-4 w-4 mr-2" />
                  )}
                  {isActivating ? "Activate" : "Deactivate"}
                </div>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
