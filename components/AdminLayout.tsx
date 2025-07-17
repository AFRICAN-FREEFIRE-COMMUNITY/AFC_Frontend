"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  BarChart2,
  Users,
  Settings,
  Shield,
  Database,
  Flag,
  FileText,
  BarChart,
  Home,
  Calendar,
  ShoppingBag,
  Clock,
} from "lucide-react"
import { Logo } from "./Logo"

// Mock user data
const mockUser = {
  role: "admin", // Changed from "partner" to "admin"
}

// Mock authentication function
const mockAuthCheck = () => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(mockUser)
    }, 1000) // Simulate a 1-second delay
  })
}

const AdminLayout = ({ children }) => {
  const pathname = usePathname()
  const [isAuthorized, setIsAuthorized] = useState(false)
  const [user, setUser] = useState(null)

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const userData = await mockAuthCheck()
        setUser(userData)
        setIsAuthorized(true)
      } catch (error) {
        console.error("Authentication failed", error)
        setIsAuthorized(false)
      }
    }

    checkAuth()
  }, [])

  const navItems = [
    { href: "/admin/dashboard", label: "Overview", icon: BarChart2, roles: ["admin", "moderator"] },
    { href: "/admin/events", label: "Events", icon: Calendar, roles: ["admin", "moderator"] },
    { href: "/admin/leaderboards", label: "Leaderboards", icon: BarChart, roles: ["admin", "moderator"] },
    { href: "/admin/news", label: "News & Announcements", icon: FileText, roles: ["admin", "moderator"] },
    { href: "/admin/teams", label: "Teams", icon: Users, roles: ["admin", "moderator"] },
    { href: "/admin/players", label: "Players", icon: Users, roles: ["admin", "moderator"] },
    { href: "/admin/rankings", label: "Rankings", icon: BarChart, roles: ["admin", "moderator"] },
    { href: "/admin/tiers", label: "Tiers", icon: Database, roles: ["admin", "moderator"] },
    { href: "/admin/infractions", label: "Infractions", icon: Flag, roles: ["admin", "moderator"] },
    { href: "/admin/drafts", label: "Drafts", icon: FileText, roles: ["admin", "moderator"] },
    { href: "/admin/shop", label: "Shop", icon: ShoppingBag, roles: ["admin"] },
    { href: "/admin/history", label: "Admin History", icon: Clock, roles: ["admin"] },
    { href: "/admin/settings", label: "Settings", icon: Settings, roles: ["admin"] },
    {
      href: "/admin/partner/roster-verification",
      label: "Roster Verification",
      icon: Shield,
      roles: ["admin", "moderator", "partner"],
    },
    { href: "/home", label: "Back to AFC Database", icon: Home, roles: ["admin", "moderator", "partner"] },
  ]

  if (!isAuthorized) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>
  }

  return (
    <div className="min-h-screen bg-background text-foreground font-inter">
      {/* Top Navigation */}
      <nav className="bg-card border-b border-border h-16">
        <div className="container mx-auto h-full flex items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <Logo size="small" />
            <div className="flex items-center gap-2 bg-primary/10 px-3 py-1 rounded-md">
              <Shield size={16} className="text-primary" />
              <span className="text-sm font-medium">Admin Panel</span>
            </div>
          </div>
        </div>
      </nav>

      <div className="flex">
        {/* Sidebar */}
        <aside className="w-64 min-h-[calc(100vh-4rem)] bg-card border-r border-border p-4">
          <nav className="space-y-2">
            {navItems.map(({ href, label, icon: Icon, roles }) => {
              const isAllowed = roles.includes(user.role)
              return (
                <Link
                  key={href}
                  href={isAllowed ? href : "#"}
                  className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors
                    ${pathname === href ? "bg-primary text-primary-foreground" : "hover:bg-muted"}
                    ${!isAllowed ? "opacity-50 cursor-not-allowed" : ""}`}
                  onClick={(e) => !isAllowed && e.preventDefault()}
                >
                  <Icon className="mr-3 h-6 w-6" />
                  {label}
                </Link>
              )
            })}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-8">{children}</main>
      </div>
    </div>
  )
}

export default AdminLayout
