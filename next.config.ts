import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  // The floating dev badge covers app controls (sidebar account menu, mobile
  // header). Errors still show in the dev overlay.
  devIndicators: false,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
