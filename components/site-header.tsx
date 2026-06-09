import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";
// Guided "Take a tour" launcher for the admin area. It is pathname-aware: it shows
// the tour button (and handles first-visit auto-show) only on pages that have a tour
// defined in app/(a)/a/_components/admin-tour-steps.ts, and renders nothing elsewhere.
import { AdminTourLauncher } from "@/app/(a)/a/_components/AdminTourLauncher";

export function SiteHeader() {
  return (
    <header className="flex h-(--header-height) py-8 md:py-0 shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mx-2 data-[orientation=vertical]:h-4"
        />
        <div className="md:hidden">
          <Logo size="small" />
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
