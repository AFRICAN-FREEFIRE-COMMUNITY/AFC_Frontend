"use client"

import type React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ImageUploader } from "@/components/ImageUploader"
import { useToast } from "@/components/ui/use-toast"
import dynamic from "next/dynamic"

const ReactQuill = dynamic(() => import("react-quill"), { ssr: false })

import "react-quill/dist/quill.snow.css"

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

interface NewsData {
  id: string
  title: string
  content: string
  category: string
  event: string
  images: string[]
}

interface NewsEditFormProps {
  initialData: NewsData
}

export const NewsEditForm: React.FC<NewsEditFormProps> = ({ initialData }) => {
  const router = useRouter()
  const { toast } = useToast()
  const [title, setTitle] = useState(initialData.title)
  const [content, setContent] = useState(initialData.content)
  const [category, setCategory] = useState(initialData.category)
  const [event, setEvent] = useState(initialData.event)
  const [images, setImages] = useState(initialData.images)
  const [isLoading, setIsLoading] = useState(false)

  const handleImageUpload = (imageUrl: string) => {
    setImages([...images, imageUrl])
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000))
      toast({ title: "News updated", description: "The news post has been updated." })
      router.push("/admin/news")
    } catch (error) {
      toast({ title: "Error", description: "Failed to update news post.", variant: "destructive" })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div>
        <Label htmlFor="title">Title</Label>
        <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Enter title" required />
      </div>
      <div className="mt-4">
        <Label htmlFor="content">Content</Label>
        <ReactQuill theme="snow" value={content} onChange={setContent} />
      </div>
      <div className="mt-4">
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
      <div className="mt-4">
        <Label htmlFor="event">Event</Label>
        <Select value={event} onValueChange={setEvent}>
          <SelectTrigger>
            <SelectValue placeholder="Select event" />
          </SelectTrigger>
          <SelectContent>
            {events.map((ev) => (
              <SelectItem key={ev.value} value={ev.value}>
                {ev.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="mt-4">
        <Label htmlFor="images">Images</Label>
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
      <div className="mt-4">
        <Button type="submit" disabled={isLoading}>
          {isLoading ? "Updating..." : "Update News"}
        </Button>
      </div>
    </form>
  )
}
