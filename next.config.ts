import withSerwistInit from "@serwist/next";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {};

const isProd = process.env.NODE_ENV === "production";

const withSerwist = withSerwistInit({
  swSrc: "src/sw.ts",
  swDest: "public/sw.js",
  cacheOnNavigation: true,
  reloadOnOnline: true,
  disable: !isProd,
});

export default isProd ? withSerwist(nextConfig) : nextConfig;
