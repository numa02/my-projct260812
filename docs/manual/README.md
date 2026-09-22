# 使い方説明書(教員向け)

`index.html` が説明書の本体で、Artifactとして公開したページのソースにあたる。
`images/` のキャプチャは、ローカルのSupabase+開発サーバーに練習用のダミーデータを入れて撮影したもので、
本番環境のデータは一切使っていない。

## 画面を変更したときの撮り直し手順

1. ローカルのSupabaseスタックを起動しておく(`supabase start`。`.env.local` はローカル向けの設定)
2. キャプチャを撮り直す

   ```bash
   npx playwright test --config docs/manual/capture/playwright.manual.config.ts
   ```

   実行のたびに新しい教員アカウントを1つ作り、科目→クラス→生徒→時間割→メモ→所見の順に
   登録しながら `images/*.png` と `images/annotations.json` を書き出す。10分程度かかる。

3. 赤枠の座標をHTMLに埋め込む

   ```bash
   node docs/manual/capture/inject-annotations.mjs
   ```

4. `index.html` を同じArtifactのURLへ再公開する(画像も `files` として一緒に公開する)

## 赤枠・番号の付け方

画像には何も描き込まない。撮影スクリプト(`capture/capture.spec.ts`)の `shot()` に
注釈したい要素を渡すと、その位置を画像に対する%で `annotations.json` に記録し、
公開ページ側がCSSで枠と番号を重ねる。番号は本文の手順番号(`.keyed` の丸数字)と対応させる。

注釈を足したいときは `shot()` の第3引数に `{ n: 番号, target: locator }` を追加する。
