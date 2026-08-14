import { z } from 'zod';
import {
  DOOR_ROLES,
  ROLES,
  LEAVE_TYPES,
  CONDITION_TYPES,
  EXPORT_KINDS,
  EXPORT_FORMATS,
  METRIC_KEYS,
} from './enums';
import { DEFAULT_WORKING_DAYS } from './constants';

// --- primitives ---
export const timeString = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Expected time as HH:mm');

export const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected date as YYYY-MM-DD');

export const passwordSchema = z
  .string()
  .min(10, 'Use at least 10 characters')
  .max(128)
  .regex(/[A-Za-z]/, 'Must contain a letter')
  .regex(/\d/, 'Must contain a digit');

// --- auth ---
export const loginSchema = z.object({
  username: z.string().min(1).max(64),
  password: z.string().min(1).max(128),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1).max(128),
    newPassword: passwordSchema,
  })
  .refine((d) => d.currentPassword !== d.newPassword, {
    message: 'New password must be different from the current one',
    path: ['newPassword'],
  });
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export const adminResetPasswordSchema = z.object({
  userId: z.number().int().positive(),
});
export type AdminResetPasswordInput = z.infer<typeof adminResetPasswordSchema>;

export const forgotPasswordSchema = z.object({
  username: z.string().min(1).max(64),
});
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

const usernameSchema = z
  .string()
  .min(2)
  .max(64)
  .regex(/^[a-zA-Z0-9._-]+$/, 'Use letters, digits, ., _ or -');

const nameSchema = z.string().trim().min(1).max(80);

export const createUserSchema = z.object({
  username: usernameSchema,
  firstName: nameSchema,
  lastName: nameSchema,
  email: z.string().trim().email().max(254),
  role: z.enum(ROLES).default('user'),
  initialPassword: passwordSchema,
});
export type CreateUserInput = z.infer<typeof createUserSchema>;

export const updateUserSchema = z.object({
  firstName: nameSchema.optional(),
  lastName: nameSchema.optional(),
  email: z.string().trim().email().max(254).optional(),
  role: z.enum(ROLES).optional(),
  isActive: z.boolean().optional(),
  initialPassword: passwordSchema.optional(),
});
export type UpdateUserInput = z.infer<typeof updateUserSchema>;

// --- config: schedule / lunch / thresholds ---
export const scheduleConfigSchema = z.object({
  startTime: timeString.default('09:00'),
  endTime: timeString.default('17:30'),
  workingDays: z
    .array(z.number().int().min(1).max(7))
    .min(1)
    .default(DEFAULT_WORKING_DAYS),
});
export type ScheduleConfig = z.infer<typeof scheduleConfigSchema>;
export const DEFAULT_SCHEDULE: ScheduleConfig = scheduleConfigSchema.parse({});

export const lunchConfigSchema = z.object({
  windowStart: timeString.default('12:00'),
  windowEnd: timeString.default('14:00'),
  capMinutes: z.number().int().min(0).max(240).default(30),
  forceMinimum: z.boolean().default(false),
});
export type LunchConfig = z.infer<typeof lunchConfigSchema>;
export const DEFAULT_LUNCH: LunchConfig = lunchConfigSchema.parse({});

export const thresholdConfigSchema = z.object({
  shortExitMinutes: z.number().int().min(0).max(120).default(10),
  roundingMinutes: z.number().int().min(0).max(60).default(0),
  overtimeThresholdMinutes: z.number().int().min(0).max(240).default(15),
});
export type ThresholdConfig = z.infer<typeof thresholdConfigSchema>;
export const DEFAULT_THRESHOLDS: ThresholdConfig = thresholdConfigSchema.parse({});

// Per-employee schedule override (nullable fields fall back to global).
export const employeeScheduleSchema = z.object({
  employeeId: z.number().int().positive(),
  startTime: timeString.nullable().optional(),
  endTime: timeString.nullable().optional(),
  workingDays: z.array(z.number().int().min(1).max(7)).nullable().optional(),
});
export type EmployeeScheduleInput = z.infer<typeof employeeScheduleSchema>;

// --- doors ---
export const doorUpdateSchema = z.object({
  role: z.enum(DOOR_ROLES).optional(),
  displayName: z.string().max(120).nullable().optional(),
  zone: z.string().max(120).nullable().optional(),
});
export type DoorUpdateInput = z.infer<typeof doorUpdateSchema>;

// --- conditions ---
export const conditionRuleSchema = z.object({
  type: z.enum(CONDITION_TYPES),
  params: z.record(z.string(), z.any()).default({}),
  enabled: z.boolean().default(true),
  order: z.number().int().default(0),
});
export type ConditionRuleInput = z.infer<typeof conditionRuleSchema>;

