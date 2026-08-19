import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { statfs } from 'node:fs/promises';
import * as os from 'node:os';
import { parse } from 'node:path';
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import type {
  ResourceHealth,
  SystemHistoryPoint,
  SystemHistoryResponse,
  SystemHostInfo,
  SystemNowResponse,
  SystemSnapshot,
  SystemVerdict,
} from '@ttah/shared';
import { PrismaService } from '../prisma/prisma.service';

const SAMPLE_MS = 60_000;
const RETAIN_DAYS = 90;
const WATCH_PCT = 75;
const CRITICAL_PCT = 90;

interface CpuTimes {
  idle: number;
  total: number;
}

interface ProcCpu {
  at: number;
  usage: NodeJS.CpuUsage;
}

@Injectable()
export class SystemMetricsService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(SystemMetricsService.name);
  private timer: NodeJS.Timeout | null = null;
  private pruneAt = 0;
  private prevCpu: CpuTimes | null = null;
  private prevProc: ProcCpu | null = null;
  private lastMemSource: SystemHostInfo['memSource'] = 'os';

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit(): void {
    void this.sampleAndStore().catch((err) => this.log.warn(`Initial sample failed: ${String(err)}`));
    this.timer = setInterval(() => {
      void this.sampleAndStore().catch((err) => this.log.warn(`Sample failed: ${String(err)}`));
    }, SAMPLE_MS);
    this.timer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async now(): Promise<SystemNowResponse> {
    const needProbe = this.prevCpu == null;
    if (!this.prevCpu) this.prevCpu = cpuTimes();
    if (!this.prevProc) this.prevProc = { at: Date.now(), usage: process.cpuUsage() };
    if (needProbe) await new Promise((r) => setTimeout(r, 180));
    const current = await this.collect();
    return {
      host: this.hostInfo(),
      current,
      verdict: this.verdict(current),
    };
  }

  async history(rangeHours: number): Promise<SystemHistoryResponse> {
    const hours = clamp(Math.round(rangeHours), 1, 24 * 90);
    const from = new Date(Date.now() - hours * 3600_000);
    const rows = await this.prisma.systemMetricSample.findMany({
      where: { at: { gte: from } },
      orderBy: { at: 'asc' },
    });
    const bucketMinutes = bucketSize(hours);
    const points = downsample(
      rows.map((row) => toPoint(row)),
      bucketMinutes,
    );
    return {
      rangeHours: hours,
      bucketMinutes,
      points,
      summary: summarize(points),
    };
  }

  private async sampleAndStore(): Promise<void> {
    const first = this.prevCpu == null;
    const snap = await this.collect();
    if (first) return;
    await this.prisma.systemMetricSample.create({
      data: {
        at: new Date(snap.at),
        cpuPercent: snap.cpuPercent,
        memUsedBytes: BigInt(snap.memUsedBytes),
        memTotalBytes: BigInt(snap.memTotalBytes),
        diskUsedBytes: snap.diskUsedBytes == null ? null : BigInt(snap.diskUsedBytes),
        diskTotalBytes: snap.diskTotalBytes == null ? null : BigInt(snap.diskTotalBytes),
        load1: snap.load1,
        processRssBytes: BigInt(snap.processRssBytes),
      },
    });
    const now = Date.now();
    if (now - this.pruneAt < 60 * 60_000) return;
    this.pruneAt = now;
    const cutoff = new Date(now - RETAIN_DAYS * 24 * 3600_000);
    const result = await this.prisma.systemMetricSample.deleteMany({ where: { at: { lt: cutoff } } });
    if (result.count > 0) this.log.log(`Pruned ${result.count} system metric samples older than ${RETAIN_DAYS}d`);
  }

  private async collect(): Promise<SystemSnapshot> {
    const mem = await readMemory();
    this.lastMemSource = mem.source;
    const disk = await readDisk();
    const loads = os.loadavg();
    const rss = process.memoryUsage();
    return {
      at: new Date().toISOString(),
      cpuPercent: round1(this.cpuPercent()),
      memUsedBytes: mem.used,
      memTotalBytes: mem.total,
      diskUsedBytes: disk?.used ?? null,
      diskTotalBytes: disk?.total ?? null,
      diskPath: disk?.path ?? null,
      load1: round2(loads[0] ?? 0),
      load5: round2(loads[1] ?? 0),
      load15: round2(loads[2] ?? 0),
      processRssBytes: rss.rss,
      processHeapBytes: rss.heapUsed,
      processCpuPercent: this.processCpuPercent(),
      osUptimeSec: Math.round(os.uptime()),
      processUptimeSec: Math.round(process.uptime()),
    };
  }

  private hostInfo(): SystemHostInfo {
    const cpus = os.cpus();
    return {
      hostname: os.hostname(),
      platform: os.platform(),
      release: os.release(),
      arch: os.arch(),
      cpuCount: cpus.length || os.availableParallelism?.() || 1,
      cpuModel: cpus[0]?.model?.trim() || 'unknown',
      nodeVersion: process.version,
      inContainer: isContainer(),
      memSource: this.lastMemSource,
    };
  }

  private cpuPercent(): number {
    const cur = cpuTimes();
    const prev = this.prevCpu;
    this.prevCpu = cur;
    if (!prev || cur.total <= prev.total) return 0;
    const idle = cur.idle - prev.idle;
    const total = cur.total - prev.total;
    if (total <= 0) return 0;
    return clamp((1 - idle / total) * 100, 0, 100);
  }

  private processCpuPercent(): number | null {
    const usage = process.cpuUsage();
    const at = Date.now();
    const prev = this.prevProc;
    this.prevProc = { at, usage };
    if (!prev) return null;
    const elapsedUs = (at - prev.at) * 1000;
    if (elapsedUs <= 0) return null;
    const used = usage.user - prev.usage.user + (usage.system - prev.usage.system);
    const cores = Math.max(1, os.cpus().length);
    return round1(clamp((used / elapsedUs) * 100 / cores, 0, 100));
  }

  private verdict(snap: SystemSnapshot): SystemVerdict {
    const memPct = pct(snap.memUsedBytes, snap.memTotalBytes);
    const diskPct = snap.diskUsedBytes != null && snap.diskTotalBytes
      ? pct(snap.diskUsedBytes, snap.diskTotalBytes)
      : null;
    const cpu = grade(snap.cpuPercent);
    const memory = grade(memPct);
    const disk = diskPct == null ? 'ok' : grade(diskPct);
    const overall = worst(cpu, memory, disk);
    const notes: string[] = [];
    if (cpu === 'critical') notes.push(`CPU is at ${snap.cpuPercent.toFixed(0)}% — the host is saturated.`);
    else if (cpu === 'watch') notes.push(`CPU is at ${snap.cpuPercent.toFixed(0)}% — watch for sustained load.`);
    if (memory === 'critical') notes.push(`Memory is ${memPct.toFixed(0)}% used — add RAM or lower container limits.`);
    else if (memory === 'watch') notes.push(`Memory is ${memPct.toFixed(0)}% used — leaving little headroom.`);
    if (diskPct != null && disk === 'critical') {
      notes.push(`Disk is ${diskPct.toFixed(0)}% full — exports and imports may fail.`);
    } else if (diskPct != null && disk === 'watch') {
      notes.push(`Disk is ${diskPct.toFixed(0)}% used — plan more space soon.`);
    }
    if (snap.load1 > 0 && snap.load1 > os.cpus().length) {
      notes.push(`Load average (${snap.load1.toFixed(2)}) is above CPU count (${os.cpus().length}).`);
    }
    if (notes.length === 0) {
      notes.push('Headroom looks fine for TTAH at this moment. Keep an eye on peaks in the history chart.');
    }
    if (isContainer()) {
      notes.push('Figures are from the API process (the container, if you run Docker). Host limits may differ.');
    }
    return { cpu, memory, disk, overall, notes };
  }
}

