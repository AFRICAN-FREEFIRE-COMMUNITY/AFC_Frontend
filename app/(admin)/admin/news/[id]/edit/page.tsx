"use client"

import { useState, useEffect } from "react"
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

// Mock function to fetch news data
const fetchNewsData = async (id: string) => {
  // In a real app, this would be an API call
  return {
    id,
    title: "Sample News Title",
    content: "<p>This is some sample content.</p>",
    category: "general-news",
    event: "event1",
    images: ["/placeholder.svg"],
  }
}

export default function EditNewsPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const { toast } = useToast()
  const [newsData, setNewsData] = useState({
    title: "",
    content: "",
    category: "",
    event: "",
    images: [] as string[],
  })
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadNewsData = async () => {
      try {
        const data = await fetchNewsData(params.id)
        setNewsData(data)
      } catch (error) {
        console.error("Failed to fetch news data:", error)
        toast({
          title: "Error",
          description: "Failed to load news data. Please try again.",
          variant: "destructive",
        })
      } finally {
        setIsLoading(false)
      }
    }

    loadNewsData()
  }, [params.id, toast])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setNewsData((prev) => ({ ...prev, [name]: value }))
  }

  const handleContentChange = (content: string) => {
    setNewsData((prev) => ({ ...prev, content }))
  }

  const handleImageUpload = (imageUrl: string) => {
    setNewsData((prev) => ({ ...prev, images: [...prev.images, imageUrl] }))
  }

  const handleSaveDraft = async () => {
    setIsLoading(true)
    try {
      // Here you would typically send the data to your backend to save as draft
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
      // Here you would typically send the data to your backend to publish
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      // In a real app, you would send the updated data to your backend here
      await new Promise((resolve) => setTimeout(resolve, 1000)) // Simulating API call
      toast({
        title: "News updated",
        description: "The news article has been successfully updated.",
      })
      router.push("/admin/news")
    } catch (error) {
      console.error("Failed to update news:", error)
      toast({
        title: "Error",
        description: "An error occurred while updating the news. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return <AdminLayout>Loading...</AdminLayout>
  }

  return (
    <AdminLayout>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">Edit News & Announcement</h1>
        <form onSubmit={handleSubmit}>
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>News Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  name="title"
                  value={newsData.title}
                  onChange={handleChange}
                  placeholder="Enter news title"
                  required
                />
              </div>
              <div>
                <Label htmlFor="content">Content</Label>
                <SimpleRichTextEditor initialValue={newsData.content} onChange={handleContentChange} />
              </div>
              <div>
                <Label htmlFor="category">Category</Label>
                <Select
                  value={newsData.category}
                  onValueChange={(value) => setNewsData((prev) => ({ ...prev, category: value }))}
                >
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
                <SearchableEventDropdown
                  value={newsData.event}
                  onValueChange={(value) => setNewsData((prev) => ({ ...prev, event: value }))}
                />
              </div>
              <div>
                <Label>Images</Label>
                <ImageUploader onImageUpload={handleImageUpload} />
                <div className="mt-2 flex flex-wrap gap-2">
                  {newsData.images.map((img, index) => (
                    <img
                      key={index}
                      src={img || "/placeholder.svg"}
                      alt={`Uploaded ${index + 1}`}
                      className="w-20 h-20 object-cover rounded"
                    />
                  ))}
                </div>
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
