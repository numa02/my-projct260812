"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { CommentsContent } from "./CommentsContent";

/** [id]は初期選択のヒント。そのIDが所属するクラスを調べてから本体を描画する(クラス選択自体は画面内state) */
export function CommentsView() {
  const params = useParams<{ id: string }>();
  const initialStudentId = params.id;

  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const initialStudentQuery = useQuery({
    queryKey: ["initial-student-class", initialStudentId],
    queryFn: async (): Promise<string | null> => {
      const { data, error } = await supabase
        .from("student")
        .select("class_id")
        .eq("id", initialStudentId)
        .maybeSingle();
      if (error) throw error;
      return data?.class_id ?? null;
    },
  });

  if (initialStudentQuery.isLoading) {
    return (
      <div className="p-8">
        <LoadingSpinner label="読み込み中..." />
      </div>
    );
  }

  return (
    <CommentsContent
      initialClassId={initialStudentQuery.data ?? null}
      initialStudentId={initialStudentQuery.data ? initialStudentId : null}
    />
  );
}
