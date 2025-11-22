"use client";

import { useState, useEffect, useCallback } from "react";
import { redirect, usePathname, useRouter } from "next/navigation";
import { Menu, ShoppingCart, X, Plus, Minus, CreditCard } from "lucide-react";
import { Logo } from "./Logo";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { SidebarContent } from "./SidebarContent";
import { useToast } from "@/components/ui/use-toast";
import { Notifications } from "./Notifications";
import { useCart } from "@/contexts/CartContext";
import type React from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

const CartDrawer = () => {
  const { cartItems, removeFromCart, updateQuantity, subtotal, tax, total } =
    useCart();
  const router = useRouter();

  const handleCheckout = () => {
    router.push("/shop/checkout");
  };

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative hidden sm:block"
        >
          <ShoppingCart className="h-6 w-6" />
          {cartItems.length > 0 && (
            <span className="absolute top-0 right-0 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">
              {cartItems.length}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Your Cart</SheetTitle>
          <SheetDescription>
            {cartItems.length === 0
              ? "Your cart is empty"
              : `You have ${cartItems.length} item${
                  cartItems.length > 1 ? "s" : ""
                } in your cart`}
          </SheetDescription>
        </SheetHeader>

        <div className="py-6 space-y-6">
          {cartItems.map((item) => (
            <div
              key={item.id}
              className="flex flex-col space-y-2 border-b pb-4"
            >
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-medium">{item.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    ₦{item.price.toLocaleString()}
                  </p>
                  {item.isGift && (
                    <p className="text-xs text-blue-500">
                      Gift to: {item.giftEmail}
                    </p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeFromCart(item.id)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => updateQuantity(item.id, item.quantity - 1)}
                  disabled={item.quantity <= 1}
                >
                  <span className="w-8 text-center">{item.quantity}</span>
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => updateQuantity(item.id, item.quantity + 1)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
                <span className="ml-auto font-medium">
                  ₦{(item.price * item.quantity).toLocaleString()}
                </span>
              </div>
            </div>
          ))}
        </div>

        {cartItems.length > 0 && (
          <>
            <div className="space-y-2 mb-6">
              <div className="flex justify-between text-sm">
                <span>Subtotal</span>
                <span>₦{subtotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Tax (5%)</span>
                <span>₦{tax.toLocaleString()}</span>
              </div>
              <div className="flex justify-between font-bold pt-2 border-t">
                <span>Total</span>
                <span>₦{total.toLocaleString()}</span>
              </div>
            </div>

            <SheetFooter>
              <Button className="w-full" onClick={handleCheckout}>
                <CreditCard className="mr-2 h-4 w-4" />
                Checkout
              </Button>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
};

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isAuthenticated, logout, isAdmin } = useAuth();

  useEffect(() => {
    const checkLoginStatus = async () => {
      if (
        !isAuthenticated &&
        !["/", "/login", "/create-account"].includes(pathname)
      ) {
        redirect("/login");
      }
    };
    checkLoginStatus();
  }, [pathname, user]);

  const handleLogout = () => {
    logout();
    toast("Logged out successfully");
    router.push("/");
  };

  return (
    <div className="min-h-screen bg-background text-foreground font-inter relative overflow-hidden">
      <div className="absolute inset-0 bg-[url('/gaming-pattern.png')] opacity-5 z-0"></div>
      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-[hsl(var(--gold))]/10 z-0"></div>
      <nav className="border-b bg-background/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <Link
              href={isAuthenticated ? "/home" : "/"}
              className="flex items-center space-x-2"
            >
              <Logo className="text-primary" />
              <span className="text-base md:text-xl font-bold gold-text">
                AFC DATABASE
              </span>
            </Link>
          </div>
          <div className="flex items-center space-x-4">
            {isAuthenticated && (
              <>
                <Notifications />
                <CartDrawer />
              </>
            )}
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Menu className="h-6 w-6" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-full sm:w-[400px]">
                <SheetHeader>
                  <SheetTitle>Menu</SheetTitle>
                  <SheetDescription>
                    Navigation menu for AFC DATABASE
                  </SheetDescription>
                </SheetHeader>
                <SidebarContent
                  isLoggedIn={isAuthenticated}
                  onLogin={() => {}}
                  onLogout={handleLogout}
                  userRole={user?.role!}
                  isAdmin={isAdmin}
                />
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </nav>
      <main className="container mx-auto py-8 px-1.5 md:px-4 relative z-10">
        {children}
        {/* {pathname.includes("/news") && (
          <div className="mt-8 flex justify-center">
            <nav
              className="inline-flex rounded-md shadow-sm"
              aria-label="Pagination"
            >
              <a
                href="#"
                className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-border bg-background/50 backdrop-blur-sm text-sm font-medium text-muted-foreground hover:bg-background/80"
              >
                <span className="sr-only">Previous</span>
                <svg
                  className="h-5 w-5"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              </a>
              <a
                href="#"
                aria-current="page"
                className="relative inline-flex items-center px-4 py-2 border border-border bg-primary text-sm font-medium text-primary-foreground"
              >
                1
              </a>
              <a
                href="#"
                className="relative inline-flex items-center px-4 py-2 border border-border bg-background/50 backdrop-blur-sm text-sm font-medium text-muted-foreground hover:bg-background/80"
              >
                2
              </a>
              <a
                href="#"
                className="relative inline-flex items-center px-4 py-2 border border-border bg-background/50 backdrop-blur-sm text-sm font-medium text-muted-foreground hover:bg-background/80"
              >
                3
              </a>
              <span className="relative inline-flex items-center px-4 py-2 border border-border bg-background/50 backdrop-blur-sm text-sm font-medium text-muted-foreground">
                ...
              </span>
              <a
                href="#"
                className="relative inline-flex items-center px-4 py-2 border border-border bg-background/50 backdrop-blur-sm text-sm font-medium text-muted-foreground hover:bg-background/80"
              >
                8
              </a>
              <a
                href="#"
                className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-border bg-background/50 backdrop-blur-sm text-sm font-medium text-muted-foreground hover:bg-background/80"
              >
                <span className="sr-only">Next</span>
                <svg
                  className="h-5 w-5"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              </a>
            </nav>
          </div>
        )} */}
      </main>
      <footer className="border-t bg-background/50 backdrop-blur-sm mt-12">
        <div className="container mx-auto px-4 py-6 flex text-sm md:text-base justify-between items-center">
          <p className="text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} AFC DATABASE. All rights reserved.
          </p>
          <nav className="space-x-4 hidden md:block">
            <a
              href="/privacy"
              className="text-sm text-muted-foreground hover:text-primary transition-colors duration-200"
            >
              Privacy Policy
            </a>
          </nav>
        </div>
      </footer>
    </div>
  );
};

export default Layout;

interface ComingSoonLinkProps {
  label: string;
}

export const ComingSoonLink = ({ label }: ComingSoonLinkProps) => {
  return (
    <div className="relative inline-flex items-center space-x-2 opacity-60 cursor-not-allowed">
      <span className="font-medium">{label}</span>
      <Badge variant="secondary" className="text-xs">
        Coming Soon
      </Badge>
    </div>
  );
};
