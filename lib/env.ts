import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {},
  client: {
    NEXT_PUBLIC_BACKEND_API_URL: z.string().url(),
    NEXT_PUBLIC_URL: z.string().url(),
    // Google Sign-In (owner 2026-06-20): the OAuth Web Client ID used by the
    // "Continue with Google" button (components/auth/GoogleSignInButton.tsx). The
    // backend verifies the resulting ID token against the SAME id
    // (settings.GOOGLE_OAUTH_CLIENT_ID). OPTIONAL: when unset the button hides and
    // Google sign-in is simply unavailable, so the app builds/runs without it.
    NEXT_PUBLIC_GOOGLE_CLIENT_ID: z.string().optional(),
    // Discord SSO (owner 2026-06-21): "true" shows the "Continue with Discord" button
    // (components/auth/DiscordSignInButton.tsx). The whole OAuth flow lives on the backend
    // (reuses the existing Discord app), so the FE only needs this on/off flag. Off where
    // Discord creds aren't configured (e.g. local dev) so the button isn't shown broken.
    NEXT_PUBLIC_DISCORD_SSO_ENABLED: z.string().optional(),
    // AFC Capture desktop client (owner 2026-07-01): the URL the "Download AFC Capture"
    // button on /organizer/capture points at (the hosted, code-signed .exe release).
    // OPTIONAL: when unset the download button is disabled with a "coming soon" note, so the
    // page ships before the signed build is hosted. Consumed by app/(organizer)/organizer/capture.
    NEXT_PUBLIC_CAPTURE_DOWNLOAD_URL: z.string().url().optional(),
  },
  experimental__runtimeEnv: {
    NEXT_PUBLIC_BACKEND_API_URL: process.env.NEXT_PUBLIC_BACKEND_API_URL,
    NEXT_PUBLIC_URL: process.env.NEXT_PUBLIC_URL,
    NEXT_PUBLIC_GOOGLE_CLIENT_ID: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
    NEXT_PUBLIC_DISCORD_SSO_ENABLED: process.env.NEXT_PUBLIC_DISCORD_SSO_ENABLED,
    NEXT_PUBLIC_CAPTURE_DOWNLOAD_URL: process.env.NEXT_PUBLIC_CAPTURE_DOWNLOAD_URL,
  },
});
