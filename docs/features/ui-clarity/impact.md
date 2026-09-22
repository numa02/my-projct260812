# 影響範囲: 画面表示の分かりにくさの解消

## 画面への影響

| 画面 | 影響 |
|---|---|
| クラス管理 | 一覧から組番号の列(デスクトップ)とカードのメタ表記(タブレット)が消える。作成・編集・削除の操作と採番の挙動は変わらない |
| 生徒名簿 | 変更なし。仮名コードは従来どおり組番号を含む形(例: 「1-03-10」)で表示される |
| 生徒別メモ一覧 | 生活メモの行ラベル・教科別表示のグループ見出しが「生活」から「生活記録」になる。教科「生活」の授業メモは別グループになる |
| 週次時間割 | 6限の下の行見出しが「生活」から「生活記録」になる。マスのボタン文言は従来どおり |
| AIプロバイダ設定 | 「APIキー」ラベル+設定状況バッジ(設定済みはドット付きの強調表示)+登録済みプロバイダ名・モデル名の併記が加わる |
| 授業記録・生活記録・所見管理・時間割マスタ設定・プロンプトひな形編集・データエクスポート | 変更なし |

## コードへの影響

| ファイル | 影響 |
|---|---|
| `app/(main)/classes/page.tsx` | 列定義とカードのメタ表記から組番号を削除 |
| `app/(main)/settings/ai-provider/AiProviderSettingsForm.tsx` | 設定状況の表示を変更、保存済みプロバイダ・モデルのstateを追加 |
| `hooks/useStudentMemos.ts` | `LIFE_MEMO_LABEL`の値変更 |
| `components/timetable/TimetableGrid.tsx` | 生活行の`rowheader`テキスト変更 |
| `hooks/useClasses.ts`・`shared/pseudonym.ts` | 変更しない(`groupNumber`はデータとして維持) |
| `lib/hono-server/routes/ai.ts` | 変更しない(`hasKey`の算出は既に正しい) |

## テストへの影響

`docs/features/ui-clarity/design.md` §5を参照。

- 更新: `components/timetable/TimetableGrid.test.tsx`、`e2e/classes.spec.ts`、`e2e/life-shoken.spec.ts`、`e2e/settings-ai-provider.spec.ts`
- 変更なし: `tests/db/rpc-class.test.ts`(組番号の採番規則はDB側で検証を継続)、`lib/hono-server/services/crypto.test.ts`

## モックアップへの影響

| ファイル | 影響 |
|---|---|
| `mockups/class-management.html` | 一覧の「3年・組番号02」等の表記から組番号を削除(3箇所) |
| `mockups/settings.html` | APIキー欄に設定状況バッジの表記を追加(現状モックには設定状況の表示自体がない) |
| `mockups/student-memo-list.html` | 生活メモの行ラベル「生活」・教科別グループ見出し「生活(1件)」を「生活記録」に変更 |
| `mockups/weekly-timetable.html` | 生活行の行見出し「生活」を「生活記録」に変更 |

## ドキュメントへの影響

| ファイル | 影響 |
|---|---|
| `docs/requirements.md` | F1の用語集「組番号」に画面に表示しない旨を追記。F7の生活メモ表記を「生活記録」に更新。F9のAPIキー保存のThenに設定状況表示を追記 |
| `docs/design/screens.md` | 画面5(クラス管理)の構成要素から組番号を削除。画面11(生徒別メモ一覧)・画面10-2の生活メモ表記を更新。画面13(設定)に設定状況表示を追記 |
| `docs/design/components.md` | Badgeのバリエーションに設定状況バッジ(設定済み/未設定)を追記 |
| `docs/features/classes/test-cases.md` | 組番号の表示を確認するケースを、表示されないことの確認に変更 |
| `docs/features/settings-ai-provider/test-cases.md` | 設定状況表示の確認ケースを追加 |
| `docs/features/memo-students-list/test-cases.md`・`docs/features/life-shoken/test-cases.md` | 「生活」表記を「生活記録」に更新 |
| `docs/features/README.md` | 実装済み一覧に本改修の行を追加 |
| `docs/data-model.md`・`docs/design.md` §4 | 変更なし(データモデルを変更しないため) |

## 同時に反映が必要な変更

小学校の標準科目セットへの教科「生活」の追加(`docs/features/subjects/` SJ-011〜SJ-014)。教科「生活」を登録できる状態で生活メモのラベルが「生活」のままだと、生徒別メモ一覧の教科別表示で両者が同一グループに混ざる。同じPRで反映する。
