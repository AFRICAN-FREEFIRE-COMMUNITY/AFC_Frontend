import type React from "react"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"

interface PrizeDistributionProps {
  distribution: string[]
  onChange: (index: number, value: string) => void
}

export const PrizeDistribution: React.FC<PrizeDistributionProps> = ({ distribution, onChange }) => {
  return (
    <div>
      <Label>Prize Distribution</Label>
      <div className="grid grid-cols-2 gap-4">
        {distribution.map((prize, index) => (
          <div key={index}>
            <Label htmlFor={`prize-${index + 1}`}>{index + 1}st Place</Label>
            <Input
              id={`prize-${index + 1}`}
              value={prize}
              onChange={(e) => onChange(index, e.target.value)}
              type="number"
            />
          </div>
        ))}
      </div>
    </div>
  )
}
