import type { Metadata, Viewport } from "next";
import { DM_Sans } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { AuthProvider } from "@/contexts/AuthContext";
import { Toaster } from "sonner";
import { PageGradient } from "@/components/PageGradient";
import {
  defaultMetadata,
  generateOrganizationSchema,
  generateWebsiteSchema,
} from "@/lib/seo";
import { CartProvider } from "@/contexts/CartContext";
import Script from "next/script";
import { AuthModalProvider } from "@/components/AuthModal";

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["100", "200", "300", "400", "500", "600", "700", "800", "900"],
});

export const metadata: Metadata = defaultMetadata;

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta property="og:image" content="/opengraph.png" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(generateOrganizationSchema()),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(generateWebsiteSchema()),
          }}
        />
      </head>
      <body className={`${dmSans.className} antialiased relative`}>
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-E21CNCZKFL"
          strategy="afterInteractive"
        />
        <Script id="ga-init" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-E21CNCZKFL');
          `}
        </Script>
        <Script
          id="mixpanel-init"
          strategy="afterInteractive"
          src="https://cdn.mxpnl.com/libs/mixpanel-2-latest.min.js"
          onLoad={() => {
            (window as any).mixpanel.init('abc2f1f29e9862cc5ca32d8b51e3b265', {
              autocapture: true,
              record_sessions_percent: 100,
            });
          }}
        />
        <AuthProvider>
          <AuthModalProvider>
            <ThemeProvider
              attribute="class"
              defaultTheme="dark"
              enableSystem
              disableTransitionOnChange
            >
              <PageGradient />
              <CartProvider>{children}</CartProvider>
              <Toaster position="bottom-center" />
            </ThemeProvider>
          </AuthModalProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
