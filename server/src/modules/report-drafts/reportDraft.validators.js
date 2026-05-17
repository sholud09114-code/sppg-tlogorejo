import { z } from "zod";

const stringField = z.string();
const optionalString = z.string().nullable().optional().transform((v) => v ?? "");
const numberOrDash = z.union([z.number(), z.string()]);

export const reportSchema = z
  .object({
    title: optionalString,
    programName: optionalString,
    sppgName: optionalString,
    sppgId: optionalString,
    foundationName: optionalString,
    periodLabel: optionalString,
    kecamatan: optionalString,
    city: optionalString,
    province: optionalString,
  })
  .strict();

export const targetSchema = z
  .object({
    category: stringField,
    total: numberOrDash,
  })
  .passthrough();

export const preparationSchema = z
  .object({
    title: stringField,
    points: z.array(stringField).default([]),
  })
  .passthrough();

export const dailyRowSchema = z
  .object({
    no: z.number(),
    district: optionalString,
    schoolName: optionalString,
    address: optionalString,
    recipientCount: numberOrDash,
    editable: z.boolean().optional(),
  })
  .passthrough();

export const dailyRecipientSchema = z
  .object({
    date: stringField,
    dayLabel: optionalString,
    dateLabel: optionalString,
    totalBeneficiaries: z.number(),
    rows: z.array(dailyRowSchema),
  })
  .passthrough();

export const menuSchema = z
  .object({
    no: z.number(),
    city: optionalString,
    schools: z.array(stringField).default([]),
    date: optionalString,
    dateLabel: optionalString,
    menuItems: z.array(stringField).default([]),
    note: optionalString,
  })
  .passthrough();

export const activityPhotoSchema = z
  .object({
    id: z.string().nullable().optional(),
    imageUrl: stringField,
    caption: optionalString,
    sortOrder: z.number().default(0),
    section: z.literal("activity").optional(),
    filename: stringField.optional(),
  })
  .passthrough();

export const menuPhotoSchema = z
  .object({
    id: z.string().nullable().optional(),
    no: z.number(),
    schools: z.array(stringField).default([]),
    date: optionalString,
    dateLabel: optionalString,
    imageUrl: optionalString,
    sortOrder: z.number().default(0),
    section: z.literal("menu").optional(),
    filename: stringField.optional(),
  })
  .passthrough();

export const signaturesSchema = z
  .object({
    placeDate: optionalString,
    leftTitle: optionalString,
    leftName: optionalString,
    rightTitle: optionalString,
    rightName: optionalString,
  })
  .passthrough();

export const draftDataSchema = z
  .object({
    status: z.enum(["draft", "final"]).default("draft"),
    report: reportSchema,
    range: z
      .object({
        start_date: stringField,
        end_date: stringField,
      })
      .passthrough(),
    chapters: z
      .object({
        background: optionalString,
        goals: z.array(stringField).default([]),
        targets: z.array(targetSchema).default([]),
        targetTotal: z.number().default(0),
        preparation: z.array(preparationSchema).default([]),
        implementation: optionalString,
        lessons: z.array(stringField).default([]),
        problems: z.array(stringField).default([]),
        solutions: z.array(stringField).default([]),
        followUps: z.array(stringField).default([]),
        closing: optionalString,
      })
      .passthrough(),
    dailyRecipients: z.array(dailyRecipientSchema).default([]),
    menus: z.array(menuSchema).default([]),
    activityPhotos: z.array(activityPhotoSchema).default([]),
    menuPhotos: z.array(menuPhotoSchema).default([]),
    signatures: signaturesSchema,
  })
  .passthrough();

export const generateInputSchema = z
  .object({
    start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    title: z.string().optional(),
  })
  .refine((value) => value.end_date >= value.start_date, {
    message: "end_date tidak boleh lebih kecil dari start_date",
    path: ["end_date"],
  });

export const updateDraftInputSchema = z
  .object({
    data: draftDataSchema.optional(),
    title: z.string().optional(),
    status: z.enum(["draft", "final"]).optional(),
  })
  .refine((value) => value.data || value.title || value.status, {
    message: "Tidak ada field yang diupdate",
  });

export const photoMetaSchema = z
  .object({
    section: z.enum(["activity", "menu"]),
    caption: z.string().optional(),
    no: z.coerce.number().optional(),
  })
  .passthrough();
