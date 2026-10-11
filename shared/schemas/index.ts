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
  // 標準科目セットの自動投入のトリガーとしてのみ使う一時的な選択値。DBには永続化しない
  schoolLevel: z.enum(["elementary", "middle"]).optional(),
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

/** 単元(科目に属する教科書の章・題材のまとまり)。同じ科目内の同名は科目名と同じ方針で許す */
export const unitInputSchema = z.object({
  name: z.string().trim().min(1, "単元名を入力してください"),
});
export type UnitInput = z.infer<typeof unitInputSchema>;

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
  /** そのコマの単元。選択は任意で、未選択はnull(単元未設定) */
  unitId: z.string().uuid().nullable().default(null),
  noteDate: z.string().date(),
  period: z.number().int().min(1).max(6),
  content: z.string().min(1),
  shareFlag: z.enum(["shared", "private"]).default("shared"),
});
export type MemoInput = z.infer<typeof memoInputSchema>;

export const lifeMemoInputSchema = z.object({
  studentId: z.string().uuid(),
  noteDate: z.string().date("日付を入力してください"),
  content: z.string().trim().min(1, "メモを入力してください"),
  shareFlag: z.enum(["shared", "private"]).default("shared"),
});
export type LifeMemoInput = z.infer<typeof lifeMemoInputSchema>;

/**
 * 所見の種類。learning=学習の所見(全教科の授業メモが材料)、life=生活の所見(生活メモが材料)、
 * general=総合の所見(科目「総合」の授業メモのみが材料)。3種類は生徒ごとに独立して1件ずつ保持する
 */
export const commentKindSchema = z.enum(["learning", "life", "general"]);
export type CommentKind = z.infer<typeof commentKindSchema>;

/**
 * 所見のAI生成の単位。whole=対象期間の共有メモ全体から1件生成する(従来の挙動)、
 * per_unit=共有メモを単元ごとに分けて単元ごとに所見案を生成し、教員が採用するものを選ぶ。
 * 生活の所見は単元を持たないため`whole`のみ(制約はUI側で表現する)
 */
export const generationScopeSchema = z.enum(["whole", "per_unit"]);
export type GenerationScope = z.infer<typeof generationScopeSchema>;

/**
 * プロンプトひな形の識別子。所見の種類(学習・生活・総合)と生成単位(まとめて生成・単元ごと)の
 * 組み合わせで決まる。生活の所見は単元を持たないため「単元ごと」用を持たず、計5つになる。
 * 種類と生成単位からの変換は`shared/prompt-template-key.ts`の`resolvePromptTemplateKey`
 */
export const promptTemplateKeySchema = z.enum([
  "learning",
  "learning_unit",
  "life",
  "general",
  "general_unit",
]);
export type PromptTemplateKey = z.infer<typeof promptTemplateKeySchema>;

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
