# 影響範囲: 起算日の廃止

## 既存機能への影響

| 機能 | 影響 |
|---|---|
| 時間割マスタ設定 | 起算日入力欄・年度更新操作がなくなる。マス割当の保存・CSV取り込み・モード切替は変更なし |
| 週次時間割 | 起算日未設定でも開ける。見出しから「第N週」がなくなり日付範囲のみになる。個別変更・「この授業を記録する」は変更なし |
| 授業記録・生徒別メモ一覧・所見管理 | 影響なし(元々起算日を参照していない) |
| データエクスポート | 影響なし(`export_teacher_data`は`start_date`を出力していない) |
| サインアップ直後の導線 | 週次時間割を開く前に起算日を設定する必要がなくなる |

## データへの影響

- フェーズ1: なし。保存済みの`teacher_profile.start_date`は残るが参照されない
- フェーズ2: `teacher_profile.start_date`列を削除するため、保存済みの起算日は失われる(画面上どこにも使われていない値のため、業務上の影響はない)

## テストへの影響

`design.md`「影響を受ける既存テスト」を参照。

## ドキュメントへの影響

- `docs/requirements.md`: ユーザーストーリー4・22、F4・F5、非機能要件(タイムゾーン)、用語集
- `docs/data-model.md`・`docs/design.md` §4.2・§5.2: `start_date`・`update_timetable_start_date`を廃止予定と明記
- `docs/design/screens.md`・`docs/design/user-flow.md`: 時間割マスタ設定・週次時間割の構成要素と状態
- `docs/features/timetable-master/test-cases.md`・`docs/features/timetable-weekly/test-cases.md`: 起算日・週番号のテストケース
- `mockups/timetable-master.html`・`mockups/weekly-timetable.html`
