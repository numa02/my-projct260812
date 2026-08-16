"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

export function useTeacherProfile() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const profileQuery = useQuery({
    queryKey: ["teacher-profile"],
    queryFn: async (): Promise<{ startDate: string | null }> => {
      const { data, error } = await supabase.from("teacher_profile").select("start_date").single();
      if (error) throw error;
      return { startDate: data.start_date };
    },
  });

  return {
    startDate: profileQuery.data?.startDate ?? null,
    isLoading: profileQuery.isLoading,
  };
}
