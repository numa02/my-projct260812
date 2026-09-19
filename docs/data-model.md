# データモデル(ER図)

`docs/requirements.md`から起こしたデータモデル案。要件が構造を明示していない箇所は、実装可能な形に補うために設計上の仮定を置いている。仮定を置いた箇所、および要件同士で整合しない箇所は、図の下の「要件と矛盾する部分・決まっていない関係性」にまとめた。

## ER図

```mermaid
erDiagram
    TEACHER ||--o{ CLASS : creates
    TEACHER ||--o{ CLASS_NUMBER_COUNTER : owns
    TEACHER ||--o{ SUBJECT : owns
    TEACHER ||--o{ TIMETABLE_MASTER_SLOT : owns
    TEACHER ||--o{ WEEKLY_SUBJECT_OVERRIDE : owns
    TEACHER ||--o{ WEEKLY_CLASS_OVERRIDE : owns
    TEACHER ||--o| AI_PROVIDER_SETTING : configures
    TEACHER ||--o| PROMPT_TEMPLATE : customizes
    CLASS ||--o{ STUDENT : contains
    CLASS |o--o{ TIMETABLE_MASTER_SLOT : "assigned to (nullable)"
    CLASS ||--o{ WEEKLY_CLASS_OVERRIDE : "assigned to"
    SUBJECT |o--o{ TIMETABLE_MASTER_SLOT : "assigned to (nullable)"
    SUBJECT |o--o{ WEEKLY_SUBJECT_OVERRIDE : "assigned to (nullable)"
    SUBJECT ||--o{ MEMO : "assigned to"
    STUDENT ||--o{ MEMO : "has (cascade delete)"
    STUDENT ||--o{ STUDENT_COMMENT : "has (cascade delete)"
    STUDENT ||--o{ LIFE_MEMO : "has (cascade delete)"
    STUDENT ||--o| STUDENT_LIFE_COMMENT : "has (cascade delete)"

    TEACHER {
        uuid id PK "Supabase AuthのユーザーIDと同一"
        string email "概念上の項目。実テーブルにはemail列を複製しない(下記注記参照)"
        date start_date "廃止予定(旧・起算日)。アプリからは参照しない。start-date-removalフェーズ2で削除"
        datetime created_at
    }

    CLASS {
        uuid id PK
        uuid teacher_id FK
        string grade "学年(1〜6等)または「特支」"
        int group_number "学年区分内の連番。CLASS_NUMBER_COUNTERから払い出す。学年編集時は再採番"
        string display_name "クラス表示名"
        date comment_period_start_date "所見管理画面の対象期間(開始日)。nullable。2026-09時点で未実装、docs/features/comments/design.md参照"
        date comment_period_end_date "所見管理画面の対象期間(終了日)。nullable。同上"
        datetime created_at
    }

    CLASS_NUMBER_COUNTER {
        uuid id PK
        uuid teacher_id FK
        string grade_group "学年区分(通常の学年値または「特支」)"
        int last_issued_number "この区分でこれまでに払い出した最大の組番号。クラスを物理削除しても減らさない"
    }

    STUDENT {
        uuid id PK
        uuid class_id FK
        int attendance_number "出席番号。クラス内で一意(登録時・編集時の両方で検証)"
        string name "氏名"
        datetime created_at
    }

    SUBJECT {
        uuid id PK
        uuid teacher_id FK
        string name "科目名。教員ごとのマスタ、自由入力ではない"
        datetime created_at
    }

    TIMETABLE_MASTER_SLOT {
        uuid id PK
        uuid teacher_id FK
        int weekday "1(月)〜5(金)"
        int period "1〜6"
        uuid subject_id FK "nullable。未入力のまま保存可"
        uuid class_id FK "nullable。参照先クラス削除時は自動でnullに戻る"
    }

    WEEKLY_SUBJECT_OVERRIDE {
        uuid id PK
        uuid teacher_id FK
        date week_start_date "対象週の月曜日"
        int weekday
        int period
        uuid subject_id FK "nullなら「未設定(空きコマ)」。行が存在する=科目を個別変更中"
    }

    WEEKLY_CLASS_OVERRIDE {
        uuid id PK
        uuid teacher_id FK
        date week_start_date "対象週の月曜日"
        int weekday
        int period
        uuid class_id FK "not null。行が存在する=クラスを個別変更中"
    }

    MEMO {
        uuid id PK
        uuid student_id FK
        uuid subject_id FK "not null。科目・クラスが未解決のマスではメモ画面自体を開けない"
        date note_date "授業日"
        int period
        text content
        string share_flag "共有する/共有しない(初期値:共有する)"
        datetime created_at
        datetime updated_at
    }

    STUDENT_COMMENT {
        uuid id PK
        uuid student_id FK "unique。生徒ごとに常に最新の1件のみ保持(2026-09時点で未実装。旧仕様はperiod_start_date/period_end_dateを含む複合キーで生徒×対象期間ごとに複数件保持していた。docs/features/comments/design.md参照)"
        text content
        int target_char_count "目安文字数(nullable)"
        string creation_method "直接生成/プロンプトコピー運用/手動作成"
        datetime created_at
        datetime updated_at
    }

    LIFE_MEMO {
        uuid id PK
        uuid student_id FK
        date note_date "記録日。授業に紐づかないため科目・時限は持たない"
        text content
        string share_flag "共有する/共有しない(初期値:共有する)"
        datetime created_at
        datetime updated_at
    }

    STUDENT_LIFE_COMMENT {
        uuid id PK
        uuid student_id FK "unique。生活の所見は生徒ごとに最新1件のみ(学習の所見STUDENT_COMMENTとは独立)"
        text content
        int target_char_count "目安文字数(nullable)"
        string creation_method "直接生成/プロンプトコピー運用/手動作成"
        datetime created_at
        datetime updated_at
    }

    AI_PROVIDER_SETTING {
        uuid id PK
        uuid teacher_id FK
        string provider "OpenAI/Anthropic/Google Gemini"
        string model
        string encrypted_api_key
        datetime updated_at
    }

    PROMPT_TEMPLATE {
        uuid id PK
        uuid teacher_id FK
        text content "学習の所見用(nullable。nullなら既定値)"
        text life_content "生活の所見用(nullable。nullなら既定値)"
        datetime updated_at
    }
```

