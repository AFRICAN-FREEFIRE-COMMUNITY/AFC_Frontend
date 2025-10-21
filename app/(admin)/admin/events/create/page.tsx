// "use client"

// import { useState } from "react"
// import { useRouter } from "next/navigation"
// import AdminLayout from "@/components/AdminLayout"
// import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
// import { Button } from "@/components/ui/button"
// import { Input } from "@/components/ui/input"
// import { Label } from "@/components/ui/label"
// import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
// import { DatePicker } from "@/components/ui/date-picker"
// import { Textarea } from "@/components/ui/textarea"
// import { useToast } from "@/components/ui/use-toast"
// import { PrizeDistribution } from "@/components/PrizeDistribution"
// import { ImageUploader } from "@/components/ImageUploader"
// import { Switch } from "@/components/ui/switch"

// export default function CreateEventPage() {
//   const router = useRouter()
//   const { toast } = useToast()
//   const [isLoading, setIsLoading] = useState(false)
//   const [error, setError] = useState("")

//   const [eventData, setEventData] = useState({
//     name: "",
//     type: "tournament",
//     format: "",
//     startDate: new Date(),
//     endDate: new Date(),
//     registrationOpenDate: new Date(),
//     registrationEndDate: new Date(),
//     prizePool: "",
//     prizeDistribution: Array(12).fill(""),
//     rules: "",
//     status: "upcoming",
//     registrationLink: "",
//     description: "",
//     tier: "",
//     bannerImage: "",
//     streamChannel: "",
//     location: "",
//     publishToEvents: false,
//     publishToNews: false,
//     stages: ["Qualifiers", "Semi-Finals", "Finals"],
//   })

//   const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
//     const { name, value } = e.target
//     setEventData((prev) => ({ ...prev, [name]: value }))
//   }

//   const handleSelectChange = (name: string, value: string) => {
//     setEventData((prev) => ({ ...prev, [name]: value }))
//   }

//   const handleDateChange = (name: string, date: Date | undefined) => {
//     if (date) {
//       setEventData((prev) => ({ ...prev, [name]: date }))
//     }
//   }

//   const handlePrizeDistributionChange = (index: number, value: string) => {
//     setEventData((prev) => ({
//       ...prev,
//       prizeDistribution: prev.prizeDistribution.map((prize, i) => (i === index ? value : prize)),
//     }))
//   }

//   const handleImageUpload = (imageUrl: string) => {
//     setEventData((prev) => ({ ...prev, bannerImage: imageUrl }))
//   }

//   const handleToggleChange = (name: string) => (checked: boolean) => {
//     setEventData((prev) => ({ ...prev, [name]: checked }))
//   }

//   const handleSubmit = async (e: React.FormEvent) => {
//     e.preventDefault()
//     setIsLoading(true)
//     setError("")

//     try {
//       // Here you would typically send the data to your API
//       // For now, we'll just simulate an API call
//       await new Promise((resolve) => setTimeout(resolve, 1000))

//       toast({
//         title: "Event created",
//         description: "The event has been successfully created.",
//       })

//       router.push("/admin/events")
//     } catch (error) {
//       setError("Failed to create event. Please try again.")
//     } finally {
//       setIsLoading(false)
//     }
//   }

//   return (
//     <AdminLayout>
//       <div className="container mx-auto px-4 py-8">
//         <h1 className="text-3xl font-bold mb-8">Create New Event</h1>

//         <form onSubmit={handleSubmit}>
//           <Card className="mb-8">
//             <CardHeader>
//               <CardTitle>Event Details</CardTitle>
//             </CardHeader>
//             <CardContent>
//               <div className="space-y-4">
//                 <div>
//                   <Label htmlFor="name">Event Name</Label>
//                   <Input id="name" name="name" value={eventData.name} onChange={handleInputChange} required />
//                 </div>

//                 <div>
//                   <Label htmlFor="type">Event Type</Label>
//                   <Select value={eventData.type} onValueChange={(value) => handleSelectChange("type", value)}>
//                     <SelectTrigger>
//                       <SelectValue placeholder="Select event type" />
//                     </SelectTrigger>
//                     <SelectContent>
//                       <SelectItem value="tournament">Tournament</SelectItem>
//                       <SelectItem value="scrim">Scrim</SelectItem>
//                     </SelectContent>
//                   </Select>
//                 </div>

//                 <div>
//                   <Label htmlFor="format">Format</Label>
//                   <Select value={eventData.format} onValueChange={(value) => handleSelectChange("format", value)}>
//                     <SelectTrigger>
//                       <SelectValue placeholder="Select format" />
//                     </SelectTrigger>
//                     <SelectContent>
//                       <SelectItem value="Battle Royale">Battle Royale</SelectItem>
//                       <SelectItem value="Clash Squad">Clash Squad</SelectItem>
//                       <SelectItem value="Hybrid">Hybrid</SelectItem>
//                     </SelectContent>
//                   </Select>
//                 </div>

