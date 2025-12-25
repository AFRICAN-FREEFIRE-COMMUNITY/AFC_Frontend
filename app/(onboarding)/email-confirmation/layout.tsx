import React, { ReactNode } from "react";
import Link from "next/link";
import { Logo } from "@/components/Logo";

import { AuthGuard } from "@/app/(auth)/_components/AuthGuard";
import { Footer } from "@/app/_components/Footer";
import { Header } from "@/app/(user)/_components/Header";

const Layout = ({ children }: { children: ReactNode }) => {
  return (
    <div>
      <Header />
      <div className="py-20 container">
        <div className="flex items-center justify-center">
          <div className="rounded-md shadow-lg w-full max-w-xl">
            <Link href={"/"} className="flex justify-center">
              <Logo size="large" />
            </Link>
            <AuthGuard>{children}</AuthGuard>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default Layout;
