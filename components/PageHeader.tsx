"use client";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { Button } from "./ui/button";
import { IconArrowLeft } from "@tabler/icons-react";

interface PageHeaderProps {
  title: string | React.ReactNode;
  description?: string | any;
  action?: ReactNode;
  back?: boolean;
  // Optional guided-tour anchor (owner 2026-07-13): when set, stamps data-tour on the header
  // root so the comprehensive welcome tour (guided-tour-stops.ts + PageGuide.tsx) can spotlight
  // "you are on the <page> page" as its first step on each route. Attribute-only, no layout change.
  dataTour?: string;
}

export function PageHeader({
  title,
  description,
  action,
  back,
  dataTour,
}: PageHeaderProps) {
  const router = useRouter();

  return (
    <div className="mb-4" data-tour={dataTour}>
      <div className="flex items-start justify-start gap-2">
        {back && (
          <Button
            onClick={() => router.back()}
            size="icon"
            variant={"secondary"}
          >
            <IconArrowLeft />
          </Button>
        )}
        <div className="flex flex-col md:flex-row justify-between items-start gap-4 md:gap-0 md:items-center">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-primary">
              {title}
            </h1>
            {description && (
              <p className="mt-2 text-sm md:text-base text-muted-foreground">
                {description}
              </p>
            )}
          </div>
        </div>
        {action && <div className="w-full md:w-auto">{action}</div>}
      </div>
    </div>
  );
}
