# 影響範囲: 所見プロンプトの差し替えと学年の反映

## 画面への影響

| 画面 | 影響 |
|---|---|
| 所見管理 | 各生徒の行のAI生成セクションに「学年」入力欄が増える(既定値は選択中クラスの学年)。表示されるプロンプト・AIへ送るプロンプトの本文が新しい文面になる。クラス切り替え時に行が再マウントされる |
| プロンプトひな形編集 | ひな形を未保存の場合に表示される初期値が新しい文面になる。プレースホルダーの案内文に`{{grade}}`が加わる。保存済みの場合の表示は変わらない |
| その他の画面 | 変更なし |

## コードへの影響

| ファイル | 影響 |
|---|---|
| `shared/prompt-builder.ts` | 初期値2件の文面差し替え、`buildPrompt`に`grade`引数と`{{grade}}`の置換を追加 |
| `components/comment/CommentAiAssist.tsx` | `classGrade` propの追加、学年入力欄の追加、`buildPrompt`への`grade`の受け渡し |
| `components/comment/StudentCommentRow.tsx` | `classGrade`をpropsで中継 |
| `app/(main)/comments/class/[[...id]]/ClassCommentsContent.tsx` | `classGrade`の受け渡し、行の`key`にクラスIDを追加 |
| `app/(main)/settings/prompt-template/PromptTemplateForm.tsx` | プレースホルダーの案内文に`{{grade}}`を追加 |
| `hooks/usePromptTemplate.ts` | 変更なし(初期値の定数を参照するだけ) |
| `hooks/useGenerateComment.ts`・`lib/hono-server/routes/ai.ts` | 変更なし(組み立て済みのプロンプト文字列を受け取る既存の形を維持) |
| `shared/schemas/index.ts` | 変更なし(学年はDBに保存せずプロンプトに埋めるだけのため、スキーマを追加しない) |

## データへの影響

- **DBスキーマ変更なし。** マイグレーションは作成しない
- **保存済みのひな形は書き換えない。** 初期値の差し替えは`prompt_template`に行が無い(または該当列がnull)の教員にのみ影響する
- 学年は入力値をプロンプトに埋めるだけで保存しない。`class.grade`を書き換えることもない

## テストへの影響

`docs/features/prompt-revision/design.md` §5を参照。

- 更新・追加: `shared/prompt-builder.test.ts`、`e2e/settings-prompt-template.spec.ts`、`e2e/comments-class.spec.ts`
- 変更なし: `tests/db/*`(DB変更を伴わないため)、`lib/hono-server/services/crypto.test.ts`

## モックアップへの影響

| ファイル | 影響 |
|---|---|
| `mockups/comment.html` | AI生成セクションに「学年」入力欄を追加 |
| `mockups/settings.html` | プロンプトひな形編集欄の初期値・プレースホルダー案内を新しい文面に合わせる |

## ドキュメントへの影響

| ファイル | 影響 |
|---|---|
| `docs/requirements.md` | F9・F10の該当箇所に、プロンプトに学年が含まれること・学年の既定値が対象クラスの学年であることを追記。F10のプレースホルダーの記載に`{{grade}}`を追加 |
| `docs/design/screens.md` | 画面12(所見管理)のAI生成セクションの構成要素に「学年」を追加。画面13(設定)のひな形編集欄のプレースホルダー案内を更新 |
| `docs/design.md` | プロンプト組み立ての記載があれば`{{grade}}`を追記 |
| `docs/features/settings-prompt-template/test-cases.md`・`docs/features/comments/test-cases.md` | 初期値の文面・学年欄に関するケースを更新・追加 |
| `docs/features/README.md` | 実装済み一覧に本改修の行を追加 |
| `docs/data-model.md` | 変更なし |

## 後続の改修との関係

総合の所見(`docs/features/general-shoken/`、次のPR)は、本改修で確定した記法(【入力情報】に`{{pseudonymCode}}`・`{{grade}}`・`{{targetCharCount}}`、続けて`{{memos}}`。学期なし)に合わせて総合用の初期値を追加する。本改修を先に入れることで、総合用のひな形を最初から同じ形式で書ける。
