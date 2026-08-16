/**
 * RPC関数が投げる `raise exception 'CODE: メッセージ'` 形式のエラーを分解する(CLAUDE.mdの規約)。
 * `:` より前をコードとして分岐処理に、`:` より後をトースト等の表示文言として使う。
 */
export function parseRpcError(error: { message: string }): { code: string; message: string } {
  const match = error.message.match(/^([A-Z_]+):\s*([\s\S]*)$/);
  if (match) {
    return { code: match[1], message: match[2] };
  }
  return { code: "UNKNOWN", message: error.message };
}
