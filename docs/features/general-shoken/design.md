# 設計: 総合の所見

対応する要件は`docs/features/general-shoken/requirements.md`、影響範囲は`docs/features/general-shoken/impact.md`を参照。

## 1. データモデルの変更

**加算的な変更のみ。** 既存テーブルの列削除・制約の入れ替えは行わないため、2フェーズ方式(`.claude/skills/feature-change/SKILL.md` §4)は不要。

### 1.1 `student_general_comment`(新設)

生活の所見(`student_life_comment`)と同じ構造・同じ理由で新設する。`student_comment`は`unique (student_id)`(1生徒1件)であり、種別列を足して`unique (student_id, kind)`に入れ替えると、稼働中のコードの`upsert(onConflict: "student_id")`が壊れる。別テーブルなら既存の制約・コードに一切触れずに済む。

```sql
create table student_general_comment (
  id uuid primary key default gen_random_uuid (),
  student_id uuid not null unique references student (id) on delete cascade,
  content text not null,
  target_char_count int,
  creation_method comment_creation_method not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

- RLS: `student`→`class`経由のサブクエリで`c.teacher_id = auth.uid()`(既存2テーブルと同じ書き方)
- `grant select, insert, update, delete on student_general_comment to authenticated, service_role;`
- `updated_at`は`default now()`。実装中に、既存の`student_comment`・`student_life_comment`を含む全テーブルで更新時に値が進まない不具合が見つかったため、同じPRで`set_updated_at`トリガーを7テーブルに追加した(`docs/bugs.md` BUG-009)。総合の所見も他の2種類と同じくトリガーで`updated_at`が更新される

**似た構造のテーブルが3つ並ぶ点は承知のうえで採用した**(ユーザー確認済み)。将来1テーブルに統合する場合は、既存データの移行と制約の入れ替えを伴う破壊的変更になるため、別途2フェーズ方式で扱う。

### 1.2 `prompt_template.general_content`(列追加)

```sql
alter table prompt_template add column general_content text;
```

nullなら本ツール既定の総合用初期値を使う(`content`・`life_content`と同じ扱い)。`content`の`not null`は生活所見の追加時に既に外してあるため、追加の変更は不要。

### 1.3 `export_teacher_data`の更新

`create or replace function`で、生徒ごとに`generalComments`、`promptTemplate`に`generalContent`を追加する。**既存のキー名・構造は変更しない。**

## 2. API設計

新規のHonoエンドポイントは追加しない。総合の所見の保存・取得は単純CRUDのため`supabase-js`から直接行う(`CLAUDE.md`のアーキテクチャ原則)。既存の`/api/comments/generate`は組み立て済みのプロンプト文字列を受け取るだけなので変更不要。

### 2.1 材料の絞り込み(PostgREST)

`useSharedMemosForPeriod`で、総合の所見は科目名が「総合」の授業メモのみ、学習の所見は科目名が「総合」以外の授業メモのみを取得する。**学習と総合で同じメモが二重に材料にならないようにする**(教員の確認事項)。PostgRESTの埋め込みリソースへのフィルタを使い、内部結合を明示する。

```ts
const query = supabase
  .from("memo")
  .select("note_date, period, content, subject!inner(name)");
