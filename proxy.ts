import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// /devは開発用コンポーネントギャラリー。本番ではページ自体がnotFound()を返すため
// 未ログインで公開扱いにしても実害はない。
// /manualはpublic/配下に置いた使い方説明書(静的ファイル)。ログイン前の教員が読めるよう
// 公開扱いにする。掲載しているのは練習用のダミーデータのキャプチャのみ
const PUBLIC_PATHS = ["/login", "/signup", "/reset-password", "/dev", "/manual"];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // getUser()はリクエストごとにAuthサーバーへの往復が入る。getClaims()は非対称鍵(ES256)の
  // JWTをWebCryptoでローカル検証するため往復がなくなる(JWKSはプロセス内で10分キャッシュされる)。
  // 代償として、失効(アカウント削除・BAN)の検知がトークンの有効期限(60分)まで遅れる。
  // このときRLSは助けにならない(RLSが守るのは他教員のデータであり、失効済みユーザーでも
  // 期限内のJWTならauth.uid()は本人のままなので自分のデータは読み書きできる)。
  // アカウント削除がスコープ外で、少数の身内運用である前提のもとでこの遅延を受容する。
  // 対称鍵に戻した場合はauth-js側が自動でgetUser()相当の検証にフォールバックする。
  let isAuthenticated = false;
  try {
    // セッションがない場合はerrorがnullのままdataだけnullになるため、dataの中身で判定する
    const { data } = await supabase.auth.getClaims();
    isAuthenticated = Boolean(data?.claims);
  } catch (error) {
    console.error("proxy: supabase.auth.getClaims() failed", error);
  }

  if (!isAuthenticated && !isPublicPath(request.nextUrl.pathname)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api).*)"],
};
