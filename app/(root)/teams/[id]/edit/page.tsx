// "use client"

// import { useState, useEffect } from "react"
// import { useParams, useRouter } from "next/navigation"
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
// import { Button } from "@/components/ui/button"
// import { Input } from "@/components/ui/input"
// import { Label } from "@/components/ui/label"
// import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
// import { toast } from "@/components/ui/use-toast"
// import { X } from "lucide-react"
import { EditTeamForm } from "./_components/EditTeamForm";

// // Mock team data
// const mockTeamData = {
//   id: "1",
//   name: "Team Alpha",
//   logo: "https://example.com/team-alpha-logo.png",
//   joinSetting: "open",
// }

type Params = Promise<{
  id: string;
}>;

export default async function EditTeamPage({ params }: { params: Params }) {
  const { id } = await params;
  const decodedId = decodeURIComponent(id);
  // const params = useParams()
  // const router = useRouter()
  // const [teamData, setTeamData] = useState(mockTeamData)
  // const [logoFile, setLogoFile] = useState<File | null>(null)
  // const [socialMediaLinks, setSocialMediaLinks] = useState([
  //   { platform: "facebook", link: "https://facebook.com/teamalpha" },
  //   { platform: "twitter", link: "https://twitter.com/teamalpha" },
  //   { platform: "instagram", link: "https://instagram.com/teamalpha" },
  // ])

  // useEffect(() => {
  //   // In a real app, fetch team data based on params.id
  //   // setTeamData(fetchedTeamData)
  // }, [])

  // const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
  //   setTeamData({ ...teamData, [e.target.name]: e.target.value })
  // }

  // const handleSocialMediaChange = (index: number, field: "platform" | "link", value: string) => {
  //   const updatedLinks = [...socialMediaLinks]
  //   updatedLinks[index][field] = value
  //   setSocialMediaLinks(updatedLinks)
  // }

  // const addSocialMediaLink = () => {
  //   setSocialMediaLinks([...socialMediaLinks, { platform: "", link: "" }])
  // }

  // const removeSocialMediaLink = (index: number) => {
  //   const updatedLinks = socialMediaLinks.filter((_, i) => i !== index)
  //   setSocialMediaLinks(updatedLinks)
  // }

  // const handleSubmit = async (e: React.FormEvent) => {
  //   e.preventDefault()

  //   // In a real app, you would make an API call to update the team
  //   try {
  //     // Simulating an API call
  //     await new Promise((resolve) => setTimeout(resolve, 1000))

  //     // Handle logo upload
  //     if (logoFile) {
  //       // In a real app, you would upload the file to your server or a file storage service
  //       console.log("Uploading logo:", logoFile.name)
  //     }

  //     // Include socialMediaLinks in the data to be sent to the server
  //     const updatedTeamData = {
  //       ...teamData,
  //       socialMediaLinks,
  //     }

  //     console.log("Updating team data:", updatedTeamData)

  //     toast({
  //       title: "Team updated successfully",
  //       description: `${teamData.name} has been updated.`,
  //     })
  //     router.push(`/teams/${teamData.id}`)
  //   } catch (error) {
  //     toast({
  //       title: "Error",
  //       description: "An error occurred while updating the team. Please try again.",
  //       variant: "destructive",
  //     })
  //   }
  // }

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Edit Team: {decodedId}</CardTitle>
          </CardHeader>
          <CardContent>
            <EditTeamForm id={decodedId} />
            {/* <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="name">Team Name</Label>
                <Input id="name" name="name" value={teamData.name} onChange={handleChange} required />
              </div>
              <div>
                <Label htmlFor="logo">Team Logo</Label>
                <Input
                  id="logo"
                  name="logo"
                  type="file"
                  accept="image/*"
                  onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
                />
              </div>
              <div>
                <Label htmlFor="joinSetting">Join Setting</Label>
                <Select
                  name="joinSetting"
                  value={teamData.joinSetting}
                  onValueChange={(value) => handleChange({ target: { name: "joinSetting", value } } as any)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select join setting" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="request">By Request</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Social Media Links</Label>
                {socialMediaLinks.map((link, index) => (
                  <div key={index} className="flex items-center space-x-2 mb-2">
                    <Select
                      value={link.platform}
                      onValueChange={(value) => handleSocialMediaChange(index, "platform", value)}
                    >
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Select platform" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="facebook">Facebook</SelectItem>
                        <SelectItem value="twitter">Twitter</SelectItem>
                        <SelectItem value="instagram">Instagram</SelectItem>
                        <SelectItem value="youtube">YouTube</SelectItem>
                        <SelectItem value="twitch">Twitch</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      placeholder="Enter social media link"
                      value={link.link}
                      onChange={(e) => handleSocialMediaChange(index, "link", e.target.value)}
                    />
                    <Button type="button" variant="outline" size="icon" onClick={() => removeSocialMediaLink(index)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button type="button" variant="outline" onClick={addSocialMediaLink} className="mt-2">
                  Add Social Media Link
                </Button>
              </div>
              <div className="flex justify-between mt-4">
                <Button variant="outline" onClick={() => router.push(`/teams/${teamData.id}`)}>
                  Back
                </Button>
                <Button type="submit">Update Team</Button>
              </div>
            </form> */}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
