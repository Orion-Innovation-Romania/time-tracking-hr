import { Injectable, NotFoundException } from '@nestjs/common';
import type { DoorRole } from '@ttah/shared';
import { PrismaService } from '../prisma/prisma.service';
import { parseLocation } from './location';

export { parseLocation } from './location';
export type { ParsedLocation } from './location';

@Injectable()
export class DoorsService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    const rows = await this.prisma.door.findMany({
      orderBy: [{ zone: 'asc' }, { rawLocation: 'asc' }],
      include: { _count: { select: { events: true } } },
    });
    return rows.map((door) => ({
      id: door.id,
      rawLocation: door.rawLocation,
      readerNo: door.readerNo,
      panel: door.panel,
      floor: door.floor,
      zone: door.zone,
      role: door.role,
      displayName: door.displayName,
      autoDetected: door.autoDetected,
      eventCount: door._count.events,
    }));
  }

  /** Resolve (or create) the door for a raw location, auto-detecting direction. */
  async resolveDoor(rawLocation: string) {
    const existing = await this.prisma.door.findUnique({ where: { rawLocation } });
    if (existing) return existing;
    const parsed = parseLocation(rawLocation);
    return this.prisma.door.create({
      data: {
        rawLocation,
        readerNo: parsed.readerNo,
        panel: parsed.panel,
        floor: parsed.floor,
        zone: parsed.zone,
        role: parsed.suggestedRole,
        autoDetected: true,
      },
    });
  }

  async update(
    id: number,
    data: { role?: DoorRole; displayName?: string | null; zone?: string | null },
  ) {
    const door = await this.prisma.door.findUnique({ where: { id } });
    if (!door) throw new NotFoundException('Door not found');
    return this.prisma.door.update({
      where: { id },
      data: {
        ...(data.role !== undefined ? { role: data.role, autoDetected: false } : {}),
        ...(data.displayName !== undefined ? { displayName: data.displayName } : {}),
        ...(data.zone !== undefined ? { zone: data.zone } : {}),
      },
    });
  }

  zones() {
    return this.prisma.door
      .findMany({
        where: { zone: { not: null } },
        distinct: ['zone'],
        select: { zone: true },
        orderBy: { zone: 'asc' },
      })
      .then((rows) => rows.map((r) => r.zone).filter((z): z is string => !!z));
  }
}
