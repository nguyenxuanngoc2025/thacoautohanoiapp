import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  turbopack: {
    // Fix: chỉ định root rõ ràng để tránh multi-lockfile confusion
    root: path.resolve(__dirname),
  },
  async headers() {
    return [
      {
        // Force no-cache trên CSS chunks để tránh stale CSS
        source: "/_next/static/chunks/:filename*.css",
        headers: [
          { key: "Cache-Control", value: "no-store, must-revalidate" },
        ],
      },
    ];
  },
};

export default nextConfig;
