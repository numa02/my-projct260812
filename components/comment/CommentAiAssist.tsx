"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useAiProviderSettings } from "@/hooks/useAiProviderSettings";
import { usePromptTemplate } from "@/hooks/usePromptTemplate";
import { useSharedMemosForPeriod } from "@/hooks/useSharedMemosForPeriod";
import { useGenerateComment } from "@/hooks/useGenerateComment";
import type { CommentCreationMethod } from "@/hooks/useStudentComments";
import { buildPrompt } from "@/shared/prompt-builder";
import { groupMemosByUnit } from "@/shared/group-memos-by-unit";
import { resolvePromptTemplateKey } from "@/shared/prompt-template-key";
import type { CommentKind, GenerationScope } from "@/shared/schemas";
import { Input, Textarea } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { InlineMessage } from "@/components/ui/InlineMessage";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { useToast } from "@/components/ui/Toast";
import { UnitCommentDraftCard } from "./UnitCommentDraftCard";

type Method = "direct" | "prompt";

/** 材料が0件のときの案内文に使うラベル。総合は科目「総合」の授業メモのみが材料になる */
const MEMO_LABEL: Record<CommentKind, string> = {
  learning: "メモ",
  life: "生活メモ",
  general: "総合の授業メモ",
};

/** 単元ごとに生成した所見案(単元名をキーに保持する) */
interface UnitDraft {
  content: string;
  method: CommentCreationMethod;
}

export interface CommentAiAssistProps {
  studentId: string;
  /** learning=全教科の授業メモ、life=生活メモ、general=科目「総合」の授業メモを材料にする */
  kind: CommentKind;
  pseudonymCode: string;
  /** 対象クラスの学年。学年欄の既定値に使う(教員が上書きできる) */
  classGrade: string;
  periodStartDate: string;
  periodEndDate: string;
  /** 生成・貼り付けた内容を行の所見欄に反映する(この時点ではまだ保存しない) */
  onApply: (content: string, method: CommentCreationMethod) => void;
}

/**
 * 所見一覧画面の行内で折りたたまれるAI生成セクション(F9, F10)。
 * 直接呼び出し・プロンプトコピー運用のどちらを使うかは教員が都度選べる
 * (APIキー設定済みでも、あえてプロンプトコピー運用を選んでよい)。
 * 生成単位も教員が選べる。「まとめて生成」は対象期間の共有メモ全体から所見を1件作り、
 * 「単元ごとに生成」は共有メモを単元で分けて単元ごとに所見案を作り、教員が採用するものを選ぶ。
 * いずれの方法も、結果は自前で保存せずonApplyで行の所見欄(常時表示のテキストエリア)に
 * 反映するだけに留める。保存は行側の責務
 */
