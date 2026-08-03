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
        {/*
          Mixpanel install stub. NOTE: it lives inside a template-literal child ({`...`}),
          so every backslash must be DOUBLED. The vendor snippet's protocol check uses the
          regex /^\/\// - written here as /^\\/\\//. Without the doubling, the template
          literal evaluates `\/` -> `/`, the regex collapses to /^/// (where // starts a
          comment that eats the closing `)`), and the injected script throws
          "SyntaxError: missing ) after argument list" on every page. Keep the backslashes
          doubled if you ever re-paste this snippet from Mixpanel's dashboard.
        */}
        <Script id="mixpanel-init" strategy="afterInteractive">
          {`
            (function(e,c){if(!c.__SV){var l,h;window.mixpanel=c;c._i=[];c.init=function(q,r,f){function t(d,a){var g=a.split(".");2==g.length&&(d=d[g[0]],a=g[1]);d[a]=function(){d.push([a].concat(Array.prototype.slice.call(arguments,0)))}}var b=c;"undefined"!==typeof f?b=c[f]=[]:f="mixpanel";b.people=b.people||[];b.toString=function(d){var a="mixpanel";"mixpanel"!==f&&(a+="."+f);d||(a+=" (stub)");return a};b.people.toString=function(){return b.toString(1)+".people (stub)"};l="disable time_event track track_pageview track_links track_forms track_with_groups add_group set_group remove_group register register_once alias unregister identify name_tag set_config reset opt_in_tracking opt_out_tracking has_opted_in_tracking has_opted_out_tracking clear_opt_in_out_tracking start_batch_senders start_session_recording stop_session_recording people.set people.set_once people.unset people.increment people.append people.union people.track_charge people.clear_charges people.delete_user people.remove".split(" ");for(h=0;h<l.length;h++)t(b,l[h]);var n="set set_once union unset remove delete".split(" ");b.get_group=function(){function d(p){a[p]=function(){b.push([g,[p].concat(Array.prototype.slice.call(arguments,0))])}}for(var a={},g=["get_group"].concat(Array.prototype.slice.call(arguments,0)),m=0;m<n.length;m++)d(n[m]);return a};c._i.push([q,r,f])};c.__SV=1.2;var k=e.createElement("script");k.type="text/javascript";k.async=!0;k.src="undefined"!==typeof MIXPANEL_CUSTOM_LIB_URL?MIXPANEL_CUSTOM_LIB_URL:"file:"===e.location.protocol&&"//cdn.mxpnl.com/libs/mixpanel-2-latest.min.js".match(/^\\/\\//)?"https://cdn.mxpnl.com/libs/mixpanel-2-latest.min.js":"//cdn.mxpnl.com/libs/mixpanel-2-latest.min.js";e=e.getElementsByTagName("script")[0];e.parentNode.insertBefore(k,e)}})(document,window.mixpanel||[]);
            mixpanel.init('abc2f1f29e9862cc5ca32d8b51e3b265', { autocapture: true, record_sessions_percent: 100 });
          `}
        </Script>
        {/*
          I18nProvider is mounted outermost so every Client Component below it
          (auth, modals, theme, cart, all pages) can call useTranslations().
          locale + messages are resolved server-side above from the NEXT_LOCALE
          cookie via i18n/request.ts.
        */}
        <I18nProvider locale={locale} messages={messages}>
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
              </ThemeProvider>
            </AuthModalProvider>
          </AuthProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
