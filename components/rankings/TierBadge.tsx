import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// spec §11, 0=Elite, 1=Competitive, 2=Rising, 3=Entry
export const tierMeta: Record<number, { label: string; cls: string; min: number }> = {
  0: { label: "Elite", cls: "text-amber-400 border-amber-500/60", min: 150 },
  1: { label: "Competitive", cls: "text-green-400 border-green-600/60", min: 90 },
  2: { label: "Rising", cls: "text-blue-400 border-blue-600/60", min: 40 },
  3: { label: "Entry", cls: "text-orange-400 border-orange-600/60", min: 0 },
};

interface TierBadgeProps {
  tier: 0 | 1 | 2 | 3 | null | undefined;
  className?: string;
}

export function TierBadge({ tier, className }: TierBadgeProps) {
  if (tier === null || tier === undefined) {
    return (
      <Badge variant="outline" className={cn("rounded-full text-muted-foreground", className)}>
        Unranked
      </Badge>
    );
  }
  const m = tierMeta[tier];
  return (
    <Badge variant="outline" className={cn("rounded-full font-semibold", m.cls, className)}>
      {m.label}
    </Badge>
  );
}
