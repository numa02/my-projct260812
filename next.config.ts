import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  agentRules: false,
  allowedDevOrigins: ["127.0.0.1"],
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [{ key: "Content-Security-Policy", value: "default-src 'self'" }],
      },
    ];
  },
};

export default nextConfig;

import("@opennextjs/cloudflare").then((m) => m.initOpenNextCloudflareForDev());
