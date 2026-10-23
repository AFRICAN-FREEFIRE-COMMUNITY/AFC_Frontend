import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";
// Guided "Take a tour" launcher for the admin area. It is pathname-aware: it shows
// the tour button (and handles first-visit auto-show) only on pages that have a tour
// defined in app/(a)/a/_components/admin-tour-steps.ts, and renders nothing elsewhere.
import { AdminTourLauncher } from "@/app/(a)/a/_components/AdminTourLauncher";
// "Section > Page > Sub-page", from the same menu data as the sidebar (inbox #54)
import { AdminBreadcrumb } from "./admin-breadcrumb";

export function SiteHeader() {
  return (
    <header className="flex h-(--header-height) py-8 md:py-0 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1 mr-2" />
        <div className="md:hidden">
          <Logo size="small" />
        </div>
        {/* No rule under the header or divider beside the trigger (design rule 2026-08-17):
            spacing separates them. The breadcrumb names where you are (inbox #54). */}
        <div className="hidden min-w-0 md:flex">
          <AdminBreadcrumb />
        </div>

        <div className="ml-auto flex items-center gap-2">
          {/* "Take a tour" guide for the current admin page (self-hides where no
              tour exists). Sits left of the theme toggle. */}
          <AdminTourLauncher />
          <ThemeToggle hide={false} />
        </div>
      </div>
    </header>
  );
}
