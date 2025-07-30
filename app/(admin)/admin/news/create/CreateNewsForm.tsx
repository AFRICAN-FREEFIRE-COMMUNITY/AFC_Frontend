"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import AdminLayout from "@/components/AdminLayout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ImageUploader } from "@/components/ImageUploader"
import { useToast } from "@/components/ui/use-toast"
import { SimpleRichTextEditor } from "@/components/SimpleRichTextEditor"
import { SearchableEventDropdown } from "@/components/SearchableEventDropdown"

const categories = [
  { value: "general-news", label: "General News" },
  { value: "tournament-updates", label: "Tournament Updates" },
  { value: "banned-updates", label: "Banned Player/Team Updates" },
]

const events = [
  { value: "event1", label: "Summer Showdown 2023" },
  { value: "event2", label: "Fall Classic 2023" },
  { value: "event3", label: "Winter Cup 2023" },
]

interface CreateNewsFormProps {
  initialUsername: string
}

export default function CreateNewsForm({ initialUsername }: CreateNewsFormProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [title, setTitle] = useState("")
  const [content, setContent] = useState("")
  const [category, setCategory] = useState("")
  const [event, setEvent] = useState("")
  const [images, setImages] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [author, setAuthor] = useState(initialUsername) // Updated: Initialize author with initialUsername

  const handleImageUpload = (imageUrl: string) => {
    setImages([...images, imageUrl])
  }

  const handleSaveDraft = async () => {
    setIsLoading(true)
    try {
      const newsData = {
        title,
        content,
        category,
        event,
        images,
        author,
      }
      await new Promise((resolve) => setTimeout(resolve, 1000))
      toast({
        title: "Draft Saved",
        description: "The news article has been saved as a draft.",
      })
      router.push("/admin/news")
    } catch (error) {
      toast({
        title: "Error",
        description: "An error occurred while saving the draft. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handlePublish = async () => {
    setIsLoading(true)
    try {
      const newsData = {
        title,
        content,
        category,
        event,
        images,
        author,
      }
      await new Promise((resolve) => setTimeout(resolve, 1000))
      toast({
        title: "News Published",
        description: "The news article has been successfully published.",
      })
      router.push("/admin/news")
    } catch (error) {
      toast({
        title: "Error",
        description: "An error occurred while publishing the news. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <AdminLayout>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">Create News & Announcement</h1>
        <form>
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>News Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Enter news title"
                  required
                />
              </div>
              <div>
                <Label htmlFor="content">Content</Label>
                <SimpleRichTextEditor initialValue={content} onChange={setContent} />
              </div>
              <div>
                <Label htmlFor="category">Category</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="event">Related Event (Optional)</Label>
                <SearchableEventDropdown value={event} onValueChange={setEvent} />
              </div>
              <div>
                <Label>Images</Label>
                <ImageUploader onImageUpload={handleImageUpload} />
                <div className="mt-2 flex flex-wrap gap-2">
                  {images.map((img, index) => (
                    <img
                      key={index}
                      src={img || "/placeholder.svg"}
                      alt={`Uploaded ${index + 1}`}
                      className="w-20 h-20 object-cover"
                    />
                  ))}
                </div>
              </div>
              <div>
                <Label htmlFor="author">Author</Label>
                <Input id="author" value={author} disabled /> {/* Updated: Author input is now disabled */}
              </div>
            </CardContent>
          </Card>
          <div className="flex justify-end space-x-4">
            <Button type="button" variant="outline" onClick={() => router.push("/admin/news")}>
              Cancel
            </Button>
            <Button type="button" onClick={handleSaveDraft} disabled={isLoading}>
              {isLoading ? "Saving..." : "Save to Drafts"}
            </Button>
            <Button type="button" onClick={handlePublish} disabled={isLoading}>
              {isLoading ? "Publishing..." : "Publish"}
            </Button>
          </div>
        </form>
      </div>
    </AdminLayout>
  )
}
