"use client";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export const useSignout = () => {
  const router = useRouter();
  const { logout } = useAuth();

  const handleSignout = async function signout() {
    try {
      logout();
      toast.success("Logged out successfully");
      router.push("/");
    } catch {
      toast.error("Oops! Failed to logout");
    } finally {
      localStorage.removeItem("lastVisitedPath"); // 🔹 clear last page
      router.push("/login?logout=true");
    }
  };

  return handleSignout;
};