function cpuTimes(): CpuTimes {
  let idle = 0;
  let total = 0;
  for (const cpu of os.cpus()) {
    const t = cpu.times;
    idle += t.idle;
    total += t.user + t.nice + t.sys + t.idle + t.irq;
  }
  return { idle, total };
}

async function readMemory(): Promise<{ used: number; total: number; source: 'os' | 'cgroup' }> {
  const cgroup = await readCgroupMemory();
  if (cgroup) return { ...cgroup, source: 'cgroup' };
  const total = os.totalmem();
  return { total, used: total - os.freemem(), source: 'os' };
}

async function readCgroupMemory(): Promise<{ used: number; total: number } | null> {
  try {
    const maxRaw = (await readFile('/sys/fs/cgroup/memory.max', 'utf8')).trim();
    const usedRaw = (await readFile('/sys/fs/cgroup/memory.current', 'utf8')).trim();
    if (maxRaw === 'max') return null;
    const total = Number(maxRaw);
    const used = Number(usedRaw);
    if (!Number.isFinite(total) || total <= 0) return null;
    return { total, used };
  } catch {
    /* cgroup v1 */
  }
  try {
    const limit = Number((await readFile('/sys/fs/cgroup/memory/memory.limit_in_bytes', 'utf8')).trim());
    const usage = Number((await readFile('/sys/fs/cgroup/memory/memory.usage_in_bytes', 'utf8')).trim());
    if (!Number.isFinite(limit) || limit <= 0 || limit > 1e15) return null;
    return { total: limit, used: usage };
  } catch {
    return null;
  }
}

