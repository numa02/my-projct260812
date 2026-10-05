# 設計: 単元の記録と単元別の所見生成

対応する要件は`docs/features/memo-unit/requirements.md`、影響範囲は`docs/features/memo-unit/impact.md`、タスクは`docs/features/memo-unit/tasks.md`。

## 0. 実装前のヒアリングで確定した意思決定

| 論点 | 決定 | 理由 |
|---|---|---|
| 単元マスタの紐づけ先 | **科目に紐づける**(`unit.subject_id`は必須) | 授業記録画面では時間割から科目が確定しているため、その科目の単元だけをプルダウンに出せる。生徒別メモ一覧の「教科別」表示と自然に入れ子になる |
| 授業記録画面での選択単位 | **コマごとに1つ**(画面上部で選び、そのコマの全メモに同じ単元が入る) | 実際の授業は1コマ1単元で進むため。生徒ごとに選ばせると毎回の操作が増える |
| 単元ごとの所見案の保存 | **保存しない**(画面に並べて選ぶだけ) | DB変更を最小にでき、既存の「生成→所見欄に反映→保存」の流れをそのまま使える。採用結果は従来どおり1件の所見として保存される |
| 単元マスタの管理画面 | **科目管理画面(`/subjects`)の中** | 画面もグローバルナビも増えない。科目と単元は親子関係にあり、同じ画面で扱うのが素直 |

## 1. データモデルの変更

**加算的な変更のみ**(テーブル追加・nullable列追加)で、既存の列・制約・RLSポリシーには一切触れない。したがって`CLAUDE.md`・スキル §4の2フェーズ方式(expand/contract)は不要。

### 1.1 `unit`(新設)

```sql
create table unit (
  id uuid primary key default gen_random_uuid (),
  subject_id uuid not null references subject (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, subject_id)
);
```

- `teacher_id`は持たない。`subject`が既に`teacher_id`を持っており、`unit`から見た所有者は`subject`経由で一意に決まるため。列を複製しないことで、**クライアントから`teacher_id`を渡す実装が不要になる**(`CLAUDE.md`の「APIキーやteacher_idをクライアントから信頼して受け取る実装」を避ける方針に合う)
- 一意制約で単元名の重複は防がない。`subject`が「科目名の重複は許可する」方針で作られているため、同じ方針に揃える
- `unique (id, subject_id)`は名前の重複防止ではなく、`memo`から「単元は必ずそのメモの科目に属する」ことをDBで保証するための複合外部キーの参照先(§1.2)
- 並び順は`created_at`昇順。並び替えUIはスコープ外(教科書の順に登録すれば自然な順になる)
- `updated_at`は`default now()`のみ。自動更新トリガーは`updated_at_triggers`マイグレーション(`20260922190000`)の既存対象に揃えて設定する(§1.4)

RLSポリシーは`subject`経由のサブクエリで書く(`memo`が`student`→`class`経由で書いているのと同じ形)。

```sql
alter table unit enable row level security;
grant select, insert, update, delete on unit to authenticated, service_role;

create policy "teacher can manage own units" on unit
for all
  using (exists (select 1 from subject s where s.id = unit.subject_id and s.teacher_id = auth.uid ()))
  with check (exists (select 1 from subject s where s.id = unit.subject_id and s.teacher_id = auth.uid ()));
```

索引: `create index unit_subject_id_idx on unit (subject_id);`(科目ごとの一覧取得とRLSの評価で毎回使う)

### 1.2 `memo.unit_id`(列追加)

```sql
alter table memo add column unit_id uuid;

alter table memo
  add constraint memo_unit_fk
  foreign key (unit_id, subject_id) references unit (id, subject_id)
  on delete set null (unit_id);
```

- **nullable**。既存のメモはすべて`null`(単元未設定)になり、移行用のデータ更新は不要。単元の選択は任意なので、今後も`null`のメモは発生しうる
- `on delete set null (unit_id)`。単元を削除してもメモは残り、単元だけが未設定に戻る(要件の「メモ自体は削除されない」)
  - **列リストの指定は省略できない。** 複数列の外部キーに対する`on delete set null`は、既定では参照元の**全列**をnullにするため、`memo.subject_id`(`not null`)も巻き込んで単元削除が常に失敗する。列リスト付きの`set null`はPostgres 15以降で使える(ローカルは`supabase/config.toml`の`major_version = 17`、本番Supabaseも15以降)
