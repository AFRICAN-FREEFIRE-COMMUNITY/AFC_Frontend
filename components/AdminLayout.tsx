// "use client";

// import { ReactNode, useEffect, useState } from "react";
// import Link from "next/link";
// import { usePathname } from "next/navigation";
// import {
//   BarChart2,
//   Users,
//   Settings,
//   Shield,
//   Database,
//   Flag,
//   FileText,
//   BarChart,
//   Home,
//   Calendar,
//   ShoppingBag,
//   Clock,
// } from "lucide-react";
// import { Logo } from "./Logo";

// // Mock user data
// const mockUser = {
//   role: "admin", // Changed from "partner" to "admin"
// };

// // Mock authentication function
// const mockAuthCheck = () => {
//   return new Promise((resolve) => {
//     setTimeout(() => {
//       resolve(mockUser);
//     }, 1000); // Simulate a 1-second delay
//   });
// };

// const AdminLayout = ({ children }: { children: ReactNode }) => {
//   const pathname = usePathname();
//   const [isAuthorized, setIsAuthorized] = useState(false);
//   const [user, setUser] = useState(null);

//   useEffect(() => {
//     const checkAuth = async () => {
//       try {
//         const userData = await mockAuthCheck();
//         setUser(userData);
//         setIsAuthorized(true);
//       } catch (error) {
//         console.error("Authentication failed", error);
//         setIsAuthorized(false);
//       }
//     };

//     checkAuth();
//   }, []);

//   const navItems = [
//     {
//       href: "/admin/dashboard",
//       label: "Overview",
//       icon: BarChart2,
//       roles: ["admin", "moderator"],
//     },
//     {
//       href: "/admin/events",
//       label: "Events",
//       icon: Calendar,
//       roles: ["admin", "moderator"],
//     },
//     {
//       href: "/admin/leaderboards",
//       label: "Leaderboards",
//       icon: BarChart,
//       roles: ["admin", "moderator"],
//     },
//     {
//       href: "/admin/news",
//       label: "News & Announcements",
//       icon: FileText,
//       roles: ["admin", "moderator"],
//     },
//     {
//       href: "/admin/teams",
//       label: "Teams",
//       icon: Users,
//       roles: ["admin", "moderator"],
//     },
//     {
//       href: "/admin/players",
//       label: "Players",
//       icon: Users,
//       roles: ["admin", "moderator"],
//     },
//     {
//       href: "/admin/rankings",
//       label: "Rankings",
//       icon: BarChart,
//       roles: ["admin", "moderator"],
//     },
//     {
//       href: "/admin/tiers",
//       label: "Tiers",
//       icon: Database,
//       roles: ["admin", "moderator"],
//     },
//     {
//       href: "/admin/infractions",
//       label: "Infractions",
//       icon: Flag,
//       roles: ["admin", "moderator"],
//     },
//     {
//       href: "/admin/drafts",
//       label: "Drafts",
//       icon: FileText,
//       roles: ["admin", "moderator"],
//     },
//     { href: "/admin/shop", label: "Shop", icon: ShoppingBag, roles: ["admin"] },
//     {
//       href: "/admin/history",
//       label: "Admin History",
//       icon: Clock,
//       roles: ["admin"],
//     },
//     {
//       href: "/admin/settings",
//       label: "Settings",
//       icon: Settings,
//       roles: ["admin"],
//     },
//     {
//       href: "/admin/partner/roster-verification",
//       label: "Roster Verification",
//       icon: Shield,
//       roles: ["admin", "moderator", "partner"],
//     },
//     {
//       href: "/home",
//       label: "Back to AFC Database",
//       icon: Home,
//       roles: ["admin", "moderator", "partner"],
//     },
//   ];

//   if (!isAuthorized) {
//     return (
//       <div className="flex items-center justify-center min-h-screen">
//         Loading...
//       </div>
//     );
//   }

//   return (
//     <div className="min-h-screen bg-background text-foreground font-inter">
//       {/* Top Navigation */}
//       <nav className="bg-card border-b border-border h-16">
//         <div className="container mx-auto h-full flex items-center justify-between px-4">
//           <div className="flex items-center gap-2">
//             <Logo size="small" />
//             <div className="flex items-center gap-2 bg-primary/10 px-3 py-1 rounded-md">
//               <Shield size={16} className="text-primary" />
//               <span className="text-sm font-medium">Admin Panel</span>
//             </div>
//           </div>
//         </div>
//       </nav>

//       <div className="flex">
//         {/* Sidebar */}
//         <aside className="w-64 min-h-[calc(100vh-4rem)] bg-card border-r border-border p-4">
//           <nav className="space-y-2">
//             {navItems.map(({ href, label, icon: Icon, roles }) => {
//               const isAllowed = roles.includes(user.role);
//               return (
//                 <Link
//                   key={href}
//                   href={isAllowed ? href : "#"}
//                   className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors
//                     ${
//                       pathname === href
//                         ? "bg-primary text-primary-foreground"
//                         : "hover:bg-muted"
//                     }
//                     ${!isAllowed ? "opacity-50 cursor-not-allowed" : ""}`}
//                   onClick={(e) => !isAllowed && e.preventDefault()}
//                 >
//                   <Icon className="mr-3 h-6 w-6" />
//                   {label}
//                 </Link>
//               );
//             })}
//           </nav>
//         </aside>