async function readDisk(): Promise<{ used: number; total: number; path: string } | null> {
  const path = os.platform() === 'win32' ? parse(process.cwd()).root || 'C:\\' : '/';
  try {
    const s = await statfs(path);
    const total = Number(s.blocks) * Number(s.bsize);
    const free = Number(s.bavail) * Number(s.bsize);
    if (!Number.isFinite(total) || total <= 0) return null;
    return { path, total, used: Math.max(0, total - free) };
  } catch {
    return null;
  }
}

function isContainer(): boolean {
  return existsSync('/.dockerenv') || existsSync('/run/.containerenv') || Boolean(process.env.KUBERNETES_SERVICE_HOST);
}

function grade(percent: number): ResourceHealth {
  if (percent >= CRITICAL_PCT) return 'critical';
  if (percent >= WATCH_PCT) return 'watch';
  return 'ok';
}

function worst(...levels: ResourceHealth[]): ResourceHealth {
  if (levels.includes('critical')) return 'critical';
  if (levels.includes('watch')) return 'watch';
  return 'ok';
}

function pct(used: number, total: number): number {
  if (!total) return 0;
  return clamp((used / total) * 100, 0, 100);
}

function bucketSize(hours: number): number {
  if (hours <= 6) return 1;
  if (hours <= 24) return 5;
  if (hours <= 24 * 7) return 15;
  return 60;
}

function toPoint(row: {
  at: Date;
  cpuPercent: number;
  memUsedBytes: bigint;
  memTotalBytes: bigint;
  diskUsedBytes: bigint | null;
  diskTotalBytes: bigint | null;
}): SystemHistoryPoint {
  const memUsed = Number(row.memUsedBytes);
  const memTotal = Number(row.memTotalBytes);
  const diskUsed = row.diskUsedBytes == null ? null : Number(row.diskUsedBytes);
  const diskTotal = row.diskTotalBytes == null ? null : Number(row.diskTotalBytes);
  return {
    at: row.at.toISOString(),
    cpuPercent: row.cpuPercent,
    memUsedPct: pct(memUsed, memTotal),
    diskUsedPct: diskUsed != null && diskTotal ? pct(diskUsed, diskTotal) : null,
    memUsedBytes: memUsed,
    memTotalBytes: memTotal,
  };
}

function downsample(points: SystemHistoryPoint[], bucketMinutes: number): SystemHistoryPoint[] {
  if (bucketMinutes <= 1 || points.length <= 2) return points;
  const ms = bucketMinutes * 60_000;
  const buckets = new Map<number, SystemHistoryPoint[]>();
  for (const p of points) {
    const key = Math.floor(new Date(p.at).getTime() / ms) * ms;
    const list = buckets.get(key) ?? [];
    list.push(p);
    buckets.set(key, list);
  }
  return [...buckets.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([key, list]) => avgPoints(new Date(key).toISOString(), list));
}

function avgPoints(at: string, list: SystemHistoryPoint[]): SystemHistoryPoint {
  const n = list.length || 1;
  const disk = list.filter((p) => p.diskUsedPct != null);
  return {
    at,
    cpuPercent: round1(list.reduce((s, p) => s + p.cpuPercent, 0) / n),
    memUsedPct: round1(list.reduce((s, p) => s + p.memUsedPct, 0) / n),
    diskUsedPct: disk.length ? round1(disk.reduce((s, p) => s + (p.diskUsedPct ?? 0), 0) / disk.length) : null,
    memUsedBytes: Math.round(list.reduce((s, p) => s + p.memUsedBytes, 0) / n),
    memTotalBytes: list[list.length - 1]?.memTotalBytes ?? 0,
  };
}

function summarize(points: SystemHistoryPoint[]): SystemHistoryResponse['summary'] {
  if (points.length === 0) {
    return { cpuAvg: 0, cpuMax: 0, memAvgPct: 0, memMaxPct: 0, diskAvgPct: null, diskMaxPct: null, samples: 0 };
  }
  const disk = points.filter((p) => p.diskUsedPct != null).map((p) => p.diskUsedPct as number);
  return {
    cpuAvg: round1(points.reduce((s, p) => s + p.cpuPercent, 0) / points.length),
    cpuMax: round1(Math.max(...points.map((p) => p.cpuPercent))),
    memAvgPct: round1(points.reduce((s, p) => s + p.memUsedPct, 0) / points.length),
    memMaxPct: round1(Math.max(...points.map((p) => p.memUsedPct))),
    diskAvgPct: disk.length ? round1(disk.reduce((s, v) => s + v, 0) / disk.length) : null,
    diskMaxPct: disk.length ? round1(Math.max(...disk)) : null,
    samples: points.length,
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}
