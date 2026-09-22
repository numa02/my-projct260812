# 使い方説明書(教員向け)

先生方に配る操作ガイド。配信先は2つあり、中身は同じものから作る。

| | 場所 | 用途 |
|---|---|---|
| 公開ページ | `https://(アプリのURL)/manual` | ログイン不要で誰でも読める。学校へ案内するのはこちら |
| Artifact | https://claude.ai/artifact/S8t92LM7MBstxUMR49yjzf | 手元での確認・共有用 |

## ファイルの配置

```
docs/manual/index.html            本文(Artifactに公開する断片。<!doctype>や<head>は持たない)
docs/manual/capture/              撮影・生成スクリプト(配信されない場所に置く)
public/manual/index.html          上記から生成した配信用HTML(直接編集しない)
public/manual/manual.css          スタイル
public/manual/images/             キャプチャ27枚
```

本文を直すときは `docs/manual/index.html` を編集し、下の「3」以降を実行する。
`public/manual/index.html` は生成物なので直接編集しない。

`/manual` でも開けるよう `next.config.ts` にリダイレクトを、未ログインでも読めるよう
`proxy.ts` の `PUBLIC_PATHS` に `/manual` を入れている。

## キャプチャの撮り直し手順

画面を変更したら実行する。本番環境には一切触れない。

1. ローカルのSupabaseスタックを起動しておく(`supabase start`。`.env.local` はローカル向けの設定)
2. キャプチャを撮り直す(約30秒)

   ```bash
   npx playwright test --config docs/manual/capture/playwright.manual.config.ts
   ```

   実行のたびに新しい教員アカウントを1つ作り、科目→クラス→生徒→時間割→メモ→所見の順に
   登録しながら `public/manual/images/*.png` と `docs/manual/capture/annotations.json` を書き出す。
   開発サーバーにだけ出る開発者向けバッジは撮影時に隠している。

3. 赤枠の座標を本文に埋め込む

   ```bash
   node docs/manual/capture/inject-annotations.mjs
   ```

4. 配信用HTMLを生成する

   ```bash
   node docs/manual/capture/build-public.mjs
   ```

5. Artifactにも反映する場合は、`docs/manual/index.html` を同じURLへ再公開する
   (`manual.css` と `images/` も `files` として一緒に公開する)

## 赤枠・番号の付け方

画像には何も描き込まない。撮影スクリプト(`capture/capture.spec.ts`)の `shot()` に
注釈したい要素を渡すと、その位置を画像に対する%で `annotations.json` に記録し、
ページ側がCSSで枠と番号を重ねる。番号は本文の手順番号(`.keyed` の丸数字)と対応させる。

注釈を足したいときは `shot()` の第3引数に `{ n: 番号, target: locator }` を追加する。

## スタイルの制約

本番のCSPが `default-src 'self'` のため、外部フォントもインラインの `<style>` も読み込めない。
そのため見出し・本文ともOSのフォントを使い、CSSは同一オリジンの `manual.css` に置いている。
この2点は動かさない。
