import { z } from "zod";

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
  periodStartDate: z.string().date(),
  periodEndDate: z.string().date(),
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
