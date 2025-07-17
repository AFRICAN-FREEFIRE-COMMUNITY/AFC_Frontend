"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import AdminLayout from "@/components/AdminLayout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DatePickerWithRange } from "@/components/ui/date-picker-with-range"
import { useToast } from "@/components/ui/use-toast"
import { addDays } from "date-fns"

export default function CreateTierPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [tierNumber, setTierNumber] = useState("")
  const [dateRange, setDateRange] = useState({
    from: new Date(),
    to: addDays(new Date(), 30),
  })
  const [tierName, setTierName] = useState("")
  const [isGenerating, setIsGenerating] = useState(false)
  const [isGenerated, setIsGenerated] = useState(false)

  const handleGenerateTier = () => {
    if (!tierNumber || !dateRange.from || !dateRange.to || !tierName) {
      toast({
        title: "Missing Information",
        description: "Please fill in all fields before generating the tier.",
        variant: "destructive",
      })
      return
    }

    setIsGenerating(true)
    // Simulate tier generation process
    setTimeout(() => {
      setIsGenerating(false)
      setIsGenerated(true)
      toast({
        title: "Tier Generated",
        description: "The tier has been successfully generated.",
      })
    }, 2000)
  }

  const handlePublishTier = () => {
    // In a real app, you would send this data to your backend
    console.log("Publishing tier:", { tierName, tierNumber, dateRange })
    toast({
      title: "Tier Published",
      description: "The tier has been successfully published.",
    })
    router.push("/admin/tiers")
  }

  return (
    <AdminLayout>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">Create New Tier</h1>

        <Card>
          <CardHeader>
            <CardTitle>Tier Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <Label htmlFor="tier-number">Tier Number</Label>
                <Select value={tierNumber} onValueChange={setTierNumber}>
                  <SelectTrigger id="tier-number">
                    <SelectValue placeholder="Select tier number" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Tier 1</SelectItem>
                    <SelectItem value="2">Tier 2</SelectItem>
                    <SelectItem value="3">Tier 3</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Tier Period</Label>
                <DatePickerWithRange dateRange={dateRange} setDateRange={setDateRange} />
              </div>

              <div>
                <Label htmlFor="tier-name">Tier Name</Label>
                <Input
                  id="tier-name"
                  value={tierName}
                  onChange={(e) => setTierName(e.target.value)}
                  placeholder="e.g., Tier 1 - July 2023"
                />
              </div>

              <Button onClick={handleGenerateTier} disabled={isGenerating || isGenerated}>
                {isGenerating ? "Generating..." : "Generate Tier"}
              </Button>

              {isGenerated && (
                <Button onClick={handlePublishTier} className="ml-4">
                  Publish Tier
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  )
}
