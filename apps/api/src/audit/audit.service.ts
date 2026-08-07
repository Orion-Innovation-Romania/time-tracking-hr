import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface AuditEntry {
  userId?: number | null;
  action: string;
  entity: string;
  entityId?: string | number | null;
  before?: unknown;
  after?: unknown;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(entry: AuditEntry): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        userId: entry.userId ?? null,
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId != null ? String(entry.entityId) : null,
        before: (entry.before ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        after: (entry.after ?? Prisma.JsonNull) as Prisma.InputJsonValue,
      },
    });
  }

  async list(limit = 100, offset = 0, userId?: number | null) {
    const where: Prisma.AuditLogWhereInput = userId != null ? { userId } : {};
    const [items, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { at: 'desc' },
        take: limit,
        skip: offset,
        include: { user: { select: { username: true } } },
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return {
      items: items.map((it) => ({
        id: it.id,
        at: it.at.toISOString(),
        userId: it.userId,
        username: it.user?.username ?? null,
        action: it.action,
        entity: it.entity,
        entityId: it.entityId,
        before: it.before,
        after: it.after,
      })),
      total,
    };
  }
}
