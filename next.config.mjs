import { createRequire } from "module";
const require = createRequire(import.meta.url);

/** @type {import('next-pwa').PWAConfig} */
const withPWA = require("next-pwa")({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
  buildExcludes: [/middleware-manifest\.json$/],
  // Custom worker for push notification handling
  customWorkerDir: "worker",
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Silence next-pwa chunk warnings
  webpack: (config) => {
    config.resolve.fallback = { ...config.resolve.fallback, fs: false };
    return config;
  },
};

export default withPWA(nextConfig);
