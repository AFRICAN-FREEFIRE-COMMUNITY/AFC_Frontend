import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

interface CriteriaModalProps {
  name: string
  description: string
  calculation: string
}

export function CriteriaModal({ name, description, calculation }: CriteriaModalProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="link" className="p-0 h-auto font-normal text-left">
          {name}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{name}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="mt-4">
          <h4 className="font-semibold mb-2">Calculation:</h4>
          <p>{calculation}</p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
