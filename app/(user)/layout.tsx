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
// Gentle, dismissible nudge for players with no esports image / team owners with no logo (owner 2026-06-20).
import { CompletionReminder } from "./_components/CompletionReminder";
// First-login onboarding redirect (owner 2026-06-20): sends a brand-new user to the
// skippable /onboarding flow once (has_completed_onboarding === false).
import { OnboardingGate } from "./_components/OnboardingGate";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Teams | African Free Fire Community",
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
          {/* print:hidden on the site chrome so window.print() (e.g. the order "Print Receipt"
              button) yields a clean printout of just the page content, not the nav header + the
              full site footer bleeding onto a 2nd page (owner 2026-06-29). */}
          <div className="print:hidden">
            <Header />
          </div>
          {/* First-login onboarding: redirect a brand-new user to /onboarding once. Renders nothing. */}
          <OnboardingGate />
          {/* Quiet, dismissible profile-completion nudge (esports image / team logo). Non-blocking. */}
          <CompletionReminder />
          <div className="py-10 container min-h-[60vh]">{children}</div>
          <div className="print:hidden">
            <Footer />
          </div>
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
