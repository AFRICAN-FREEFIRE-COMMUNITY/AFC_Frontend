"use client";

// Owner 2026-06-20: the Player/Team Reports triage moved UNDER the Teams & Players
// page as a "Reports" tab (app/(a)/a/_components/ReportsAdminContent.tsx). This old
// standalone route now just redirects to /a/teams?tab=reports so any bookmarks /
// notification deep links keep working (mirrors how /a/players redirects to
// /a/teams?tab=players).
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { FullLoader } from "@/components/Loader";

export default function PlayerReportsRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/a/teams?tab=reports");
  }, [router]);
  return <FullLoader />;
}
