import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  agentRules: false,
  allowedDevOrigins: ["127.0.0.1"],
  async headers() {
    // 開発モードではTurbopack/webpackのHMRがeval()を使うため、CSPが'unsafe-eval'を
    // 禁止すると開発サーバーのハイドレーション自体が壊れる。本番ビルドのみ付与する
    if (process.env.NODE_ENV !== "production") return [];

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