// --- holidays / leave ---
export const holidaySchema = z.object({
  date: dateString,
  name: z.string().min(1).max(160),
});
export type HolidayInput = z.infer<typeof holidaySchema>;

export const leaveSchema = z.object({
  employeeId: z.number().int().positive(),
  date: dateString,
  type: z.enum(LEAVE_TYPES),
  note: z.string().max(280).nullable().optional(),
});
export type LeaveInput = z.infer<typeof leaveSchema>;

// --- manual day correction ---
export const dayCorrectionSchema = z.object({
  employeeId: z.number().int().positive(),
  date: dateString,
  workedMinutes: z.number().int().min(0).max(1440),
  lunchMinutes: z.number().int().min(0).max(240).default(0),
  reason: z.string().min(3).max(280),
});
export type DayCorrectionInput = z.infer<typeof dayCorrectionSchema>;

// --- filters ---
export const attendanceFilterSchema = z.object({
  from: dateString,
  to: dateString,
  employeeIds: z.array(z.number().int().positive()).optional(),
  departments: z.array(z.string()).optional(),
  zones: z.array(z.string()).optional(),
  directions: z.array(z.enum(DOOR_ROLES)).optional(),
});
export type AttendanceFilter = z.infer<typeof attendanceFilterSchema>;

// --- export template builder ---
export const exportColumnSchema = z.object({
  key: z.enum(METRIC_KEYS),
  header: z.string().min(1).max(60),
  width: z.number().int().min(4).max(80).optional(),
});
export type ExportColumn = z.infer<typeof exportColumnSchema>;

export const exportTemplateLayoutSchema = z.object({
  title: z.string().max(120).optional(),
  columns: z.array(exportColumnSchema).default([]),
  includeTotals: z.boolean().default(true),
  // For 'pontaj' kind: cell metric of the day matrix.
  matrixMetric: z.enum(['workedHours', 'workedMinutes']).default('workedHours'),
});
export type ExportTemplateLayout = z.infer<typeof exportTemplateLayoutSchema>;

export const exportTemplateSchema = z.object({
  name: z.string().min(1).max(120),
  kind: z.enum(EXPORT_KINDS),
  layout: exportTemplateLayoutSchema,
  isDefault: z.boolean().default(false),
});
export type ExportTemplateInput = z.infer<typeof exportTemplateSchema>;

export const exportRequestSchema = z.object({
  templateId: z.number().int().positive().nullable().optional(),
  /** Used only when templateId is omitted (built-in layouts). */
  kind: z.enum(EXPORT_KINDS).optional(),
  format: z.enum(EXPORT_FORMATS).default('xlsx'),
  filter: attendanceFilterSchema,
  sendEmail: z.boolean().optional(),
});
export type ExportRequest = z.infer<typeof exportRequestSchema>;

export const exportAvailabilitySchema = z.object({
  filter: attendanceFilterSchema,
});
export type ExportAvailabilityInput = z.infer<typeof exportAvailabilitySchema>;

// --- import commit ---
export const importCommitSchema = z.object({
  previewId: z.string().min(1),
  employeeId: z.number().int().positive().nullable().optional(),
  employeeName: z.string().trim().min(1).max(120).nullable().optional(),
});
export type ImportCommitInput = z.infer<typeof importCommitSchema>;

// --- mail (Microsoft Graph sendMail) ---
const mailEmail = z.string().trim().email().max(254);

/** Split a comma/semicolon-separated recipient list. */
export function parseMailRecipients(raw: string): string[] {
  return [...new Set(raw.split(/[,;]+/).map((s) => s.trim()).filter(Boolean))];
}

export const mailConfigSchema = z.object({
  authority: z.string().trim().url().max(500),
  clientId: z.string().trim().min(1).max(80),
  clientSecret: z.string().trim().max(200).optional(),
  scope: z.string().trim().min(1).max(200),
  senderMailbox: mailEmail,
  fromAddress: mailEmail,
  fromName: z.string().trim().max(120).default(''),
  reportRecipient: z
    .string()
    .trim()
    .max(500)
    .default('')
    .refine(
      (value) =>
        value === '' || parseMailRecipients(value).every((addr) => mailEmail.safeParse(addr).success),
      { message: 'Use valid email addresses, separated by commas' },
    ),
  sendReportByDefault: z.boolean().default(false),
});
export type MailConfigInput = z.infer<typeof mailConfigSchema>;

export const sendTestMailSchema = z.object({
  to: mailEmail,
  cc: z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
    mailEmail.optional(),
  ),
  subject: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(10_000),
});
export type SendTestMailInput = z.infer<typeof sendTestMailSchema>;
