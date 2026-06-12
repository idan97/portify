import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    proxy: {
      // Mirrors the Vercel serverless function api/base44.js for local dev,
      // so the Base44 import feature works under `npm run dev` too.
      "/api/base44": {
        target: "https://app.base44.com",
        changeOrigin: true,
        rewrite: (p) => {
          const url = new URL(p, "http://localhost");
          const appId = url.searchParams.get("appId");
          const entity = url.searchParams.get("entity");
          return `/api/apps/${appId}/entities/${entity}`;
        },
      },
      // Mirrors api/usd-rate.js for local dev (Frankfurter USD->ILS rate).
      "/api/usd-rate": {
        target: "https://api.frankfurter.dev",
        changeOrigin: true,
        rewrite: () => "/v1/latest?from=USD&to=ILS",
      },
    },
  },
});
