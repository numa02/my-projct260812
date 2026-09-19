# 影響範囲調査: 所見管理の再設計(期間の記憶・データモデル変更)

調査日: 2026-09-10。実装前の読み取り専用調査。要件は本調査時点でユーザーと合意済み:
- 所見データモデルから「期間」の概念を廃止し、生徒ごとに最新の所見1件のみ保持(履歴機能F11を廃止)
- 既存の複数期間データは、生徒ごとに最も新しい更新日時の1件を残して他は削除(マイグレーション)
- 対象期間(開始日・終了日)の入力欄はUIに残すが、用途はAI生成時の集計対象メモの絞り込みのみ
- 対象期間はクラスごとに個別にDB保存し、変更した瞬間に自動保存
- 実行前にDB手動バックアップを取る方針で合意済み

3機能の中で最もリスクが高い(破壊的マイグレーションを伴う)。

## 1. 変更・追加が必要なファイル一覧

| ファイル | 種別 | 変更概要 |
|---|---|---|
| `supabase/migrations/<timestamp>_student_comment_drop_period.sql`(仮) | 新規 | ①生徒ごとに最新1件を残して重複行を削除するデータ移行 ②ユニーク制約を`(student_id, period_start_date, period_end_date)`→`(student_id)`に変更 ③`period_start_date`/`period_end_date`カラムの扱いを決定(要確認、後述) |
| `supabase/migrations/<timestamp>_class_comment_period.sql`(仮) | 新規 | `class`テーブルに対象期間を保持するカラム追加(例: `comment_period_start_date`, `comment_period_end_date`、どちらもnullable)。クラスごとに個別記憶するため |
| `shared/schemas/index.ts` L73-79 `commentSaveInputSchema` | 変更 | `periodStartDate`/`periodEndDate`を必須項目から除去(保存自体には使わなくなるため) |
| `hooks/useStudentComments.ts`(全78行) | 変更 | クエリの`select`・`upsert`の`onConflict`から期間列を除去。関数名・コメントの「F11向け」表記も見直しが必要(F11自体を廃止するため) |
| `components/comment/StudentCommentRow.tsx`(全体、特にL67-72の完全一致判定、L127のhistoryOpen、L192-225の履歴セクション) | 変更 | 完全一致による`existing`/`history`の振り分けロジックを削除し、生徒ごとの1件をそのまま表示する形に単純化。履歴表示セクション(折りたたみ、L192-225)を削除 |
| `components/comment/CommentAiAssist.tsx` | 変更なし(想定) | `periodStartDate`/`periodEndDate`はAI生成の集計対象決定にのみ使うため、props自体は残る。渡し元が変わるだけ |
| `app/(main)/comments/class/[[...id]]/ClassCommentsContent.tsx` L24-29 | 変更 | `useState("")`での期間管理から、クラスごとのDB保存値を読み込み・変更時に自動保存するロジックに置き換え(新規hook`useClassCommentPeriod`等が必要になる可能性) |
| `hooks/useClassCommentPeriod.ts`(仮) | 新規 | クラスごとの対象期間の取得・自動保存(直接`supabase-js`でclassテーブルをupdate、CLAUDE.mdの単純CRUD方針に従う) |
| `docs/requirements.md` F11関連の記述 | 変更 | 履歴閲覧機能の説明を削除・修正 |
| `docs/design/screens.md` 画面12 | 変更 | 所見管理画面の仕様(履歴セクション記述)を修正 |
| `docs/design.md` データモデル・ルーティング表 | 変更 | `student_comment`のスキーマ記述を修正 |
| `docs/features/comments/test-cases.md` | 変更 | 履歴関連のテストケース削除、期間自動保存のテストケース追加 |
| `e2e/comments-class.spec.ts` | 変更 | 履歴閲覧のE2Eケース(存在する場合)削除、期間記憶のE2Eケース追加 |
| `tests/db/rls.test.ts` L311-370 | 変更 | `student_comment`のinsert呼び出しから期間列を除去(またはスキーマ変更に合わせて調整) |

## 2. 影響を受ける既存機能

- **所見管理画面(F9〜F11)全体**: 現状は「対象期間を指定→その期間の所見を表示・編集、他の期間は履歴として折りたたみ表示」という構成。今回の変更で「生徒ごとに所見は常に1件」という単純な構成に変わるため、**画面のメンタルモデル自体が変わる**。単なるバグ修正ではなく仕様変更である点に注意
- **F11(過去の所見を見る)機能自体が廃止される**。この機能を使っていた教員がいた場合、「過去の学期の所見を参照しながら今学期の所見を書く」というユースケースができなくなる(要確認: この影響を教員側に説明する必要があるか)
- **AI生成(F9)**: 変更なし。対象期間はメモの集計範囲としてこれまで通り機能する
- **プロンプトコピー運用(F10)**: 変更なし(同上)
- **生徒名簿画面からの遷移**: 現状「対象クラス+対象生徒のハイライト付きで遷移」という導線があるが、期間指定は伴わないため影響なし

## 3. データモデルへの変更(最重要)

### `student_comment`テーブル

現状(`supabase/migrations/20260815132825_student_comment.sql`):
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

変更が必要な点:
1. **ユニーク制約**を`(student_id, period_start_date, period_end_date)`から`(student_id)`のみに変更
2. **要確認: `period_start_date`/`period_end_date`カラムをどうするか**、3つの選択肢がある
   - (a) カラムごと削除する(履歴として保持する意味がなくなるため)
   - (b) カラムは残すが`not null`制約を外し、「最後にこの所見を生成/更新したときの対象期間」という参考情報として残す
   - (c) カラムは残して`not null`のまま、保存時に呼び出し元(フロント)が常に現在の対象期間を渡す形にする(実質的に意味を持たない値になる)
   - 要件定義では「保存される所見の特定には使わない」とだけ決まっており、カラム自体の要否は未確定
