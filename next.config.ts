import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['exceljs'],
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
