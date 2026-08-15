import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

export const adminClient: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

export interface TestTeacher {
  id: string;
  email: string;
  client: SupabaseClient;
}

/** テスト用の教員アカウントを作成し、その教員としてRLSが適用されるsupabase-jsクライアントを返す */
export async function createTestTeacher(): Promise<TestTeacher> {
  const email = `test-${randomUUID()}@example.com`;
  const password = "test-password-1234";

  const { data: created, error: createError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createError || !created.user) {
    throw createError ?? new Error("failed to create test user");
  }

  const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: signedIn, error: signInError } = await anon.auth.signInWithPassword({
    email,
    password,
  });
  if (signInError || !signedIn.session) {
    throw signInError ?? new Error("failed to sign in as test user");
  }

  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: {
      headers: { Authorization: `Bearer ${signedIn.session.access_token}` },
    },
  });

  return { id: created.user.id, email, client };
}

export async function deleteTestTeacher(teacherId: string): Promise<void> {
  await adminClient.auth.admin.deleteUser(teacherId);
}
