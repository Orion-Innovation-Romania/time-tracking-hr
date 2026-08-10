"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.importCommitSchema = exports.exportRequestSchema = exports.exportTemplateSchema = exports.exportTemplateLayoutSchema = exports.exportColumnSchema = exports.attendanceFilterSchema = exports.dayCorrectionSchema = exports.leaveSchema = exports.holidaySchema = exports.conditionRuleSchema = exports.doorUpdateSchema = exports.employeeScheduleSchema = exports.DEFAULT_THRESHOLDS = exports.thresholdConfigSchema = exports.DEFAULT_LUNCH = exports.lunchConfigSchema = exports.DEFAULT_SCHEDULE = exports.scheduleConfigSchema = exports.adminResetPasswordSchema = exports.changePasswordSchema = exports.loginSchema = exports.passwordSchema = exports.dateString = exports.timeString = void 0;
const zod_1 = require("zod");
const enums_1 = require("./enums");
const constants_1 = require("./constants");
exports.timeString = zod_1.z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Expected time as HH:mm');
exports.dateString = zod_1.z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected date as YYYY-MM-DD');
exports.passwordSchema = zod_1.z
    .string()
    .min(10, 'Use at least 10 characters')
    .max(128)
    .regex(/[A-Za-z]/, 'Must contain a letter')
    .regex(/\d/, 'Must contain a digit');
exports.loginSchema = zod_1.z.object({
    username: zod_1.z.string().min(1).max(64),
    password: zod_1.z.string().min(1).max(128),
});
exports.changePasswordSchema = zod_1.z
    .object({
    currentPassword: zod_1.z.string().min(1).max(128),
    newPassword: exports.passwordSchema,
})
    .refine((d) => d.currentPassword !== d.newPassword, {
    message: 'New password must be different from the current one',
    path: ['newPassword'],
});
exports.adminResetPasswordSchema = zod_1.z.object({
    userId: zod_1.z.number().int().positive(),
});
exports.scheduleConfigSchema = zod_1.z.object({
    startTime: exports.timeString.default('08:00'),
    endTime: exports.timeString.default('18:00'),
    workingDays: zod_1.z
        .array(zod_1.z.number().int().min(1).max(7))
        .min(1)
        .default(constants_1.DEFAULT_WORKING_DAYS),
});
exports.DEFAULT_SCHEDULE = exports.scheduleConfigSchema.parse({});
exports.lunchConfigSchema = zod_1.z.object({
    windowStart: exports.timeString.default('12:00'),
    windowEnd: exports.timeString.default('14:00'),
    capMinutes: zod_1.z.number().int().min(0).max(240).default(30),
    forceMinimum: zod_1.z.boolean().default(false),
});
exports.DEFAULT_LUNCH = exports.lunchConfigSchema.parse({});
exports.thresholdConfigSchema = zod_1.z.object({
    shortExitMinutes: zod_1.z.number().int().min(0).max(120).default(10),
    roundingMinutes: zod_1.z.number().int().min(0).max(60).default(0),
    overtimeThresholdMinutes: zod_1.z.number().int().min(0).max(240).default(15),
});
exports.DEFAULT_THRESHOLDS = exports.thresholdConfigSchema.parse({});
exports.employeeScheduleSchema = zod_1.z.object({
    employeeId: zod_1.z.number().int().positive(),
    startTime: exports.timeString.nullable().optional(),
    endTime: exports.timeString.nullable().optional(),
    workingDays: zod_1.z.array(zod_1.z.number().int().min(1).max(7)).nullable().optional(),
});
exports.doorUpdateSchema = zod_1.z.object({
    role: zod_1.z.enum(enums_1.DOOR_ROLES).optional(),
    displayName: zod_1.z.string().max(120).nullable().optional(),
    zone: zod_1.z.string().max(120).nullable().optional(),
});
exports.conditionRuleSchema = zod_1.z.object({
    type: zod_1.z.enum(enums_1.CONDITION_TYPES),
    params: zod_1.z.record(zod_1.z.string(), zod_1.z.any()).default({}),
    enabled: zod_1.z.boolean().default(true),
    order: zod_1.z.number().int().default(0),
});
exports.holidaySchema = zod_1.z.object({
    date: exports.dateString,
    name: zod_1.z.string().min(1).max(160),
});
exports.leaveSchema = zod_1.z.object({
    employeeId: zod_1.z.number().int().positive(),
    date: exports.dateString,
    type: zod_1.z.enum(enums_1.LEAVE_TYPES),
    note: zod_1.z.string().max(280).nullable().optional(),
});
exports.dayCorrectionSchema = zod_1.z.object({
    employeeId: zod_1.z.number().int().positive(),
    date: exports.dateString,
    workedMinutes: zod_1.z.number().int().min(0).max(1440),
    lunchMinutes: zod_1.z.number().int().min(0).max(240).default(0),
    reason: zod_1.z.string().min(3).max(280),
});
exports.attendanceFilterSchema = zod_1.z.object({
    from: exports.dateString,
    to: exports.dateString,
    employeeIds: zod_1.z.array(zod_1.z.number().int().positive()).optional(),
    departments: zod_1.z.array(zod_1.z.string()).optional(),
    zones: zod_1.z.array(zod_1.z.string()).optional(),
    directions: zod_1.z.array(zod_1.z.enum(enums_1.DOOR_ROLES)).optional(),
});
exports.exportColumnSchema = zod_1.z.object({
    key: zod_1.z.enum(enums_1.METRIC_KEYS),
    header: zod_1.z.string().min(1).max(60),
    width: zod_1.z.number().int().min(4).max(80).optional(),
});
exports.exportTemplateLayoutSchema = zod_1.z.object({
    title: zod_1.z.string().max(120).optional(),
    columns: zod_1.z.array(exports.exportColumnSchema).default([]),
    includeTotals: zod_1.z.boolean().default(true),
    matrixMetric: zod_1.z.enum(['workedHours', 'workedMinutes']).default('workedHours'),
});
exports.exportTemplateSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(120),
    kind: zod_1.z.enum(enums_1.EXPORT_KINDS),
    layout: exports.exportTemplateLayoutSchema,
    isDefault: zod_1.z.boolean().default(false),
});
exports.exportRequestSchema = zod_1.z.object({
    templateId: zod_1.z.number().int().positive().nullable().optional(),
    kind: zod_1.z.enum(enums_1.EXPORT_KINDS).default('summary'),
    format: zod_1.z.enum(enums_1.EXPORT_FORMATS).default('xlsx'),
    filter: exports.attendanceFilterSchema,
});
exports.importCommitSchema = zod_1.z.object({
    previewId: zod_1.z.string().min(1),
    employeeId: zod_1.z.number().int().positive().nullable().optional(),
    employeeName: zod_1.z.string().trim().min(1).max(120).nullable().optional(),
});
//# sourceMappingURL=schemas.js.map