//                 <div>
//                   <Label htmlFor="startDate">Start Date</Label>
//                   <DatePicker
//                     id="startDate"
//                     selected={eventData.startDate}
//                     onSelect={(date) => handleDateChange("startDate", date)}
//                   />
//                 </div>

//                 <div>
//                   <Label htmlFor="endDate">End Date</Label>
//                   <DatePicker
//                     id="endDate"
//                     selected={eventData.endDate}
//                     onSelect={(date) => handleDateChange("endDate", date)}
//                   />
//                 </div>

//                 <div>
//                   <Label htmlFor="registrationOpenDate">Registration Open Date</Label>
//                   <DatePicker
//                     id="registrationOpenDate"
//                     selected={eventData.registrationOpenDate}
//                     onSelect={(date) => handleDateChange("registrationOpenDate", date)}
//                   />
//                 </div>

//                 <div>
//                   <Label htmlFor="registrationEndDate">Registration End Date</Label>
//                   <DatePicker
//                     id="registrationEndDate"
//                     selected={eventData.registrationEndDate}
//                     onSelect={(date) => handleDateChange("registrationEndDate", date)}
//                   />
//                 </div>

//                 <div>
//                   <Label htmlFor="prizePool">Prize Pool</Label>
//                   <Input
//                     id="prizePool"
//                     name="prizePool"
//                     value={eventData.prizePool}
//                     onChange={handleInputChange}
//                     type="number"
//                     required
//                   />
//                 </div>

//                 <PrizeDistribution
//                   distribution={eventData.prizeDistribution}
//                   onChange={handlePrizeDistributionChange}
//                 />

//                 <div>
//                   <Label htmlFor="rules">Event Rules</Label>
//                   <Textarea id="rules" name="rules" value={eventData.rules} onChange={handleInputChange} required />
//                 </div>

//                 <div>
//                   <Label htmlFor="status">Event Status</Label>
//                   <Select value={eventData.status} onValueChange={(value) => handleSelectChange("status", value)}>
//                     <SelectTrigger>
//                       <SelectValue placeholder="Select status" />
//                     </SelectTrigger>
//                     <SelectContent>
//                       <SelectItem value="upcoming">Upcoming</SelectItem>
//                       <SelectItem value="ongoing">Ongoing</SelectItem>
//                       <SelectItem value="completed">Completed</SelectItem>
//                     </SelectContent>
//                   </Select>
//                 </div>

//                 <div>
//                   <Label htmlFor="registrationLink">Registration Link</Label>
//                   <Input
//                     id="registrationLink"
//                     name="registrationLink"
//                     value={eventData.registrationLink}
//                     onChange={handleInputChange}
//                   />
//                 </div>

//                 <div>
//                   <Label htmlFor="description">Event Description</Label>
//                   <Textarea
//                     id="description"
//                     name="description"
//                     value={eventData.description}
//                     onChange={handleInputChange}
//                     required
//                   />
//                 </div>

//                 {eventData.type === "tournament" && (
//                   <div>
//                     <Label htmlFor="tier">Tournament Tier</Label>
//                     <Select value={eventData.tier} onValueChange={(value) => handleSelectChange("tier", value)}>
//                       <SelectTrigger>
//                         <SelectValue placeholder="Select tier" />
//                       </SelectTrigger>
//                       <SelectContent>
//                         <SelectItem value="1">Tier 1</SelectItem>
//                         <SelectItem value="2">Tier 2</SelectItem>
//                         <SelectItem value="3">Tier 3</SelectItem>
//                       </SelectContent>
//                     </Select>
//                   </div>
//                 )}

//                 <div>
//                   <Label htmlFor="bannerImage">Event Banner/Image</Label>
//                   <ImageUploader onImageUpload={handleImageUpload} />
//                 </div>

//                 <div>
//                   <Label htmlFor="streamChannel">Stream Channel</Label>
//                   <Input
//                     id="streamChannel"
//                     name="streamChannel"
//                     value={eventData.streamChannel}
//                     onChange={handleInputChange}
//                   />
//                 </div>

//                 <div>
//                   <Label htmlFor="location">Location</Label>
//                   <Select value={eventData.location} onValueChange={(value) => handleSelectChange("location", value)}>
//                     <SelectTrigger>
//                       <SelectValue placeholder="Select location" />
//                     </SelectTrigger>
//                     <SelectContent>
//                       <SelectItem value="online">Online</SelectItem>
//                       <SelectItem value="physical">Physical</SelectItem>
//                       <SelectItem value="hybrid">Hybrid</SelectItem>
//                     </SelectContent>
//                   </Select>
//                 </div>

