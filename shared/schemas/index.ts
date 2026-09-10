import { z } from "zod";

// パスワードの最小文字数はSupabase Auth側(supabase/config.toml minimum_password_length)と揃える
const PASSWORD_MIN_LENGTH = 6;

export const loginInputSchema = z.object({
  email: z.string().email("メールアドレスの形式が正しくありません"),
  password: z.string().min(1, "パスワードを入力してください"),
});
export type LoginInput = z.infer<typeof loginInputSchema>;

export const signupInputSchema = z.object({
  email: z.string().email("メールアドレスの形式が正しくありません"),
  password: z
    .string()
    .min(PASSWORD_MIN_LENGTH, `パスワードは${PASSWORD_MIN_LENGTH}文字以上で入力してください`),
});
export type SignupInput = z.infer<typeof signupInputSchema>;

export const resetRequestInputSchema = z.object({
  email: z.string().email("メールアドレスの形式が正しくありません"),
});
export type ResetRequestInput = z.infer<typeof resetRequestInputSchema>;

export const resetConfirmInputSchema = z
  .object({
    password: z
      .string()
      .min(PASSWORD_MIN_LENGTH, `パスワードは${PASSWORD_MIN_LENGTH}文字以上で入力してください`),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "パスワードが一致しません",
    path: ["confirmPassword"],
  });
export type ResetConfirmInput = z.infer<typeof resetConfirmInputSchema>;

export const classInputSchema = z.object({
  grade: z.string().min(1),
  displayName: z.string().min(1),
});
export type ClassInput = z.infer<typeof classInputSchema>;

export const studentInputSchema = z.object({
  attendanceNumber: z.number().int().positive(),
  name: z.string().min(1),
});
export type StudentInput = z.infer<typeof studentInputSchema>;

export const subjectInputSchema = z.object({
  name: z.string().min(1),
});
export type SubjectInput = z.infer<typeof subjectInputSchema>;

export const timetableSlotSchema = z.object({
  weekday: z.number().int().min(1).max(5),
  period: z.number().int().min(1).max(6),
  subjectId: z.string().uuid().nullable(),
  classId: z.string().uuid().nullable(),
});
export type TimetableSlot = z.infer<typeof timetableSlotSchema>;

export const memoInputSchema = z.object({
  studentId: z.string().uuid(),
  subjectId: z.string().uuid(),
  noteDate: z.string().date(),
  period: z.number().int().min(1).max(6),
  content: z.string().min(1),
  shareFlag: z.enum(["shared", "private"]).default("shared"),
});
export type MemoInput = z.infer<typeof memoInputSchema>;

export const commentSaveInputSchema = z.object({
  content: z.string().min(1),
  targetCharCount: z.number().int().positive().optional(),
  creationMethod: z.enum(["direct_ai", "prompt_copy", "manual"]),
});
export type CommentSaveInput = z.infer<typeof commentSaveInputSchema>;

export const aiProviderSettingInputSchema = z.object({
  provider: z.enum(["openai", "anthropic", "gemini"]),
  model: z.string().min(1),
  apiKey: z.string().min(1),
});
export type AiProviderSettingInput = z.infer<typeof aiProviderSettingInputSchema>;

export const promptTemplateInputSchema = z.object({
  content: z.string().min(1),
});
export type PromptTemplateInput = z.infer<typeof promptTemplateInputSchema>;

export const importStudentRowSchema = z.object({
  attendanceNumber: z.number().int().positive().nullable(),
  name: z.string().nullable(),
});
export type ImportStudentRow = z.infer<typeof importStudentRowSchema>;
