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
import { CurrencyProvider } from "@/contexts/CurrencyContext";
import Script from "next/script";
import { AuthModalProvider } from "@/components/AuthModal";
// i18n: locale + messages come from i18n/request.ts (driven by the NEXT_LOCALE
// cookie). I18nProvider (NextIntlClientProvider) makes them available to every
// Client Component via useTranslations(). See components/I18nProvider.tsx.
import { getLocale, getMessages } from "next-intl/server";
import { I18nProvider } from "@/components/I18nProvider";
// Which namespaces a PUBLIC page can ask for, generated from the import graph by
// scripts/i18n-namespaces.mjs (checked in check-all: a stale list or a non-literal namespace fails).
import publicNamespaces from "@/lib/i18n/publicNamespaces.generated.json";
import { ReferralClaimer } from "@/components/referrals/ReferralClaimer";
import { HelpBot } from "@/components/help/HelpBot";

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

// RootLayout is async so it can await the locale and messages resolved by
// next-intl for this request (cookie-based, no URL prefix). The <html lang>
// then reflects the active language for accessibility + SEO.
export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Resolved from the NEXT_LOCALE cookie via i18n/request.ts; fallback 'en'.
  const locale = await getLocale();
  // Deep-merged catalog (English base + fr/pt overlay) for Client Components.
  const messages = await getMessages();
  // ONLY the namespaces a public page can reach go to the browser from here (Search Console
  // 2026-10-16: the full 94-namespace catalog was inlined into every page, 870 KB of HTML).
  // The workspace groups mount the full catalog themselves (components/WorkspaceMessages.tsx).
  const PUBLIC_NAMESPACES = new Set<string>(publicNamespaces.public);
  const publicMessages = Object.fromEntries(
    Object.entries(messages).filter(([ns]) => PUBLIC_NAMESPACES.has(ns)),
  ) as typeof messages;

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        {/*
          Site-wide default link embed (logo + tagline card) is set via the
          Metadata API in lib/seo.ts → defaultMetadata (exported as `metadata`
          below). metadataBase makes its og:image ("/assets/opengraph.png", a
          1200x630 branded card) absolute automatically, and per-page
          generateMetadata overrides it where richer data exists. The old manual
          <meta property="og:image" content="/opengraph.png"> here was a RELATIVE
          URL (uncrawlable) that also pointed at a non-existent file, so it is
          removed - the Metadata API handles the default correctly.
        */}
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
        {/* Analytics load with strategy="lazyOnload": after the page has loaded and the browser is
            idle, so they no longer compete with the page itself on a phone (Search Console Core Web
            Vitals 2026-10-16: LCP 5.9 s, INP 348 ms; GTM is 180 KB). Nothing in the app calls
            gtag() directly (checked 2026-10-16), so nothing can run before the stub exists.
            Mixpanel was removed on 2026-10-16 (owner, inbox #275: "we dont use mixpanel right now,
            so you can remove it"); its session recorder was another 105 KB on every page. */}
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-E21CNCZKFL"
          strategy="lazyOnload"
        />
        <Script id="ga-init" strategy="lazyOnload">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-E21CNCZKFL');
          `}
        </Script>
        {/*
          I18nProvider is mounted outermost so every Client Component below it
          (auth, modals, theme, cart, all pages) can call useTranslations().
          locale + messages are resolved server-side above from the NEXT_LOCALE
          cookie via i18n/request.ts.
        */}
        <I18nProvider locale={locale} messages={publicMessages}>
          <AuthProvider>
            <AuthModalProvider>
              <ThemeProvider
                attribute="class"
                defaultTheme="dark"
                enableSystem
                disableTransitionOnChange
              >
                <PageGradient />
                {/* Multi-currency display layer (owner 2026-06-30): loads FX rates + the viewer's
                    display currency so <Money/> shows everyone their own currency. Inside AuthProvider
                    so it can read the auth token; wraps the cart so shop money converts too. */}
                <CurrencyProvider>
                  <CartProvider>{children}</CartProvider>
                </CurrencyProvider>
                <Toaster position="bottom-center" />
                {/* Sends a waiting referral code once its owner is signed in (inbox #47). Renders nothing. */}
                <ReferralClaimer />
                {/* The Help button and panel on every page (inbox #109). Inside AuthProvider and
                    AuthModalProvider because it answers about the signed-in account and opens the
                    sign-in modal; it renders nothing on /overlay and /qr. See components/help/HelpBot.tsx. */}
                <HelpBot />
              </ThemeProvider>
            </AuthModalProvider>
          </AuthProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
