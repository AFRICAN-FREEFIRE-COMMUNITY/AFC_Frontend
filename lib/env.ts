import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {},
  client: {
    NEXT_PUBLIC_BACKEND_API_URL: z.string().url(),
    NEXT_PUBLIC_URL: z.string().url(),
    NEXT_PUBLIC_WAGER_MOCK: z
      .string()
      .optional()
      .default("0")
      .transform((v) => v === "1" || v === "true"),
  },
  experimental__runtimeEnv: {
    NEXT_PUBLIC_BACKEND_API_URL: process.env.NEXT_PUBLIC_BACKEND_API_URL,
    NEXT_PUBLIC_URL: process.env.NEXT_PUBLIC_URL,
    NEXT_PUBLIC_WAGER_MOCK: process.env.NEXT_PUBLIC_WAGER_MOCK,
  },
});
