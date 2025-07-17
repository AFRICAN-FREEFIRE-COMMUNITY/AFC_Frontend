"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import AdminLayout from "@/components/AdminLayout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Edit } from "lucide-react"
import Image from "next/image"
import Link from "next/link"

// Mock function to fetch a news post
const fetchNewsPost = async (id: string) => {
  // In a real app, this would be an API call
  const newsItems = [
    {
      id: "1",
      title: "New Tournament Series Announced",
      content:
        "<p>AFC is proud to announce the launch of the 'African Freefire Masters' tournament series, starting next month. This exciting new series will bring together the best teams from across the continent to compete for glory and substantial prize pools. Stay tuned for more details on registration, format, and schedules.</p>",
      date: "2023-07-01T14:30:00Z",
      author: {
        name: "John Doe",
        avatar: "/placeholder.svg",
        role: "Admin",
      },
      image: "/placeholder.svg?height=400&width=800",
      category: "tournament-updates",
      event: "Summer Showdown 2023",
      eventId: "1", // Added eventId
    },
    // ... other news items
  ]

  return newsItems.find((item) => item.id === id)
}

export default function AdminNewsPostPage() {
  const params = useParams()
  const router = useRouter()
  const [newsPost, setNewsPost] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    const getNewsPost = async () => {
      try {
        const post = await fetchNewsPost(params.id as string)
        if (post) {
          setNewsPost(post)
        } else {
          setError("News post not found")
        }
      } catch (err) {
        setError("Failed to fetch news post")
      } finally {
        setIsLoading(false)
      }
    }

    getNewsPost()
  }, [params.id])

  if (isLoading) {
    return <AdminLayout>Loading...</AdminLayout>
  }

  if (error) {
    return <AdminLayout>Error: {error}</AdminLayout>
  }

  if (!newsPost) {
    return <AdminLayout>News post not found</AdminLayout>
  }

  return (
    <AdminLayout>
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-4">
          <Button variant="outline" onClick={() => router.push("/admin/news")}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back
          </Button>
          <div>
            <Button asChild className="mr-2">
              <Link href={`/admin/news/${params.id}/edit`}>
                <Edit className="mr-2 h-4 w-4" /> Edit
              </Link>
            </Button>
          </div>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="text-3xl">{newsPost.title}</CardTitle>
            <div className="flex items-center space-x-2 text-sm text-muted-foreground mt-2">
              <Avatar className="h-8 w-8">
                <AvatarImage src={newsPost.author.avatar} alt={newsPost.author.name} />
                <AvatarFallback>{newsPost.author.name[0]}</AvatarFallback>
              </Avatar>
              <span>{newsPost.author.name}</span>
              <span>•</span>
              <span>{new Date(newsPost.date).toLocaleString()}</span>
              <span>•</span>
              <Badge variant="secondary">{newsPost.category}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <Image
              src={newsPost.image || "/placeholder.svg"}
              alt={newsPost.title}
              width={800}
              height={400}
              className="w-full h-auto rounded-lg mb-6"
            />
            <div className="prose max-w-none mb-6" dangerouslySetInnerHTML={{ __html: newsPost.content }} />
            {newsPost.event && (
              <div className="mt-4">
                <h3 className="text-lg font-semibold">Related Event</h3>
                <Link href={`/admin/events/${newsPost.eventId}`} className="text-primary hover:underline">
                  {newsPost.event}
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  )
}
