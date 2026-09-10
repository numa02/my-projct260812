# 技術設計: 科目の標準セット投入

対応する要件は`docs/features/subjects/requirements.md`を参照。

## データモデルの変更

新規テーブル・新規カラムはない。新規のPostgres関数(RPC)を1つ追加する。

```sql
-- supabase/migrations/<timestamp>_rpc_seed_standard_subjects.sql

create function seed_standard_subjects (p_school_level text) returns jsonb
language plpgsql as $$
declare
  v_teacher_id uuid := auth.uid();
  v_names text[];
  v_inserted text[] := '{}';
  v_name text;
begin
  -- teacher_idごとのトランザクションスコープのadvisory lockを取り、この関数の同時実行を
  -- 教員単位で直列化する。subject.nameにユニーク制約がない(重複許可の既存方針)ため、
  -- 「存在確認→insert」だけではREAD COMMITTED下で2つの呼び出しが同時に存在確認を通過し、
  -- 同じ科目名を二重登録しうる(ボタン連打・複数タブ等)。この対策として直列化する
  perform pg_advisory_xact_lock(hashtext(v_teacher_id::text));

  if p_school_level = 'elementary' then
    v_names := array['国語', '算数', '理科', '社会', '英語', '図画工作', '体育', '音楽', '総合', '学活'];
  elsif p_school_level = 'middle' then
    v_names := array['国語', '数学', '理科', '社会', '英語', '美術', '技術・家庭', '保健体育', '音楽', '総合', '学活'];
  else
    raise exception 'INVALID_SCHOOL_LEVEL: 学校区分の指定が不正です';
  end if;

  foreach v_name in array v_names loop
    if not exists (
      select 1 from subject where teacher_id = v_teacher_id and name = v_name
    ) then
      insert into subject (teacher_id, name) values (v_teacher_id, v_name);
      v_inserted := array_append(v_inserted, v_name);
    end if;
  end loop;

  return jsonb_build_object('inserted', to_jsonb(v_inserted));
end;
$$;
```

Postgres関数は`SECURITY INVOKER`(デフォルト)のまま実装し、`teacher_id`は`auth.uid()`から取得する(CLAUDE.mdの方針通り、クライアントから`teacher_id`を信頼して受け取らない)。関数全体が1トランザクションとして実行されるため、途中で失敗した場合は挿入済みの行も含めてロールバックされる(部分適用は発生しない)。

`docs/design.md` §5.2(Postgres RPC関数一覧)に以下の行を追加する。

| 関数 | 呼び出し元操作 | 対応要件 |
|---|---|---|
| `seed_standard_subjects(school_level)` | 標準科目セット投入(サインアップ時・科目管理画面) | F3 |

## API設計

新規Honoエンドポイントの追加はない。`supabase.rpc("seed_standard_subjects", { p_school_level })`をフロントエンドから直接呼ぶ。

## 画面/UI設計

### サインアップ画面(`app/(auth)/signup/page.tsx`)

既存のメールアドレス・パスワード入力の下に、学校区分の選択欄を追加する。

```
サインアップ
メールアドレス [_______________]
パスワード     [_______________]
学校区分(任意) [選択しない ▾]   ← 新規。選択肢: 選択しない(既定)/小学校/中学校
[サインアップ]
```

### 科目管理画面(`app/(main)/subjects/page.tsx`)

既存の科目一覧・1件ずつの登録フォームの上に、標準セット投入の導線を追加する。

```
科目管理
▶ 標準科目セットを追加            ← 新規。折りたたみ、初期状態は閉
  (開くと以下が表示される)
  学校区分 [小学校 ▾]             ← 選択肢: 小学校/中学校(既定は小学校)
  [追加する]ボタン

科目名 [_______________] [登録]   ← 既存
科目一覧                          ← 既存
```

## 既存コンポーネントの変更

- `app/(auth)/signup/page.tsx`: `signupInputSchema`に`schoolLevel: z.enum(["elementary", "middle"]).optional()`を追加し、他のフィールド(email, password)と同じく`register()`経由でreact-hook-formの管理下に置く(このフォームは他の全フィールドがreact-hook-form管理であり、学校区分だけ素の`useState`で別管理すると状態管理パターンが1フォーム内で混在するため統一する)。`onSubmit`内で、`supabase.auth.signUp()`成功後に`data.schoolLevel`が指定されていれば`supabase.rpc("seed_standard_subjects", { p_school_level: data.schoolLevel })`を呼ぶ。このRPC呼び出しの成否に関わらず、既存の`router.push("/")`によるトップページ遷移は実行する
- `app/(main)/subjects/page.tsx`: 折りたたみセクション(開閉状態の`useState<boolean>`)と学校区分選択・実行ボタンを追加。「追加する」ボタンは`loading={seedStandardSubjects.isPending}`を指定し、他のフォーム(`AiProviderSettingsForm`等)と同じく実行中は連打できないようにする(advisory lockによるサーバー側の直列化に加えて、クライアント側でも二重送信自体を防ぐ)
- `hooks/useSubjects.ts`: `seedStandardSubjects`mutationを追加。成功時は既存の`subjects`クエリを`invalidateQueries`する

## 新規コンポーネント

なし。既存の`Select`・`Button`・`InlineMessage`(いずれも`components/ui/`)を組み合わせて実装する。

## エラーハンドリング

| エラー種別 | 発生箇所 | 表示方法 |
|---|---|---|
| サインアップ時のRPC呼び出し失敗 | `app/(auth)/signup/page.tsx` | サインアップ自体は成功として扱い、遷移先の画面(トップページ)で`useToast`により「標準科目の登録に失敗しました。科目管理画面から再度お試しください」を表示する |
| 科目管理画面からのRPC呼び出し失敗 | `app/(main)/subjects/page.tsx` | `useToast`で「標準科目セットの追加に失敗しました」を表示する。画面が保持する一時状態(選択中の学校区分)はクリアせず、教員がそのまま再度「追加する」を押し直せる状態を維持する(既存のF13方針:自動リトライなし) |
| `p_school_level`に想定外の値が渡る | `seed_standard_subjects`RPC | `INVALID_SCHOOL_LEVEL: 学校区分の指定が不正です`を例外として返す。フロントエンドは学校区分をSelectの固定選択肢からのみ取得するため、通常はこの経路に到達しない(防御的なチェックとして関数側に持たせる) |

## ロールバック手順

1. Vercelのデプロイを、本機能追加前のバージョンに戻す
2. 必要であれば、`seed_standard_subjects`関数を削除するマイグレーションを追加で適用する(関数が存在するだけでは実害がないため、必須ではない)
3. 既存の科目データへの変更を伴わないため、データの復旧作業は不要

## 段階リリース戦略

本アプリにはフィーチャーフラグの仕組みが存在しない。リスクが低い機能であるため、段階リリースは行わず、通常のデプロイで一括リリースする。
