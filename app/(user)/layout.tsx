import React, { ReactNode } from "react";
import { Footer } from "../_components/Footer";
import { Header } from "./_components/Header";
import { ProtectedRoute } from "./_components/ProtectedRoute";
import { CartProvider } from "@/contexts/CartContext";
// Interactive GUIDED welcome tour (3 pieces). GuidedTourProvider is the cross-page
// orchestrator (state in localStorage so it survives navigation + auto-start + replay);
// WelcomeTour is the animated hub modal; PageGuide runs the per-stop driver.js spotlight
// on the real pages. All three are mounted here (PageGuide + WelcomeTour INSIDE the
// provider) so the tour can run on any user page. See contexts/GuidedTourContext.tsx.
import { GuidedTourProvider } from "@/contexts/GuidedTourContext";
import { WelcomeTour } from "./_components/WelcomeTour";
import { PageGuide } from "./_components/PageGuide";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Teams | Africa Freefire Community",
};

const layout = ({ children }: { children: ReactNode }) => {
  return (
    // <ProtectedRoute>
    // GuidedTourProvider wraps the user shell so the hub modal (WelcomeTour) and the
    // on-page spotlight (PageGuide) share one orchestrator and one persisted run that
    // survives the navigation between stops.
    <GuidedTourProvider>
      <div className="min-h-screen">
        <div className="relative z-10">
          <Header />
          <div className="py-10 container min-h-[60vh]">{children}</div>
          <Footer />
        </div>
        {/* Animated guided-tour HUB modal (auto-shows for newcomers, replayable from
            the Header sparkles button). Renders nothing when the hub is not open. */}
        <WelcomeTour />
        {/* On-page driver.js spotlight runner. Watches the route + orchestrator and
            runs the current stop's guide when we land on its page; returns nothing
            visible otherwise (only its scoped popover <style>). */}
        <PageGuide />
      </div>
    </GuidedTourProvider>
    // </ProtectedRoute>
  );
};

export default layout;
