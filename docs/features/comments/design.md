# 技術設計: 所見管理の再設計(期間の記憶・所見の単一化)

対応する要件は`docs/features/comments/requirements.md`を参照。3機能の中で唯一、不可逆なデータマイグレーションを伴う。

## データモデルの変更

### `student_comment`テーブル

変更前(`supabase/migrations/20260815132825_student_comment.sql`):

```sql
create table student_comment (
  id uuid primary key default gen_random_uuid (),
  student_id uuid not null references student (id) on delete cascade,
  period_start_date date not null,
  period_end_date date not null,
  content text not null,
  target_char_count int,
  creation_method comment_creation_method not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, period_start_date, period_end_date)
);
```

この変更は**2フェーズ(expand/contract)で行う**。理由: マイグレーション適用とVercelデプロイは別パイプラインで原子的に切り替わらないため、1回のマイグレーションで列削除・制約変更まで行うと、マイグレーション適用直後からデプロイ完了までの間、本番で稼働中の旧コード(`period_start_date`/`period_end_date`を参照する)が確実にエラーを返す(列が既に存在しないため)。2フェーズに分けることで、どの時点でも旧コード・新コードのどちらが稼働していてもDBスキーマと整合する状態を維持する。

**フェーズ1(拡張・後方互換、マイグレーション適用→デプロイの順序を問わない)**: `supabase/migrations/<timestamp>_student_comment_expand.sql`

```sql
-- 1. 生徒ごとに最新の更新日時の1件を残し、他を削除する(不可逆)。
--    updated_atが完全に同一の行が複数ある場合の決定性を保証するため、idを最終タイブレーカーに使う
delete from student_comment sc
where sc.id not in (
  select distinct on (student_id) id
  from student_comment
  order by student_id, updated_at desc, id desc
);

-- 2. period_start_date / period_end_date の NOT NULL 制約を外す(列自体はまだ残す)。
--    新コードはこの2列を送らずupsertするため、NOT NULLのままだと新コードのinsertが失敗する
alter table student_comment alter column period_start_date drop not null;
alter table student_comment alter column period_end_date drop not null;

-- 3. 生徒ごとに1件のみのユニーク制約を新規追加(旧複合ユニーク制約とは共存可能。
--    上記1のDELETE後は生徒ごとに1行しかないため両方の制約を同時に満たす)
alter table student_comment add constraint student_comment_student_id_key unique (student_id);
```

このフェーズ1適用後であれば、新コード(`onConflict: "student_id"`でupsertし、period列を送らない)・旧コード(period列を送ってupsertする、ただし当面は使われない)のどちらが稼働していても、スキーマ上は両立する。**新コードのデプロイはフェーズ1マイグレーションの後であればいつでもよく、フェーズ1適用直後に急いでデプロイする必要はない。**

**フェーズ2(縮小・破壊的、新コードのデプロイと本番動作確認が完了してから、日を空けて適用する)**: `supabase/migrations/<timestamp>_student_comment_contract.sql`

```sql
-- 旧複合ユニーク制約は無名(create table内でのunique指定)で作成されているため、
-- Postgresが自動生成した実際の制約名は63バイトの識別子上限で切り詰められており、
-- 元のDDLから単純に組み立てた名前とは一致しない。決め打ちで名前を書いてdropするのは危険なため、
-- pg_constraintから対象列の集合で動的に検索して削除する
do $$
declare
  v_constraint_name text;
begin
  select con.conname into v_constraint_name
  from pg_constraint con
  where con.conrelid = 'public.student_comment'::regclass
    and con.contype = 'u'
    and (
      select array_agg(a.attname::text order by a.attname)
      from unnest(con.conkey) k
      join pg_attribute a on a.attrelid = con.conrelid and a.attnum = k
    ) = array['period_end_date', 'period_start_date', 'student_id'];

  if v_constraint_name is not null then
    execute format('alter table student_comment drop constraint %I', v_constraint_name);
  else
    raise notice 'old composite unique constraint not found (already dropped?)';
  end if;
end $$;

alter table student_comment drop column period_start_date;
alter table student_comment drop column period_end_date;
```

フェーズ2を適用する前に、`select conname from pg_constraint where conrelid = 'public.student_comment'::regclass and contype = 'u';`を本番DBに対して実行し、上記の`do`ブロックが意図した制約を実際に見つけられるかを**適用前に確認する**こと(空振りしてもエラーにはならず`raise notice`で済むため気づきにくい)。

