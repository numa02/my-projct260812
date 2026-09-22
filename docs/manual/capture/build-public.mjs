/**
 * Artifact用の断片(docs/manual/index.html)から、アプリで配信する
 * public/manual/index.html を生成する。
 *
 *   node docs/manual/capture/build-public.mjs
 *
 * Artifactは公開時に <!doctype>〜<body> を自動で付けるため、元ファイルにはそれらを書かない。
 * 一方、Vercelからそのまま配信する静的HTMLには必要なので、ここで包む。
 * CSSと画像は同じ相対パス(manual.css / images/…)のまま両方で解決できるよう、
 * public/manual/ に置いている。
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const source = readFileSync(path.resolve(here, "../index.html"), "utf8");

// 先頭に並ぶ <title> と <link> は<head>へ、残りを<body>へ入れる
const headPattern = /^\s*(?:<title>[\s\S]*?<\/title>|<link\b[^>]*>)\s*/;
let rest = source;
const headTags = [];
for (;;) {
  const match = rest.match(headPattern);
  if (!match) break;
  headTags.push(match[0].trim());
  rest = rest.slice(match[0].length);
}
if (headTags.length === 0) {
  throw new Error("docs/manual/index.html の先頭に <title> が見つかりません");
}

const html = `<!doctype html>
<html lang="ja">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
    ${headTags.join("\n    ")}
  </head>
  <body>
${rest.trimEnd()}
  </body>
</html>
`;

const out = path.resolve(here, "../../../public/manual/index.html");
writeFileSync(out, html);
console.log(`生成しました: ${path.relative(process.cwd(), out)}`);
