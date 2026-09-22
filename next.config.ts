import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  agentRules: false,
  allowedDevOrigins: ["127.0.0.1"],
  async redirects() {
    // public/manual/index.html は /manual/index.html でしか配信されないため、
    // 案内しやすい /manual でも開けるようにする
    return [{ source: "/manual", destination: "/manual/index.html", permanent: false }];
  },
  async headers() {
    // 開発モードではTurbopack/webpackのHMRがeval()を使うため、CSPが'unsafe-eval'を
    // 禁止すると開発サーバーのハイドレーション自体が壊れる。本番ビルドのみ付与する
    if (process.env.NODE_ENV !== "production") return [];

    // supabase-jsはブラウザから直接Supabase(NEXT_PUBLIC_SUPABASE_URL)へfetchするため、
    // connect-srcで明示的に許可する(未指定だとdefault-srcにフォールバックし同一オリジン以外への
    // fetchがブロックされる)。script-srcはNext.jsがハイドレーション用データを埋め込むインライン
    // scriptタグを使うため'unsafe-inline'が必要
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: `default-src 'self'; script-src 'self' 'unsafe-inline'; connect-src 'self' ${supabaseUrl}`,
          },
        ],
      },
    ];
  },
};

export default nextConfig;
