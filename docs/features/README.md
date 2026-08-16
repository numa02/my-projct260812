# テストケース一覧(機能別)

実装済み画面ごとに手動テストケースをまとめている。各ファイルは「最低限のテスト(P0)」と「後で確認するテスト(P1〜P3)」に分かれている。P0は自動E2E(`e2e/*.spec.ts`)でも大半をカバー済み。確認環境は現状Chrome (Mac)のみ。

新しい画面を実装したら、このディレクトリに `docs/features/[機能名]/test-cases.md` を追加していく。

## 実装済み

- [認証](./auth/test-cases.md) — サインアップ・ログイン・ログアウト・パスワードリセット(T-049〜T-052)
- [クラス管理](./classes/test-cases.md)(T-053, T-054)
- [生徒名簿](./students/test-cases.md)(T-055, T-055b, T-056)
- [科目管理](./subjects/test-cases.md)(T-057)
- [時間割マスタ設定](./timetable-master/test-cases.md)(T-058〜T-060)
- [週次時間割](./timetable-weekly/test-cases.md)(T-061, T-062)
- [授業記録](./memo-record/test-cases.md)(T-063)
- [生徒別メモ一覧](./memo-students-list/test-cases.md)(T-064)
- [所感画面(骨格)](./comments/test-cases.md)(T-065。履歴タブの中身はT-067で追記)
- [所感生成(直接呼び出し・プロンプトコピー運用)](./comments-generate/test-cases.md)(T-066a, T-066b。F11の保存・上書き確認も含む)
- [所感履歴タブ](./comments-history/test-cases.md)(T-067)
- [AIプロバイダ設定](./settings-ai-provider/test-cases.md)(T-068)

## 未実装(今後追加)

- 設定画面・プロンプトひな形編集/データエクスポート(T-069, T-070)