//                 <div className="space-y-4">
//                   <div className="flex items-center space-x-2">
//                     <Switch
//                       id="publishToEvents"
//                       checked={eventData.publishToEvents}
//                       onCheckedChange={handleToggleChange("publishToEvents")}
//                     />
//                     <Label htmlFor="publishToEvents">Publish to Events</Label>
//                   </div>
//                   <div className="flex items-center space-x-2">
//                     <Switch
//                       id="publishToNews"
//                       checked={eventData.publishToNews}
//                       onCheckedChange={handleToggleChange("publishToNews")}
//                     />
//                     <Label htmlFor="publishToNews">Publish to News & Updates</Label>
//                   </div>
//                 </div>
//               </div>
//             </CardContent>
//           </Card>

//           <div className="flex justify-end space-x-4">
//             <Button type="button" variant="outline" onClick={() => router.push("/admin/events")}>
//               Cancel
//             </Button>
//             <Button type="submit" disabled={isLoading}>
//               {isLoading ? "Creating..." : "Create Event"}
//             </Button>
//           </div>
//         </form>
//       </div>
//     </AdminLayout>
//   )
// }
"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import AdminLayout from "@/components/AdminLayout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DatePicker } from "@/components/ui/date-picker"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/components/ui/use-toast"
import { PrizeDistribution } from "@/components/PrizeDistribution"
import { ImageUploader } from "@/components/ImageUploader"
import { Switch } from "@/components/ui/switch"

