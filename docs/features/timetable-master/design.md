# 技術設計: 時間割マスタ CSV/貼り付け取り込み

対応する要件は`docs/features/timetable-master/requirements.md`を参照。

## データモデルの変更

なし。新規テーブル・新規カラム・マイグレーションは発生しない。取り込んだCSVは、既存の`MasterSlotState[]`(`hooks/useTimetableMaster.ts`で定義済み)の形に変換したうえで、既存の`timetable_master_slot`テーブル・`save_timetable_master`RPCをそのまま経由する。

## API設計

新規APIエンドポイントの追加はない。CLAUDE.mdのアーキテクチャ方針(単純CRUD・RPCはブラウザから`supabase-js`で直接)に従い、既存のRPC呼び出しをフロントエンドから再利用する。

```
既存RPC(変更なし): save_timetable_master(p_slots jsonb, p_confirm_overwrite boolean) returns jsonb
呼び出し元(変更なし): hooks/useTimetableMaster.ts の saveMaster mutation
```

## 画面/UI設計

`app/(main)/timetable/master/TimetableMasterForm.tsx`のグリッド表(既存)の直前に、折りたたみ式の取り込みセクションを追加する。

```
時間割マスタ設定
[一括モード | 教科担任制モード] ← 既存のSegmentedControl

▶ CSV/貼り付けで取り込む          ← 新規。初期状態は折りたたみ(閉)
  (開くと以下が表示される)
  [ファイルアップロード | テキスト貼り付け] ← 既存のPasteOrUploadAreaを汎用化して再利用
  [取り込む]ボタン
  (エラーがあれば行ごとに一覧表示)

[クラス選択(一括モードのみ)]       ← 既存
[時間割グリッド]                  ← 既存。取り込み成功時にここへ反映される
[起算日入力]                      ← 既存
[保存]ボタン                     ← 既存。CSV取り込み後もこのボタンで保存する
```

取り込みセクションを折りたたみ式にする理由: 既存のグリッド手入力が引き続き主要な操作方法であり、CSV取り込みは補助的な操作であるため、画面の初見の情報量を増やさない。

## 既存コンポーネントの変更

### `components/ui/PasteOrUploadArea.tsx`

現状、生徒名簿専用の文言(`REASON_LABEL`、Textareaのlabel文言、ファイル選択のaria-label)がハードコードされている。以下のprops追加で汎用化する。

```ts
export interface PasteOrUploadAreaProps {
  onImport: (rawText: string) => void;
  errorRows?: ImportErrorRow[];
  loading?: boolean;
  reasonLabels: Record<string, string>;      // 新規。呼び出し元がエラーコード→日本語文言のマップを渡す
  pasteLabel: string;                          // 新規。Textareaのlabel文言
  fileInputAriaLabel: string;                  // 新規。ファイル選択inputのaria-label
  segmentedControlAriaLabel: string;           // 新規。SegmentedControlのaria-label
}
```

既存の呼び出し元(`app/(main)/students/page.tsx`)は、生徒名簿用の文言を明示的にpropsとして渡すよう変更する(デフォルト値は持たせない。呼び出し元ごとに文言が異なることを型で強制するため)。

### `app/(main)/timetable/master/TimetableMasterForm.tsx`

- 取り込みセクションの開閉状態(`useState<boolean>`)を追加
- 取り込み成功時のハンドラを追加し、`setDraftSlots`を呼んでグリッド表示を更新する
- モード(`mode`)に応じて、パース・検証時に3列/4列のどちらを期待するかを切り替える
- 一括モードでのCSV取り込み時、`validateTimetableCsvRows`が返す各スロットの`classId`は`null`固定で構わない。既存の`buildPayload()`が一括モード時に`classId`を常に画面上部で選択中の`bulkClassId`で上書きするため(L83)、CSVインポート直後の`draftSlots`内の`classId`の値は保存時に参照されない。この既存の上書き挙動に変更は加えない

## 新規コンポーネント

なし。既存の`PasteOrUploadArea`の汎用化で対応する。

## 新規ファイル(コンポーネント以外)

### `shared/parse-timetable-rows.ts`

