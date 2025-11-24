"use client";
import React from "react";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { LoginForm } from "./_components/LoginForm";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

export default function LoginPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();

  if (isAuthenticated) return router.push("/home");
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="bg-card p-8 rounded-md shadow-lg w-full max-w-md">
        <Link href={"/"} className="flex justify-center mb-6">
          <Logo size="large" />
        </Link>
        <h1 className="text-2xl md:text-3xl font-rajdhani font-bold text-primary mb-6 text-center">
          Login to AFC
        </h1>
        <LoginForm />
        <div className="mt-4 text-center">
          <Link
            href="/forgot-password"
            className="text-muted-foreground hover:text-primary"
          >
            Forgot password?
          </Link>
        </div>
        <div className="mt-6 text-center">
          <p className="text-muted-foreground">Don't have an account?</p>
          <Link href="/create-account" className="text-primary hover:underline">
            Create an account
          </Link>
        </div>
      </div>
    </div>
  );
}
