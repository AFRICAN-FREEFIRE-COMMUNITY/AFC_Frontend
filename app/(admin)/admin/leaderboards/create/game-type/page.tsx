"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import AdminLayout from "@/components/AdminLayout"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"

const GameTypePage = () => {
  const router = useRouter()
  const [gameType, setGameType] = useState<"battle_royale" | "clash_squad" | "">("")
  const [leaderboardDetails, setLeaderboardDetails] = useState<any>(null)

  useEffect(() => {
    // Retrieve leaderboard details from localStorage
    const storedDetails = localStorage.getItem("leaderboardDetails")
    if (storedDetails) {
      setLeaderboardDetails(JSON.parse(storedDetails))
    } else {
      // If no details found, redirect back to step 1
      router.push("/admin/leaderboards/create")
    }
  }, [router])

  const handleContinue = () => {
    if (!gameType) return

    // Update leaderboard details with game type
    const updatedDetails = { ...leaderboardDetails, gameType }
    localStorage.setItem("leaderboardDetails", JSON.stringify(updatedDetails))

    // Navigate to the next step
    router.push("/admin/leaderboards/create/point-system")
  }

  const handleBack = () => {
    router.push("/admin/leaderboards/create")
  }

  if (!leaderboardDetails) {
    return <AdminLayout>Loading...</AdminLayout>
  }

  return (
    <AdminLayout>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-2">Create Leaderboard</h1>
        <p className="text-muted-foreground mb-8">Step 2 of 5: Game Type</p>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Select Game Type</CardTitle>
            <CardDescription>Choose the game type for {leaderboardDetails.leaderboardName}</CardDescription>
          </CardHeader>
          <CardContent>
            <RadioGroup value={gameType} onValueChange={(value: "battle_royale" | "clash_squad") => setGameType(value)}>
              <div className="flex flex-col space-y-4">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="battle_royale" id="battle_royale" />
                  <Label htmlFor="battle_royale" className="cursor-pointer">
                    <div className="font-medium">Battle Royale</div>
                    <div className="text-sm text-muted-foreground">Points based on placement and kills</div>
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="clash_squad" id="clash_squad" />
                  <Label htmlFor="clash_squad" className="cursor-pointer">
                    <div className="font-medium">Clash Squad</div>
                    <div className="text-sm text-muted-foreground">Points based on wins and kills</div>
                  </Label>
                </div>
              </div>
            </RadioGroup>
          </CardContent>
        </Card>

        <div className="flex justify-between">
          <Button variant="outline" onClick={handleBack}>
            Back
          </Button>
          <Button onClick={handleContinue} disabled={!gameType}>
            Continue to Point System
          </Button>
        </div>
      </div>
    </AdminLayout>
  )
}

export default GameTypePage
