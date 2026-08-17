"use client";

import { useParams, useSearchParams } from "next/navigation";
import { ClassCommentsContent } from "./ClassCommentsContent";

/**
 * [[...id]]は初期選択クラスのヒント(任意。生徒名簿画面からの遷移時のみ付与される)。
 * ?studentはその中で目立たせる生徒(任意)。クラス選択自体は画面内state
 */
export function ClassCommentsView() {
  const params = useParams<{ id?: string[] }>();
  const searchParams = useSearchParams();

  const initialClassId = params.id?.[0] ?? null;
  const highlightStudentId = searchParams.get("student");

  return <ClassCommentsContent initialClassId={initialClassId} highlightStudentId={highlightStudentId} />;
}
