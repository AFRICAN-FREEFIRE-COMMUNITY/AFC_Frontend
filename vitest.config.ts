import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
    },
  },
  test: {
    environment: "happy-dom",
    setupFiles: ["./tests/setup.ts"],
    globals: true,
    include: ["**/__tests__/**/*.test.ts", "**/__tests__/**/*.test.tsx"],
    exclude: ["**/node_modules/**", "**/.next/**", "**/tests/e2e/**"],
  },
});
