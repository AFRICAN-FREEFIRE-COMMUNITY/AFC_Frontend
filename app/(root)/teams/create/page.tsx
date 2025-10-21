// "use client"

// import { useState } from "react"
// import { useRouter } from "next/navigation"
// import Layout from "@/components/Layout"
// import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
// import { Button } from "@/components/ui/button"
// import { Input } from "@/components/ui/input"
// import { Label } from "@/components/ui/label"
// import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
// import { Textarea } from "@/components/ui/textarea"
// import { toast } from "@/components/ui/use-toast"
// import { AlertCircle } from "lucide-react"
// import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
// import { ImageUploader } from "@/components/ImageUploader"

// export default function CreateTeamPage() {
//   const router = useRouter()
//   const [teamData, setTeamData] = useState({
//     name: "",
//     tag: "",
//     logo: null as File | null,
//     description: "",
//     country: "",
//     facebook: "",
//     twitter: "",
//     instagram: "",
//     youtube: "",
//     twitch: "",
//   })
//   const [inviteMembers, setInviteMembers] = useState([""])
//   const [errors, setErrors] = useState<{ [key: string]: string }>({})
//   const [isSubmitting, setIsSubmitting] = useState(false)

//   const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
//     const { name, value } = e.target
//     setTeamData({ ...teamData, [name]: value })
//     setErrors({ ...errors, [name]: "" })
//   }

//   const handleLogoUpload = (file: File) => {
//     setTeamData({ ...teamData, logo: file })
//     setErrors({ ...errors, logo: "" })
//   }

//   const handleInviteMemberChange = (index: number, value: string) => {
//     const newInviteMembers = [...inviteMembers]
//     newInviteMembers[index] = value
//     setInviteMembers(newInviteMembers)
//   }

//   const addInviteMember = () => {
//     setInviteMembers([...inviteMembers, ""])
//   }

//   const removeInviteMember = (index: number) => {
//     const newInviteMembers = inviteMembers.filter((_, i) => i !== index)
//     setInviteMembers(newInviteMembers)
//   }

//   const validateForm = () => {
//     const newErrors: { [key: string]: string } = {}
//     if (!teamData.name.trim()) newErrors.name = "Team name is required"
//     if (!teamData.logo) newErrors.logo = "Team logo is required"
//     if (!teamData.country) newErrors.country = "Country is required"

//     // Check for team name uniqueness (this would typically be done server-side)
//     // For this example, we'll just simulate it
//     if (teamData.name.toLowerCase() === "team alpha") {
//       newErrors.name = "This team name is already taken"
//     }

//     setErrors(newErrors)
//     return Object.keys(newErrors).length === 0
//   }

//   const handleSubmit = async (e: React.FormEvent) => {
//     e.preventDefault()
//     if (!validateForm()) return

//     setIsSubmitting(true)

//     try {
//       // In a real application, you would send the data to your backend here
//       // For this example, we'll simulate the creation process
//       await new Promise((resolve) => setTimeout(resolve, 1500))

//       console.log("Submitting team data:", { ...teamData, inviteMembers })

//       toast({
//         title: "Team created successfully",
//         description: `${teamData.name} has been created and invitations sent.`,
//       })
//       router.push("/teams")
//     } catch (error) {
//       toast({
//         title: "Error",
//         description: "An error occurred while creating the team. Please try again.",
//         variant: "destructive",
//       })
//     } finally {
//       setIsSubmitting(false)
//     }
//   }

//   return (
//     <Layout>
//       <div className="container mx-auto px-4 py-8">
//         <Card>
//           <CardHeader>
//             <CardTitle>Create a New Team</CardTitle>
//           </CardHeader>
//           <CardContent>
//             <form onSubmit={handleSubmit} className="space-y-4">
//               <div>
//                 <Label htmlFor="name">Team Name</Label>
//                 <Input
//                   id="name"
//                   name="name"
//                   value={teamData.name}
//                   onChange={handleChange}
//                   placeholder="Enter your team name"
//                   required
//                 />
//                 {errors.name && (
//                   <Alert variant="destructive" className="mt-2">
//                     <AlertCircle className="h-4 w-4" />
//                     <AlertTitle>Error</AlertTitle>
//                     <AlertDescription>{errors.name}</AlertDescription>
//                   </Alert>
//                 )}
//               </div>