export function CommentAiAssist({
  studentId,
  kind,
  pseudonymCode,
  classGrade,
  periodStartDate,
  periodEndDate,
  onApply,
}: CommentAiAssistProps) {
  const { showToast } = useToast();
  const { setting, isLoading: isLoadingSetting } = useAiProviderSettings();
  const { templates, isLoading: isLoadingTemplate } = usePromptTemplate();
  const memoLabel = MEMO_LABEL[kind];
  const generateComment = useGenerateComment();

  const [targetCharCount, setTargetCharCount] = useState("");
  // 既定値は対象クラスの学年。クラスを切り替えると行ごと再マウントされるため前のクラスの値は残らない
  // (ClassCommentsContentの行のkeyにクラスIDを含めている)
  const [grade, setGrade] = useState(classGrade);
  const [pastedText, setPastedText] = useState("");
  // 未選択の場合はAPIキー設定状況から妥当な既定値を出す。教員が選び直したらそちらを優先する
  // (常にstateから直接計算することで、設定の読み込みタイミングに関わらず正しい値になる)
  const [methodOverride, setMethodOverride] = useState<Method | null>(null);
  const method = methodOverride ?? (setting.hasKey ? "direct" : "prompt");
  // 生成単位。既定は従来の挙動(まとめて1件)。生活の所見は単元を持たないため常にwhole
  const [scope, setScope] = useState<GenerationScope>("whole");
  const effectiveScope: GenerationScope = kind === "life" ? "whole" : scope;

  // 単元ごとの所見案・採用選択・エラーは、この折りたたみを開いている間だけ保持する(保存はしない)
  const [unitDrafts, setUnitDrafts] = useState<Record<string, UnitDraft>>({});
  const [selectedUnits, setSelectedUnits] = useState<Record<string, boolean>>({});
  const [unitErrors, setUnitErrors] = useState<Record<string, string>>({});
  const [generatingUnitName, setGeneratingUnitName] = useState<string | null>(null);
  const [batchProgress, setBatchProgress] = useState<{ done: number; total: number } | null>(null);

  // 使うひな形は所見の種類と生成単位の組み合わせで決まる(生活は生成単位によらずlife)。
  // 「まとめて生成」のひな形・組み立て結果は従来と変わらない
  const template = templates[resolvePromptTemplateKey(kind, effectiveScope)];

  const { memos, isLoading: isLoadingMemos } = useSharedMemosForPeriod(
    studentId,
    periodStartDate,
    periodEndDate,
    kind,
  );
  const hasSharedMemos = memos.length > 0;
  const targetCharCountNumber = targetCharCount.trim() ? Number(targetCharCount) : undefined;

  const prompt = useMemo(
    () =>
      buildPrompt({ template, memos, grade, targetCharCount: targetCharCountNumber, pseudonymCode }),
    [template, memos, grade, targetCharCountNumber, pseudonymCode],
  );

  const unitGroups = useMemo(() => groupMemosByUnit(memos), [memos]);

  /** 単元1件ぶんのプロンプト。その単元のメモだけを材料にし、単元名も{{unitName}}で渡す */
  const buildUnitPrompt = (unitName: string, unitMemos: typeof memos) =>
    buildPrompt({
      template,
      memos: unitMemos,
      grade,
      targetCharCount: targetCharCountNumber,
      pseudonymCode,
      unitName,
    });

  const handleGenerate = async () => {
    try {
      const { rawText } = await generateComment.mutateAsync({
        prompt,
        targetCharCount: targetCharCountNumber,
      });
      onApply(rawText, "direct_ai");
      showToast("success", "生成結果を所見欄に反映しました");
    } catch (err) {
      showToast("error", (err as Error).message || "生成に失敗しました");
    }
  };

  const handleCopyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      showToast("success", "プロンプトをコピーしました");
    } catch {
      showToast("error", "コピーに失敗しました");
    }
  };

  const handleApplyPasted = () => {
    if (pastedText.trim().length === 0) return;
    onApply(pastedText.trim(), "prompt_copy");
    setPastedText("");
    showToast("success", "所見欄に反映しました");
  };

  /** 単元1件を生成する。成功/失敗のどちらもその単元のカードにだけ反映する */
  const generateUnit = async (unitName: string, unitMemos: typeof memos): Promise<boolean> => {
    setGeneratingUnitName(unitName);
    setUnitErrors((prev) => {
      const next = { ...prev };
      delete next[unitName];
      return next;
    });
    try {
      const { rawText } = await generateComment.mutateAsync({
        prompt: buildUnitPrompt(unitName, unitMemos),
        targetCharCount: targetCharCountNumber,
      });
      setUnitDrafts((prev) => ({ ...prev, [unitName]: { content: rawText, method: "direct_ai" } }));
      // 生成できた案は既定で採用候補にしておく(教員は外せる)
      setSelectedUnits((prev) => ({ ...prev, [unitName]: true }));
      return true;
    } catch (err) {
      setUnitErrors((prev) => ({
        ...prev,
        [unitName]: (err as Error).message || "生成に失敗しました",
      }));
      return false;
    } finally {
      setGeneratingUnitName(null);
    }
  };

  /**
   * すべての単元を順次生成する。並列にすると外部プロバイダのレート制限に当たりやすく、
   * どの単元で失敗したかも分かりにくいため、1件ずつ実行する。
   * 途中で失敗しても残りの単元は続行する(自動リトライはしない)
   */
  const handleGenerateAllUnits = async () => {
    setBatchProgress({ done: 0, total: unitGroups.length });
    let failed = 0;
    for (const [index, group] of unitGroups.entries()) {
      const ok = await generateUnit(group.unitName, group.memos);
      if (!ok) failed += 1;
      setBatchProgress({ done: index + 1, total: unitGroups.length });
    }
    setBatchProgress(null);
    if (failed === 0) {
      showToast("success", `${unitGroups.length}件の単元の所見案を生成しました`);
    } else {
      showToast("error", `${failed}件の単元の生成に失敗しました。失敗した単元は個別に生成できます`);
    }
  };

  const selectedDrafts = unitGroups
    .filter((g) => selectedUnits[g.unitName] && (unitDrafts[g.unitName]?.content.trim() ?? "") !== "")
    .map((g) => unitDrafts[g.unitName]);

  const handleApplySelectedUnits = () => {
    if (selectedDrafts.length === 0) return;
    const content = selectedDrafts.map((d) => d.content.trim()).join("\n\n");
    const creationMethod: CommentCreationMethod = selectedDrafts.some((d) => d.method === "direct_ai")
      ? "direct_ai"
      : "prompt_copy";
    onApply(content, creationMethod);
    showToast("success", `${selectedDrafts.length}件の案を所見欄に反映しました`);
  };

  if (isLoadingSetting || isLoadingTemplate) {
    return <LoadingSpinner label="読み込み中..." />;
  }

  const needsApiKey = method === "direct" && !setting.hasKey;

  return (
    <div className="flex flex-col gap-4 rounded-md border border-gray-200 bg-gray-50 p-4">
      <SegmentedControl
        aria-label="所見の作成方法"
        options={[
          { value: "direct", label: "AIで直接生成" },
          { value: "prompt", label: "プロンプトを作成" },
        ]}
        value={method}
        onChange={(v) => setMethodOverride(v as Method)}
      />

      {/* 生活の所見は生活メモが材料で単元を持たないため、生成単位の切り替えを出さない */}
      {kind !== "life" && (
        <SegmentedControl
          aria-label="所見の生成単位"
          options={[
            { value: "whole", label: "まとめて生成" },
            { value: "per_unit", label: "単元ごとに生成" },
          ]}
          value={scope}
          onChange={(v) => setScope(v as GenerationScope)}
        />
      )}

      <div className="flex gap-3">
        <div className="w-24">
          {/* 「特支」が入るためtype="number"にはしない */}
          <Input label="学年" type="text" value={grade} onChange={(e) => setGrade(e.target.value)} />
        </div>
        <div className="w-48">
          <Input
            label={effectiveScope === "per_unit" ? "1単元あたりの目安文字数" : "目安文字数"}
            type="number"
            value={targetCharCount}
            onChange={(e) => setTargetCharCount(e.target.value)}
          />
        </div>
      </div>

      {isLoadingMemos ? (
        <LoadingSpinner label="読み込み中..." />
      ) : !hasSharedMemos ? (
        <EmptyState message={`送信可能な${memoLabel}が存在しません`} />
      ) : needsApiKey ? (
        <div className="flex flex-col gap-2">
          <InlineMessage
            variant="warning"
            message="APIキーが未設定のため、直接生成はできません。「プロンプトを作成」に切り替えるか、先にAPIキーを登録してください"
          />
          <Link href="/settings/ai-provider" className="text-sm text-gray-700 underline hover:text-gray-900">
            AIプロバイダ設定へ
          </Link>
        </div>
      ) : effectiveScope === "per_unit" ? (
        <div className="flex flex-col gap-3">
          <InlineMessage
            variant="info"
            message={
              method === "direct"
                ? `「共有する」区分の${memoLabel}が単元ごとに仮名化された状態で外部のAIサービスに送信されます`
                : `「共有する」区分の${memoLabel}が単元ごとに仮名化された状態でプロンプトに含まれます。単元ごとにコピーして外部のAIサービスに貼り付けてください`
            }
          />

          {method === "direct" && (
            <div className="flex flex-wrap items-center gap-3">
              <Button
                variant="primary"
                size="sm"
                loading={batchProgress !== null}
                disabled={generatingUnitName !== null}
                onClick={handleGenerateAllUnits}
              >
                すべての単元を生成
              </Button>
              {batchProgress && (
                <span className="text-sm text-gray-700">
                  {batchProgress.done}/{batchProgress.total} 件生成しました
                </span>
              )}
            </div>
          )}

          {unitGroups.map((group) => (
            <UnitCommentDraftCard
              key={group.unitName}
              unitName={group.unitName}
              memoCount={group.memos.length}
              method={method}
              prompt={buildUnitPrompt(group.unitName, group.memos)}
              draft={unitDrafts[group.unitName]?.content ?? null}
              generating={generatingUnitName === group.unitName}
              error={unitErrors[group.unitName] ?? null}
              selected={selectedUnits[group.unitName] ?? false}
              onToggleSelected={(selected) =>
                setSelectedUnits((prev) => ({ ...prev, [group.unitName]: selected }))
              }
              onChangeDraft={(content) =>
                setUnitDrafts((prev) => ({
                  ...prev,
                  // 編集しても由来(直接生成/プロンプトコピー)は変えない
                  [group.unitName]: { content, method: prev[group.unitName]?.method ?? "prompt_copy" },
                }))
              }
              onGenerate={() => void generateUnit(group.unitName, group.memos)}
              onApplyPasted={(text) => {
                setUnitDrafts((prev) => ({
                  ...prev,
                  [group.unitName]: { content: text, method: "prompt_copy" },
                }));
                setSelectedUnits((prev) => ({ ...prev, [group.unitName]: true }));
              }}
            />
          ))}

          <Button
            variant="primary"
            size="sm"
            className="self-start"
            disabled={selectedDrafts.length === 0}
            onClick={handleApplySelectedUnits}
          >
            選択した案を所見欄に反映
            {selectedDrafts.length > 0 && `(${selectedDrafts.length}件)`}
          </Button>
        </div>
      ) : method === "direct" ? (
        <>
          <InlineMessage
            variant="info"
            message={`「共有する」区分の${memoLabel}が仮名化された状態で外部のAIサービスに送信されます`}
          />
          <Button
            variant="primary"
            size="sm"
            className="self-start"
            loading={generateComment.isPending}
            onClick={handleGenerate}
          >
            生成して所見欄に反映
          </Button>
          {generateComment.isPending && (
            <LoadingSpinner label="AIが所見を生成しています(数秒〜数十秒かかることがあります)" />
          )}
        </>
      ) : (
        <div className="flex flex-col gap-3">
          <InlineMessage
            variant="info"
            message={`「共有する」区分の${memoLabel}が仮名化された状態でプロンプトに含まれます。コピーして外部のAIサービスに貼り付けてください`}
          />
          <Textarea label="プロンプト" value={prompt} readOnly rows={6} />
          <Button variant="outline" size="sm" className="self-start" onClick={handleCopyPrompt}>
            プロンプトをコピー
          </Button>
          <Textarea
            label="AIの応答を貼り付け"
            value={pastedText}
            onChange={(e) => setPastedText(e.target.value)}
            rows={6}
          />
          <Button
            variant="outline"
            size="sm"
            className="self-start"
            onClick={handleApplyPasted}
            disabled={pastedText.trim().length === 0}
          >
            所見欄に反映
          </Button>
        </div>
      )}
    </div>
  );
}
