import React, { ReactNode } from "react";
import { Metadata } from "next";
import { Header } from "../_components/Header";
import { Footer } from "../_components/Footer";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { AuthGuard } from "./_components/AuthGuard";
import { siteConfig } from "@/lib/seo";

export const metadata: Metadata = {
  title: {
    default: "Account",
    template: `%s | ${siteConfig.shortName}`,
  },
  robots: {
    index: true,
    follow: true,
  },
};

const Layout = ({ children }: { children: ReactNode }) => {
  return (
    <div>
      <Header />
      <div className="py-20 container">
        <div className="flex items-center justify-center">
          <div className="rounded-md w-full max-w-2xl">
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
