"use client"

import React from "react"
import { useRouter } from "next/navigation"
import Layout from "@/components/Layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import Link from "next/link"

export default function EditProfilePage() {
  const router = useRouter()
  // Mock data - replace with actual data fetching logic
  const [userProfile, setUserProfile] = React.useState({
    name: "John Doe",
    username: "FireKing",
    email: "john.doe@example.com",
    uid: "123456789",
    inGameName: "FireKing123",
    avatar: "/placeholder.svg",
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // Here you would typically send the updated profile to your backend
    console.log("Profile updated:", userProfile)
    // Redirect to profile page after successful update
    router.push("/profile")
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUserProfile({ ...userProfile, [e.target.name]: e.target.value })
  }

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold mb-8">Edit Profile</h1>

        <Card>
          <CardHeader>
            <CardTitle>Update Your Information</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex justify-center mb-4">
                <Avatar className="w-32 h-32">
                  <AvatarImage src={userProfile.avatar} alt={userProfile.name} />
                  <AvatarFallback>{userProfile.name.charAt(0)}</AvatarFallback>
                </Avatar>
              </div>
              <div>
                <Label htmlFor="avatar">Profile Picture</Label>
                <Input id="avatar" type="file" accept="image/*" />
              </div>
              <div>
                <Label htmlFor="name">Name</Label>
                <Input id="name" name="name" value={userProfile.name} onChange={handleChange} />
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input id="email" name="email" type="email" value={userProfile.email} onChange={handleChange} />
              </div>
              <div>
                <Label htmlFor="uid">UID</Label>
                <Input id="uid" name="uid" value={userProfile.uid} onChange={handleChange} />
              </div>
              <div>
                <Label htmlFor="inGameName">In-Game Name</Label>
                <Input id="inGameName" name="inGameName" value={userProfile.inGameName} onChange={handleChange} />
              </div>
              <div className="flex justify-between">
                <Button type="submit">Save Changes</Button>
                <Button variant="outline" asChild>
                  <Link href="/profile/change-password">Change Password</Link>
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </Layout>
  )
}