- **複合外部キー`(unit_id, subject_id)`にする理由**: 単一列の`unit_id`参照だと「算数のメモに国語の単元が入る」組み合わせをDBが止められない。フロントは時間割で確定した科目の単元しか出さないが、`CLAUDE.md`の「ビジネスルールの最終防衛線はDB側」に従い、科目と単元の整合をDBで保証する
  - 複合外部キーは参照先に`unique (id, subject_id)`を要求するため、§1.1でそれを張っている(`id`は主キーなので実質的な制約の強さは変わらない)
  - `unit_id`が`null`の行はMATCH SIMPLE(既定)の下で外部キー検査の対象外になるため、単元未設定のメモは従来どおり保存できる
- RLSポリシーは変更しない。`memo`のポリシーは`student`→`class`経由で`teacher_id`を見ており、`unit_id`に依存しない。他教員の単元のidを推測して渡そうとしても、複合外部キー(自分の`subject`に属する単元しか`memo.subject_id`と一致しない)と`unit`側のRLSで弾かれる

索引は張らない(単元から逆引きする画面がないため。生徒別メモ一覧・所見生成はいずれも`student_id`で絞ってから単元で分類する)。

### 1.3 `export_teacher_data`の更新

`create or replace`で以下を加える。既存キーの名前・構造は変えない。

- `subjects[]`に`units`(その科目の単元の`id`・`name`・`createdAt`、`created_at`昇順)を追加
- `students[].memos[]`に`unitId`を追加

### 1.4 `updated_at`の自動更新トリガー

既存の`20260922190000_updated_at_triggers.sql`が`memo`・`life_memo`等に`set_updated_at`トリガーを張っている。`unit`も同じ関数を再利用してトリガーを張る(単元名を編集したときに`updated_at`が進むようにする)。

## 2. API設計

新しいHonoエンドポイントは追加しない。単元は秘密情報を含まないため、`CLAUDE.md`のアーキテクチャ原則どおり**すべてブラウザからの直接Supabaseアクセス**で扱う。

| 操作 | 方式 |
|---|---|
| 単元の一覧取得(科目ごと) | `supabase.from("unit").select(...)` |
| 単元の追加・名前編集・削除 | `insert` / `update` / `delete` |
| メモ保存時の単元の記録 | 既存の`memo`の`upsert`に`unit_id`を追加 |
| コマの単元の一括付け替え | `supabase.from("memo").update({ unit_id }).eq(...)`(単一テーブル・単一ステートメントなのでRPCは不要) |
| 所見案の生成 | 既存の`/api/comments/generate`を単元ごとに呼ぶ(エンドポイントの追加・変更はしない) |

### 2.1 単元ごとの材料メモの取得

`useSharedMemosForPeriod`の`memo`側クエリの埋め込みに`unit(name)`を加える。

```ts
.select("note_date, period, content, unit_id, subject!inner(name), unit(name)")
```

`unit`は`left join`(既定)のままにする。`!inner`にすると単元未設定のメモが落ちてしまい、従来の「まとめて生成」の材料が減ってしまうため。

単元ごとのグループ分けはサーバー側では行わず、取得済みの`PromptMemo[]`を`shared/`の純粋関数で分類する(§3.2)。期間内の共有メモは1生徒あたり高々数十件で、クエリを単元ごとに分けるほどの量ではない。

## 3. 型・スキーマ

### 3.1 zodスキーマ(`shared/schemas/index.ts`)

```ts
export const unitInputSchema = z.object({
  name: z.string().trim().min(1, "単元名を入力してください"),
});
export type UnitInput = z.infer<typeof unitInputSchema>;
```

`memoInputSchema`に`unitId: z.string().uuid().nullable().default(null)`を追加する。

所見の生成単位は新しい型として定義する(`CommentKind`とは独立。`life`では「単元ごと」を選べない制約はUI側で表現する)。

```ts
export const generationScopeSchema = z.enum(["whole", "per_unit"]);
export type GenerationScope = z.infer<typeof generationScopeSchema>;
```

### 3.2 `shared/`の純粋関数

| ファイル | 関数 | 役割 |
|---|---|---|
| `shared/group-memos-by-unit.ts` | `groupMemosByUnit(memos: PromptMemo[]): UnitMemoGroup[]` | 所見生成の材料を単元ごとに分ける。`unitName`が`null`/未指定のものは最後の「単元未設定」グループにまとめる。単元の並びは最初に現れた順(=メモの日付順) |
| `shared/group-memos-by-subject-unit.ts` | `groupMemosBySubjectAndUnit(memos: StudentMemoRow[]): SubjectGroup[]` | 生徒別メモ一覧の「教科別」表示用。教科ごとにまとめ、その教科に単元付きメモが1件以上あるときだけ単元の小グループに分ける |

