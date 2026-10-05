import { z } from "zod";
const percentage = z
  .string()
  .trim()
  .min(1, "Enter a grade.")
  .refine((v) => Number.isFinite(Number(v)), "Enter a number.")
  .transform(Number)
  .pipe(
    z
      .number()
      .min(0)
      .max(100)
      .refine(
        (v) => Math.abs(v * 100 - Math.round(v * 100)) < 1e-8,
        "Use at most two decimal places.",
      ),
  );
export const gradeFormSchema = z.object({
  student: z
    .string()
    .trim()
    .min(2, "Use at least two characters for the student name.")
    .max(120),
  course: z
    .string()
    .trim()
    .min(2, "Use at least two characters for the course.")
    .max(160),
  assessment: z
    .string()
    .trim()
    .min(2, "Use at least two characters for the assessment.")
    .max(160),
  percentage,
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Choose an assessment date.")
    .refine((value) => {
      const date = new Date(`${value}T00:00:00Z`);
      return (
        Number.isFinite(date.getTime()) &&
        date.toISOString().slice(0, 10) === value
      );
    }, "Choose a valid calendar date."),
  notes: z.string().max(2000),
});
export const contactFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Use at least two characters for the name.")
    .max(120),
  phone: z
    .string()
    .trim()
    .regex(
      /^\+?[0-9 ()-]{7,30}$/,
      "Enter a valid phone number using digits, spaces, parentheses or hyphens.",
    )
    .refine((v) => {
      const count = v.replace(/\D/g, "").length;
      return count >= 7 && count <= 15;
    }, "Use 7 to 15 digits."),
  fellowship: z.boolean(),
  branch: z.boolean(),
  notes: z.string().max(2000),
});
