"use client"

import { useState } from "react"
import Layout from "@/components/Layout"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import Image from "next/image"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { PlusCircle } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { ExternalLink } from "lucide-react"

export default function NewsPage() {
  const [userRole, setUserRole] = useState("moderator") // This should come from an auth context in a real app
  const [selectedCategory, setSelectedCategory] = useState("all")

  // Mock data for news items with author names
  const newsItems = [
    {
      id: 1,
      title: "New Tournament Series Announced",
      excerpt:
        "AFC is proud to announce the launch of the 'African Freefire Masters' tournament series, starting next month.",
      date: "2023-07-01T14:30:00Z",
      author: {
        name: "John Doe", // Mock author name
        avatar: "/placeholder.svg",
        role: "Admin",
      },
      image: "/placeholder.svg?height=200&width=300",
      category: "tournament-updates",
      registrationLink: "https://example.com/register",
    },
    {
      id: 2,
      title: "Team Rankings Updated",
      excerpt: "The latest team rankings have been released. Check out the Leaderboards to see where your team stands!",
      date: "2023-06-28T10:15:00Z",
      author: {
        name: "Jane Smith", // Mock author name
        avatar: "/placeholder.svg",
        role: "Moderator",
      },
      image: "/placeholder.svg?height=200&width=300",
      category: "general-news",
    },
    {
      id: 3,
      title: "Player Banned for Rule Violation",
      excerpt:
        "A professional player has been banned for violating tournament rules. Read more about the incident and the consequences.",
      date: "2023-06-25T09:00:00Z",
      author: {
        name: "Mike Johnson", // Mock author name
        avatar: "/placeholder.svg",
        role: "Moderator",
      },
      image: "/placeholder.svg?height=200&width=300",
      category: "banned-updates",
    },
  ]

  const categories = [
    { value: "all", label: "All Categories" },
    { value: "general-news", label: "General News" },
    { value: "tournament-updates", label: "Tournament Updates" },
    { value: "banned-updates", label: "Banned Player/Team Updates" },
  ]

  const filteredNews =
    selectedCategory === "all" ? newsItems : newsItems.filter((item) => item.category === selectedCategory)

  const getCategoryLabel = (category: string) => {
    return categories.find((c) => c.value === category)?.label || category
  }

  return (
    <Layout>
      <div className="container mx-auto px-4 py-4">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-3xl font-bold">News & Updates</h1>
          {userRole === "moderator" && (
            <Button asChild>
              <Link href="/admin/news/create">
                <PlusCircle className="mr-2 h-4 w-4" />
                Create News Post
              </Link>
            </Button>
          )}
        </div>

        <div className="mb-4">
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((category) => (
                <SelectItem key={category.value} value={category.value}>
                  {category.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredNews.map((item) => (
            <Card key={item.id} className="overflow-hidden h-full flex flex-col">
              <div className="relative h-40">
                <Image src={item.image || "/placeholder.svg"} alt={item.title} fill className="object-cover" />
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                  <Badge variant="secondary" className="text-xs">
                    {getCategoryLabel(item.category)}
                  </Badge>
                </div>
              </div>
              <CardContent className="p-3 flex-grow flex flex-col">
                <h2 className="text-lg font-bold mb-1 line-clamp-2">{item.title}</h2>
                <div className="flex items-center space-x-1 text-xs text-muted-foreground mb-2">
                  <Avatar className="h-4 w-4 mr-1">
                    <AvatarImage src={item.author.avatar} alt={item.author.name} />
                    <AvatarFallback>{item.author.name[0]}</AvatarFallback>
                  </Avatar>
                  <span>{item.author.name}</span>
                  <span>•</span>
                  <span>{new Date(item.date).toLocaleDateString()}</span>
                </div>
                <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{item.excerpt}</p>
                <div className="mt-auto flex space-x-2">
                  <Button size="sm" asChild>
                    <Link href={`/news/${item.id}`}>Read More</Link>
                  </Button>
                  {item.category === "tournament-updates" && item.registrationLink && (
                    <Button size="sm" asChild variant="outline">
                      <a href={item.registrationLink} target="_blank" rel="noopener noreferrer">
                        Register <ExternalLink className="ml-1 h-3 w-3" />
                      </a>
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </Layout>
  )
}
