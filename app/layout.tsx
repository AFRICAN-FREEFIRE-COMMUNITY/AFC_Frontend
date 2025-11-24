import type React from "react";
import { DM_Sans, Inter, Rajdhani } from "next/font/google";
import "../styles/globals.css";
import { Providers } from "./providers";
import { Toaster } from "sonner";
import { AuthProvider } from "@/contexts/AuthContext";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const rajdhani = Rajdhani({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-rajdhani",
  display: "swap",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["100", "200", "300", "400", "500", "600", "700", "800", "900"],
});

export const metadata = {
  title: "Africa Freefire Community",
  description: "Track your performance in the African Freefire Community",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // <html lang="en" className={`${inter.variable} ${rajdhani.variable}`}>
    <html lang="en" className={`${dmSans.className}`}>
      <body className="font-sans">
        <AuthProvider>
          <Providers>{children}</Providers>
          <Toaster />
        </AuthProvider>
      </body>
    </html>
  );
}
