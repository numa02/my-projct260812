-- 所感管理画面(クラス単位一覧)の対象期間をクラスごとに記憶するためのカラムを追加する。
-- 既存クラスは未設定(null)のまま追加され、教員が画面で初めて入力したタイミングで値が入る。
-- classの既存RLSポリシー(teacher_id = auth.uid())がそのまま適用されるため、ポリシーの追加・変更は不要
alter table class add column comment_period_start_date date;
alter table class add column comment_period_end_date date;
