"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/components/ui/use-toast"
import { Logo } from "@/components/Logo"

export default function EmailConfirmationPage() {
  const [email, setEmail] = useState<string | null>(null)
  const [confirmationCode, setConfirmationCode] = useState("")
  const router = useRouter()
  const { toast } = useToast()

  useEffect(() => {
    const storedEmail = localStorage.getItem("pendingConfirmationEmail")
    if (storedEmail) {
      setEmail(storedEmail)
    } else {
      // If there's no email in localStorage, redirect to create account page
      router.push("/create-account")
    }
  }, [router])

  const handleResendCode = () => {
    // In a real application, this would trigger sending a new confirmation code
    toast({
      title: "Confirmation code resent",
      description: "Please check your email for the new code.",
    })
  }

  const handleConfirmEmail = async (e: React.FormEvent) => {
    e.preventDefault()
    // In a real application, this would verify the confirmation code with the backend
    try {
      // Simulating an API call
      await new Promise((resolve) => setTimeout(resolve, 1000))

      if (confirmationCode === "123456") {
        // This is a mock validation, replace with actual logic
        localStorage.removeItem("pendingConfirmationEmail")
        toast({
          title: "Email confirmed",
          description: "Your account has been successfully created.",
        })
        router.push("/home")
      } else {
        toast({
          title: "Invalid code",
          description: "Please enter the correct confirmation code.",
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "An error occurred while confirming your email. Please try again.",
        variant: "destructive",
      })
    }
  }

  if (!email) {
    return <div>Loading...</div>
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="flex justify-center mb-4">
            <Logo size="large" />
          </div>
          <CardTitle className="text-2xl text-center">Check Your Email</CardTitle>
          <CardDescription className="text-center">We've sent a confirmation link to {email}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleConfirmEmail} className="space-y-4">
            <div className="space-y-2">
              <Input
                id="confirmationCode"
                placeholder="Enter confirmation code"
                value={confirmationCode}
                onChange={(e) => setConfirmationCode(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full">
              Confirm Email
            </Button>
          </form>
          <div className="mt-4 text-center">
            <Button variant="link" onClick={handleResendCode}>
              Resend confirmation code
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