どちらも副作用を持たない純粋関数として`shared/`に置き、単体テストを書く。

`UNIT_UNSET_LABEL = "単元未設定"`を`shared/group-memos-by-unit.ts`からexportし、UI・プロンプト組み立ての両方で使う(`LIFE_MEMO_LABEL`と同じ扱い)。

### 3.3 `prompt-builder`の拡張

```ts
export interface PromptMemo {
  noteDate: string;
  content: string;
  subjectName?: string;
  period?: number;
  /** 授業メモのみ。単元未設定・生活メモではnull */
  unitName?: string | null;
}
```

- `formatMemoLine`: 単元があるときは`- 2026-10-05 3時限 算数(分数のかけ算): 内容`、ないときは従来どおり`- 2026-10-05 3時限 算数: 内容`
- `buildPrompt`に`unitName?: string`を追加し、`{{unitName}}`を置換する。未指定時は他のプレースホルダーと同じく「指定なし」
- **既定のひな形3種に`{{unitName}}`は追加しない。** 既定ひな形を変えると、ひな形を保存していない教員の生成結果が変わってしまう。単元名はメモの各行で伝わるため、プレースホルダーは「必要な教員が自分のひな形に入れる」任意の拡張として提供する。プロンプトひな形編集画面の案内文に`{{unitName}}`を追記して存在を知らせる
- ひな形に含まれないプレースホルダーは何も置換しないだけでエラーにしない、という既存の設計はそのまま(`buildPrompt`のdocコメント参照)

## 4. 画面/UI設計

`docs/design/design-system.md`のトークンのみを使う。新しい色・フォントサイズ・余白は追加しない。新規の共通コンポーネントも作らず、既存の`Select`・`Button`・`Input`/`Textarea`・`Badge`・`SegmentedControl`・`InlineMessage`・`EmptyState`・`LoadingSpinner`・`ConfirmDialog`で構成する。

### 4.1 科目管理画面(`app/(main)/subjects/page.tsx`)

科目の一覧の各行を、クリックで開閉する折りたたみに変える(科目名・編集・削除のボタンは現状のまま残す)。開いた中に単元の小見出しと単元の一覧・追加フォームを置く。

```
科目管理
────────────────────────────────
▾ 算数                 [編集][削除]
    単元
    ・分数のかけ算       [編集][削除]
    ・円の面積           [編集][削除]
    [単元名        ] [追加]
▸ 国語                 [編集][削除]
▸ 理科                 [編集][削除]
```

- 開閉状態は画面のローカルstate。同時に開ける科目は1つ(`CollapsibleList`と同じ挙動に揃える)。既存の一覧は`<ul>`の素朴な実装なので、構造を変えずに開閉トリガーのボタンを追加する
- 単元が0件のときは「まだ単元が登録されていません」を小さく表示する
- 単元の削除は`ConfirmDialog`で確認する。本文で「この単元を使っているメモは単元未設定に戻ります(メモは削除されません)」と伝える
- 科目の削除確認ダイアログの本文に「登録済みの単元もまとめて削除されます」を追記する

単元の編集UIは、既存の科目名のインライン編集(`editingId`+`<input>`+チェック/×ボタン)と同じ形にする。

### 4.2 授業記録画面(`app/(main)/memos/record/RecordView.tsx`)

科目・クラス名の表示の隣に単元の`Select`を置く。

```
授業記録                                    [戻る]
日付 [2026-10-05]  時限 [3限 ▼]   算数 / 1年2組
単元 [ 分数のかけ算  ▼ ]
────────────────────────────────
▸ 佐藤 さくら  (1-2-04)  [入力済み]
▸ 鈴木 はると  (1-2-05)
```

- 選択肢は「選択しない」(値`""`)+その科目の単元。`Select`の`emptyMessage`で単元0件のときの案内を出す(`StudentMemosContent`の生徒`Select`と同じパターン)
- 初期値: そのコマの保存済みメモのうち、最初に見つかった`null`でない`unit_id`。保存済みメモに単元がなければ「選択しない」
- 単元を変更したときの挙動(要件):
  1. ローカルstateを即座に更新してプルダウンの表示を変える
  2. そのコマの保存済みメモ全件の`unit_id`を`update`する(0件なら何もしない)
  3. 成功したらメモのクエリを無効化する。失敗したらトーストでエラーを出し、プルダウンの表示をサーバー確定値に戻す