**注意(CM-014のローカル検証で判明)**: `a.attname`は`name`型であり、`array['period_end_date', ...]`(`text[]`)とは直接`=`比較できない(`operator does not exist: name[] = text[]`)。上記のように`a.attname::text`へキャストしてから`array_agg`すること。

マイグレーション適用後(フェーズ2完了後)のテーブル定義:

```sql
create table student_comment (
  id uuid primary key default gen_random_uuid (),
  student_id uuid not null references student (id) on delete cascade,
  content text not null,
  target_char_count int,
  creation_method comment_creation_method not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id)
);
```

RLSポリシー(`supabase/migrations/20260815132825_student_comment.sql`で定義済み)は変更しない。ポリシー本文は`student_id`にのみ依存しており、削除するカラムを参照していないため。

**性能に関する注記**: フェーズ1のDELETEは`student_id`・`updated_at`にインデックスがない場合、テーブル全体のスキャン+ソートになる。本番適用前に`explain analyze`で実行計画を確認すること。`create index concurrently`はトランザクションブロック内では実行できず、Supabase CLIのマイグレーションは1ファイル=1トランザクションとして適用されるため、インデックスを事前作成する場合は**フェーズ1のマイグレーションファイルとは別に、`supabase db push`とは別経路(`psql`等でトランザクション外から直接実行)で先に作成する**必要がある。同じマイグレーションファイルに`create index concurrently`を書いても適用時にエラーになる。DELETE後はデッドタプルが残るため、フェーズ1適用後に`vacuum analyze student_comment;`を明示的に実行する(autovacuumが自然に追いつくのを待たない)。

### `class`テーブル(対象期間の永続化先)

新規マイグレーション`supabase/migrations/<timestamp>_class_comment_period.sql`:

```sql
alter table class add column comment_period_start_date date;
alter table class add column comment_period_end_date date;
```

`comment_period_start_date`・`comment_period_end_date`はいずれもnullable(既存クラスは未設定の状態で追加され、教員が所見管理画面で対象期間を初めて入力したタイミングで値が入る)。既存の`class`テーブルのRLSポリシー(`teacher_id = auth.uid()`)がそのまま適用されるため、RLSポリシーの追加・変更は不要。

新規テーブル(例: `class_comment_period`)は作成しない。対象期間は`class`と1:1の関係であり、別テーブルに切り出す運用上の利点がないため(CLAUDE.mdの「楽観的な理由からモノレポ化・切り出しを行うこと」を避ける方針に整合)。

## API設計

新規Honoエンドポイントの追加はない。以下はすべて`supabase-js`からの直接呼び出し(CLAUDE.mdの単純CRUD方針)。

```
所見の取得: supabase.from("student_comment").select(...).eq("student_id", studentId).maybeSingle()
所見の保存: supabase.from("student_comment").upsert({ student_id, content, ... }, { onConflict: "student_id" })
対象期間の取得: supabase.from("class").select("comment_period_start_date, comment_period_end_date").eq("id", classId).single()
対象期間の保存: supabase.from("class").update({ comment_period_start_date, comment_period_end_date }).eq("id", classId)
```

`docs/design.md` §5.4(直接Supabaseアクセスのパターン)の「所見の保存について」の補足(L849)を、上記の`onConflict: "student_id"`に合わせて更新する。

## 画面/UI設計

`app/(main)/comments/class/[[...id]]/`配下の画面構成(クラス選択+対象期間+生徒一覧)自体は変更しない。変更点は以下の2つ。

1. 対象期間の入力欄の値の出所が、ローカルstateの初期値`""`から、選択中クラスの`comment_period_start_date`/`comment_period_end_date`(DB)に変わる
2. 各生徒の行から「過去の所見を見る」の折りたたみセクションを削除する

```
所見管理(変更後)
クラス選択 [1年1組 ▾]
対象期間   [2026-04-01] 〜 [2026-07-20]   ← 変更した瞬間に自動保存(クラスごと)

生徒一覧
  田中太郎   [所見入力欄(常時表示)]        [保存]
             ▶ AIで生成する                  ← 既存のまま
             (「過去の所見を見る」は削除)
  ...
```

