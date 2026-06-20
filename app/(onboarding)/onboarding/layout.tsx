import React, { ReactNode } from "react";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { Footer } from "@/app/_components/Footer";
import { Header } from "@/app/(user)/_components/Header";

// Shell for the first-login onboarding flow (owner 2026-06-20). Mirrors the
// email-confirmation layout (Header + centered card + Footer) but WITHOUT AuthGuard:
// onboarding is for a LOGGED-IN new user (AuthGuard is for logged-out auth pages).
// The page itself bounces a logged-out visitor to /login.
const Layout = ({ children }: { children: ReactNode }) => {
  return (
    <div>
      <Header />
      <div className="py-16 container">
        <div className="flex items-center justify-center">
          <div className="w-full max-w-xl">
            <Link href={"/"} className="flex justify-center mb-2">
              <Logo size="large" />
            </Link>
            {children}
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default Layout;
