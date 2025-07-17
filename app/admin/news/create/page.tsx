import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import CreateNewsForm from "./CreateNewsForm"

export default function CreateNewsPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [currentUser, setCurrentUser] = useState(null)
  const router = useRouter()

  useEffect(() => {
    // Simulate an authentication check and fetching current user
    const checkAuth = async () => {
      // In a real app, this would check for a valid session or token and fetch user data
      await new Promise((resolve) => setTimeout(resolve, 500)) // Simulate API call
      setIsAuthenticated(true)
      setCurrentUser({ name: "Admin User" }) // Replace with actual user data
    }
    checkAuth()
  }, [])

  if (!isAuthenticated) {
    return <div>Loading...</div>
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Create News & Announcement</h1>
      {currentUser && <CreateNewsForm initialUsername={currentUser.name} />}
    </div>
  )
}
