# 設計: 画面表示の分かりにくさの解消

対応する要件は`docs/features/ui-clarity/requirements.md`、影響範囲は`docs/features/ui-clarity/impact.md`を参照。

## 1. データモデルの変更

なし。テーブル・カラム・制約・RLSポリシー・RPC関数のいずれも変更しない。

`class.group_number`は従来どおり保持し、`create_class`/`update_class_grade`の採番ロジックも変更しない。表示をやめるだけで、`shared/pseudonym.ts`の仮名コード生成は`groupNumber`を引き続き受け取る。

## 2. API設計

なし。新規のHonoエンドポイント・RPC関数は追加しない。既存の`GET /api/settings/ai-provider`が返す`{ provider, model, hasKey }`をそのまま使う(サーバー側の変更なし)。

## 3. 画面/UI設計

### 3.1 クラス管理画面(`app/(main)/classes/page.tsx`)

- `columns`から`groupNumber`の列定義を削除する(学年・クラス表示名・操作の3列になる)
- タブレット向けカード表示の`meta`を`` `${c.grade} / 組番号${c.groupNumber}` `` から`c.grade`のみに変更する
- `useClasses`が返す`ClassRow.groupNumber`は他画面(生徒名簿・所見管理・生活記録・授業記録が仮名コード生成に使う)で必要なため、型・取得クエリは変更しない

### 3.2 AIプロバイダ設定画面(`app/(main)/settings/ai-provider/AiProviderSettingsForm.tsx`)

現状は`variant="neutral"`のBadgeを見出し直下に単独で置いており、「設定済み」と「未設定」が同じ薄いグレーで描画され差がつかない。何に対する状態かを示すラベルもない。

変更後の構成:

```
AIプロバイダ設定

APIキー  [● 設定済み]  OpenAI / gpt-5-mini     ← 登録済みの場合
APIキー  [未設定]                              ← 未登録の場合
```

- 「APIキー」のラベルを`text-sm text-gray-700`で前置し、バッジが何の状態かを明示する
- 登録済みは`<Badge variant="recorded" label="設定済み" />`。`recorded`は授業記録画面の「入力済み」インジケーターで使っている既存バリエーションで、`bg-success-500/10 text-success-500`と緑のドットを持つ。新しい色・バリエーションは追加しない
- 未登録は`<Badge variant="neutral" label="未設定" />`のまま(設定前の正常な初期状態であり、警告として扱わない)
- 登録済みの場合はプロバイダ名(`PROVIDER_OPTIONS`の`label`)とモデル名を`text-sm text-gray-600`で併記する。プルダウンの選択値は「保存済みの値」と「教員が選び直した未保存の値」を区別できないため、保存済みの内容をここに出すことで登録の事実が確認できる
- バッジのラベル文字列は「設定済み」「未設定」のまま変えない(既存E2E `e2e/settings-ai-provider.spec.ts`が`getByText`で参照しているため、文言を変えずに視認性だけを上げる)

保存後の更新方法: このフォームは`initialSetting`をpropsから一度だけ受け取り`useState`の初期値にする構成のため、保存成功時に併記内容も更新する必要がある。既存の`setHasKey(true)`と同じ方針で、`savedProvider`/`savedModel`のstateを持ち、`saveSetting.mutateAsync`成功時に保存した値で更新する(TanStack Queryのキャッシュ更新に依存しない)。

### 3.3 生活メモの表示ラベル

- `hooks/useStudentMemos.ts`の`LIFE_MEMO_LABEL`を`"生活"`から`"生活記録"`に変更する。生徒別メモ一覧の日付順表示の行ラベル・教科別表示のグループ見出しはいずれもこの定数を参照しているため、1箇所の変更で両方に反映される
- `components/timetable/TimetableGrid.tsx`の生活行の`rowheader`テキストを`"生活"`から`"生活記録"`に変更する。各曜日のマスのボタン文言・`aria-label`は既に「生活記録」のため変更しない

`LIFE_MEMO_LABEL`の変更は表示上の衝突解消だけでなく、機能的な不具合の予防でもある。生徒別メモ一覧の「教科別」表示は`groupBySubject`が`subjectName`の文字列一致でグループ化するため(`app/(main)/memos/students/[[...id]]/StudentMemosContent.tsx`)、教科「生活」の授業メモと生活メモが同じ`"生活"`を持つと1つのグループに混ざる。

## 4. エラーハンドリング

新規のエラー経路はない。保存失敗時の挙動(入力内容を保持したまま再保存できる、自動リトライしない)は既存のまま変更しない(F13)。

## 5. 影響を受ける既存テスト

| テスト | 影響 | 対応 |
|---|---|---|
| `components/timetable/TimetableGrid.test.tsx` | 行見出しを`rowheader { name: "生活" }`で参照している2箇所が落ちる | `"生活記録"`に変更する |
| `e2e/classes.spec.ts` | 「組番号が自動採番される」テストが一覧の組番号列を前提にしている。表示名に数字を含むため`toContainText`自体は通り続けてしまうが、検証の意味を失う | テスト名と検証内容を「一覧に組番号が表示されない」ことの確認に変更する。採番規則自体の検証は`tests/db/rpc-class.test.ts`が担っているため、E2Eからは外す |
| `e2e/life-shoken.spec.ts` | 教科別表示のグループ見出しを`heading { name: "生活" }`で参照している(1箇所) | `"生活記録"`に変更する |
| `e2e/settings-ai-provider.spec.ts` | `getByText("設定済み")`/`getByText("未設定")`で参照している | バッジのラベル文言を変えないため変更不要。プロバイダ名・モデル名の併記を確認するアサーションを追加する |
| `tests/db/rpc-class.test.ts` | 組番号の採番規則を検証している。DB側の挙動は変更しないため影響なし | 変更しない |

## 6. ロールバック手順

DB変更を伴わないため、コードのrevertのみで完全に復旧できる。マイグレーションの巻き戻しは不要。

ただし同じPRに含まれる教科「生活」の追加(SJ-011)はマイグレーションを伴う。生活メモのラベル変更だけをrevertすると、教科「生活」と生活メモの「生活」が再び衝突するため、ラベル変更をrevertする場合はSJ-011のロールバック(`docs/features/subjects/tasks.md`参照)も併せて検討する。
