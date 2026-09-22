/**
 * 撮影時に記録した赤枠の座標(images/annotations.json)を、説明書のHTMLに埋め込む。
 *
 *   node docs/manual/capture/inject-annotations.mjs
 *
 * 公開ページから外部ファイルを読みに行かなくて済むよう、JSONをHTMLの
 * <script id="shot-annotations"> の中に直接書き込む。キャプチャを撮り直したら実行する。
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const htmlPath = path.resolve(here, "../index.html");
const jsonPath = path.resolve(here, "../images/annotations.json");

const annotations = JSON.parse(readFileSync(jsonPath, "utf8"));
const payload = JSON.stringify({
  shots: annotations.shots.map(({ name, marks }) => ({ name, marks })),
});

const html = readFileSync(htmlPath, "utf8");
const pattern = /(<script id="shot-annotations" type="application\/json">)([\s\S]*?)(<\/script>)/;
if (!pattern.test(html)) {
  throw new Error('index.html に <script id="shot-annotations"> が見つかりません');
}

writeFileSync(htmlPath, html.replace(pattern, `$1${payload}$3`));
console.log(`埋め込み完了: ${annotations.shots.length}枚ぶんの注釈`);
