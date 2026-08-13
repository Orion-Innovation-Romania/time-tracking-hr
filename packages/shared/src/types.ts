// Response/view shapes returned by the API and consumed by the web app.
import type { Role, DoorRole, EventType, AnomalyFlag, LeaveType } from './enums';

export interface SessionUser {
  id: number;
  username: string;
  role: Role;
  mustChangePassword: boolean;
}

export interface UserAccountView {
  id: number;
  username: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  role: Role;
  isActive: boolean;
  mustChangePassword: boolean;
  managedByConfig: boolean;
  passwordResetRequestedAt: string | null;
  lastLoginAt: string | null;
  lockedUntil: string | null;
  failedAttempts: number;
  createdAt: string;
}

export interface EmployeeView {
  id: number;
  canonicalName: string;
  displayName: string;
  active: boolean;
  departments: string[];
  aliases?: string[];
}

export interface DoorView {
  id: number;
  rawLocation: string;
  readerNo: number | null;
  panel: string | null;
  floor: string | null;
  zone: string | null;
  role: DoorRole;
  displayName: string | null;
  autoDetected: boolean;
  eventCount?: number;
}

/** Per-door anomaly attribution over a date range (misclassification signal). */
export interface DoorHealthView {
  doorId: number;
  rawLocation: string;
  displayName: string | null;
  zone: string | null;
  role: DoorRole;
  events: number; // access-granted reads in range
  activeDays: number; // distinct employee-days this door was used
  problems: number; // employee-days where this door caused a missing entry/exit
  anomalyRatePct: number; // problems / activeDays, 0-100
}

export interface ParsedEventRow {
  occurredAt: string; // ISO local time
  rawLocation: string;
  direction: DoorRole;
  eventType: EventType;
  zone: string | null;
  floor: string | null;
}

export interface DiscoveredDoor {
  rawLocation: string;
  readerNo: number | null;
  panel: string | null;
  floor: string | null;
  zone: string | null;
  suggestedRole: DoorRole;
}

export interface ImportPreview {
  previewId: string;
  fileName: string;
  fileHash: string;
  rawUserName: string;
  canonicalName: string;
  matchedEmployeeId: number | null;
  department: string | null;
  rangeFrom: string | null;
  rangeTo: string | null;
  rowsTotal: number;
  rowsParsed: number;
  duplicateOfBatchId: number | null;
  newDoors: DiscoveredDoor[];
  sampleRows: ParsedEventRow[];
  warnings: string[];
}

export interface ImportResult {
  batchId: number;
  employeeId: number;
  rowsTotal: number;
  rowsNew: number;
  rowsDuplicate: number;
  affectedDates: string[];
}

export interface ImportBatchView {
  id: number;
  fileName: string;
  employeeId: number;
  employeeName: string;
  rangeFrom: string | null;
  rangeTo: string | null;
  rowsTotal: number;
  rowsNew: number;
  rowsDuplicate: number;
  status: string;
  createdAt: string;
  createdByUsername: string | null;
}

export interface DayInterval {
  start: string;
  end: string;
  source: 'inside' | 'merged-short-exit' | 'grace';
}

export interface DailySummaryView {
  date: string; // YYYY-MM-DD
  employeeId: number;
  employeeName?: string;
  workedMinutes: number;
  lunchMinutes: number;
  earlyMinutes: number;
  overtimeMinutes: number;
  firstIn: string | null;
  lastOut: string | null;
  perZone: Record<string, number>;
  flags: AnomalyFlag[];
  manual: boolean;
  intervals?: DayInterval[];
}

export interface MonthAggregateView {
  employeeId: number;
  employeeName: string;
  department: string | null;
  year: number;
  month: number; // 1-12
  daysPresent: number;
  workedMinutes: number;
  lunchMinutes: number;
  expectedMinutes: number;
  overtimeMinutes: number;
  deficitMinutes: number;
  perZone: Record<string, number>;
  anomalies: number;
}

export interface DashboardKpis {
  employees: number;
  daysPresent: number;
  totalWorkedMinutes: number;
  avgWorkedMinutesPerDay: number;
  anomalies: number;
  rangeFrom: string;
  rangeTo: string;
}

export interface TrendPoint {
  date: string;
  workedMinutes: number;
  employeesPresent: number;
}

export interface ZoneBreakdown {
  zone: string;
  minutes: number;
}

export interface LeaveView {
  id: number;
  employeeId: number;
  date: string;
  type: LeaveType;
  note: string | null;
}

export interface HolidayView {
  id: number;
  date: string;
  name: string;
}

export interface LoginHistoryView {
  id: number;
  username: string;
  at: string;
  ip: string | null;
  userAgent: string | null;
  success: boolean;
}

export interface AuditLogView {
  id: number;
  at: string;
  userId: number | null;
  username: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  before: unknown;
  after: unknown;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ApiError {
  statusCode: number;
  message: string | string[];
  error?: string;
}
