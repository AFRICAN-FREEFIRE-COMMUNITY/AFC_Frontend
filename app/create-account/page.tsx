"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Logo } from "@/components/Logo"
import { useToast } from "@/components/ui/use-toast"
import { useRouter } from "next/navigation"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

// Mock function to fetch countries (replace with actual API call in production)
const fetchCountries = async () => {
  // Simulating API call
  await new Promise((resolve) => setTimeout(resolve, 1000))
  return ["Afghanistan", "Albania", "Algeria", /* ... other countries ... */ "Zimbabwe"]
}

export default function CreateAccountPage() {
  const { toast } = useToast()
  const router = useRouter()
  const [countries, setCountries] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [formData, setFormData] = useState({
    fullName: "",
    ingameName: "",
    uid: "",
    email: "",
    password: "",
    confirmPassword: "",
    country: "",
  })

  useEffect(() => {
    const loadCountries = async () => {
      try {
        const fetchedCountries = await fetchCountries()
        setCountries(fetchedCountries)
      } catch (error) {
        console.error("Failed to fetch countries:", error)
        toast({
          title: "Error",
          description: "Failed to load country list. Please try again later.",
          variant: "destructive",
        })
      } finally {
        setIsLoading(false)
      }
    }

    loadCountries()
  }, [toast])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.id]: e.target.value })
  }

  const handleCountryChange = (value: string) => {
    setFormData({ ...formData, country: value })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (formData.password !== formData.confirmPassword) {
      toast({
        title: "Passwords do not match",
        description: "Please ensure your passwords match.",
        variant: "destructive",
      })
      return
    }

    try {
      // Here you would typically send the form data to your backend
      // Simulating an API call
      await new Promise((resolve) => setTimeout(resolve, 1000))

      // Store the email in localStorage for the confirmation page
      localStorage.setItem("pendingConfirmationEmail", formData.email)

      // Redirect to the email confirmation page
      router.push("/email-confirmation")
    } catch (error) {
      toast({
        title: "Error",
        description: "An error occurred while creating your account. Please try again.",
        variant: "destructive",
      })
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="bg-card p-8 rounded-lg shadow-lg w-full max-w-md">
        <div className="flex justify-center mb-6">
          <Logo size="large" />
        </div>
        <h1 className="text-3xl font-rajdhani font-bold text-primary mb-6 text-center">Create AFC DATABASE Account</h1>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <Label htmlFor="fullName">Full Name</Label>
            <Input
              id="fullName"
              type="text"
              placeholder="Enter your full name"
              className="bg-input border-border"
              value={formData.fullName}
              onChange={handleChange}
              required
            />
          </div>
          <div>
            <Label htmlFor="ingameName">IN-GAME NAME</Label>
            <Input
              id="ingameName"
              type="text"
              placeholder="Enter your in-game name"
              className="bg-input border-border"
              value={formData.ingameName}
              onChange={handleChange}
              required
            />
          </div>
          <div>
            <Label htmlFor="uid">UID</Label>
            <Input
              id="uid"
              type="text"
              placeholder="Enter your FreeFire UID"
              className="bg-input border-border"
              value={formData.uid}
              onChange={handleChange}
              required
            />
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="Enter your email"
              className="bg-input border-border"
              value={formData.email}
              onChange={handleChange}
              required
            />
          </div>
          <div>
            <Label htmlFor="country">Country</Label>
            <Select onValueChange={handleCountryChange} disabled={isLoading}>
              <SelectTrigger>
                <SelectValue placeholder={isLoading ? "Loading countries..." : "Select your country"} />
              </SelectTrigger>
              <SelectContent>
                {countries.map((country) => (
                  <SelectItem key={country} value={country}>
                    {country}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="Create a password"
              className="bg-input border-border"
              value={formData.password}
              onChange={handleChange}
              required
            />
          </div>
          <div>
            <Label htmlFor="confirmPassword">Confirm Password</Label>
            <Input
              id="confirmPassword"
              type="password"
              placeholder="Confirm your password"
              className="bg-input border-border"
              value={formData.confirmPassword}
              onChange={handleChange}
              required
            />
          </div>
          <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
            Create Account
          </Button>
        </form>
        <div className="mt-6 text-center">
          <p className="text-muted-foreground">Already have an account?</p>
          <Link href="/login" className="text-primary hover:underline">
            Login here
          </Link>
        </div>
      </div>
    </div>
  )
}
