import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  headers: async () => [
    {
      // All pages — no caching so you always get the latest
      source: "/((?!_next/static|icons|manifest).*)",
      headers: [
        { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
      ],
    },
  ],
};

export default nextConfig;
