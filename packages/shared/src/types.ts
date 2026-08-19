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

export type WelcomeEmailStatus = 'sent' | 'skipped' | 'failed';

export interface CreateUserResult extends UserAccountView {
  welcomeEmail: WelcomeEmailStatus;
  welcomeEmailError: string | null;
}

export interface UpdateUserResult extends UserAccountView {
  passwordEmail?: WelcomeEmailStatus;
  passwordEmailError?: string | null;
}

export interface EmployeeView {
  id: number;
  canonicalName: string;
  displayName: string;
  active: boolean;
  departments: string[];
  aliases?: string[];
}

export interface OfficeView {
  id: number;
  name: string;
}

export interface ReaderView {
  id: number;
  doorId: number;
  rawLocation: string;
  readerNo: number | null;
  panel: string | null;
  role: DoorRole;
  autoDetected: boolean;
  eventCount: number;
  valid: boolean;
}

export interface DoorView {
  id: number;
  name: string;
  floor: string | null;
  officeId: number | null;
  officeName: string | null;
  eventCount: number;
  readers: ReaderView[];
}

export interface ParsedEventRow {
  occurredAt: string; // ISO local time
  rawLocation: string;
  direction: DoorRole;
  eventType: EventType;
  zone: string | null;
  floor: string | null;
  employeeName?: string | null;
}

export type ImportKind = 'single' | 'multi';

export interface ImportPreviewEmployee {
  rawUserName: string;
  department: string | null;
  matchedEmployeeId: number | null;
  eventCount: number;
}

export interface DiscoveredDoor {
  rawLocation: string;
  readerNo: number | null;
  panel: string | null;
  floor: string | null;
  suggestedName: string;
  suggestedRole: DoorRole;
}

export interface ImportPreview {
  previewId: string;
  fileName: string;
  fileHash: string;
  kind: ImportKind;
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
  employees: ImportPreviewEmployee[];
  warnings: string[];
}

export interface ImportResult {
  batchId: number;
  employeeId: number;
  employeeCount: number;
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
  zone?: string | null;
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
  manualReason: string | null;
  intervals?: DayInterval[];
}

/** Why a single badge read is highlighted in the day-insight timeline. */
export type DayEventIssue =
  | 'unmatched-exit'
  | 'unclosed-entry'
  | 'already-inside'
  | 'neutral'
  | 'not-granted';

export interface DayAccessEventView {
  occurredAt: string; // ISO
  time: string; // HH:mm:ss wall-clock
  role: DoorRole;
  doorLabel: string;
  zone: string | null;
  eventType: EventType;
  issue: DayEventIssue | null;
  insideAfter: boolean;
}

/** Daily summary plus the raw badge timeline used to explain flags. */
export interface DayDetailView extends DailySummaryView {
  events: DayAccessEventView[];
  schedule: { startTime: string; endTime: string };
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

/** Public mail settings (client secret is never returned). */
export interface MailConfigView {
  authority: string;
  clientId: string;
  scope: string;
  senderMailbox: string;
  fromAddress: string;
  fromName: string;
  reportRecipient: string;
  sendReportByDefault: boolean;
  problemReportRecipient: string;
  hasClientSecret: boolean;
  configured: boolean;
}

/** Policy visible to any signed-in user (no Graph secrets). */
export interface MailReportPolicy {
  sendByDefault: boolean;
  recipient: string;
  canSend: boolean;
}

/** Whether signed-in users can send “Report a problem” (no recipient addresses). */
export interface MailProblemReportPolicy {
  canSend: boolean;
}

export interface ProblemReportResult {
  id: string;
}

export interface MailVerifyResult {
  ok: true;
  expiresIn: number;
}

export interface MailSendResult {
  ok: true;
}

export interface ExportAvailability {
  hasData: boolean;
}

export type ResourceHealth = 'ok' | 'watch' | 'critical';

export interface SystemHostInfo {
  hostname: string;
  platform: string;
  release: string;
  arch: string;
  cpuCount: number;
  cpuModel: string;
  nodeVersion: string;
  inContainer: boolean;
  memSource: 'os' | 'cgroup';
}

export interface SystemSnapshot {
  at: string;
  cpuPercent: number;
  memUsedBytes: number;
  memTotalBytes: number;
  diskUsedBytes: number | null;
  diskTotalBytes: number | null;
  diskPath: string | null;
  load1: number;
  load5: number;
  load15: number;
  processRssBytes: number;
  processHeapBytes: number;
  processCpuPercent: number | null;
  osUptimeSec: number;
  processUptimeSec: number;
}

export interface SystemVerdict {
  cpu: ResourceHealth;
  memory: ResourceHealth;
  disk: ResourceHealth;
  overall: ResourceHealth;
  notes: string[];
}

export interface SystemNowResponse {
  host: SystemHostInfo;
  current: SystemSnapshot;
  verdict: SystemVerdict;
}

export interface SystemHistoryPoint {
  at: string;
  cpuPercent: number;
  memUsedPct: number;
  diskUsedPct: number | null;
  memUsedBytes: number;
  memTotalBytes: number;
}

export interface SystemHistorySummary {
  cpuAvg: number;
  cpuMax: number;
  memAvgPct: number;
  memMaxPct: number;
  diskAvgPct: number | null;
  diskMaxPct: number | null;
  samples: number;
}

export interface SystemHistoryResponse {
  rangeHours: number;
  bucketMinutes: number;
  points: SystemHistoryPoint[];
  summary: SystemHistorySummary;
}
