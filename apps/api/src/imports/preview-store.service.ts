import { Injectable } from '@nestjs/common';
import type { ParsedReport } from './parsed-report';

export interface PreviewEntry {
  previewId: string;
  fileName: string;
  fileHash: string;
  report: ParsedReport;
  matchedEmployeeId: number | null;
  createdAt: number;
}

const TTL_MS = 30 * 60 * 1000;

/**
 * Holds parsed reports between the preview and commit steps. The raw PDF is
 * never persisted (retention policy: discard immediately after parsing); only
 * the extracted events live here, in memory, until committed or expired.
 */
@Injectable()
export class PreviewStore {
  private readonly entries = new Map<string, PreviewEntry>();

  put(entry: PreviewEntry): void {
    this.sweep();
    this.entries.set(entry.previewId, entry);
  }

  get(previewId: string): PreviewEntry | undefined {
    const entry = this.entries.get(previewId);
    if (!entry) return undefined;
    if (Date.now() - entry.createdAt > TTL_MS) {
      this.entries.delete(previewId);
      return undefined;
    }
    return entry;
  }

  delete(previewId: string): void {
    this.entries.delete(previewId);
  }

  private sweep(): void {
    const now = Date.now();
    for (const [id, entry] of this.entries) {
      if (now - entry.createdAt > TTL_MS) this.entries.delete(id);
    }
  }
}