## 既存コンポーネントの変更

### `hooks/useStudentComments.ts`

- `select`から`period_start_date, period_end_date`を除去
- `saveComment`の`upsert`の`onConflict`を`"student_id"`に変更し、呼び出し時の引数から`periodStartDate`/`periodEndDate`を除去
- クエリの`enabled`条件・キャッシュキー(`["student-comments", studentId]`)は変更不要(期間に依存しないキャッシュキーのままでよくなる)
- 戻り値の型`StudentCommentRow`から`periodStartDate`/`periodEndDate`を除去し、配列ではなく単一のオブジェクト(または`null`)を返す形に変更する(生徒ごとに1件のみのため)

### `components/comment/StudentCommentRow.tsx`

- L67-72の「対象期間との完全一致で`existing`/`history`に振り分ける」ロジックを削除。`useStudentComments`が返す単一の所見をそのまま初期値として使う
- L127の`historyOpen`のstate、およびL192-225の履歴セクション(「過去の所見を見る」ボタンとその中身)を削除
- `periodStartDate`/`periodEndDate`のpropsは維持する(`CommentAiAssist`へAI生成の集計範囲として渡すため)

### `components/comment/CommentAiAssist.tsx`

変更なし。`periodStartDate`/`periodEndDate`をpropsとして受け取り`useSharedMemosForPeriod`に渡す既存の実装は、渡し元の値の出所が変わるだけで、コンポーネント自体のロジックは影響を受けない。

### `app/(main)/comments/class/[[...id]]/ClassCommentsContent.tsx`

- L24-29の`useState("")`による対象期間の管理を、新規hook`useClassCommentPeriod(classId)`の呼び出しに置き換える
- 対象期間の入力欄の`onChange`ハンドラを、新規hookが返す`updatePeriod`mutationの呼び出しに変更する

### `shared/schemas/index.ts`

`commentSaveInputSchema`から`periodStartDate`/`periodEndDate`を削除する。

```ts
// 変更後
export const commentSaveInputSchema = z.object({
  content: z.string().min(1),
  targetCharCount: z.number().int().positive().optional(),
  creationMethod: z.enum(["direct_ai", "prompt_copy", "manual"]),
});
```

## 新規コンポーネント

なし。

## 新規ファイル(フック)

### `hooks/useClassCommentPeriod.ts`

```ts
export function useClassCommentPeriod(classId: string | null) {
  // supabase.from("class").select("comment_period_start_date, comment_period_end_date")
  //   .eq("id", classId).single() でクエリキー ["class-comment-period", classId]

  // updatePeriod: supabase.from("class").update({ comment_period_start_date, comment_period_end_date })
  //   .eq("id", classId) を呼ぶmutation。onChangeのたびに即座にmutateする(デバウンスなし。
  //   date inputは離散的な値変更イベントであり、テキスト入力のような連続イベントではないため)。
  //   開始日・終了日はまとめて1回のupdate呼び出しで送る(片方ずつ別々に送ると、後続の呼び出しが
  //   先行の呼び出しより先に完了した場合に古い値で上書きする恐れがあるため)

  // CLAUDE.mdの「楽観的更新は行わない。useMutation成功後にのみキャッシュ・画面を更新する」方針に
  // 従う。入力欄の表示値はmutation成功後のキャッシュ値をそのまま表示する(react-queryの
  // invalidateQueries後の再取得値)。mutation実行中は入力欄をdisabledにはしない(教員の入力を
  // 妨げないため)が、mutation失敗時は直前にサーバーへの保存が確認できている値に表示を戻し、
  // 「対象期間の保存に失敗しました。もう一度入力してください」を表示する。教員が入力した値を
  // 無条件に保持し続ける(＝サーバー未確認のまま表示し続ける)実装にはしない
  return { periodStartDate, periodEndDate, updatePeriod, isLoading };
}
```

## エラーハンドリング

