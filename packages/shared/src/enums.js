"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.METRIC_KEYS = exports.EXPORT_FORMATS = exports.EXPORT_KINDS = exports.ANOMALY_FLAGS = exports.CONDITION_TYPES = exports.LEAVE_TYPES = exports.EVENT_TYPES = exports.DOOR_ROLES = exports.ROLES = void 0;
exports.ROLES = ['admin', 'user'];
exports.DOOR_ROLES = ['IN', 'OUT', 'NEUTRAL'];
exports.EVENT_TYPES = ['ACCESS_GRANTED', 'ACCESS_DENIED', 'OTHER'];
exports.LEAVE_TYPES = ['vacation', 'sick', 'remote', 'other'];
exports.CONDITION_TYPES = [
    'MIN_SESSION_MINUTES',
    'GRACE_START_MINUTES',
    'GRACE_END_MINUTES',
    'ROUND_DAILY_MINUTES',
    'IGNORE_ZONE',
    'MAX_DAILY_MINUTES',
];
exports.ANOMALY_FLAGS = [
    'MISSING_EXIT',
    'MISSING_ENTRY',
    'OVERNIGHT',
    'ZERO_DURATION',
    'ONLY_OUTSIDE_SCHEDULE',
    'MANUAL_OVERRIDE',
    'EARLY_START',
    'OVERTIME',
];
exports.EXPORT_KINDS = ['summary', 'pontaj', 'raw'];
exports.EXPORT_FORMATS = ['xlsx', 'csv'];
exports.METRIC_KEYS = [
    'employeeName',
    'department',
    'daysPresent',
    'workedHours',
    'workedMinutes',
    'lunchMinutes',
    'expectedHours',
    'overtimeHours',
    'deficitHours',
    'firstIn',
    'lastOut',
    'anomalies',
];
//# sourceMappingURL=enums.js.map