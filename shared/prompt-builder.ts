export interface PromptMemo {
  subjectName: string;
  noteDate: string;
  period: number;
  content: string;
}

/** プロンプトひな形の初期値(F10)。設定画面で教員ごとに編集される */
export const DEFAULT_PROMPT_TEMPLATE = `生徒{{pseudonymCode}}について、以下の授業メモをもとに所見文を作成してください。
目安の文字数: {{targetCharCount}}文字

【授業メモ】
{{memos}}`;

/**
 * ひな形のプレースホルダーをメモ・目安文字数・仮名コードで置換してプロンプト文字列を組み立てる。
 * F9(直接呼び出し)・F10(プロンプトコピー運用)の両方から共通で使う。
 */
export function buildPrompt(params: {
  template: string;
  memos: PromptMemo[];
  targetCharCount?: number;
  pseudonymCode: string;
}): string {
  const memoLines = params.memos
    .map((m) => `- ${m.noteDate} ${m.period}時限 ${m.subjectName}: ${m.content}`)
    .join("\n");

  return params.template
    .replaceAll("{{pseudonymCode}}", params.pseudonymCode)
    .replaceAll(
      "{{targetCharCount}}",
      params.targetCharCount != null ? String(params.targetCharCount) : "指定なし",
    )
    .replaceAll("{{memos}}", memoLines || "(該当期間の共有メモはありません)");
}
