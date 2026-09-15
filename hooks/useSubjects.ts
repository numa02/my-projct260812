"use client";

import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

export interface SubjectRow {
  id: string;
  name: string;
}

export type SchoolLevel = "elementary" | "middle";

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

  const seedStandardSubjects = useMutation({
    mutationFn: async (schoolLevel: SchoolLevel) => {
      const { data, error } = await supabase.rpc("seed_standard_subjects", {
        p_school_level: schoolLevel,
      });
      if (error) throw error;
      return data as { inserted: string[] };
    },
    onSuccess: invalidate,
  });

  const importSubjects = useMutation({
    mutationFn: async (names: string[]) => {
      const { data: userData } = await supabase.auth.getUser();
      const { data: existing, error: fetchError } = await supabase.from("subject").select("name");
      if (fetchError) throw fetchError;
      const existingNames = new Set((existing ?? []).map((s) => s.name));
      const newNames = names.filter((name) => !existingNames.has(name));
      if (newNames.length === 0) return { inserted: [] as string[] };
      const { error } = await supabase
        .from("subject")
        .insert(newNames.map((name) => ({ name, teacher_id: userData.user!.id })));
      if (error) throw error;
      return { inserted: newNames };
    },
    onSuccess: invalidate,
  });

  return {
    subjects: subjectsQuery.data ?? [],
    isLoading: subjectsQuery.isLoading,
    createSubject,
    updateSubject,
    deleteSubject,
    seedStandardSubjects,
    importSubjects,
  };
}
