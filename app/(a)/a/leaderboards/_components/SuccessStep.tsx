"use client";

import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  IconCircleCheck,
  IconTrophy,
  IconArrowRight,
} from "@tabler/icons-react";
import Link from "next/link";

export function SuccessStep() {
  return (
    <Card>
      <CardContent className="flex flex-col items-center text-center space-y-6">
        <div className="relative">
          <div className="absolute inset-0 bg-green-500/20 blur-3xl rounded-full" />
          <IconCircleCheck size={80} className="text-green-500 relative z-10" />
        </div>

        <div className="space-y-2">
          <h2 className="text-2xl lg:text-3xl font-semibold tracking-tight">
            Leaderboard Created!
          </h2>
          <p className="text-muted-foreground max-w-md text-sm mx-auto">
            Your leaderboard scoring rules and configuration have been
            successfully saved to the event.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 w-full max-w-md pt-4">
          <Link href="/a/leaderboards" className="w-full">
            <Button className="w-full">View Leaderboards</Button>
          </Link>
          <Link href="/a/dashboard" className="w-full">
            <Button variant="outline" className="w-full">
              Back to Dashboard
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