## 主なユニーク制約(要件からの推定)

- `CLASS`: (teacher_id, grade, group_number) — 組番号は学年区分内で一意、欠番は再利用しない
- `CLASS_NUMBER_COUNTER`: (teacher_id, grade_group) — 学年区分ごとに1行。クラスを削除しても`last_issued_number`は減らさないことで欠番を保証する
- `STUDENT`: (class_id, attendance_number) — クラス内で出席番号は一意。登録(インポート)時・個別編集時の両方で検証する
- `SUBJECT`: 一意制約なし(教員ごとに同名の科目を複数登録できる)。**2026-08-13の設計レビューで、当初「表記ゆれ防止のため一意にすべきでは」という設計側の仮定を提案したが、ユーザーヒアリングの結果「重複を許可する」で確定した。** `docs/design.md`のDDLでは`(teacher_id, name)`のユニーク制約を設けていない
- `TIMETABLE_MASTER_SLOT`: (teacher_id, weekday, period) — マスのスロットは1つのみ
- `WEEKLY_SUBJECT_OVERRIDE`: (teacher_id, week_start_date, weekday, period)
- `WEEKLY_CLASS_OVERRIDE`: (teacher_id, week_start_date, weekday, period)
- `MEMO`: (student_id, subject_id, note_date, period) — 同一生徒・科目・日付・時限につき1件(F6)
- `LIFE_MEMO`: (student_id, note_date) — 同一生徒・日付につき1件(`docs/features/life-shoken/`)
- `STUDENT_LIFE_COMMENT`: (student_id) — 生徒ごとに1件(`docs/features/life-shoken/`)
- `STUDENT_COMMENT`: (student_id) — 生徒ごとに1件(F11。2026-09時点で未実装。旧仕様は(student_id, period_start_date, period_end_date)で生徒×期間ごとに1件だった。詳細は`docs/features/comments/design.md`)

