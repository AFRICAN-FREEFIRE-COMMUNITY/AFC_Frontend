import React, { ReactNode } from "react";
import { Footer } from "../_components/Footer";
import { Header } from "./_components/Header";
import { ProtectedRoute } from "./_components/ProtectedRoute";
import { CartProvider } from "@/contexts/CartContext";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Teams | Africa Freefire Community",
};

const layout = ({ children }: { children: ReactNode }) => {
  return (
    // <ProtectedRoute>
    <div className="min-h-screen">
      <div className="relative z-10">
        <Header />
        <div className="py-10 container min-h-[60vh]">{children}</div>
        <Footer />
      </div>
    </div>
    // </ProtectedRoute>
  );
};

export default layout;
