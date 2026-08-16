import { redirect } from "next/navigation";

// ルート("/")はproxy.tsにより未ログイン時は/loginへ誘導されるため、ここに到達するのは常にログイン済み。
// ログイン後の遷移先として、初回セットアップフロー(user-flow.md)の起点であるクラス管理画面へ送る。
export default function Home() {
  redirect("/classes");
}