- 新規にメモを保存するときは、その時点で選択中の`unit_id`を一緒に`upsert`する
- 楽観的更新はしない(表示の巻き戻しは「保存されていないことを見せる」ための復帰であり、保存結果を先取りして表示するものではない)。自動リトライもしない

### 4.3 生徒別メモ一覧(`app/(main)/memos/students/[[...id]]/StudentMemosContent.tsx`)

- メモ1件の見出し: 単元があるとき`2026-10-05 ・ 3限 ・ 算数 ・ 分数のかけ算`、ないとき従来どおり`2026-10-05 ・ 3限 ・ 算数`。編集・削除ボタンの`aria-label`に使う`memoLabel()`も同じ規則で単元名を含める(操作対象が音声でも区別できるようにする)
- 「教科別」表示: `groupMemosBySubjectAndUnit`の結果で、教科の`<h2>`の下に単元の`<h3>`を置く。単元の小見出しは、その教科に単元付きメモが1件以上あるときだけ出す

```
算数
  分数のかけ算
    2026-10-05 ・ 3限 ・ 算数 ・ 分数のかけ算   [共有する] [編集][削除]
    ...
  円の面積
    ...
  単元未設定
    ...
国語
  2026-09-30 ・ 1限 ・ 国語                    [共有する] [編集][削除]
```

- `<h3>`は`design-system.md`の見出しトークンの範囲で`<h2>`より一段小さい指定にする(新しいサイズは追加しない)
- 生活メモ(`kind === "life"`)は単元を持たないため、「生活記録」の教科グループには単元の小見出しを作らない(上記の「単元付きメモが1件もなければ小見出しなし」の規則で自然にそうなる)

### 4.4 AI生成セクション(`components/comment/CommentAiAssist.tsx`)

生成単位の`SegmentedControl`を、既存の作成方法(`AIで直接生成`/`プロンプトを作成`)の切り替えの下に追加する。`kind === "life"`では生成単位の切り替え自体を描画しない。

```
[ AIで直接生成 | プロンプトを作成 ]
[ まとめて生成 | 単元ごとに生成 ]        ← 学習・総合のみ
学年 [5]   1単元あたりの目安文字数 [120]

「共有する」区分のメモが仮名化された状態で外部のAIサービスに送信されます
[すべての単元を生成]  (2/3 件生成しました)
────────────────────────────────
☑ 分数のかけ算  メモ4件                   [生成]
  ┌──────────────────────────┐
  │ 分数のかけ算の学習では…              │  112字
  └──────────────────────────┘
☐ 円の面積  メモ2件                       [生成]
  (まだ生成していません)
☐ 単元未設定  メモ1件                     [生成]

[選択した案を所見欄に反映]
```

- カードは`groupMemosByUnit`の結果の順(=メモの日付順。「単元未設定」は常に最後)
- 各カードの状態: 未生成 / 生成中 / 生成済み(`Textarea`で編集可・文字数表示) / 失敗(`InlineMessage`の`error`)
- 生成は単元ごとに`useGenerateComment`を呼ぶ。「すべての単元を生成」は**順次**実行する(並列にすると外部プロバイダのレート制限に当たりやすく、どこで失敗したか分かりにくい)。1件失敗しても残りは続行し、失敗したカードにだけエラーを出す
- 「選択した案を所見欄に反映」: チェック済みかつ本文が空でない案を、カードの並び順で`\n\n`区切りに連結して`onApply`に渡す。`creationMethod`は、採用した案に`direct_ai`由来が1件でもあれば`direct_ai`、それ以外は`prompt_copy`
- 「プロンプトを作成」モードの各カードには、その単元のプロンプトのコピーボタンと貼り付け用`Textarea`を置く。貼り付けた内容がその単元の案になる(`prompt_copy`由来)
- 目安文字数の入力欄のラベルは、生成単位に応じて「目安文字数」/「1単元あたりの目安文字数」に切り替える
- 材料0件(`memos.length === 0`)のときは、生成単位の切り替えより前に従来の`EmptyState`を出す(切り替えても何も生成できないため)
- 単元ごとの案は`useState`のみで保持し、DBにも`localStorage`にも保存しない(要件のスコープ外)。折りたたみを閉じる・クラスを切り替える・画面を離れると消える

