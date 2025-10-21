import type React from "react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface ImageUploaderProps {
  onImageUpload: (imageUrl: string) => void
}

export function ImageUploader({ onImageUpload }: ImageUploaderProps) {
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setSelectedFiles(e.target.files)
    }
  }

  const handleUpload = async () => {
    if (!selectedFiles) return

    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i]
      // In a real application, you would upload the file to your server or a cloud storage service
      // For this example, we'll simulate the upload and return a fake URL
      const fakeImageUrl = URL.createObjectURL(file)

      onImageUpload(fakeImageUrl)
    }

    setSelectedFiles(null)
  }

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="imageUpload">Select Images</Label>
        <Input id="imageUpload" type="file" accept="image/*" onChange={handleFileChange} multiple />
      </div>
      <Button onClick={handleUpload} disabled={!selectedFiles}>
        Upload Images
      </Button>
    </div>
  )
}
