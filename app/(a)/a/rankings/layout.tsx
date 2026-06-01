import React from "react";
import { RankingsSubNav } from "@/components/rankings/RankingsSubNav";

export default function RankingsAdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <RankingsSubNav />
      {children}
    </div>
  );
}