if (kind === "general") {
  query.eq("subject.name", GENERAL_SUBJECT_NAME);   // "総合"
} else {
  query.neq("subject.name", GENERAL_SUBJECT_NAME);
}
```

`subject!inner(...)`にするのは、フィルタに一致しない行を除外するため(既定の左結合だと条件に合わない行が`subject: null`として残る)。`memo.subject_id`は`not null`なので、内部結合にしても学習側で授業メモを取り漏らすことはない。

この変更により、**科目「総合」の授業メモしかない生徒では学習の所見の材料が0件になる**(「送信可能なメモが存在しません」の案内が出る)。同じメモは総合の所見タブでは材料になる。

## 3. 型・スキーマ

`shared/schemas/index.ts`の`commentKindSchema`に`"general"`を追加する。

```ts
export const commentKindSchema = z.enum(["learning", "life", "general"]);
```

`CommentKind`を`Record<CommentKind, ...>`で使っている箇所は、型エラーとして漏れが検出される。該当は`hooks/useStudentComments.ts`の`COMMENT_TABLE`と`hooks/usePromptTemplate.ts`の`Templates`/`DEFAULTS`。

## 4. 画面/UI設計

### 4.1 所見管理画面(`app/(main)/comments/class/[[...id]]/ClassCommentsContent.tsx`)

所見の種類タブに「総合の所見」を追加し、3つにする。

```
[ 学習の所見 ][ 生活の所見 ][ 総合の所見 ]
```

対象期間はこれまでどおり3タブ共通(クラスごとに1つ、`class_comment_period`)。タブの`SegmentedControl`に選択肢を1つ足すだけで、期間の扱いは変更しない。

### 4.2 行の表示(`components/comment/StudentCommentRow.tsx`)

所見欄のラベルは種類ごとに変える。学習のみ従来の「所見」表記を維持する(既存E2E・テストケースとの整合のため)。

| kind | ラベル |
|---|---|
| learning | 所見 |
| life | 生活の所見 |
| general | 総合の所見 |

### 4.3 AI生成セクション(`components/comment/CommentAiAssist.tsx`)

材料が無いときの案内文に使うラベルを種類ごとに変える。

| kind | メモのラベル |
|---|---|
| learning | メモ |
| life | 生活メモ |
| general | 総合の授業メモ |

総合で材料が0件になるのは「科目『総合』のメモがない」場合と「科目名を変更している」場合の両方があり得るが、画面上はどちらも同じ案内(「送信可能な総合の授業メモが存在しません」)にする。教員が科目管理画面を確認すれば判断できるため、原因ごとの出し分けはしない。

### 4.4 プロンプトひな形編集(`app/(main)/settings/prompt-template/`)

`PromptTemplateForm`を3つ並べる。`LABELS`に`general`を追加する。

| kind | 見出し | メモの呼称 |
|---|---|---|
| learning | 学習の所見用のひな形 | メモ |
| life | 生活の所見用のひな形 | 生活メモ |
| general | 総合の所見用のひな形 | 総合の授業メモ |

保存は`usePromptTemplate`の`saveTemplate`が種類に応じた列だけを送る既存の仕組みをそのまま使う(PostgRESTのupsertは送らなかった列を上書きしないため、他の2つは保持される)。

### 4.5 総合用ひな形の初期値

`shared/prompt-builder.ts`に`DEFAULT_GENERAL_PROMPT_TEMPLATE`を追加する。文面は教員から提示されたものを採用し、記法は学習用・生活用と揃える(【入力情報】に`{{pseudonymCode}}`・`{{grade}}`・`{{targetCharCount}}`、続けて`{{memos}}`。学期の指定は置かない)。

文面には「ここでいう『総合』は複数教科や生活面を総合して評価するという意味ではない」ことと、「総合的な学習の時間に関する記録のみを使用する」ことが明示されている。材料の絞り込みはコード側でも行うため二重の担保になる。

## 5. エラーハンドリング

新規のエラーコードは追加しない。

| 状況 | 挙動 |
|---|---|
| 総合の所見の保存失敗 | 既存の行と同じく、その行にエラーを表示し入力内容を保持する(F13、自動リトライなし) |
| 材料0件 | エラーではなく案内として`EmptyState`を表示する(既存の学習・生活と同じ) |
| ひな形の保存失敗 | 既存と同じくトーストを表示し、編集中の内容を保持する |

## 6. 影響を受ける既存テスト

| テスト | 影響 | 対応 |
|---|---|---|
| `tests/db/rls.test.ts` | テーブル追加のため「他教員のデータを読めない・書けない」ケースが必要 | `student_general_comment`のケースを追加 |
| `tests/db/schema.test.ts` | テーブル・列の存在を検証している | `student_general_comment`・`prompt_template.general_content`を追加 |
| `tests/db/rpc-export.test.ts` | エクスポート内容を検証している | `generalComments`・`promptTemplate.generalContent`の検証を追加 |
| `shared/prompt-builder.test.ts` | 初期値のプレースホルダー・学期なしをループで検証している | ループの対象に`DEFAULT_GENERAL_PROMPT_TEMPLATE`を追加 |
| `e2e/comments-class.spec.ts`・`e2e/life-shoken.spec.ts` | タブが2つ前提の箇所がある場合に影響 | タブ名で指定しているため基本は影響なし。総合タブのE2Eを新規に追加する |
| `e2e/settings-prompt-template.spec.ts` | ひな形フォームが2つ前提 | フォームはラベルで指定しているため影響なし。総合用の保存独立性のケースを追加 |

## 7. 既知の制約

**科目名「総合」の完全一致で絞り込むため、教員が科目名を変更すると材料が0件になる。** 例: 「総合」→「総合的な学習の時間」にリネームすると、総合の所見のAI生成が使えなくなる(手入力は可能)。**このとき、リネーム後の科目は学習の所見側の除外条件(`neq "総合"`)にも一致しなくなるため、学習の所見の材料に戻る。**

ユーザー確認のうえ、実装を単純に保つためこの方式を採用した。将来必要になれば、総合タブで対象科目を選べるようにする改修で解消できる(`requirements.md`のスコープ外に記載)。科目名は標準科目セットで「総合」として投入されるため、既定の運用では問題にならない。

## 8. ロールバック手順

| フェーズ | 手順 |
|---|---|
| ローカル未適用 | マイグレーションファイルを削除して`npx supabase db reset` |
| 本番適用後 | `drop table student_general_comment;`と`alter table prompt_template drop column general_content;`、および`export_teacher_data`を総合を含まない定義に戻す`create or replace`を含む新規マイグレーションを追加する |

**本番適用後のロールバックは保存済みの総合の所見を失う。** ただし既存の学習の所見・生活の所見・メモには一切影響しない(外部キー・制約の参照先になっていないため)。コード側のrevertのみでも、テーブルと列が残るだけで既存機能は正常に動作する(前方互換)。