export default function CreateEventPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")

  const [eventData, setEventData] = useState({
    name: "",
    type: "tournament",
    format: "",
    startDate: new Date(),
    endDate: new Date(),
    registrationOpenDate: new Date(),
    registrationEndDate: new Date(),
    prizePool: "",
    prizeDistribution: Array(12).fill(""),
    rules: "",
    status: "upcoming",
    registrationLink: "",
    description: "",
    tier: "",
    bannerImage: "",
    streamChannel: "",
    location: "",
    publishToEvents: false,
    publishToNews: false,
    stages: ["Qualifiers", "Semi-Finals", "Finals"],
  })

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setEventData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSelectChange = (name: string, value: string) => {
    setEventData((prev) => ({ ...prev, [name]: value }))
  }

  const handleDateChange = (name: string, date: Date | undefined) => {
    if (date) {
      setEventData((prev) => ({ ...prev, [name]: date }))
    }
  }

  const handlePrizeDistributionChange = (index: number, value: string) => {
    setEventData((prev) => ({
      ...prev,
      prizeDistribution: prev.prizeDistribution.map((prize, i) => (i === index ? value : prize)),
    }))
  }

  const handleImageUpload = (imageUrl: string) => {
    setEventData((prev) => ({ ...prev, bannerImage: imageUrl }))
  }

  const handleToggleChange = (name: string) => (checked: boolean) => {
    setEventData((prev) => ({ ...prev, [name]: checked }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")

    try {
      const formData = new FormData()
      formData.append("event_name", eventData.name)
      formData.append("event_type", eventData.type)
      formData.append("format", eventData.format)
      formData.append("location", eventData.location)
      formData.append("start_date", eventData.startDate.toISOString())
      formData.append("end_date", eventData.endDate.toISOString())
      formData.append("registration_open_date", eventData.registrationOpenDate.toISOString())
      formData.append("registration_end_date", eventData.registrationEndDate.toISOString())
      formData.append("prizepool", eventData.prizePool)
      formData.append("rules", eventData.rules)
      formData.append("description", eventData.description)
      formData.append("status", eventData.status)
      formData.append("registration_link", eventData.registrationLink)
      formData.append("tier", eventData.tier)
      formData.append("banner_image", eventData.bannerImage) // Ensure backend expects URL or base64
      formData.append("stream_channel", eventData.streamChannel)
      formData.append("publish_to_events", String(eventData.publishToEvents))
      formData.append("publish_to_news", String(eventData.publishToNews))
      formData.append("stages", JSON.stringify(eventData.stages))
      formData.append("prize_distribution", JSON.stringify(eventData.prizeDistribution))

      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_API_URL}/event/create-event/`, {
        method: "POST",
        body: formData,
      })

      if (!response.ok) throw new Error("API error")

      toast({
        title: "Event created",
        description: "The event has been successfully created.",
      })

      router.push("/admin/events")
    } catch (error) {
      setError("Failed to create event. Please try again.")
      toast({
        title: "Error",
        description: "Something went wrong. Please check your input and try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <AdminLayout>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">Create New Event</h1>

            <form onSubmit={handleSubmit}>
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Event Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="name">Event Name</Label>
                  <Input id="name" name="name" value={eventData.name} onChange={handleInputChange} required />
                </div>

                <div>
                  <Label htmlFor="type">Event Type</Label>
                  <Select value={eventData.type} onValueChange={(value) => handleSelectChange("type", value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select event type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="tournament">Tournament</SelectItem>
                      <SelectItem value="scrim">Scrim</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="format">Format</Label>
                  <Select value={eventData.format} onValueChange={(value) => handleSelectChange("format", value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select format" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Battle Royale">Battle Royale</SelectItem>
                      <SelectItem value="Clash Squad">Clash Squad</SelectItem>
                      <SelectItem value="Hybrid">Hybrid</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="startDate">Start Date</Label>
                  <DatePicker
                    id="startDate"
                    selected={eventData.startDate}
                    onSelect={(date) => handleDateChange("startDate", date)}
                  />
                </div>

                <div>
                  <Label htmlFor="endDate">End Date</Label>
                  <DatePicker
                    id="endDate"
                    selected={eventData.endDate}
                    onSelect={(date) => handleDateChange("endDate", date)}
                  />
                </div>

                <div>
                  <Label htmlFor="registrationOpenDate">Registration Open Date</Label>
                  <DatePicker
                    id="registrationOpenDate"
                    selected={eventData.registrationOpenDate}
                    onSelect={(date) => handleDateChange("registrationOpenDate", date)}
                  />
                </div>

                <div>
                  <Label htmlFor="registrationEndDate">Registration End Date</Label>
                  <DatePicker
                    id="registrationEndDate"
                    selected={eventData.registrationEndDate}
                    onSelect={(date) => handleDateChange("registrationEndDate", date)}
                  />
                </div>

                <div>
                  <Label htmlFor="prizePool">Prize Pool</Label>
                  <Input
                    id="prizePool"
                    name="prizePool"
                    value={eventData.prizePool}
                    onChange={handleInputChange}
                    type="number"
                    required
                  />
                </div>

                <PrizeDistribution
                  distribution={eventData.prizeDistribution}
                  onChange={handlePrizeDistributionChange}
                />

                <div>
                  <Label htmlFor="rules">Event Rules</Label>
                  <Textarea id="rules" name="rules" value={eventData.rules} onChange={handleInputChange} required />
                </div>

                <div>
                  <Label htmlFor="status">Event Status</Label>
                  <Select value={eventData.status} onValueChange={(value) => handleSelectChange("status", value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="upcoming">Upcoming</SelectItem>
                      <SelectItem value="ongoing">Ongoing</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="registrationLink">Registration Link</Label>
                  <Input
                    id="registrationLink"
                    name="registrationLink"
                    value={eventData.registrationLink}
                    onChange={handleInputChange}
                  />
                </div>

                <div>
                  <Label htmlFor="description">Event Description</Label>
                  <Textarea
                    id="description"
                    name="description"
                    value={eventData.description}
                    onChange={handleInputChange}
                    required
                  />
                </div>

                {eventData.type === "tournament" && (
                  <div>
                    <Label htmlFor="tier">Tournament Tier</Label>
                    <Select value={eventData.tier} onValueChange={(value) => handleSelectChange("tier", value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select tier" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">Tier 1</SelectItem>
                        <SelectItem value="2">Tier 2</SelectItem>
                        <SelectItem value="3">Tier 3</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div>
                  <Label htmlFor="bannerImage">Event Banner/Image</Label>
                  <ImageUploader onImageUpload={handleImageUpload} />
                </div>

                <div>
                  <Label htmlFor="streamChannel">Stream Channel</Label>
                  <Input
                    id="streamChannel"
                    name="streamChannel"
                    value={eventData.streamChannel}
                    onChange={handleInputChange}
                  />
                </div>

                <div>
                  <Label htmlFor="location">Location</Label>
                  <Select value={eventData.location} onValueChange={(value) => handleSelectChange("location", value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select location" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="online">Online</SelectItem>
                      <SelectItem value="physical">Physical</SelectItem>
                      <SelectItem value="hybrid">Hybrid</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="publishToEvents"
                      checked={eventData.publishToEvents}
                      onCheckedChange={handleToggleChange("publishToEvents")}
                    />
                    <Label htmlFor="publishToEvents">Publish to Events</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="publishToNews"
                      checked={eventData.publishToNews}
                      onCheckedChange={handleToggleChange("publishToNews")}
                    />
                    <Label htmlFor="publishToNews">Publish to News & Updates</Label>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end space-x-4">
            <Button type="button" variant="outline" onClick={() => router.push("/admin/events")}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Creating..." : "Create Event"}
            </Button>
          </div>
        </form>
      </div>
    </AdminLayout>
  )
}