| エラー種別 | 発生箇所 | 表示方法 |
|---|---|---|
| 対象期間の自動保存失敗 | `useClassCommentPeriod`の`updatePeriod`mutation | `useToast`で「対象期間の保存に失敗しました」を表示し、入力欄の表示値は直前にサーバーへの保存が確認できている値に戻す(サーバー未確認の値を表示し続けない。CLAUDE.mdの楽観的更新禁止方針に従う) |
| 対象期間の開始日が終了日より後 | `ClassCommentsContent.tsx`(クライアント側バリデーション) | 終了日の入力欄に「開始日は終了日より前の日付にしてください」というインラインエラーを表示し、自動保存自体を実行しない(不正な範囲をDBに保存しない)。既存の`Input`コンポーネントの`error`propを使う(他画面の入力バリデーションと同じパターン) |
| 所見の保存失敗 | `useStudentComments`の`saveComment`mutation | 既存のF13方針のまま変更なし(エラー表示、直前の状態を維持) |
| AI生成時のメモ取得・生成失敗 | `useSharedMemosForPeriod`、`useGenerateComment` | 変更なし(既存のF9のエラーハンドリングをそのまま維持) |

## 影響を受ける既存テスト

以下は本機能のリリースにより変更が必要で、対応しないままフェーズ2マイグレーションを適用するとテストが失敗する。

| ファイル | 必要な変更 |
|---|---|
| `tests/db/rls.test.ts` L311-370 | `student_comment`への`insert`呼び出しから`period_start_date`/`period_end_date`を除去する。2件目のinsert(`teacherB`によるなりすまし)は、現状「別の期間を指定してユニーク制約を回避しRLSのみで弾かれることを確認する」意図で書かれているが、ユニーク制約が`student_id`のみになった後は期間を変える意味がなくなる。RLSが制約チェックより先に評価されブロックすることを確認する意図はそのまま成立するため、期間関連のフィールドを削除するだけでテスト自体は成立する |
| `e2e/comments-class.spec.ts` | 「履歴閲覧」に関するケースを削除。「対象期間切替」のケースは自動保存・クラスごとの記憶を検証する内容に書き換える |
| `shared/schemas/index.test.ts` L45-46, L55-56 | `commentSaveInputSchema`のテストから`periodStartDate`/`periodEndDate`を除去する |
| `e2e/golden-path.spec.ts` | 所見生成→保存のステップを含む場合、対象期間の入力方法が変わっていないか確認する(クラスごとの自動保存に変わるため、初回訪問時は空欄から入力する手順になる) |

**追記(CM-014実装時に判明、上記表には未掲載だった項目)**: 以下はフェーズ1適用時点ではまだ動作するが、フェーズ2(列削除)を適用すると影響が出るため、フェーズ2と同じマイグレーション内(またはその直前)で対応する必要がある。

| ファイル | 必要な変更 |
|---|---|
| `export_teacher_data()` RPC(`supabase/migrations/20260815133309_rpc_export_teacher_data.sql`) | `comments`配列の各要素が`sc.period_start_date`/`sc.period_end_date`を直接参照している。列削除後は関数呼び出し自体がエラーになるため、フェーズ2マイグレーション内で`create or replace function`により参照を除去した定義へ差し替える(`supabase/migrations/20260918013828_student_comment_contract.sql`) |
| `tests/db/schema.test.ts`(`student_comment`のdescribeブロック、T-014) | 旧複合ユニーク制約(`student_id,period_start_date,period_end_date`)でのupsertを検証していたテストを、`unique(student_id)`でのupsert検証に置き換える |
| `tests/db/rpc-export.test.ts` | `student_comment`への`insert`フィクスチャから`period_start_date`/`period_end_date`を除去する |

## ロールバック手順

本機能はコードのロールバックとデータのロールバックを明確に分けて考える必要がある。2フェーズマイグレーション(上記データモデルの変更を参照)により、**フェーズ1適用後・フェーズ2適用前であれば、コードのロールバックだけで完全に復旧できる**(period列はNOT NULLが外れているだけでまだ存在し、データも削除されていないため)。データの不可逆な削除はフェーズ1のDELETE文の時点で発生するため、実際にリスクがあるのはフェーズ1適用時点である。

### コードのロールバック

1. Vercelのデプロイを、本機能追加前のバージョンに戻す
2. フェーズ2(カラム削除)適用後にコードだけロールバックすると、旧コードがperiod列を参照して失敗する。**フェーズ2はフェーズ1が本番で問題なく稼働していることを確認してから適用し、フェーズ2適用後はコードロールバックの選択肢がなくなる(データロールバックのみ)ことを踏まえて適用タイミングを決める**

### データのロールバック(バックアップからの復元)