3. **データ移行**: 生徒ごとに`updated_at`が最も新しい1行を残し、他の行を削除する。SQLの概形:
   ```sql
   delete from student_comment sc
   where sc.id not in (
     select distinct on (student_id) id
     from student_comment
     order by student_id, updated_at desc
   );
   ```
   このDELETEは**不可逆**(合意済みの通り、実行前に手動バックアップが前提)

### `class`テーブル(対象期間の永続化先)

現状(`supabase/migrations/20260815132800_class.sql`)には対象期間を保存するカラムがない。クラスごとに個別記憶するため、`class`テーブルに2カラム追加(例: `comment_period_start_date date`, `comment_period_end_date date`、いずれもnullable)するのが最も単純。既存の`class`のRLSポリシー(`teacher_id = auth.uid()`)がそのまま適用できるため、新規テーブルを作るより変更コストが低い。

要確認: 「所見の対象期間」という所見機能固有の関心事を`class`テーブル(クラス管理の中核テーブル)に持たせることの是非。設計上の見た目のきれいさを重視するなら別テーブル(`class_comment_period`等)を切る案もあるが、CLAUDE.mdの「楽観的なモノレポ化・過剰な切り出しをしない」という方針に照らすと、カラム追加の方が本アプリの規模には合う可能性がある。

## 4. APIへの変更

**Honoエンドポイントの変更は不要**(`/api/comments/generate`は`prompt`を受け取るだけで、DBスキーマの変更と無関係)。

既存の直接`supabase-js`呼び出し(`hooks/useStudentComments.ts`)の`upsert`呼び出しの`onConflict`パラメータを変更する必要がある。これは「単純CRUD」の範囲内(CLAUDE.mdの方針通りRPC化は不要)。

対象期間の自動保存(クラスごと)も同様に、直接`supabase-js`の`update`で完結できる見込み(RPC不要)。

## 5. 影響を受ける既存テスト

- **`tests/db/rls.test.ts` L311-370**: `student_comment`のinsert呼び出しが`period_start_date`/`period_end_date`を明示的に渡しているため、カラムを削除する場合(上記3の選択肢a)は**このテストが失敗する**。カラムを残す場合(b, c)でも、2件目のinsert(`teacherB`によるなりすまし)が「別の期間を指定することでユニーク制約を回避してRLSのみで弾かれることを確認する」という意図で書かれているため、**ユニーク制約が`student_id`のみになると、このテストの意図(RLSが先に弾くことの確認)が成立するか再検証が必要**
- **`e2e/comments-class.spec.ts`**: 「履歴閲覧」に関するE2Eケース(9ケースのうち該当するもの)の削除・書き換えが必要。「対象期間切替」のケースも自動保存の仕様に合わせて書き換えが必要
- **`e2e/golden-path.spec.ts`**: 所見関連のステップ(所見生成→保存)を含むため、期間入力の扱いが変わる場合は調整が必要
- **`shared/schemas/index.test.ts` L45,55**: `commentSaveInputSchema`のテストで`periodStartDate`/`periodEndDate`を使っているため、スキーマ変更に合わせて修正が必要

## 6. UI/画面への影響

- **所見管理画面(`/comments/class/[[...id]]`)**: 履歴閲覧の折りたたみセクション(「過去の所見を見る」)を削除。画面がシンプルになる方向の変更
- **新規画面・新規ルートは不要**
- 対象期間の入力欄自体は残るが、「これは所見の保存内容とは無関係で、AI生成時の集計範囲を指定するだけのもの」という位置づけが教員に伝わるよう、ラベルや説明文の見直しが必要になる可能性がある(要確認: UI文言の再検討)

## 7. 本番運用への影響

- **ダウンタイム**: Supabase(Postgres)のマイグレーションはオンライン実行可能。生徒数×教員数の規模(小〜中規模)であれば、DELETE・制約変更ともにロック時間は軽微と見込まれるが、**実測はしていないため要確認**
- **データマイグレーションの所要時間**: 現在の総所見データ件数が不明(要確認: 本番DBの`student_comment`件数を事前に確認しておくことを推奨)。件数が少なければ数秒〜数十秒程度と見込まれる
- **ロールバック手順**: **コードのロールバックは可能だが、削除された過去の期間別所見データはバックアップなしでは復元不可能**。ロールバック手順としては、(1)コードを前バージョンに戻す、(2)バックアップからDELETEされたデータを復元する、の2段階が必要になる。バックアップ取得は合意済みなので、復元手順(具体的なリストア方法)もあわせて事前に確認しておくことを推奨

## 8. リスクと懸念点

- **最大のリスクはデータの不可逆な削除**。バックアップ方針は合意済みだが、リストア手順の検証(実際に復元できるかのリハーサル)まで行うかどうかは未確認
- **`period_start_date`/`period_end_date`カラムの扱い(上記3の3択)が未決定**。実装前に決める必要がある
- **F11(履歴閲覧)廃止のユーザー影響**: 現在すでにこの機能を使って複数期間の所見を管理している教員がいた場合、体験が変わる(過去の所見を見返せなくなる)。今回のユーザー自身は明確に「不要」と判断しているが、他の利用教員がいる場合は影響範囲の説明が必要になる可能性がある(要確認: 現在の利用者が本人のみか、他の教員も本番環境を使っているか)
- **RLSテストの意図の再検証が必要**(上記5参照)。ユニーク制約の変更がRLSテストの前提を崩す可能性がある
- **`class`テーブルへのカラム追加 vs 新規テーブル**の設計判断が未確定(上記3参照)
