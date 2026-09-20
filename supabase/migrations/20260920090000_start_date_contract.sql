-- 起算日の廃止(docs/features/start-date-removal/)フェーズ2(縮小・破壊的)。
-- フェーズ1(SD-001〜SD-007、PR #9)でアプリ側は起算日を一切参照しなくなっている。
-- 適用前に、削除対象を参照するPostgres関数が update_timetable_start_date 以外に
-- 残っていないことを `git grep "start_date"` で確認済み(export_teacher_data は参照していない)。

-- 1. 起算日を更新するRPC。アプリからは既に呼び出していない
drop function if exists update_timetable_start_date (date, boolean);

-- 2. 起算日の列。この時点以降、コードロールバックだけでは復旧できない
--    (docs/features/start-date-removal/design.md「ロールバック手順」参照)
alter table teacher_profile
drop column start_date;