カードの繰り返し部分は、`CommentAiAssist`が肥大化するため`components/comment/UnitCommentDraftCard.tsx`に切り出す。

### 4.5 プロンプトひな形編集画面(`app/(main)/settings/prompt-template/PromptTemplateForm.tsx`)

案内文のプレースホルダー一覧に`{{unitName}}`(単元名。「単元ごとに生成」のときに単元名へ置き換わる)を追記する。ひな形の初期値は変更しない。

## 5. エラーハンドリング

| 事象 | 扱い |
|---|---|
| 単元の追加・編集・削除の失敗 | トーストでエラー。入力内容は保持し、再操作できる状態を維持する(F13) |
| コマの単元の一括付け替えの失敗 | トーストでエラー。プルダウンの表示をサーバー確定値に戻す。メモの内容には影響しない |
| 科目の削除が`SUBJECT_IN_USE`で拒否 | 従来どおり`parseRpcError`でコードとメッセージに分け、メッセージをトーストに出す |
| 単元ごとの生成で1件失敗 | そのカードにエラーを表示し、残りの単元の生成は続行する。所見欄には何も反映しない |
| 単元ごとの生成で全件失敗 | 各カードにエラーが残る。「選択した案を所見欄に反映」は選択できる案がないため押せない |
| メモ保存時に他教員の単元idを渡した | 複合外部キー(`unit_id, subject_id`)違反でPostgresが拒否(23503)。フロントからは起きない経路だが、DB側で止まることを前提にする |

自動リトライは行わない(`CLAUDE.md`の方針)。「すべての単元を生成」の順次実行は、失敗した単元を自動で再試行はせず、教員がそのカードの「生成」を押し直す。

## 6. 影響を受ける既存テスト

| テスト | 影響 |
|---|---|
| `tests/db/schema.test.ts` | `unit`テーブル・`memo.unit_id`・複合外部キーの存在検証を追加 |
| `tests/db/rls.test.ts` | 他教員の単元を読めない・書けないケースを追加 |
| `tests/db/rpc-export.test.ts` | `subjects[].units`・`memos[].unitId`の検証を追加。**既存キーが従来どおり出力されることの検証は維持する** |
| `tests/db/rpc-subject.test.ts` | 科目削除時に単元がcascadeで消えること、メモがある科目は従来どおり拒否されることを追加 |
| `shared/prompt-builder.test.ts` | `formatMemoLine`の単元あり/なしの表記、`{{unitName}}`の置換、ひな形に`{{unitName}}`がない場合に従来どおりであることを追加 |
| `e2e/memos-record.spec.ts` | 単元の選択・付け替えのケースを追加 |
| `e2e/memos-students.spec.ts` | 教科別表示での単元の小見出しのケースを追加 |
| `e2e/subjects.spec.ts` | 単元の追加・編集・削除のケースを追加 |
| `e2e/comments-class.spec.ts` | 既存の「まとめて生成」の挙動が変わらないことの確認(生成単位の既定値) |

## 7. 既知の制約

- 単元を記録していない過去のメモに単元を後付けするには、授業記録画面でそのコマを開き直して単元を選ぶ必要がある(生徒別メモ一覧の編集では単元を変えられない)
- 同じコマで生徒ごとに違う単元を記録することはできない(単元はコマごとに1つ)。2単元を並行して扱った授業は、どちらか一方を選ぶか「選択しない」にする
- 「単元ごとに生成」の案は保存されない。画面を離れると消える
- 単元ごとの生成は単元数ぶんのAI呼び出しになるため、外部プロバイダの課金・レート制限の影響を受けやすい。カード単位で生成できるようにすることで、必要な単元だけ呼び出せるようにしている

## 8. ロールバック手順

本番適用前(ローカルのみ)なら、マイグレーションファイルを削除して`npx supabase db reset`で足りる。

本番適用後にコードだけ戻す場合は、`unit`テーブルと`memo.unit_id`が残るだけで旧コードはそのまま動作する(旧コードは`unit_id`を読み書きしないため)。`export_teacher_data`は新定義のままになるが、追加キーが増えているだけなのでエクスポートの利用に支障はない。

DBまで戻す必要がある場合は、次の内容の新規マイグレーションを追加して適用する(**`memo.unit_id`に記録済みの単元の対応は失われる**)。

```sql
alter table memo drop constraint memo_unit_fk;
alter table memo drop column unit_id;
drop table unit;
-- export_teacher_data を 20260922180000_general_shoken.sql の定義へ create or replace で戻す
```
