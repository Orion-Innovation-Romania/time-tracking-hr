import { existsSync } from 'node:fs';
import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import type { Role } from '@ttah/shared';
import { PrismaService } from '../prisma/prisma.service';
import { UsersFileService } from './users-file.service';
import { UsersService } from './users.service';

/**
 * Reconciles config/users.yml with the DB at boot:
 *  - new YAML entries are created and forced to change password;
 *  - existing YAML users keep their chosen password (profile/role/active refresh);
 *  - YAML `active: false` or missing usernames are deactivated.
 */
@Injectable()
export class UserSyncService implements OnApplicationBootstrap {
  private readonly logger = new Logger(UserSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly file: UsersFileService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    try {
      await this.sync();
    } catch (err) {
      this.logger.error('User sync failed', err as Error);
    }
  }

  async sync(): Promise<void> {
    const abs = this.file.absolutePath();
    if (!existsSync(abs)) {
      this.logger.warn(`users config not found at ${abs}; skipping sync`);
      return;
    }

    const entries = this.file.read();
    const configured = new Set<string>();

    for (const entry of entries) {
      configured.add(entry.username);
      const role: Role = entry.role === 'admin' ? 'admin' : 'user';
      const wantActive = entry.active !== false;
      const existing = await this.users.findByUsername(entry.username);

      if (!existing) {
        if (!wantActive) continue;
        const initialHash = await this.users.hash(entry.initialPassword);
        await this.prisma.user.create({
          data: {
            username: entry.username,
            firstName: entry.firstName?.trim() || null,
            lastName: entry.lastName?.trim() || null,
            email: entry.email?.trim().toLowerCase() || null,
            role,
            passwordHash: initialHash,
            initialPasswordHash: initialHash,
            mustChangePassword: true,
            isActive: true,
            managedByConfig: true,
          },
        });
        this.logger.log(`Created user ${entry.username} (${role})`);
        continue;
      }

      const initialChanged = !(await this.users.verify(
        existing.initialPasswordHash,
        entry.initialPassword,
      ));
      await this.prisma.user.update({
        where: { id: existing.id },
        data: {
          role,
          isActive: wantActive,
          managedByConfig: true,
          ...(entry.firstName ? { firstName: entry.firstName.trim() } : {}),
          ...(entry.lastName ? { lastName: entry.lastName.trim() } : {}),
          ...(entry.email ? { email: entry.email.trim().toLowerCase() } : {}),
          ...(initialChanged
            ? { initialPasswordHash: await this.users.hash(entry.initialPassword) }
            : {}),
        },
      });
    }

    const dbUsers = await this.prisma.user.findMany({
      where: { managedByConfig: true },
    });
    for (const user of dbUsers) {
      if (!configured.has(user.username) && user.isActive) {
        await this.prisma.user.update({
          where: { id: user.id },
          data: { isActive: false },
        });
        this.logger.log(`Deactivated user ${user.username} (removed from config)`);
      }
    }
  }
}
