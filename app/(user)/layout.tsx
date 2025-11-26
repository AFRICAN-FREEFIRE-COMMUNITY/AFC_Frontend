import React, { ReactNode } from "react";
import { Footer } from "../_components/Footer";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { Header } from "./_components/Header";
import { PageGradient } from "@/components/PageGradient";

const layout = ({ children }: { children: ReactNode }) => {
  return (
    <div className="min-h-screen">
      <div className="relative z-10">
        <Header />
        <div className="py-10 container mx-auto px-4">{children}</div>
        <Footer />
      </div>
    </div>
  );
};

export default layout;
