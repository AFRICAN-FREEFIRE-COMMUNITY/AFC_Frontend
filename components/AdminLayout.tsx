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
  Trophy,
  Newspaper,
  ShieldCheck,
  ShoppingCart,
  Menu,
  LogOut,
} from "lucide-react";
import { Logo } from "./Logo";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  SidebarProvider,
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
} from "@/components/ui/sidebar";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "./ui/button";
import { Separator } from "./ui/separator";

const AdminLayout = ({ children }: { children: ReactNode }) => {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isAuthenticated, loading, logout } = useAuth();

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

  const adminNavItems = [
    {
      name: "Admin Dashboard",
      href: "/admin/dashboard",
      icon: Home,
      roles: ["admin", "moderator"],
    },
    {
      name: "Admin Leaderboards",
      href: "/admin/leaderboards",
      icon: Trophy,
      roles: ["admin", "moderator"],
    },
    {
      name: "Admin Players",
      href: "/admin/players",
      icon: Users,
      roles: ["admin", "moderator"],
    },
    {
      name: "Admin Teams",
      href: "/admin/teams",
      icon: Users,
      roles: ["admin", "moderator"],
    },
    {
      name: "Admin Events",
      href: "/admin/events",
      icon: Calendar,
      roles: ["admin", "moderator"],
    },
    {
      name: "Admin News",
      href: "/admin/news",
      icon: Newspaper,
      roles: ["admin", "moderator"],
    },
    {
      name: "Admin Rankings",
      href: "/admin/rankings",
      icon: BarChart2,
      roles: ["admin", "moderator"],
    },
    {
      name: "Admin Tiers",
      href: "/admin/tiers",
      icon: ShieldCheck,
      roles: ["admin", "moderator"],
    },
    {
      name: "Admin Shop",
      href: "/admin/shop",
      icon: ShoppingCart,
      roles: ["admin", "moderator"],
    },
    {
      name: "Admin History",
      href: "/admin/history",
      icon: BarChart2,
      roles: ["admin", "moderator"],
    },
    {
      name: "Admin Votes",
      href: "/admin/votes",
      icon: BarChart2,
      roles: ["admin", "moderator"],
    },
    {
      name: "Admin Settings",
      href: "/admin/settings",
      icon: Settings,
      roles: ["admin", "moderator"],
    },
    {
      name: "Admin Partner Verification",
      href: "/admin/partner/roster-verification",
      icon: ShieldCheck,
      roles: ["admin", "moderator"],
    },
  ];

  const handleLogout = () => {
    logout();
    toast("Logged out successfully");
    router.push("/");
  };

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
    // <div className="min-h-screen bg-background text-foreground font-inter">
    //   {/* Top Navigation */}
    //   <nav className="bg-card border-b border-border h-16">
    //     <div className="container mx-auto h-full flex items-center justify-between px-4">
    //       <div className="flex items-center gap-2">
    //         <Logo size="small" />
    //         <div className="flex items-center gap-2 bg-primary/10 px-3 py-1 rounded-md">
    //           <Shield size={16} className="text-primary" />
    //           <span className="text-sm font-medium">Admin Panel</span>
    //         </div>
    //       </div>

    //       {/* User info */}
    //       <div className="flex items-center gap-2">
    //         <span className="text-sm text-muted-foreground">
    //           Welcome, {user.full_name}
    //         </span>
    //         <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
    //           <span className="text-xs font-medium text-primary">
    //             {user.full_name.charAt(0).toUpperCase()}
    //           </span>
    //         </div>
    //       </div>
    //     </div>
    //   </nav>

    //   <div className="flex">
    //     {/* Sidebar */}
    //     <aside className="w-64 min-h-[calc(100vh-4rem)] bg-card border-r border-border p-4">
    //       <nav className="space-y-2">
    //         {adminNavItems.map(({ href, name, icon: Icon, roles }) => {
    //           const isAllowed = roles.includes(user.role);
    //           const isActive = pathname === href;

    //           return (
    //             <Link
    //               key={href}
    //               href={isAllowed ? href : "#"}
    //               className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors
    //                 ${
    //                   isActive
    //                     ? "bg-primary text-primary-foreground"
    //                     : "hover:bg-muted"
    //                 }
    //                 ${!isAllowed ? "opacity-50 cursor-not-allowed" : ""}`}
    //               onClick={(e) => !isAllowed && e.preventDefault()}
    //             >
    //               <Icon className="h-5 w-5 flex-shrink-0" />
    //               <span className="text-sm">{name}</span>
    //             </Link>
    //           );
    //         })}
    //       </nav>
    //     </aside>

    //     {/* Main Content */}
    //     <main className="flex-1 p-8">{children}</main>
    //   </div>
    // </div>
    <SidebarProvider>
      <div className="flex min-h-screen w-full flex-col bg-muted/40">
        {/* Mobile Header */}
        <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6 lg:hidden">
          <Sheet>
            <SheetTrigger asChild>
              <Button
                size="icon"
                variant="outline"
                className="sm:hidden bg-transparent"
              >
                <Menu className="h-5 w-5" />
                <span className="sr-only">Toggle Menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="sm:max-w-xs">
              <nav className="grid gap-6 text-lg font-medium">
                {adminNavItems.map((item) => (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`flex items-center gap-4 px-2.5 ${
                      pathname === item.href
                        ? "text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <item.icon className="h-5 w-5" />
                    {item.name}
                  </Link>
                ))}
                {/* Added "Back to User Dashboard" link for mobile */}
                <Separator className="my-2" />
                <Link
                  href="/home" // Link back to the general user home page
                  className="flex items-center gap-4 px-2.5 text-muted-foreground hover:text-foreground"
                >
                  <Home className="h-5 w-5" />
                  Back to User Dashboard
                </Link>
                {isAuthenticated && (
                  <Button
                    onClick={handleLogout}
                    className="w-full justify-start gap-4 px-2.5 text-muted-foreground hover:text-foreground"
                    variant="ghost"
                  >
                    <LogOut className="h-5 w-5" />
                    Logout
                  </Button>
                )}
              </nav>
            </SheetContent>
          </Sheet>
          {/* Placeholder for other header content if any */}
        </header>

        <div className="flex flex-1">
          {/* Desktop Sidebar */}
          <Sidebar className="hidden lg:block">
            <SidebarHeader className="p-4">
              <Link
                href="/admin/dashboard"
                className="flex items-center gap-2 font-semibold"
              >
                <ShieldCheck className="h-6 w-6" />
                <span className="">Admin Panel</span>
              </Link>
            </SidebarHeader>
            <SidebarContent className="flex-1 overflow-auto p-4">
              <SidebarGroup>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {adminNavItems.map((item) => (
                      <SidebarMenuItem key={item.name}>
                        <SidebarMenuButton
                          asChild
                          isActive={pathname === item.href}
                        >
                          <Link href={item.href}>
                            <item.icon className="h-4 w-4" />
                            <span>{item.name}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            </SidebarContent>
            <SidebarFooter className="p-4">
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <Link href="/profile">
                      {" "}
                      {/* Assuming profile is a user page */}
                      <Users className="h-4 w-4" />
                      <span>Admin Profile</span> {/* Or link to user profile */}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                {/* Added "Back to User Dashboard" link for desktop */}
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <Link href="/home">
                      {" "}
                      {/* Link back to the general user home page */}
                      <Home className="h-4 w-4" />
                      <span>Back to User Dashboard</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton onClick={handleLogout}>
                    <LogOut className="h-4 w-4" />
                    <span>Logout</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarFooter>
          </Sidebar>

          <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default AdminLayout;
