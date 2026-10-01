import withSerwistInit from "@serwist/next";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {};

const isProd = process.env.NODE_ENV === "production";

const withSerwist = withSerwistInit({
  swSrc: "src/sw.ts",
  swDest: "public/sw.js",
  cacheOnNavigation: true,
  reloadOnOnline: true,
  // Offline fallback page, precached at install (see src/sw.ts).
  additionalPrecacheEntries: [
    { url: "/~offline", revision: process.env.VERCEL_GIT_COMMIT_SHA ?? "dev" },
  ],
  disable: !isProd,
});

export default isProd ? withSerwist(nextConfig) : nextConfig;
