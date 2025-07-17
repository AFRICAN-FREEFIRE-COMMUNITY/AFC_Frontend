"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import Layout from "@/components/Layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, ExternalLink } from "lucide-react"
import Image from "next/image"

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
      prizePool: "$50,000",
      format: "Battle Royale",
      tournamentName: "African Freefire Masters",
      location: "Online",
      registrationLink: "https://example.com/register",
    },
    {
      id: "2",
      title: "Team Rankings Updated",
      content:
        "<p>The latest team rankings have been released. Check out the Leaderboards to see where your team stands! These rankings take into account recent tournament performances, scrim results, and overall team statistics. Congratulations to all teams who have improved their positions!</p>",
      date: "2023-06-28T10:15:00Z",
      author: {
        name: "Jane Smith",
        avatar: "/placeholder.svg",
        role: "Moderator",
      },
      image: "/placeholder.svg?height=400&width=800",
      category: "general-news",
    },
    {
      id: "3",
      title: "Player Banned for Rule Violation",
      content:
        "<p>A professional player has been banned for violating tournament rules. The player, whose identity is being withheld pending an appeal, was found to be using unauthorized third-party software during an official match. The ban will be in effect for 6 months, after which the player's case will be reviewed. This incident serves as a reminder of the importance of fair play and integrity in our esports community.</p>",
      date: "2023-06-25T09:00:00Z",
      author: {
        name: "Mike Johnson",
        avatar: "/placeholder.svg",
        role: "Moderator",
      },
      image: "/placeholder.svg?height=400&width=800",
      category: "banned-updates",
    },
  ]

  return newsItems.find((item) => item.id === id)
}

export default function NewsPostPage() {
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
    return <Layout>Loading...</Layout>
  }

  if (error) {
    return <Layout>Error: {error}</Layout>
  }

  if (!newsPost) {
    return <Layout>News post not found</Layout>
  }

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <Button variant="outline" onClick={() => router.back()} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
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
            {newsPost.category === "tournament-updates" && (
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle>Tournament Details</CardTitle>
                </CardHeader>
                <CardContent>
                  <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <dt className="font-semibold">Tournament Name</dt>
                      <dd>{newsPost.tournamentName}</dd>
                    </div>
                    <div>
                      <dt className="font-semibold">Format</dt>
                      <dd>{newsPost.format}</dd>
                    </div>
                    <div>
                      <dt className="font-semibold">Prize Pool</dt>
                      <dd>{newsPost.prizePool}</dd>
                    </div>
                    <div>
                      <dt className="font-semibold">Location</dt>
                      <dd>{newsPost.location}</dd>
                    </div>
                  </dl>
                </CardContent>
              </Card>
            )}
            {newsPost.category === "tournament-updates" && newsPost.registrationLink && (
              <Button asChild className="mt-4">
                <a href={newsPost.registrationLink} target="_blank" rel="noopener noreferrer">
                  Register for Tournament <ExternalLink className="ml-2 h-4 w-4" />
                </a>
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  )
}
