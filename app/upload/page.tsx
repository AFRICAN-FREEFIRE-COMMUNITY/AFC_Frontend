import type React from "react"
import Layout from "@/components/Layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

const UploadPage: React.FC = () => {
  return (
    <Layout>
      <h1 className="text-3xl font-rajdhani font-bold text-[#FFD700] mb-6">Upload Match Results</h1>
      <form className="space-y-6">
        <div>
          <Label htmlFor="match-type">Match Type</Label>
          <Input id="match-type" placeholder="e.g., Tournament, Scrim" className="bg-[#1A1A2E] border-[#8A8A8A]" />
        </div>
        <div>
          <Label htmlFor="match-date">Match Date</Label>
          <Input id="match-date" type="date" className="bg-[#1A1A2E] border-[#8A8A8A]" />
        </div>
        <div>
          <Label htmlFor="match-results">Match Results (JSON)</Label>
          <Textarea
            id="match-results"
            placeholder="Paste JSON data here"
            className="bg-[#1A1A2E] border-[#8A8A8A] h-40"
          />
        </div>
        <div>
          <Label htmlFor="screenshot">Upload Screenshot (optional)</Label>
          <Input id="screenshot" type="file" accept="image/*" className="bg-[#1A1A2E] border-[#8A8A8A]" />
        </div>
        <Button type="submit" className="bg-[#FFD700] text-[#1A1A2E] hover:bg-[#FFD700]/90">
          Submit Results
        </Button>
      </form>
    </Layout>
  )
}

export default UploadPage