```ts
export interface ParsedTimetableRow {
  weekdayLabel: string | null;   // "月"〜"金"。不正な値でもそのまま保持し、検証層でエラーにする
  period: number | null;
  subjectName: string | null;
  className: string | null;      // 一括モード(3列)の場合は常にnull
}

/**
 * CSV/貼り付け共通のパース処理。1行目はヘッダー行として無視する。
 * 区切り文字はカンマ/タブを自動判定する(shared/parse-student-rows.tsと同じ方式)。
 * ここでは字句解析のみを行い、名前解決・完全性チェックはshared/timetable-csv-validation.tsで行う。
 */
export function parseTimetableRows(rawText: string, mode: "bulk" | "per-class"): ParsedTimetableRow[]
```

### `shared/timetable-csv-validation.ts`

```ts
export type TimetableCsvErrorReason =
  | "INVALID_WEEKDAY"        // 曜日が「月〜金」以外
  | "INVALID_PERIOD"         // 時限が1〜6の数値でない
  | "SUBJECT_NOT_FOUND"      // 科目名が登録済み一覧と一致しない
  | "CLASS_NOT_FOUND"        // クラス名が登録済み一覧と一致しない(教科担任制モードのみ)
  | "DUPLICATE_SLOT"         // 同じ曜日・時限の組み合わせが複数行にある
  | "INCOMPLETE"             // 30マスに満たない、または超えている

export interface TimetableCsvError {
  // INCOMPLETE(30マスに満たない/超えている)はファイル全体に対するエラーであり、
  // 特定の1行に紐づかないため、rowIndexはoptionalとしundefinedを許容する。
  // それ以外の理由(INVALID_WEEKDAY等)は必ずrowIndexを持つ
  rowIndex?: number;
  reason: TimetableCsvErrorReason;
}

// 1行が複数のエラー理由に同時に該当する場合(例: 曜日が不正かつ科目名も不一致)、
// validateTimetableCsvRowsはその行について最初に検出した理由のみを1件返す
// (曜日・時限の形式チェック→科目名/クラス名の照合→重複チェックの順に検証し、
// いずれかで失敗した時点でその行の検証を打ち切る。優先順位はこの検証順と一致する)

export interface TimetableCsvValidationResult {
  ok: boolean;
  slots: MasterSlotState[];       // ok=trueの場合のみ30件
  errors: TimetableCsvError[];    // ok=falseの場合のみ1件以上
}

/**
 * パース済みの行を、登録済みsubjects/classesと突き合わせて名前解決し、
 * 30マスの完全性・重複を検証する純粋関数。1件でもエラーがあればok:falseを返し、
 * slotsは空配列にする(全か無か方式)。
 */
export function validateTimetableCsvRows(
  rows: ParsedTimetableRow[],
  subjects: { id: string; name: string }[],
  classes: { id: string; displayName: string }[],
): TimetableCsvValidationResult
```

## エラーハンドリング

`docs/design.md` §6.1の「部分成功を許す操作と、全か無かの操作を明確に分ける」方針に従い、本機能は**全か無かの操作**に分類する(既存の時間割マスタ保存と同じ区分)。

| エラー種別 | 発生層 | 表示方法 |
|---|---|---|
| 曜日・時限の形式不正 | `validateTimetableCsvRows`(クライアント) | `PasteOrUploadArea`のエラー一覧に行番号付きで表示 |
| 科目名・クラス名が未登録 | `validateTimetableCsvRows`(クライアント) | 同上 |
| マスの重複・過不足 | `validateTimetableCsvRows`(クライアント) | 同上(行番号は紐づけられない場合は全体エラーとして表示) |
| 保存時のRPCエラー(`CONFIRM_OVERWRITE`等) | `save_timetable_master`RPC(既存) | 既存の`TimetableMasterForm.tsx`の`doSave`のエラーハンドリング(`parseRpcError`)をそのまま使う。取り込み由来かグリッド手入力由来かでハンドリングを分岐しない |

## ロールバック手順

1. Vercelのデプロイを、本機能追加前のバージョンに戻す(コードのみのロールバックで完結)
2. DBスキーマ・データへの変更を伴わないため、追加のデータ復旧作業は不要

## 段階リリース戦略

本アプリにはフィーチャーフラグの仕組みが存在しない(CLAUDE.mdのアーキテクチャに記載なし)。リスクが低い機能であるため、段階リリースは行わず、通常のデプロイ(mainブランチへのマージ→Vercel自動デプロイ)で一括リリースする。
