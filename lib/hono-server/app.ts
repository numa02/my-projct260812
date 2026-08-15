import { Hono } from "hono";
import { aiRoutes } from "./routes/ai";

const app = new Hono().basePath("/api");

// 状態変更を伴うリクエストはCookieベースセッションに依存するためCSRF対策が必要。
// sec-fetch-siteヘッダー(フォールバックとしてOrigin)がsame-originであることを確認する(design.md §5.1)
app.use("*", async (c, next) => {
  if (c.req.method === "GET" || c.req.method === "HEAD") {
    return next();
  }

  const secFetchSite = c.req.header("sec-fetch-site");
  if (secFetchSite) {
    if (secFetchSite !== "same-origin") {
      return c.json({ error: { code: "FORBIDDEN", message: "不正なリクエスト元です" } }, 403);
    }
    return next();
  }

  const origin = c.req.header("origin");
  if (origin) {
    let originHost: string;
    try {
      originHost = new URL(origin).host;
    } catch {
      return c.json({ error: { code: "FORBIDDEN", message: "不正なリクエスト元です" } }, 403);
    }
    if (originHost !== new URL(c.req.url).host) {
      return c.json({ error: { code: "FORBIDDEN", message: "不正なリクエスト元です" } }, 403);
    }
  }

  return next();
});

app.route("/", aiRoutes);

export { app };