//               <div>
//                 <Label htmlFor="tag">Team Tag (Optional)</Label>
//                 <Input
//                   id="tag"
//                   name="tag"
//                   value={teamData.tag}
//                   onChange={handleChange}
//                   placeholder="Enter your team tag"
//                 />
//               </div>

//               <div>
//                 <Label htmlFor="logo">Team Logo</Label>
//                 <ImageUploader onImageUpload={handleLogoUpload} />
//                 {errors.logo && (
//                   <Alert variant="destructive" className="mt-2">
//                     <AlertCircle className="h-4 w-4" />
//                     <AlertTitle>Error</AlertTitle>
//                     <AlertDescription>{errors.logo}</AlertDescription>
//                   </Alert>
//                 )}
//               </div>

//               <div>
//                 <Label htmlFor="description">Team Description</Label>
//                 <Textarea
//                   id="description"
//                   name="description"
//                   value={teamData.description}
//                   onChange={handleChange}
//                   placeholder="Enter a brief description of your team"
//                 />
//               </div>

//               <div>
//                 <Label htmlFor="country">Country</Label>
//                 <Select name="country" onValueChange={(value) => setTeamData({ ...teamData, country: value })}>
//                   <SelectTrigger>
//                     <SelectValue placeholder="Select your country" />
//                   </SelectTrigger>
//                   <SelectContent>
//                     <SelectItem value="nigeria">Nigeria</SelectItem>
//                     <SelectItem value="ghana">Ghana</SelectItem>
//                     <SelectItem value="kenya">Kenya</SelectItem>
//                     <SelectItem value="south-africa">South Africa</SelectItem>
//                     {/* Add more African countries as needed */}
//                   </SelectContent>
//                 </Select>
//                 {errors.country && (
//                   <Alert variant="destructive" className="mt-2">
//                     <AlertCircle className="h-4 w-4" />
//                     <AlertTitle>Error</AlertTitle>
//                     <AlertDescription>{errors.country}</AlertDescription>
//                   </Alert>
//                 )}
//               </div>

//               <div>
//                 <Label>Invite Members (Email or Username)</Label>
//                 {inviteMembers.map((member, index) => (
//                   <div key={index} className="flex items-center space-x-2 mt-2">
//                     <Input
//                       type="text"
//                       value={member}
//                       onChange={(e) => handleInviteMemberChange(index, e.target.value)}
//                       placeholder="Enter email or username"
//                     />
//                     {index === inviteMembers.length - 1 ? (
//                       <Button type="button" onClick={addInviteMember}>
//                         +
//                       </Button>
//                     ) : (
//                       <Button type="button" onClick={() => removeInviteMember(index)} variant="destructive">
//                         -
//                       </Button>
//                     )}
//                   </div>
//                 ))}
//               </div>

//               <div>
//                 <Label>Social Media Links (Optional)</Label>
//                 <div className="space-y-2">
//                   <Input name="facebook" value={teamData.facebook} onChange={handleChange} placeholder="Facebook URL" />
//                   <Input name="twitter" value={teamData.twitter} onChange={handleChange} placeholder="Twitter URL" />
//                   <Input
//                     name="instagram"
//                     value={teamData.instagram}
//                     onChange={handleChange}
//                     placeholder="Instagram URL"
//                   />
//                   <Input name="youtube" value={teamData.youtube} onChange={handleChange} placeholder="YouTube URL" />
//                   <Input name="twitch" value={teamData.twitch} onChange={handleChange} placeholder="Twitch URL" />
//                 </div>
//               </div>

//               <div className="flex justify-between pt-4">
//                 <Button variant="outline" onClick={() => router.push("/teams")}>
//                   Cancel
//                 </Button>
//                 <Button type="submit" disabled={isSubmitting}>
//                   {isSubmitting ? "Creating..." : "Create Team"}
//                 </Button>
//               </div>
//             </form>
//           </CardContent>
//         </Card>
//       </div>
//     </Layout>
//   )
// }

import { useState } from "react";
import { useRouter } from "next/navigation";
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ImageUploader } from "@/components/ImageUploader";
import { CreateTeamForm } from "./_components/CreateTeamForm";

export default function CreateTeamPage() {
  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Create a New Team</CardTitle>
          </CardHeader>
          <CardContent>
            <CreateTeamForm />
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
