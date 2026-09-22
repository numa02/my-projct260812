# 設計: 所見プロンプトの差し替えと学年の反映

対応する要件は`docs/features/prompt-revision/requirements.md`、影響範囲は`docs/features/prompt-revision/impact.md`を参照。

## 1. データモデルの変更

なし。テーブル・カラム・制約・RLSポリシー・RPC関数のいずれも変更しない。

ひな形は既存の`prompt_template`テーブル(`content`=学習用、`life_content`=生活用)にそのまま保存する。初期値はコード側(`shared/prompt-builder.ts`)が持つため、DBへの移行処理は不要。

**保存済みのひな形は一切書き換えない。** 初期値の差し替えは、`prompt_template`に行が無い(または該当列がnullの)教員にのみ影響する。

## 2. API設計

なし。新規のHonoエンドポイント・RPC関数は追加しない。`{{grade}}`の置換はブラウザ側の`buildPrompt`で行い、`/api/comments/generate`へは組み立て済みのプロンプト文字列を渡す既存の形を変えない。

## 3. 実装設計

### 3.1 `shared/prompt-builder.ts`

- `DEFAULT_PROMPT_TEMPLATE`(学習用)・`DEFAULT_LIFE_PROMPT_TEMPLATE`(生活用)の文面を差し替える。教員から提示された文面から「学期」の行を削除し、プレースホルダーを実装の記法に合わせる

| 提示された文面 | 実装のプレースホルダー |
|---|---|
| `{学年}` | `{{grade}}` |
| `{文字数}` | `{{targetCharCount}}` |
| `{メモ一覧}` | `{{memos}}` |
| `{学期}` | (削除。本ツールに学期の概念がないため) |

- `buildPrompt`の引数に`grade?: string`を追加し、`{{grade}}`を置換する。未指定・空文字の場合は`targetCharCount`と同じく`"指定なし"`とする
- `{{pseudonymCode}}`の置換処理は残す(初期値からは外れるが、教員が保存済みのひな形で使っている可能性があるため)

置換は既存どおり`replaceAll`で行うため、ひな形に含まれないプレースホルダーがあっても何も起こらない(エラーにしない)。

### 3.2 学年の受け渡し

`class.grade`は所見管理画面が既に保持している(仮名コード生成に使っている)ため、propsで渡すだけでよい。新しいデータ取得は追加しない。

```
ClassCommentsContent          selectedClass.grade を持っている(既存)
  └ StudentCommentRow         classGrade を中継(新規prop)
      └ RowBody
          └ CommentAiAssist   classGrade を学年入力欄の初期値にする(新規prop)
```

`CommentAiAssist`側の実装:

- `const [grade, setGrade] = useState(classGrade)` とし、目安文字数の欄の隣に「学年」の`Input`(`type="text"`)を置く。`type="number"`にはしない(「特支」が入るため)
- あわせて`ClassCommentsContent`の行の`key`に`selectedClass.id`を含める(`key={`${kind}-${selectedClass?.id}-${s.id}-${periodKey}`}`)。`useState`の初期値はマウント時にしか評価されないため、クラス切り替え時に行を確実に再マウントさせ、学年欄が前のクラスの値を持ち越さないようにする。生徒はクラスに1対1で属するためクラス切り替えで生徒IDの集合自体が変わり大半の行は再マウントされるが、生徒一覧の取得完了前は古い行が新しい`classGrade`で再レンダリングされうる。キーにクラスIDを含めればこの隙間がなくなる。既存の「クラスを切り替えると選択をリセットする」方針(F7)とも整合する

### 3.3 `app/(main)/settings/prompt-template/PromptTemplateForm.tsx`

プレースホルダーの案内文に`{{grade}}`を追加する。現状の文面:

> `{{pseudonymCode}}`(仮名コード)・`{{targetCharCount}}`(目安文字数)・`{{memos}}`(<メモの種類>)のプレースホルダーが、生成時に実際の値へ置き換えられます

変更後は`{{grade}}`(学年)を加え、`{{pseudonymCode}}`は新しい初期値に含まれないため案内の末尾に回す(使えることは変わらないため案内自体は残す)。

## 4. エラーハンドリング

新規のエラー経路はない。学年欄は自由入力で、値の妥当性検証は行わない(プロンプトに埋める文字列でありDBに保存しないため)。保存失敗時の挙動(入力内容を保持し自動リトライしない、F13)は変更しない。

## 5. 影響を受ける既存テスト

| テスト | 影響 | 対応 |
|---|---|---|
| `shared/prompt-builder.test.ts` | 初期値の文面を検証している場合、および`buildPrompt`の引数を検証している場合に影響 | `{{grade}}`の置換(値あり/空)のケースを追加。初期値の文面そのものを固定値として比較しているアサーションがあれば、プレースホルダーの有無の検証に置き換える |
| `e2e/settings-prompt-template.spec.ts` | 初期値の文面を`getByText`等で参照している箇所が落ちる可能性 | 新しい文面に合わせて参照文字列を更新する |
| `e2e/comments-class.spec.ts` | AI生成セクションのプロンプト表示を検証している箇所に「学年」欄が増える | 学年欄の既定値がクラスの学年になっていること、プロンプトに反映されることのアサーションを追加 |
| `hooks/usePromptTemplate.ts`の既定値解決 | 変更なし(初期値の定数を参照しているだけ) | 変更しない |

## 6. ロールバック手順

DB変更を伴わないため、コードのrevertのみで完全に復旧できる。

ただし**revertしても、本改修の反映後にプロンプトひな形編集画面で「保存」を押した教員のひな形はDBに残る**(新しい文面が保存済みとして扱われる)。この場合はひな形編集画面から教員自身が編集し直す必要がある。初期値の差し替えは保存済みデータを書き換えないため、revert時にデータ不整合は起きない。
