"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  Home,
  Users,
  Calendar,
  BarChart2,
  Newspaper,
  Info,
  Mail,
  LogIn,
  LogOut,
  UserCircle,
  Shield,
  ShoppingCart,
} from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import type React from "react"

interface SidebarContentProps {
  isLoggedIn: boolean
  onLogin: () => void
  onLogout: () => void
  userRole: string
}

export const SidebarContent: React.FC<SidebarContentProps> = ({ isLoggedIn, onLogin, onLogout, userRole }) => {
  const pathname = usePathname()
  const router = useRouter()
  const { toast } = useToast()

  const menuItems = [
    { href: "/home", label: "Home", icon: Home },
    { href: "/teams", label: "Teams", icon: Users },
    { href: "/tournaments-and-scrims", label: "Tournaments & Scrims", icon: Calendar },
    { href: "/rankings", label: "Rankings & Tiers", icon: BarChart2 },
    { href: "/news", label: "News & Updates", icon: Newspaper },
    { href: "/shop", label: "Shop", icon: ShoppingCart },
    { href: "/about", label: "About Us", icon: Info },
    { href: "/contact", label: "Contact", icon: Mail },
  ]

  return (
    <div className="py-4">
      <div className="mb-8">
        <h2 className="mb-2 px-4 text-lg font-semibold tracking-tight">Menu</h2>
        <nav className="space-y-1">
          {menuItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center px-4 py-2 text-sm font-medium rounded-md ${
                pathname === item.href
                  ? "text-primary-foreground bg-primary"
                  : "text-muted-foreground hover:text-[hsl(var(--gold))] hover:bg-primary/10"
              } transition-colors duration-200`}
            >
              <item.icon className="mr-3 h-6 w-6" />
              {item.label}
            </Link>
          ))}
          {(userRole === "moderator" || userRole === "super_admin") && (
            <Link
              href="/admin/dashboard"
              className={`flex items-center px-4 py-2 text-sm font-medium rounded-md ${
                pathname.startsWith("/admin")
                  ? "text-primary-foreground bg-primary"
                  : "text-muted-foreground hover:text-[hsl(var(--gold))] hover:bg-primary/10"
              } transition-colors duration-200`}
            >
              <Shield className="mr-3 h-6 w-6" />
              Admin Dashboard
            </Link>
          )}
        </nav>
      </div>
      <div className="px-4">
        {isLoggedIn ? (
          <>
            <Link
              href="/profile"
              className="flex items-center mb-4 text-sm font-medium text-muted-foreground hover:text-[hsl(var(--gold))] transition-colors duration-200"
            >
              <UserCircle className="mr-3 h-6 w-6" />
              Profile
            </Link>
            <Button onClick={onLogout} className="w-full button-gradient">
              <LogOut className="mr-2 h-4 w-4" /> Logout
            </Button>
          </>
        ) : (
          <div className="space-y-2">
            <Button onClick={onLogin} className="w-full button-gradient">
              <LogIn className="mr-2 h-4 w-4" /> Login
            </Button>
            <Link href="/create-account">
              <Button variant="outline" className="w-full hover:bg-primary/10 transition-colors duration-200">
                Create Account
              </Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
