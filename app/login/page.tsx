"use client"

import React from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Logo } from "@/components/Logo"
import { useToast } from "@/components/ui/use-toast"

export default function LoginPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [isLoading, setIsLoading] = React.useState(false)

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsLoading(true)

    // Simulate login process
    await new Promise((resolve) => setTimeout(resolve, 1000))

    // In a real app, you would validate credentials here
    // For now, we'll just simulate a successful login
    toast({
      title: "Login successful",
      description: "Welcome back to AFC DATABASE!",
    })

    // Redirect to homepage
    router.push("/home")
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="bg-card p-8 rounded-lg shadow-lg w-full max-w-md">
        <div className="flex justify-center mb-6">
          <Logo size="large" />
        </div>
        <h1 className="text-3xl font-rajdhani font-bold text-primary mb-6 text-center">Login to AFC DATABASE</h1>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <Label htmlFor="identifier">In-game Name or UID</Label>
            <Input
              id="identifier"
              type="text"
              placeholder="Enter your in-game name or UID"
              className="bg-input border-border"
              required
            />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="Enter your password"
              className="bg-input border-border"
              required
            />
          </div>
          <Button
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
            type="submit"
            disabled={isLoading}
          >
            {isLoading ? "Logging in..." : "Login"}
          </Button>
        </form>
        <div className="mt-4 text-center">
          <Link href="/forgot-password" className="text-muted-foreground hover:text-primary">
            Forgot password?
          </Link>
        </div>
        <div className="mt-6 text-center">
          <p className="text-muted-foreground">Don't have an account?</p>
          <Link href="/create-account" className="text-primary hover:underline">
            Create an account
          </Link>
        </div>
      </div>
    </div>
  )
}
