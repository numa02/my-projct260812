import { useSyncExternalStore } from "react";

const emptySubscribe = () => () => {};

/**
 * SSRとクライアント初回レンダリングの出力を一致させたうえで、マウント後のみtrueを返す。
 * ポータル(Modal, Toast等)のようにdocument/windowに依存する描画をSSRで安全にスキップするために使う。
 * useEffect + setStateの組み合わせ(cascading render)を避けるためuseSyncExternalStoreを使う。
 */
export function useHasMounted(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
}
