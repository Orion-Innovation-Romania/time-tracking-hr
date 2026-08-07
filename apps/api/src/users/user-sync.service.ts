import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { load } from 'js-yaml';
import type { Role } from '@ttah/shared';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from './users.service';

interface ConfiguredUser {
  username: string;
  role?: Role;
  initialPassword: string;
}

interface UsersFile {
  users?: ConfiguredUser[];
}

/**
 * Reconciles the DB users with config/users.yml at boot:
 *  - new entries are created and forced to change password on first login;
 *  - existing users keep their chosen password (only role/active refreshed;
 *    initial-password hash updated if the file value changed);
 *  - users removed from the file are deactivated.
 */
@Injectable()
export class UserSyncService implements OnApplicationBootstrap {
  private readonly logger = new Logger(UserSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly config: ConfigService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    try {
      await this.sync();
    } catch (err) {
      this.logger.error('User sync failed', err as Error);
    }
  }

  async sync(): Promise<void> {
    const path = this.config.get<string>('usersConfigPath') ?? './config/users.yml';
    const abs = resolve(path);
    if (!existsSync(abs)) {
      this.logger.warn(`users config not found at ${abs}; skipping sync`);
      return;
    }

    const doc = (load(readFileSync(abs, 'utf8')) as UsersFile) ?? {};
    const entries = doc.users ?? [];
    const configured = new Set<string>();

    for (const entry of entries) {
      if (!entry?.username || !entry?.initialPassword) continue;
      configured.add(entry.username);
      const role: Role = entry.role === 'admin' ? 'admin' : 'user';
      const existing = await this.users.findByUsername(entry.username);

      if (!existing) {
        const initialHash = await this.users.hash(entry.initialPassword);
        await this.prisma.user.create({
          data: {
            username: entry.username,
            role,
            passwordHash: initialHash,
            initialPasswordHash: initialHash,
            mustChangePassword: true,
            isActive: true,
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
          isActive: true,
          ...(initialChanged
            ? { initialPasswordHash: await this.users.hash(entry.initialPassword) }
            : {}),
        },
      });
    }

    const dbUsers = await this.prisma.user.findMany();
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
