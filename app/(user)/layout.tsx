import React, { ReactNode } from "react";
import { Footer } from "../_components/Footer";
import { Header } from "./_components/Header";
import { UserAreaShell } from "./_components/UserAreaShell";
import { MockBootstrap } from "@/components/MockBootstrap";
import { DevPanel } from "@/components/DevPanel";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Teams | Africa Freefire Community",
};

const layout = ({ children }: { children: ReactNode }) => {
  return (
    <div className="min-h-screen">
      <MockBootstrap />
      <div className="relative z-10">
        <UserAreaShell>
          <Header />
          <div className="py-10 container min-h-[60vh]">{children}</div>
          <Footer />
        </UserAreaShell>
      </div>
      <DevPanel />
    </div>
  );
};

export default layout;
