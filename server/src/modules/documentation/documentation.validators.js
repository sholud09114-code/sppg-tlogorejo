import { z } from "zod";

export const PHOTO_TYPES = ["menu_daily", "distribution", "activity_other"];

export const PHOTO_TYPE_LABELS = {
  menu_daily: "Menu Harian",
  distribution: "Distribusi",
  activity_other: "Kegiatan Lain",
};

export const createDocumentationSchema = z.object({
  photo_type: z.enum(PHOTO_TYPES),
  photo_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "photo_date harus YYYY-MM-DD"),
  title: z.string().max(255).optional(),
  notes: z.string().optional(),
});

export const updateDocumentationSchema = z
  .object({
    photo_type: z.enum(PHOTO_TYPES).optional(),
    photo_date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "photo_date harus YYYY-MM-DD")
      .optional(),
    title: z.string().max(255).optional(),
    notes: z.string().optional(),
  })
  .refine(
    (value) =>
      value.photo_type !== undefined ||
      value.photo_date !== undefined ||
      value.title !== undefined ||
      value.notes !== undefined,
    { message: "Tidak ada field yang diupdate" }
  );

export const listQuerySchema = z.object({
  photo_type: z.enum(PHOTO_TYPES).optional(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});
