"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { resetRequestInputSchema, type ResetRequestInput } from "@/shared/schemas";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { InlineMessage } from "@/components/ui/InlineMessage";

export default function ResetPasswordRequestPage() {
  const [sent, setSent] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetRequestInput>({ resolver: zodResolver(resetRequestInputSchema) });

  const onSubmit = async (data: ResetRequestInput) => {
    setSubmitError(null);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.resetPasswordForEmail(data.email, {
      redirectTo: `${window.location.origin}/reset-password/confirm`,
    });

    // 登録有無にかかわらず同一メッセージを表示する(F8)。通信エラー等の場合のみ別途エラー表示する
    if (error && error.status && error.status >= 500) {
      setSubmitError("送信に失敗しました。時間をおいて再度お試しください");
      return;
    }

    setSent(true);
  };

  if (sent) {
    return (
      <>
        <h1 className="text-xl font-semibold text-gray-900">パスワードリセット申請</h1>
        <InlineMessage
          variant="info"
          message="ご入力いただいたメールアドレス宛にパスワードリセット用のリンクを送信しました。メールをご確認ください。"
        />
        <p className="text-center text-sm text-gray-600">
          <Link href="/login" className="font-medium text-gray-900 hover:underline">
            ログイン画面に戻る
          </Link>
        </p>
      </>
    );
  }

  return (
    <>
      <h1 className="text-xl font-semibold text-gray-900">パスワードリセット申請</h1>

      {submitError && <InlineMessage variant="warning" message={submitError} />}

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
        <Input
          label="メールアドレス"
          type="email"
          autoComplete="email"
          error={errors.email?.message}
          {...register("email")}
        />
        <Button type="submit" variant="primary" size="lg" loading={isSubmitting}>
          送信
        </Button>
      </form>

      <p className="text-center text-sm text-gray-600">
        <Link href="/login" className="hover:underline">
          ログイン画面に戻る
        </Link>
      </p>
    </>
  );
}
