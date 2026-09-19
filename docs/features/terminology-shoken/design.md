# 設計: 用語「所感」を「所見」に統一する

要件は`docs/features/terminology-shoken/requirements.md`を参照。

## データモデルの変更

なし。`student_comment`テーブル・`class.comment_period_*`列・RPC関数はいずれも英語の識別子のみを使っており、DBに保存される固定文字列(既定値・`raise exception`のメッセージ)にも「所感」は含まれていない(`supabase/migrations/`をgrepで確認済み。出現はSQLコメントのみ)。

## API設計

- `/api/comments/generate`(Hono)のパス・リクエスト・レスポンスの形は変更しない
- 500エラー時のメッセージ文言のみ「所感の生成に失敗しました」→「所見の生成に失敗しました」に変更する(`lib/hono-server/routes/ai.ts`)。フロントはエラーコードで分岐しており、文言はトーストにそのまま表示するだけのため互換性の問題はない

## 画面/UI設計

- 画面構成・レイアウト・コンポーネントは変更しない。文言のみ置き換える
- `shared/prompt-builder.ts`の`DEFAULT_PROMPT_TEMPLATE`を「所見文」に変更する。保存済みひな形がない教員にのみ効く(`hooks/usePromptTemplate.ts`)

## 置き換え方針

- 対象: Gitで追跡しているファイルのうち、`supabase/migrations/`と本ディレクトリ(`docs/features/terminology-shoken/`、旧称の説明のため)を除く全ファイル
- 方法: 「所感」→「所見」の単純置換。複合語(所感管理・所感文・所感欄・所感生成など)もすべて「所見〜」で意味が通ることを確認済み
- コメント・JSDoc・テスト名も含めて置き換える(コードとドキュメントの用語を一致させるため)

## エラーハンドリング

変更なし。

## 影響を受ける既存テスト

画面文言をセレクタやアサーションに使っているテストは、置換によって期待値も同時に更新される。

- `e2e/comments-class.spec.ts`、`e2e/golden-path.spec.ts`、`e2e/settings-prompt-template.spec.ts`、`e2e/students.spec.ts`、`e2e/settings-export.spec.ts`
- `components/ui/LoadingSpinner.test.tsx`、`components/ui/ConfirmDialog.test.tsx`
- `lib/hono-server/services/ai-adapters/index.test.ts`、`shared/schemas/index.test.ts`
- `tests/db/schema.test.ts`、`tests/db/rpc-export.test.ts`、`tests/db/rls.test.ts`(テスト名・フィクスチャの文字列のみ)

## ロールバック手順

DB変更を伴わないため、PRのrevertのみで元に戻せる。
