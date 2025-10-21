import type { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  description?: string;
  action?: ReactNode;
}

export function PageHeader({ title, description, action }: PageHeaderProps) {
  return (
    <div className="mb-8">
      <div className="flex flex-col md:flex-row justify-between items-start gap-4 md:gap-0 md:items-center">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-primary to-[hsl(var(--gold))] bg-clip-text text-transparent">
            {title}
          </h1>
          {description && (
            <p className="mt-2 text-sm md:text-base text-muted-foreground">
              {description}
            </p>
          )}
        </div>
        {action && <div className="w-full md:w-auto">{action}</div>}
      </div>
    </div>
  );
}
