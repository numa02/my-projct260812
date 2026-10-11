import type { CommentKind, GenerationScope, PromptTemplateKey } from "./schemas";

/**
 * 所見の種類と生成単位から、使うプロンプトひな形のキーを決める(UN-031)。
 *
 * 学習・総合は「まとめて生成」用と「単元ごと」用でひな形を分ける。
 * 生活の所見は生活メモを材料とし単元を持たないため、生成単位によらず`life`を返す
 * (UI側でも生活タブでは生成単位の切り替えを出さない)。
 */
export function resolvePromptTemplateKey(
  kind: CommentKind,
  scope: GenerationScope,
): PromptTemplateKey {
  if (kind === "life") return "life";
  if (scope === "whole") return kind;
  return kind === "learning" ? "learning_unit" : "general_unit";
}