//         {/* Main Content */}
//         <main className="flex-1 p-8">{children}</main>
//       </div>
//     </div>
//   );
// };

// export default AdminLayout;

"use client";

import { ReactNode, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
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
  AlertCircle,
} from "lucide-react";
import { Logo } from "./Logo";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const AdminLayout = ({ children }: { children: ReactNode }) => {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isAuthenticated, loading } = useAuth();

  useEffect(() => {
    // Wait for auth to load
    if (loading) return;

    // If not authenticated, redirect to login
    if (!isAuthenticated) {
      toast.error("Please log in to access the admin panel");
      router.push("/login");
      return;
    }

    // Check if user has admin or moderator role
    const allowedRoles = ["admin", "moderator", "player"];
    if (!user?.role || !allowedRoles.includes(user.role)) {
      toast.error("You don't have permission to access the admin panel");
      router.push("/home");
      return;
    }
  }, [loading, isAuthenticated, user, router]);

  const navItems = [
    {
      href: "/admin/dashboard",
      label: "Overview",
      icon: BarChart2,
      roles: ["admin", "moderator"],
    },
    {
      href: "/admin/events",
      label: "Events",
      icon: Calendar,
      roles: ["admin", "moderator"],
    },
    {
      href: "/admin/leaderboards",
      label: "Leaderboards",
      icon: BarChart,
      roles: ["admin", "moderator"],
    },
    {
      href: "/admin/news",
      label: "News & Announcements",
      icon: FileText,
      roles: ["admin", "moderator"],
    },
    {
      href: "/admin/teams",
      label: "Teams",
      icon: Users,
      roles: ["admin", "moderator"],
    },
    {
      href: "/admin/players",
      label: "Players",
      icon: Users,
      roles: ["admin", "moderator"],
    },
    {
      href: "/admin/rankings",
      label: "Rankings",
      icon: BarChart,
      roles: ["admin", "moderator"],
    },
    {
      href: "/admin/tiers",
      label: "Tiers",
      icon: Database,
      roles: ["admin", "moderator"],
    },
    {
      href: "/admin/infractions",
      label: "Infractions",
      icon: Flag,
      roles: ["admin", "moderator"],
    },
    {
      href: "/admin/drafts",
      label: "Drafts",
      icon: FileText,
      roles: ["admin", "moderator"],
    },
    {
      href: "/admin/shop",
      label: "Shop",
      icon: ShoppingBag,
      roles: ["admin"],
    },
    {
      href: "/admin/history",
      label: "Admin History",
      icon: Clock,
      roles: ["admin"],
    },
    {
      href: "/admin/settings",
      label: "Settings",
      icon: Settings,
      roles: ["admin"],
    },
    {
      href: "/admin/partner/roster-verification",
      label: "Roster Verification",
      icon: Shield,
      roles: ["admin", "moderator", "partner"],
    },
    {
      href: "/home",
      label: "Back to AFC Database",
      icon: Home,
      roles: ["admin", "moderator", "partner"],
    },
  ];

  // Show loading state while auth is being checked
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Loading admin panel...</p>
        </div>
      </div>
    );
  }

  // Show error state if user is not authenticated or authorized
  if (
    !isAuthenticated ||
    !user?.role ||
    !["admin", "moderator", "player"].includes(user.role)
  ) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
          <p className="text-muted-foreground mb-4">
            You don't have permission to access this area.
          </p>
          <Link
            href="/home"
            className="inline-flex items-center px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          >
            Return to Home
          </Link>
        </div>
      </div>
    );
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

          {/* User info */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              Welcome, {user.full_name}
            </span>
            <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
              <span className="text-xs font-medium text-primary">
                {user.full_name.charAt(0).toUpperCase()}
              </span>
            </div>
          </div>
        </div>
      </nav>

      <div className="flex">
        {/* Sidebar */}
        <aside className="w-64 min-h-[calc(100vh-4rem)] bg-card border-r border-border p-4">
          <nav className="space-y-2">
            {navItems.map(({ href, label, icon: Icon, roles }) => {
              const isAllowed = roles.includes(user.role);
              const isActive = pathname === href;

              return (
                <Link
                  key={href}
                  href={isAllowed ? href : "#"}
                  className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors
                    ${
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-muted"
                    }
                    ${!isAllowed ? "opacity-50 cursor-not-allowed" : ""}`}
                  onClick={(e) => !isAllowed && e.preventDefault()}
                >
                  <Icon className="h-5 w-5 flex-shrink-0" />
                  <span className="text-sm">{label}</span>
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-8">{children}</main>
      </div>
    </div>
  );
};

export default AdminLayout;
