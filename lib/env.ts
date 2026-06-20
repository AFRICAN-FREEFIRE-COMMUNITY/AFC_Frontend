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
  },
  experimental__runtimeEnv: {
    NEXT_PUBLIC_BACKEND_API_URL: process.env.NEXT_PUBLIC_BACKEND_API_URL,
    NEXT_PUBLIC_URL: process.env.NEXT_PUBLIC_URL,
    NEXT_PUBLIC_GOOGLE_CLIENT_ID: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
  },
});
