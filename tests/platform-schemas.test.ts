import { describe, it, expect } from "vitest";
import { gradeFormSchema, contactFormSchema } from "../lib/platform-schemas";
const grade = {
  student: "Ada",
  course: "Computing",
  assessment: "Exam",
  percentage: "59",
  date: "2026-10-01",
  notes: "",
};
describe("grade submission validation", () => {
  it("rejects blank scores rather than treating them as zero", () => {
    expect(
      gradeFormSchema.safeParse({ ...grade, percentage: "" }).success,
    ).toBe(false);
  });
  it.each(["58.99", "59", "0", "100"])(
    "accepts the boundary score %s without changing it",
    (percentage) => {
      expect(gradeFormSchema.parse({ ...grade, percentage }).percentage).toBe(
        Number(percentage),
      );
    },
  );
  it.each(["-1", "101", "abc"])(
    "rejects invalid percentage %s",
    (percentage) => {
      expect(gradeFormSchema.safeParse({ ...grade, percentage }).success).toBe(
        false,
      );
    },
  );
  it("rejects empty student", () => {
    expect(gradeFormSchema.safeParse({ ...grade, student: "  " }).success).toBe(
      false,
    );
  });
});
describe("contact validation", () => {
  const contact = {
    name: "Ada",
    phone: "+44 7700 900123",
    notes: "",
    fellowship: false,
    branch: false,
  };
  it("accepts international phone formatting", () => {
    expect(contactFormSchema.safeParse(contact).success).toBe(true);
  });
  it.each(["hello", "12", "", "12345678901234567890"])(
    "rejects invalid phone %s",
    (phone) => {
      expect(contactFormSchema.safeParse({ ...contact, phone }).success).toBe(
        false,
      );
    },
  );
});
describe("database contract boundaries", () => {
  it.each(["2026-99-99", "2026-02-30", "2025-02-29"])(
    "rejects impossible date %s",
    (date) =>
      expect(gradeFormSchema.safeParse({ ...grade, date }).success).toBe(false),
  );
  it("accepts leap day", () =>
    expect(
      gradeFormSchema.safeParse({ ...grade, date: "2024-02-29" }).success,
    ).toBe(true));
  it("rejects three decimal grades", () =>
    expect(
      gradeFormSchema.safeParse({ ...grade, percentage: "58.999" }).success,
    ).toBe(false));
  it("accepts floating point two decimal grade", () =>
    expect(
      gradeFormSchema.safeParse({ ...grade, percentage: "58.01" }).success,
    ).toBe(true));
  it.each(["student", "course", "assessment"])(
    "requires two characters for %s",
    (field) =>
      expect(
        gradeFormSchema.safeParse({ ...grade, [field]: " A " }).success,
      ).toBe(false),
  );
  const contact = {
    name: "Ada",
    phone: "+44 7700 900123",
    notes: "",
    fellowship: false,
    branch: false,
  };
  it("rejects one character contact name", () =>
    expect(
      contactFormSchema.safeParse({ ...contact, name: " A " }).success,
    ).toBe(false));
  it.each([
    "07700.900123",
    "07700\t900123",
    "07700                        900123",
  ])("rejects phone unsupported by database %s", (phone) =>
    expect(contactFormSchema.safeParse({ ...contact, phone }).success).toBe(
      false,
    ),
  );
});
