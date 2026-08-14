import { Injectable, NotFoundException } from '@nestjs/common';
import type { DoorRole, DoorView, OfficeView, ReaderView } from '@ttah/shared';
import { PrismaService } from '../prisma/prisma.service';
import {
  parseLocation,
  isValidAxTraxLocation,
  doorGroupingKey,
} from './location';

export { parseLocation, doorGroupingKey } from './location';
export type { ParsedLocation } from './location';

@Injectable()
export class DoorsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<DoorView[]> {
    const rows = await this.prisma.door.findMany({
      orderBy: [{ officeId: 'asc' }, { floor: 'asc' }, { name: 'asc' }],
      include: {
        office: true,
        readers: {
          orderBy: [{ role: 'asc' }, { rawLocation: 'asc' }],
          include: { _count: { select: { events: true } } },
        },
      },
    });
    return rows.map((door) => this.toDoorView(door));
  }

  async listOffices(): Promise<OfficeView[]> {
    const rows = await this.prisma.office.findMany({ orderBy: { name: 'asc' } });
    return rows.map((o) => ({ id: o.id, name: o.name }));
  }

  async createOffice(name: string): Promise<OfficeView> {
    const trimmed = name.trim();
    const existing = await this.prisma.office.findFirst({
      where: { name: { equals: trimmed, mode: 'insensitive' } },
    });
    if (existing) return { id: existing.id, name: existing.name };
    const created = await this.prisma.office.create({ data: { name: trimmed } });
    return { id: created.id, name: created.name };
  }

  async updateOffice(id: number, name: string): Promise<OfficeView> {
    const office = await this.prisma.office.findUnique({ where: { id } });
    if (!office) throw new NotFoundException('Office not found');
    const updated = await this.prisma.office.update({
      where: { id },
      data: { name: name.trim() },
    });
    return { id: updated.id, name: updated.name };
  }

  async removeOffice(id: number): Promise<{ ok: true }> {
    const office = await this.prisma.office.findUnique({ where: { id } });
    if (!office) throw new NotFoundException('Office not found');
    await this.prisma.office.delete({ where: { id } });
    return { ok: true };
  }

  /** Resolve (or create) the reader for a raw location, grouping it onto a door. */
  async resolveReader(rawLocation: string) {
    const existing = await this.prisma.reader.findUnique({ where: { rawLocation } });
    if (existing) return existing;
    if (!isValidAxTraxLocation(rawLocation)) return null;
    const parsed = parseLocation(rawLocation);
    const door = await this.findOrCreateDoor(parsed.suggestedName, parsed.floor);
    return this.prisma.reader.create({
      data: {
        rawLocation,
        readerNo: parsed.readerNo,
        panel: parsed.panel,
        role: parsed.suggestedRole,
        autoDetected: true,
        doorId: door.id,
      },
    });
  }

  async updateDoor(
    id: number,
    data: { name?: string; officeId?: number | null; floor?: string | null },
  ) {
    const door = await this.prisma.door.findUnique({ where: { id } });
    if (!door) throw new NotFoundException('Door not found');
    if (data.officeId != null) {
      const office = await this.prisma.office.findUnique({ where: { id: data.officeId } });
      if (!office) throw new NotFoundException('Office not found');
    }
    return this.prisma.door.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.officeId !== undefined ? { officeId: data.officeId } : {}),
        ...(data.floor !== undefined ? { floor: data.floor || null } : {}),
      },
    });
  }

  async updateReader(id: number, data: { role?: DoorRole }) {
    const reader = await this.prisma.reader.findUnique({ where: { id } });
    if (!reader) throw new NotFoundException('Reader not found');
    return this.prisma.reader.update({
      where: { id },
      data: {
        ...(data.role !== undefined ? { role: data.role, autoDetected: false } : {}),
      },
    });
  }

  async removeDoor(id: number): Promise<{ ok: true; readersDeleted: number; eventsDeleted: number }> {
    const door = await this.prisma.door.findUnique({
      where: { id },
      include: { readers: { include: { _count: { select: { events: true } } } } },
    });
    if (!door) throw new NotFoundException('Door not found');
    const readersDeleted = door.readers.length;
    const eventsDeleted = door.readers.reduce((n, r) => n + r._count.events, 0);
    await this.prisma.door.delete({ where: { id } });
    return { ok: true, readersDeleted, eventsDeleted };
  }

  async removeReader(id: number): Promise<{ ok: true; eventsDeleted: number }> {
    const reader = await this.prisma.reader.findUnique({
      where: { id },
      include: { _count: { select: { events: true } } },
    });
    if (!reader) throw new NotFoundException('Reader not found');
    const eventsDeleted = reader._count.events;
    const doorId = reader.doorId;
    await this.prisma.reader.delete({ where: { id } });
    const leftover = await this.prisma.reader.count({ where: { doorId } });
    if (leftover === 0) await this.prisma.door.delete({ where: { id: doorId } }).catch(() => undefined);
    return { ok: true, eventsDeleted };
  }

  async purgeInvalid(): Promise<{ deleted: number; eventsDeleted: number; doorsDeleted: number }> {
    const rows = await this.prisma.reader.findMany({
      include: { _count: { select: { events: true } } },
    });
    const junk = rows.filter((d) => !isValidAxTraxLocation(d.rawLocation));
    let eventsDeleted = 0;
    const doorIds = new Set<number>();
    for (const reader of junk) {
      eventsDeleted += reader._count.events;
      doorIds.add(reader.doorId);
      await this.prisma.reader.delete({ where: { id: reader.id } });
    }
    let doorsDeleted = 0;
    for (const doorId of doorIds) {
      const leftover = await this.prisma.reader.count({ where: { doorId } });
      if (leftover === 0) {
        await this.prisma.door.delete({ where: { id: doorId } }).catch(() => undefined);
        doorsDeleted += 1;
      }
    }
    return { deleted: junk.length, eventsDeleted, doorsDeleted };
  }

  private async findOrCreateDoor(name: string, floor: string | null) {
    const groupingKey = doorGroupingKey(name, floor);
    const existing = await this.prisma.door.findUnique({ where: { groupingKey } });
    if (existing) return existing;
    return this.prisma.door.create({
      data: { name, floor, groupingKey },
    });
  }

  private toDoorView(door: {
    id: number;
    name: string;
    floor: string | null;
    officeId: number | null;
    office: { id: number; name: string } | null;
    readers: Array<{
      id: number;
      doorId: number;
      rawLocation: string;
      readerNo: number | null;
      panel: string | null;
      role: DoorRole;
      autoDetected: boolean;
      _count: { events: number };
    }>;
  }): DoorView {
    const readers: ReaderView[] = door.readers.map((reader) => ({
      id: reader.id,
      doorId: reader.doorId,
      rawLocation: reader.rawLocation,
      readerNo: reader.readerNo,
      panel: reader.panel,
      role: reader.role,
      autoDetected: reader.autoDetected,
      eventCount: reader._count.events,
      valid: isValidAxTraxLocation(reader.rawLocation),
    }));
    return {
      id: door.id,
      name: door.name,
      floor: door.floor,
      officeId: door.officeId,
      officeName: door.office?.name ?? null,
      eventCount: readers.reduce((n, r) => n + r.eventCount, 0),
      readers,
    };
  }
}