`WEEKLY_SUBJECT_OVERRIDE` / `WEEKLY_CLASS_OVERRIDE` を分離しているのは、F4・F5が「科目とクラスは独立に個別変更でき、一致した項目だけがマスタ追従に戻る」と定義しているため。1テーブルにまとめて2つのnull許容カラムを持たせるより、科目側とクラス側で行の有無自体が「個別変更されているかどうか」を表す設計の方が、この部分一致・部分削除の挙動を素直に表現できると判断した(要件はテーブル構造までは指定していないため、これは設計判断)。

`STUDENT`・`MEMO`・`STUDENT_COMMENT`・`LIFE_MEMO`・`STUDENT_LIFE_COMMENT`は生徒削除時に物理削除で連鎖する(ON DELETE CASCADE相当)。`CLASS`は生徒が0人の場合のみ物理削除でき、`TIMETABLE_MASTER_SLOT`・`WEEKLY_CLASS_OVERRIDE`からの参照は削除前に自動でnull/削除に置き換わる(F1)。

`TEACHER`エンティティの`email`はER図上の概念的な項目であり、`docs/design.md`の実テーブル(`teacher_profile`)には複製しない。`auth.users.email`と二重管理してズレが生じるのを避けるため、表示が必要な箇所ではSupabase Authのセッションから直接取得する想定とする。

学習の所見(`STUDENT_COMMENT`)と生活の所見(`STUDENT_LIFE_COMMENT`)を別テーブルにしているのは、`STUDENT_COMMENT`の一意制約`(student_id)`を`(student_id, 種別)`に入れ替えると稼働中のコードのupsertが失敗する破壊的変更になるため(`docs/features/life-shoken/`design.md)。

`STUDENT_COMMENT`と`MEMO`の間にはFK関係を持たせていない。所見は生成・保存時点のテキストを保持する独立したスナップショットであり、元になったメモを後から編集・削除しても既存の所見の内容には影響しない(F11)。

## データエクスポート(F14)について

F14は既存エンティティを横断的に読み取ってJSONにまとめる機能であり、新しいエンティティは追加していない。目的は生徒ごとのメモ・所見を長期的に手元へ保管しておくことにあるため、出力は生徒ごとにメモ・所見がまとまる形にする(生活メモ`lifeMemos`・生活の所見`lifeComments`も生徒ごとに含める)。`AI_PROVIDER_SETTING`(APIキーを含む)はエクスポート対象から除外する。インポート(復元)機能は持たないため、エクスポートしたファイルからDBの状態を再現する経路は現時点で存在しない。バックアップ目的で定期的にエクスポートを促す仕組み(リマインダー等)は要件に含まれておらず、教員が自発的に実行しなければ手元にファイルは残らない。

## 残っている矛盾・未決事項

**科目マスタの初期値は解消済み**: サインアップ画面で学校区分(小学校/中学校)を選ぶと、対応する標準科目セット(小学校10科目/中学校11科目)が自動登録される。学校区分を選ばなければ従来通り空の状態で始まる。既存アカウントも科目管理画面から任意のタイミングで同じセットを追加できる。詳細は`docs/features/subjects/requirements.md`・`docs/features/subjects/design.md`(2026-09時点で未実装)。

**`SUBJECT`の一意性については解消済み**: 上記ユニーク制約の項の通り、2026-08-13のヒアリングで「重複を許可する」と確定した。表記ゆれのリスクは受け入れた上で、保存時のエラーによる教員の作業中断を避けることを優先している。

**エクスポートに実質的な復元経路がない**: F14はエクスポート専用でインポートを持たないため、「バックアップ」として機能するのは教員が手元のファイルを保管し続け、かつ将来何らかの手段(手動でのDB復元作業など)でそれを使う場合に限られる。現状ではエクスポートしたJSONを使ってサービス側にデータを戻す手段が存在しないため、「バックアップ」と呼べる実効性がどこまであるかは要件側で認識をすり合わせておいた方がよい。
