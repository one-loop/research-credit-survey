import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: "/credit-roles", destination: "/", permanent: false },
    ];
  },
};

export default nextConfig;
