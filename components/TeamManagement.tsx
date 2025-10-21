import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/components/ui/use-toast"

interface TeamMember {
  id: string
  name: string
}

interface TeamManagementProps {
  teamId: string
  isCreator: boolean
  teamMembers: TeamMember[]
  onDisband: () => void
  onTransferOwnership: (newOwnerId: string) => void
  onLeave: () => void
}

export function TeamManagement({
  teamId,
  isCreator,
  teamMembers,
  onDisband,
  onTransferOwnership,
  onLeave,
}: TeamManagementProps) {
  const { toast } = useToast()
  const [newOwnerId, setNewOwnerId] = useState("")

  const handleDisband = () => {
    // In a real app, you would make an API call here
    onDisband()
    toast({
      title: "Team Disbanded",
      description: "Your team has been successfully disbanded.",
    })
  }

  const handleTransferOwnership = () => {
    if (!newOwnerId) {
      toast({
        title: "Error",
        description: "Please select a team member to transfer ownership to.",
        variant: "destructive",
      })
      return
    }
    // In a real app, you would make an API call here
    onTransferOwnership(newOwnerId)
    toast({
      title: "Ownership Transferred",
      description: "Team ownership has been successfully transferred.",
    })
  }

  const handleLeave = () => {
    // In a real app, you would make an API call here
    onLeave()
    toast({
      title: "Team Left",
      description: "You have successfully left the team.",
    })
  }

  return (
    <div className="space-y-4">
      {isCreator && (
        <>
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="destructive">Disband Team</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Disband Team</DialogTitle>
                <DialogDescription>
                  Are you sure you want to disband this team? This action cannot be undone.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => {}}>
                  Cancel
                </Button>
                <Button variant="destructive" onClick={handleDisband}>
                  Disband
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog>
            <DialogTrigger asChild>
              <Button>Transfer Ownership</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Transfer Team Ownership</DialogTitle>
                <DialogDescription>Select a team member to transfer ownership to.</DialogDescription>
              </DialogHeader>
              <Select onValueChange={setNewOwnerId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select new owner" />
                </SelectTrigger>
                <SelectContent>
                  {teamMembers.map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <DialogFooter>
                <Button variant="outline" onClick={() => {}}>
                  Cancel
                </Button>
                <Button onClick={handleTransferOwnership}>Transfer</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}

      {!isCreator && (
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline">Leave Team</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Leave Team</DialogTitle>
              <DialogDescription>Are you sure you want to leave this team?</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => {}}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleLeave}>
                Leave
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
