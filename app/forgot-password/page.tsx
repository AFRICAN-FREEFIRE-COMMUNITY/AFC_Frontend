import type React from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const ForgotPasswordPage: React.FC = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="bg-card p-8 rounded-lg shadow-lg w-full max-w-md">
        <h1 className="text-3xl font-rajdhani font-bold text-primary mb-6 text-center">Reset Your Password</h1>
        <p className="text-muted-foreground mb-6 text-center">
          Enter your email address and we'll send you instructions to reset your password.
        </p>
        <form className="space-y-4">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" placeholder="Enter your email" className="bg-input border-border" />
          </div>
          <Button className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
            Send Reset Instructions
          </Button>
        </form>
        <div className="mt-6 text-center">
          <Link href="/login" className="text-primary hover:underline">
            Back to Login
          </Link>
        </div>
      </div>
    </div>
  )
}

export default ForgotPasswordPage
