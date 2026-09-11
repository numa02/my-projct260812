-- 所感管理画面の再設計(所感の単一化)フェーズ1(拡張・後方互換)。
-- docs/features/comments/design.mdの2フェーズ(expand/contract)方針の1段階目。
-- フェーズ2(period_start_date/period_end_dateのdrop column)は新コードの本番安定稼働を
-- 確認してから日を空けて別マイグレーションとして適用する(CM-014)。

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
