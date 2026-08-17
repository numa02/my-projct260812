"use client";

import { useMemo } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { StudentMemosContent } from "./StudentMemosContent";

/**
 * [[...id]]はオプショナル(生徒名簿からの遷移時のみ初期選択のヒントとして渡される)。
 * IDがある場合はそのIDが所属するクラスを調べてから本体を描画する(クラス選択自体は画面内state)。
 * IDがない場合(メニューから直接開いた場合)はクラス・生徒とも未選択の状態で描画する
 */
export function StudentMemosView() {
  const params = useParams<{ id?: string[] }>();
  const searchParams = useSearchParams();
  const from = searchParams.get("from");
  const initialStudentId = params.id?.[0] ?? null;

  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const initialStudentQuery = useQuery({
    queryKey: ["initial-student-class", initialStudentId],
    queryFn: async (): Promise<string | null> => {
      const { data, error } = await supabase
        .from("student")
        .select("class_id")
        .eq("id", initialStudentId!)
        .maybeSingle();
      if (error) throw error;
      return data?.class_id ?? null;
    },
    enabled: initialStudentId !== null,
  });

  if (initialStudentId !== null && initialStudentQuery.isLoading) {
    return (
      <div className="p-8">
        <LoadingSpinner label="読み込み中..." />
      </div>
    );
  }

  return (
    <StudentMemosContent
      initialClassId={initialStudentId !== null ? (initialStudentQuery.data ?? null) : null}
      initialStudentId={initialStudentId !== null && initialStudentQuery.data ? initialStudentId : null}
      from={from}
    />
  );
}
