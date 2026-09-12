"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { signupInputSchema, type SignupInput } from "@/shared/schemas";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { InlineMessage } from "@/components/ui/InlineMessage";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";

const SCHOOL_LEVEL_OPTIONS = [
  { value: "", label: "選択しない" },
  { value: "elementary", label: "小学校" },
  { value: "middle", label: "中学校" },
];

export default function SignupPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignupInput>({ resolver: zodResolver(signupInputSchema) });

  const onSubmit = async ({ email, password, schoolLevel }: SignupInput) => {
    setSubmitError(null);
    const supabase = createSupabaseBrowserClient();
    const { data: signUpData, error } = await supabase.auth.signUp({ email, password });

    if (error) {
      if (error.message.toLowerCase().includes("already registered")) {
        setSubmitError("このメールアドレスは既に登録されています");
      } else {
        setSubmitError("登録に失敗しました。時間をおいて再度お試しください");
      }
      return;
    }

    // メール確認を無効化しているため、既存ユーザーへの再サインアップでもエラーを返さず
    // 「本人確認用の偽の識別情報」を返すことがある(identitiesが空配列)。その場合も
    // 既に登録済みとして扱う
    if (signUpData.user && signUpData.user.identities?.length === 0) {
      setSubmitError("このメールアドレスは既に登録されています");
      return;
    }

    // 標準科目セットの投入はサインアップの成否とは切り離す。失敗してもサインアップ自体は
    // 成功として扱い、教員は科目管理画面から改めて投入をやり直せる(docs/features/subjects/design.md)
    if (schoolLevel) {
      const { error: seedError } = await supabase.rpc("seed_standard_subjects", {
        p_school_level: schoolLevel,
      });
      if (seedError) {
        showToast("error", "標準科目の登録に失敗しました。科目管理画面から再度お試しください");
      }
    }

    router.push("/");
    router.refresh();
  };

  return (
    <>
      <h1 className="text-xl font-semibold text-gray-900">サインアップ</h1>

      {submitError && <InlineMessage variant="warning" message={submitError} />}

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
        <Input
          label="メールアドレス"
          type="email"
          autoComplete="email"
          error={errors.email?.message}
          {...register("email")}
        />
        <Input
          label="パスワード"
          type="password"
          autoComplete="new-password"
          error={errors.password?.message}
          {...register("password")}
        />
        <Controller
          name="schoolLevel"
          control={control}
          render={({ field }) => (
            <Select
              label="学校区分(任意)"
              options={SCHOOL_LEVEL_OPTIONS}
              value={field.value ?? ""}
              onChange={(v) => field.onChange(v === "" ? undefined : v)}
            />
          )}
        />
        <Button type="submit" variant="primary" size="lg" loading={isSubmitting}>
          サインアップ
        </Button>
      </form>

      <p className="text-center text-sm text-gray-600">
        既にアカウントをお持ちの場合は{" "}
        <Link href="/login" className="font-medium text-gray-900 hover:underline">
          ログイン
        </Link>
      </p>
    </>
  );
}
