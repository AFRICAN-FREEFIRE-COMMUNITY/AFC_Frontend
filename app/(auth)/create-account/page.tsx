"use client";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { CreateAccountForm } from "./_components/CreateAccountForm";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

export default function page() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();

  if (isAuthenticated) return router.push("/home");
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="bg-card p-8 rounded-lg shadow-lg w-full max-w-md">
        <div className="flex justify-center mb-6">
          <Logo size="large" />
        </div>
        <h1 className="text-3xl font-rajdhani font-bold text-primary mb-6 text-center">
          Create AFC DATABASE Account
        </h1>
        <CreateAccountForm />
        <div className="mt-6 text-center">
          <p className="text-muted-foreground">Already have an account?</p>
          <Link href="/login" className="text-primary hover:underline">
            Login here
          </Link>
        </div>
      </div>
    </div>
  );
}