`supabase db dump`にはテーブル単位で絞り込むフラグが存在しない(`--exclude`による除外指定のみ)。`student_comment`だけを対象にしたバックアップ・リストアには、Supabaseダッシュボード(Project Settings → Database → Connection string)から直接接続文字列を取得し、標準の`pg_dump`/`psql`を使う。

```bash
# リリース前(フェーズ1のDELETE実行前)に取得するバックアップ。
# SUPABASE_DB_URL はダッシュボードから取得した接続文字列(URLエンコード済み)を環境変数として設定しておく
pg_dump "$SUPABASE_DB_URL" -t public.student_comment --data-only -f student_comment_backup.sql

# 復元が必要になった場合
# 1. student_comment テーブルを一旦truncateする(バックアップの内容とリストア先の既存データが
#    重複するとINSERTが主キー衝突で失敗するため)
psql "$SUPABASE_DB_URL" -c "truncate table student_comment;"
# 2. バックアップをリストアする(period_start_date/period_end_date列がまだ存在する
#    フェーズ1適用直後〜フェーズ2適用前の間でのみこのバックアップはそのまま復元可能。
#    フェーズ2適用後に復元する場合は、先にフェーズ2を巻き戻すマイグレーションで列を復元してから行う)
psql "$SUPABASE_DB_URL" -f student_comment_backup.sql
```

**この手順は本番適用前に、ローカルのSupabaseスタック(`supabase start`)に対して実際にバックアップ→データ変更→リストアの一連を実行し、動作を検証すること(CM-001でリハーサル済み。同一生徒に複数期間のテストデータを投入した状態でバックアップ→truncate→リストアを行い、件数・内容(`md5(string_agg(content,...))`)が完全一致することを確認した)。**

**注意(CM-001リハーサルで判明): `pg_dump`/`psql`のクライアントバージョンがサーバーのPostgresバージョンより古いと`pg_dump: error: server version: 17.6; pg_dump version: 14.7`のようなエラーで即座に失敗する。** Homebrewで`brew install postgresql`しただけでは古いバージョン(例: 14.x)が入ることがあり、Supabaseのサーバー(2026-09時点でPostgres 17.6)と噛み合わない。本番バックアップ実行時は、事前に`pg_dump --version`で手元のクライアントバージョンがサーバー以上であることを確認すること。ローカル検証時にクライアントバージョンを揃えられない場合は、`docker exec <supabase_db_のコンテナ名> pg_dump -U postgres ...`のようにSupabaseのPostgresコンテナ内蔵の`pg_dump`/`psql`(サーバーと同一バージョン)を使う代替手段がある(`docker cp`でホストにファイルを持ち出す)。

## 段階リリース戦略

本アプリにはフィーチャーフラグの仕組みが存在しないため、機能単位の段階公開(一部ユーザーのみ先行公開等)は行わない。代わりに、上記の2フェーズマイグレーションに沿ってリリース手順そのものを段階化し、各ステップの間に本番動作確認を挟む。

1. **事前確認**: 本番DBの`student_comment`テーブルの総件数、生徒あたりの最大所見件数、`(student_id, updated_at)`のインデックス有無を確認する
2. **バックアップ取得**: 上記の`pg_dump`コマンドで`student_comment`のバックアップを取得し、ローカル環境でリストアを検証する
3. **`class`カラム追加を適用**: `alter table class add column comment_period_start_date / comment_period_end_date`のみを含むマイグレーションを適用する(既存カラムへの影響がなく、最もリスクが低いため最初に適用する)
4. **フェーズ1(拡張)マイグレーションを適用**: DELETE・NOT NULL解除・新ユニーク制約追加を適用する。この時点ではまだ`period_start_date`/`period_end_date`カラムは存在するため、旧コードは引き続き問題なく動作する
5. **新コードをデプロイ**: フェーズ1適用後であればいつでもよい。デプロイ後、所見の保存・表示、対象期間の自動保存・復元、AI生成が本番環境で正常に動作することを確認する
6. **新コードの安定稼働を数日程度確認**: この間、問題があればコードのロールバックのみで復旧できる(フェーズ2未適用のため)
7. **フェーズ2(縮小)マイグレーションを適用**: 安定稼働を確認できてから、`period_start_date`/`period_end_date`カラムを削除する。この時点以降はコードロールバックだけでは復旧できなくなる
