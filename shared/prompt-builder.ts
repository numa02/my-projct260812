export interface PromptMemo {
  noteDate: string;
  content: string;
  /** 授業メモのみ。生活メモでは省略する */
  subjectName?: string;
  /** 授業メモのみ。生活メモでは省略する */
  period?: number;
}

/** 学習の所見用のプロンプトひな形の初期値(F10)。設定画面で教員ごとに編集される */
export const DEFAULT_PROMPT_TEMPLATE = `生徒{{pseudonymCode}}について、以下の授業メモをもとに所見文を作成してください。
目安の文字数: {{targetCharCount}}文字

【授業メモ】
{{memos}}`;

/** 生活の所見用のプロンプトひな形の初期値。設定画面で教員ごとに編集される */
export const DEFAULT_LIFE_PROMPT_TEMPLATE = `生徒{{pseudonymCode}}について、以下の生活メモ(授業以外の場面での様子)をもとに、行動・生活面の所見文を作成してください。
目安の文字数: {{targetCharCount}}文字

【生活メモ】
{{memos}}`;

function formatMemoLine(m: PromptMemo): string {
  if (m.period != null) {
    return `- ${m.noteDate} ${m.period}時限 ${m.subjectName ?? ""}: ${m.content}`;
  }
  return `- ${m.noteDate}: ${m.content}`;
}

/**
 * ひな形のプレースホルダーをメモ・目安文字数・仮名コードで置換してプロンプト文字列を組み立てる。
 * F9(直接呼び出し)・F10(プロンプトコピー運用)の両方から、学習・生活の所見で共通で使う。
 */
export function buildPrompt(params: {
  template: string;
  memos: PromptMemo[];
  targetCharCount?: number;
  pseudonymCode: string;
}): string {
  const memoLines = params.memos.map(formatMemoLine).join("\n");

  return params.template
    .replaceAll("{{pseudonymCode}}", params.pseudonymCode)
    .replaceAll(
      "{{targetCharCount}}",
      params.targetCharCount != null ? String(params.targetCharCount) : "指定なし",
    )
    .replaceAll("{{memos}}", memoLines || "(該当期間の共有メモはありません)");
}
