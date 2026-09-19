"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";

export default function ExportPage() {
  const { showToast } = useToast();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const exportData = useMutation({
    mutationFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase.rpc("export_teacher_data");
      if (error) throw error;
      return data;
    },
  });

  const handleExport = async () => {
    try {
      const data = await exportData.mutateAsync();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `export_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      showToast("success", "エクスポートが完了しました");
      setConfirmOpen(false);
    } catch {
      showToast("error", "エクスポートに失敗しました");
    }
  };

  return (
    <div className="flex flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold text-gray-900">データエクスポート</h1>

      <p className="max-w-xl text-sm leading-normal text-gray-700">
        クラス・生徒・科目・時間割マスタ・週次時間割の個別変更・メモ・所見・プロンプトひな形など、アカウントに紐づく全データをJSON形式でダウンロードします。AIプロバイダ設定(APIキーを含む)はエクスポート対象に含まれません。
      </p>

      <Button
        variant="primary"
        size="lg"
        className="self-start"
        onClick={() => setConfirmOpen(true)}
      >
        全データをエクスポート
      </Button>

      <ConfirmDialog
        title="全データをエクスポートしますか"
        body="ダウンロードされるファイルには生徒の氏名など個人情報がそのまま含まれます。ファイルの保管・取り扱いには十分注意してください。"
        confirmLabel="エクスポートする"
        open={confirmOpen}
        loading={exportData.isPending}
        onConfirm={handleExport}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}
