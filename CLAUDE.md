# CLAUDE.md

## プロジェクト概要

学校教員向けの週間時間割・生徒メモ・所感自動生成ツール。教員が授業ごとに生徒別メモを記録し、学期末にAIが所感文の下書きを生成する。教員1人につき1アカウント、他教員とのデータ共有は行わない(`docs/requirements.md` 参照)。

## 技術スタック

- フロントエンド: Next.js (App Router) + TypeScript。ほぼ全画面をクライアントコンポーネントとして実装
- バックエンド: Hono(Next.jsのRoute Handler `app/api/[[...route]]/route.ts` にマウント。秘密情報を扱う2系統3エンドポイントのみ担当)
- DB・認証: Supabase (PostgreSQL + Supabase Auth + RLS)、セッションは `@supabase/ssr` のCookieベース
- ホスティング: Vercel(単一デプロイ。当初Cloudflare Pagesを検討したが、Next.js 16の`proxy.ts`がNode.jsランタイム固定になったこととOpenNext Cloudflareアダプタの対応が追いつかない非互換があったため変更。詳細は`docs/tasks.md` T-005/T-079参照)
- 状態管理: TanStack Query(`supabase-js` の呼び出し結果のキャッシュ用途)
- フォーム: react-hook-form + zod(`shared/schemas`)
- 日付・週番号: date-fns + date-fns-tz(JST固定)
- アイコン: lucide-react
- テスト: Vitest + React Testing Library、Playwright(E2Eはゴールデンパス中心に絞る)

詳細な選定理由・データモデル・API設計は `docs/design.md` を参照。

## アーキテクチャの原則(最重要)

**秘密情報(APIキー暗号化・復号)に触れる操作だけがHonoを経由し、それ以外の全CRUDはブラウザから `supabase-js` で直接Supabaseへアクセスする。** RLSがテナント分離の唯一の防衛線。

- 単純CRUD(クラス表示名編集、生徒編集・削除、科目名編集、メモ・所感の保存など)→ `supabase-js` から直接 `insert`/`update`/`delete`/`upsert`
- 複数テーブルにまたがる操作・アトミック性が必要な操作 → Postgres関数(RPC)を `supabase.rpc()` で直接呼び出し(一覧は `docs/design.md` §5.2)
- APIキーの暗号化保存・復号して外部AIプロバイダ呼び出し → Hono経由(`/api/settings/ai-provider`, `/api/comments/generate` のみ)

新しいHonoエンドポイントを安易に追加しない。秘密情報に触れない処理は直接SupabaseアクセスかRPC関数で実現できないか先に検討する。

## ディレクトリ構成のルール

```
app/(auth)/            未ログイン向け画面(ログイン・サインアップ・パスワードリセット)
app/(main)/            ログイン必須画面。proxy.ts(Next.js 16。旧middleware.ts)でガード
app/api/[[...route]]/  Honoアプリのマウント先
components/            画面横断コンポーネント(timetable/, memo/, comment/, ui/)
hooks/                 TanStack Queryベースのデータ取得・更新フック
lib/                   supabaseクライアント、Honoサーバー本体
shared/                zodスキーマ、仮名コード生成・週番号計算・プロンプト組み立て等の純粋関数
supabase/migrations/   Supabase CLIのSQLマイグレーション(テーブル+RPC関数)
docs/                  要件定義・データモデル・技術設計・デザイン定義
```

詳細は `docs/design.md` §3。新しいファイルは既存の分割方針(画面=`app/`、横断コンポーネント=`components/`、副作用のないロジック=`shared/`)に従って配置する。

## コーディング規約

- 型はzodスキーマを正とし、`shared/schemas` から `z.infer` で導出する。フロントの入力チェックとRPC呼び出し前の事前チェックの両方で同じスキーマを使い回す
- ビジネスルールの最終防衛線はDB側(RLS・CHECK制約・Postgres関数)。フロント側のチェックは体験向上のためであり、フロント側だけで完結させない
- Postgres関数は `SECURITY INVOKER`(デフォルト)のまま実装する。`SECURITY DEFINER` はRLSを迂回するため使わない
- 楽観的更新は行わない(Last-Write-Winsのため)。`useMutation` 成功後にのみキャッシュ・画面を更新する
- 自動リトライは行わない。保存エラー時は入力内容を保持したまま、教員が再度保存できる状態を維持する(F13)
- RPC関数のエラーは `raise exception 'CODE: メッセージ'` 形式で統一し、フロントは `:` 前をコード、`:` 後をトースト文言として扱う

## よく使うコマンド

```bash
npm install          # 依存関係インストール
npm run dev           # 開発サーバー起動
npm run test          # Vitestによる単体・結合テスト
npm run test:e2e      # Playwright E2Eテスト
npm run lint           # Lint
npm run build          # 本番ビルド
supabase start         # ローカルSupabaseスタック起動(DB結合テスト用)
supabase db push       # マイグレーション適用
```

## 命名規則

- DBのテーブル名・カラム名: `snake_case`(例: `student_comment`, `share_flag`)
- TypeScriptの変数・関数: `camelCase`。型・Reactコンポーネント: `PascalCase`
- zodスキーマ: `xxxSchema`(例: `memoInputSchema`)
- Postgres関数: 動詞_目的語の `snake_case`(例: `create_class`, `delete_subject`)
- ファイル名: Reactコンポーネントファイルは `PascalCase.tsx`、それ以外(hooks, lib, shared)は `camelCase.ts` または `kebab-case.ts`(既存ファイルの命名に合わせる)

## デザイン関連の参照先

UIを実装・変更する際は、必ず以下を参照する(優先度順)。

1. `docs/design/design-system.md` — カラー・タイポグラフィ・スペーシング等のトークン。**具体的な数値・色はここを最優先**
2. `docs/design/design-principles.md` — 「〇〇より△△を優先する」の判断軸(迷ったときの拠り所)
3. `docs/design/components.md` — 共通コンポーネントの仕様(バリエーション・状態・使用箇所)
4. `docs/design/screens.md` — 画面ごとの構成要素・状態バリエーション(正常・空・ローディング・エラー)
5. `docs/design/user-flow.md` — 画面遷移(Mermaid図)
6. `docs/design/references.md` — 参考サイト(Notion, craft.do)

トークンや原則にない判断が必要な場合は、`design-principles.md` の原則(静けさ・速記性・信頼感・実務ツールらしい素直さ・可読性)から逆算する。独自の色・余白・装飾を勝手に増やさない。

## やってはいけないこと

- スマートフォン向けのレイアウト最適化(スコープ外。対応はタブレット・デスクトップのみ)
- ダークモードの実装(design-principlesの方針でMVPはライトモードのみ)
- ブラウザから外部AIプロバイダへの直接リクエスト(必ずHono経由。CORS非依存を維持する設計上の前提)
- APIキーやteacher_idをクライアントから信頼して受け取る実装(Postgres関数・Honoハンドラは常に `auth.uid()` をサーバー側で取得する)
- Postgres関数への `SECURITY DEFINER` の使用
- 楽観的更新・自動リトライの追加(方針として意図的に採用していない)
- サインアップ制限(招待制・許可リスト)の追加、メールアドレス確認フローの追加(要件のスコープ外)
- 自動バックアップ・Point-in-Timeリカバリの実装(Supabase無料プランのまま運用する方針、リスクは受容済み)
- 楽観的な理由からモノレポ化・`packages/` への切り出しを行うこと(単一Next.jsアプリ構成を維持する)
- `docs/design/design-system.md` にない色・フォントサイズ・余白を新規に追加すること(必要な場合はまず design-system.md を更新する)
