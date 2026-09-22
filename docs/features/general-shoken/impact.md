# 影響範囲: 総合の所見

## データモデルへの影響

| 対象 | 影響 |
|---|---|
| `student_general_comment` | 新設(`unique (student_id)`、RLS・grant付き) |
| `prompt_template.general_content` | 列追加(nullable) |
| `export_teacher_data` | `create or replace`で総合の所見・総合用ひな形を追加。既存キーは変更なし |
| 既存テーブル(`student_comment`・`student_life_comment`・`memo`・`life_memo`ほか) | 列・制約・RLSは変更なし。`updated_at`の自動更新トリガー(`set_updated_at`)のみ7テーブルに追加する(`docs/bugs.md` BUG-009。別マイグレーション`20260922190000_updated_at_triggers.sql`) |

破壊的変更を含まないため2フェーズ方式は不要。ダウンタイム・データ移行も発生しない。

## 画面への影響

| 画面 | 影響 |
|---|---|
| 所見管理 | 所見の種類タブが2つ→3つになる(「総合の所見」追加)。総合タブでは材料が科目「総合」の授業メモのみに、**学習タブでは科目「総合」以外の授業メモのみ**に絞られる。対象期間は3タブ共通のまま。各行の「最終更新」が上書き保存で正しく進むようになる(BUG-009) |
| プロンプトひな形編集 | 編集フォームが2つ→3つになる(「総合の所見用のひな形」追加) |
| データエクスポート | 出力JSONに`generalComments`・`promptTemplate.generalContent`が増える(既存キーは不変) |
| 授業記録・生活記録・生徒別メモ一覧・クラス管理・生徒名簿・科目管理・時間割系 | 変更なし |

総合のメモは既存の授業記録画面から科目「総合」の授業として記録する。新しい記録画面は作らない。

## コードへの影響

| ファイル | 影響 |
|---|---|
| `supabase/migrations/<timestamp>_general_shoken.sql` | 新規 |
| `shared/schemas/index.ts` | `commentKindSchema`に`"general"`を追加 |
| `shared/prompt-builder.ts` | `DEFAULT_GENERAL_PROMPT_TEMPLATE`を追加 |
| `hooks/useStudentComments.ts` | `COMMENT_TABLE`に`general`を追加 |
| `hooks/usePromptTemplate.ts` | `Templates`・`DEFAULTS`・保存列の判定に`general`を追加 |
| `hooks/useSharedMemosForPeriod.ts` | 総合は科目名「総合」で絞り、学習は「総合」を除外する。いずれも`subject!inner`で内部結合にする |
| `app/(main)/comments/class/[[...id]]/ClassCommentsContent.tsx` | タブの選択肢を追加 |
| `components/comment/StudentCommentRow.tsx` | 所見欄のラベルに`general`を追加 |
| `components/comment/CommentAiAssist.tsx` | メモのラベルに`general`を追加 |
| `app/(main)/settings/prompt-template/` | フォームを3つに、`LABELS`に`general`を追加 |
| `lib/hono-server/` | 変更なし(秘密情報を扱う処理に変更がないため) |

`CommentKind`を`Record<CommentKind, ...>`で受けている箇所は、`"general"`の追加により型エラーで漏れが検出される。

## テストへの影響

`docs/features/general-shoken/design.md` §6を参照。

- 追加: `tests/db/rls.test.ts`(他教員から読めない・書けない)、`tests/db/schema.test.ts`、`tests/db/rpc-export.test.ts`、`shared/prompt-builder.test.ts`、`e2e/comments-class.spec.ts`(総合タブ)、`e2e/settings-prompt-template.spec.ts`(ひな形の独立性)
- 変更なし: `tests/db/rpc-class.test.ts`・`rpc-subject.test.ts`・`rpc-timetable.test.ts`、`lib/hono-server/services/crypto.test.ts`

## モックアップへの影響

| ファイル | 影響 |
|---|---|
| `mockups/comment.html` | 所見の種類タブを3つにする |
| `mockups/settings.html` | ひな形編集欄を3つにする |

## ドキュメントへの影響

| ファイル | 影響 |
|---|---|
| `docs/requirements.md` | F15(生活記録と生活の所見)を所見3種の構成に更新するか、総合の所見の節を追加。用語集の「学習の所見 / 生活の所見」を3種に更新。F9・F10・F11・F14の該当箇所に総合を反映 |
| `docs/data-model.md` | `student_general_comment`の追加、`prompt_template`の列追加、ER図・一意制約一覧の更新 |
| `docs/design.md` §4 | データモデル詳細(DDL)に新テーブル・新列を追加 |
| `docs/design.md` §5.2 | `export_teacher_data`の説明に総合を含む旨を追記 |
| `docs/design/screens.md` | 画面12(所見管理)のタブ、画面13(設定)のひな形編集欄 |
| `docs/design/components.md` | `SegmentedControl`の選択肢数に関する記載があれば更新 |
| `docs/features/comments/test-cases.md`・`docs/features/settings-prompt-template/test-cases.md` | 総合タブ・総合用ひな形のケースを追加 |
| `docs/features/README.md` | 実装済み一覧に本機能の行を追加 |

## 本番運用への影響

- **ダウンタイム**: 不要
- **データ移行**: 不要(新規テーブル・新規列のみ。既存データには触れない)
- **適用順序**: マイグレーションを先に適用してもコードを先にデプロイしても壊れない。テーブル・列が増えるだけで旧コードは参照しないため(前方互換)。ただし総合タブが動くのは両方揃ってから
- **ロールバック**: `docs/features/general-shoken/design.md` §8参照。保存済みの総合の所見は失われるが、既存の所見・メモには影響しない

## 同時にリリースする必要があるもの

なし。単独で完結する加算的な改修。
