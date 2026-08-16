"use client";

import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

export interface SubjectRow {
  id: string;
  name: string;
}

export function useSubjects() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const queryClient = useQueryClient();

  const subjectsQuery = useQuery({
    queryKey: ["subjects"],
    queryFn: async (): Promise<SubjectRow[]> => {
      const { data, error } = await supabase
        .from("subject")
        .select("id, name")
        .order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["subjects"] });

  const createSubject = useMutation({
    mutationFn: async (name: string) => {
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("subject")
        .insert({ name, teacher_id: userData.user!.id });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const updateSubject = useMutation({
    mutationFn: async (input: { id: string; name: string }) => {
      const { error } = await supabase.from("subject").update({ name: input.name }).eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const deleteSubject = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("delete_subject", { p_subject_id: id });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return {
    subjects: subjectsQuery.data ?? [],
    isLoading: subjectsQuery.isLoading,
    createSubject,
    updateSubject,
    deleteSubject,
  };
}
