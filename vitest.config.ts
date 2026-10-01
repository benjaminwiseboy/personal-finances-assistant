import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    coverage: {
      provider: "v8",
      include: ["src/lib/**", "src/domain/**", "src/actions/**", "src/server/**"],
      exclude: ["src/lib/db.ts", "src/lib/auth.ts"],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "server-only": path.resolve(__dirname, "./tests/helpers/empty-module.ts"),
    },
  },
});
