"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { resetConfirmInputSchema, type ResetConfirmInput } from "@/shared/schemas";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { InlineMessage } from "@/components/ui/InlineMessage";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

type LinkStatus = "verifying" | "valid" | "invalid";

export function ResetPasswordConfirmForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [linkStatus, setLinkStatus] = useState<LinkStatus>("verifying");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetConfirmInput>({ resolver: zodResolver(resetConfirmInputSchema) });

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    let settled = false;

    const markValid = () => {
      if (!settled) {
        settled = true;
        setLinkStatus("valid");
      }
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") markValid();
    });

    const code = searchParams.get("code");
    if (code) {
      supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
        if (!error) markValid();
      });
    }

    const timeout = setTimeout(() => {
      if (!settled) {
        settled = true;
        setLinkStatus("invalid");
      }
    }, 3000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, [searchParams]);

  const onSubmit = async (data: ResetConfirmInput) => {
    setSubmitError(null);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.updateUser({ password: data.password });

    if (error) {
      setSubmitError("パスワードの変更に失敗しました。時間をおいて再度お試しください");
      return;
    }

    await supabase.auth.signOut();
    router.push("/login");
  };

  if (linkStatus === "verifying") {
    return (
      <>
        <h1 className="text-xl font-semibold text-gray-900">パスワードリセット</h1>
        <LoadingSpinner label="リンクを確認しています..." />
      </>
    );
  }

  if (linkStatus === "invalid") {
    return (
      <>
        <h1 className="text-xl font-semibold text-gray-900">パスワードリセット</h1>
        <InlineMessage
          variant="warning"
          message="リンクが無効か、有効期限が切れています。お手数ですが、もう一度パスワードリセットを申請してください。"
        />
        <p className="text-center text-sm text-gray-600">
          <Link href="/reset-password" className="font-medium text-gray-900 hover:underline">
            パスワードリセットを再度申請する
          </Link>
        </p>
      </>
    );
  }

  return (
    <>
      <h1 className="text-xl font-semibold text-gray-900">新しいパスワードを設定</h1>

      {submitError && <InlineMessage variant="warning" message={submitError} />}

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
        <Input
          label="新しいパスワード"
          type="password"
          autoComplete="new-password"
          error={errors.password?.message}
          {...register("password")}
        />
        <Input
          label="新しいパスワード(確認用)"
          type="password"
          autoComplete="new-password"
          error={errors.confirmPassword?.message}
          {...register("confirmPassword")}
        />
        <Button type="submit" variant="primary" size="lg" loading={isSubmitting}>
          パスワードを変更する
        </Button>
      </form>
    </>
  );
}
