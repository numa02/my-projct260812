// wranglerシークレットとして管理する環境変数の型定義。
// cloudflare-env.d.ts(`npm run cf-typegen`でwrangler.jsoncのbindingsから自動生成・上書きされる)
// とは別ファイルにし、TypeScriptの宣言マージでCloudflareEnvに合成する。
declare global {
  interface CloudflareEnv {
    // AIプロバイダAPIキー暗号化用マスターキー(design.md §4.2)
    ENCRYPTION_MASTER_KEY?: string;
  }
}

export {};
