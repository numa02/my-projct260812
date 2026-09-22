-- updated_atの自動更新(docs/bugs.md BUG-009)。
-- updated_atを持つ7テーブルすべてに default now() はあったが、更新時に値を進める仕組みが
-- どこにもなかった(pg_triggerで非内部トリガー0件を確認)。アプリ側もupdated_atを送っていないため、
-- upsertでの上書き・update後もinsert時点の値が残り続けていた。
-- 影響が見えていたのは所見管理画面の「最終更新」表示(学習・生活の所見)と、
-- エクスポートJSONのupdatedAt。
--
-- 修正方針: サーバー側(DB)で必ず更新されるようトリガーで統一する。
-- クライアントからupdated_atを送る方式は、端末の時計に依存するため採らない。
-- 既存データのupdated_atは遡って直せないため、そのまま残す(値としては
-- 「最後に保存した日時」ではなく「最初に保存した日時」のまま)。

create function set_updated_at () returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- PostgRESTのupsert(insert ... on conflict do update)もUPDATE文として発火する
create trigger memo_set_updated_at before update on memo
for each row
execute function set_updated_at ();

create trigger student_comment_set_updated_at before update on student_comment
for each row
execute function set_updated_at ();

create trigger student_life_comment_set_updated_at before update on student_life_comment
for each row
execute function set_updated_at ();

create trigger student_general_comment_set_updated_at before update on student_general_comment
for each row
execute function set_updated_at ();

create trigger life_memo_set_updated_at before update on life_memo
for each row
execute function set_updated_at ();

create trigger prompt_template_set_updated_at before update on prompt_template
for each row
execute function set_updated_at ();

create trigger ai_provider_setting_set_updated_at before update on ai_provider_setting
for each row
execute function set_updated_at ();
