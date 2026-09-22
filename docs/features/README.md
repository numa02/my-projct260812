# テストケース一覧(機能別)

実装済み画面ごとに手動テストケースをまとめている。各ファイルは「最低限のテスト(P0)」と「後で確認するテスト(P1〜P3)」に分かれている。P0は自動E2E(`e2e/*.spec.ts`)でも大半をカバー済み。確認環境は現状Chrome (Mac)のみ。

新しい画面を実装したら、このディレクトリに `docs/features/[機能名]/test-cases.md` を追加していく。

## 実装済み

- [認証](./auth/test-cases.md) — サインアップ・ログイン・ログアウト・パスワードリセット(T-049〜T-052)
- [クラス管理](./classes/test-cases.md)(T-053, T-054)
- [生徒名簿](./students/test-cases.md)(T-055, T-055b, T-056)
- [科目管理](./subjects/test-cases.md)(T-057)
- [時間割マスタ設定](./timetable-master/test-cases.md)(T-058〜T-060、SD-001〜SD-010で起算日を廃止)
- [週次時間割](./timetable-weekly/test-cases.md)(T-061, T-062、SD-001〜SD-010で週番号表示を廃止)
- [授業記録](./memo-record/test-cases.md)(T-063)
- [生徒別メモ一覧](./memo-students-list/test-cases.md)(T-064)
- [所見管理(クラス単位一覧)](./comments/test-cases.md)(T-080。T-065〜T-067の生徒単位・タブ切替の構成を再設計・置換)
- [AIプロバイダ設定](./settings-ai-provider/test-cases.md)(T-068)
- [プロンプトひな形編集](./settings-prompt-template/test-cases.md)(T-069)
- [データエクスポート](./settings-export/test-cases.md)(T-070)
- [用語「所感」→「所見」の統一](./terminology-shoken/test-cases.md)(TS-001〜TS-005)
- [生活所見の記録](./life-shoken/test-cases.md)(LS-001〜LS-008。生活記録画面の新設、週次時間割・生徒別メモ一覧・所見管理・プロンプトひな形編集の拡張)
- [画面表示の分かりにくさの解消](./ui-clarity/test-cases.md)(UC-001〜UC-009。クラス管理の組番号を非表示、AIプロバイダ設定の設定状況表示、生活メモの表示ラベルを「生活記録」に変更。小学校標準科目セットへの教科「生活」の追加(SJ-011〜SJ-014)と同時にリリース)
- [所見プロンプトの差し替えと学年の反映](./prompt-revision/test-cases.md)(PT-001〜PT-010。学習・生活のひな形の初期値を差し替え、`{{grade}}`プレースホルダーと所見管理画面の学年入力欄を追加)

全画面(T-049〜T-070)の実装完了後、仕上げ(T-071〜T-079)・所見画面を所見管理画面として再設計(T-080)まで完了。
