import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["mjml"],
  experimental: {
    serverActions: {
      bodySizeLimit: "30mb",
    },
  },
};

export default nextConfig;
