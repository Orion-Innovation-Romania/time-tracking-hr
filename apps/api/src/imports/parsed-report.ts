import type { DoorRole, EventType } from '@ttah/shared';

export type ReportKind = 'single' | 'multi';

export interface ParsedRecord {
  occurredAt: Date;
  rawLocation: string;
  direction: DoorRole;
  eventType: EventType;
  rawUserName?: string | null;
  department?: string | null;
}

export interface ParsedEmployee {
  rawUserName: string;
  department: string | null;
  eventCount: number;
}

export interface ParsedReport {
  kind: ReportKind;
  rawUserName: string | null;
  department: string | null;
  rangeFrom: Date | null;
  rangeTo: Date | null;
  records: ParsedRecord[];
  employees: ParsedEmployee[];
  warnings: string[];
}
