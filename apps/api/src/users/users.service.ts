import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import type { CreateUserInput, Role, UpdateUserInput, UserAccountView } from '@ttah/shared';
import { PrismaService } from '../prisma/prisma.service';
import { UsersFileService } from './users-file.service';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly file: UsersFileService,
  ) {}

  findByUsername(username: string) {
    return this.prisma.user.findUnique({ where: { username } });
  }

  findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  }

  findById(id: number) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  findByPasswordResetTokenHash(hash: string) {
    return this.prisma.user.findUnique({ where: { passwordResetTokenHash: hash } });
  }

  hash(password: string): Promise<string> {
    return argon2.hash(password, { type: argon2.argon2id });
  }

  async verify(hash: string, password: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, password);
    } catch {
      return false;
    }
  }

  list(): Promise<UserAccountView[]> {
    return this.prisma.user
      .findMany({
        orderBy: { username: 'asc' },
      })
      .then((rows) => rows.map((r) => this.toView(r)));
  }

  async create(input: CreateUserInput): Promise<UserAccountView> {
    const username = input.username.trim();
    const email = input.email.trim().toLowerCase();
    const existing = await this.findByUsername(username);
    if (existing) throw new ConflictException('Username already exists');
    await this.assertEmailFree(email);

    const initialHash = await this.hash(input.initialPassword);
    const row = await this.prisma.user.create({
      data: {
        username,
        firstName: input.firstName.trim(),
        lastName: input.lastName.trim(),
        email,
        role: input.role,
        passwordHash: initialHash,
        initialPasswordHash: initialHash,
        mustChangePassword: true,
        isActive: true,
        managedByConfig: true,
      },
    });
    this.file.upsert({
      username,
      role: input.role,
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      email,
      initialPassword: input.initialPassword,
    });
    return this.toView(row);
  }

  async update(userId: number, input: UpdateUserInput): Promise<UserAccountView> {
    const user = await this.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    const data: {
      firstName?: string;
      lastName?: string;
      email?: string;
      role?: Role;
      isActive?: boolean;
      passwordHash?: string;
      initialPasswordHash?: string;
      mustChangePassword?: boolean;
      failedAttempts?: number;
      lockedUntil?: null;
      passwordResetTokenHash?: null;
      passwordResetExpiresAt?: null;
      passwordResetRequestedAt?: null;
    } = {};

    if (input.firstName !== undefined) data.firstName = input.firstName.trim();
    if (input.lastName !== undefined) data.lastName = input.lastName.trim();
    if (input.email !== undefined) {
      const email = input.email.trim().toLowerCase();
      await this.assertEmailFree(email, userId);
      data.email = email;
      data.passwordResetTokenHash = null;
      data.passwordResetExpiresAt = null;
    }
    if (input.role !== undefined) data.role = input.role;
    if (input.isActive !== undefined) data.isActive = input.isActive;
    if (input.isActive === false) {
      data.passwordResetTokenHash = null;
      data.passwordResetExpiresAt = null;
      data.passwordResetRequestedAt = null;
    }
    if (input.initialPassword) {
      const hash = await this.hash(input.initialPassword);
      data.initialPasswordHash = hash;
      data.passwordHash = hash;
      data.mustChangePassword = true;
      data.failedAttempts = 0;
      data.lockedUntil = null;
      data.passwordResetTokenHash = null;
      data.passwordResetExpiresAt = null;
      data.passwordResetRequestedAt = null;
    }

    if (input.role === 'user' && user.role === 'admin') {
      await this.ensureNotLastAdmin(user);
    }
    if (input.isActive === false) {
      await this.ensureNotLastAdmin(user);
    }

    if (Object.keys(data).length === 0) {
      throw new BadRequestException('No changes provided');
    }

    const row = await this.prisma.user.update({ where: { id: userId }, data });
    this.file.patch(user.username, {
      ...(data.firstName !== undefined ? { firstName: data.firstName } : {}),
      ...(data.lastName !== undefined ? { lastName: data.lastName } : {}),
      ...(data.email !== undefined ? { email: data.email } : {}),
      ...(data.role !== undefined ? { role: data.role } : {}),
      ...(input.initialPassword ? { initialPassword: input.initialPassword } : {}),
      ...(input.isActive === false ? { active: false } : {}),
      ...(input.isActive === true ? { active: true } : {}),
    });
    return this.toView(row);
  }

  async resetToInitial(userId: number) {
    const user = await this.findById(userId);
    if (!user) throw new NotFoundException('User not found');
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: user.initialPasswordHash,
        mustChangePassword: true,
        failedAttempts: 0,
        lockedUntil: null,
        passwordResetTokenHash: null,
        passwordResetExpiresAt: null,
        passwordResetRequestedAt: null,
      },
    });
  }

  async setPassword(userId: number, newPassword: string, mustChange = false) {
    const passwordHash = await this.hash(newPassword);
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash,
        mustChangePassword: mustChange,
        failedAttempts: 0,
        lockedUntil: null,
        passwordResetTokenHash: null,
        passwordResetExpiresAt: null,
        passwordResetRequestedAt: null,
      },
    });
  }

  async storePasswordResetToken(
    userId: number,
    tokenHash: string,
    expiresAt: Date,
  ) {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordResetTokenHash: tokenHash,
        passwordResetExpiresAt: expiresAt,
        passwordResetRequestedAt: new Date(),
      },
    });
  }

  async remove(userId: number, actorId: number): Promise<UserAccountView> {
    const user = await this.findById(userId);
    if (!user) throw new NotFoundException('User not found');
    if (user.id === actorId) {
      throw new BadRequestException('You cannot delete your own account');
    }
    await this.ensureNotLastAdmin(user);
    this.file.remove(user.username);
    const row = await this.prisma.user.update({
      where: { id: userId },
      data: {
        isActive: false,
        passwordResetTokenHash: null,
        passwordResetExpiresAt: null,
        passwordResetRequestedAt: null,
      },
    });
    return this.toView(row);
  }

  markLogin(userId: number) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { lastLoginAt: new Date(), failedAttempts: 0, lockedUntil: null },
    });
  }

  setLock(userId: number, failedAttempts: number, lockedUntil: Date | null) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { failedAttempts, lockedUntil },
    });
  }

  private async ensureNotLastAdmin(user: { role: Role; isActive: boolean }) {
    if (user.role !== 'admin' || !user.isActive) return;
    const admins = await this.prisma.user.count({
      where: { role: 'admin', isActive: true },
    });
    if (admins <= 1) {
      throw new BadRequestException('Cannot remove the last active admin');
    }
  }

  private async assertEmailFree(email: string, exceptUserId?: number) {
    const taken = await this.prisma.user.findUnique({ where: { email } });
    if (taken && taken.id !== exceptUserId) {
      throw new ConflictException('Email already in use');
    }
  }

  private toView(row: {
    id: number;
    username: string;
    firstName: string | null;
    lastName: string | null;
    email: string | null;
    role: Role;
    isActive: boolean;
    mustChangePassword: boolean;
    managedByConfig: boolean;
    passwordResetRequestedAt: Date | null;
    lastLoginAt: Date | null;
    lockedUntil: Date | null;
    failedAttempts: number;
    createdAt: Date;
  }): UserAccountView {
    return {
      id: row.id,
      username: row.username,
      firstName: row.firstName,
      lastName: row.lastName,
      email: row.email,
      role: row.role,
      isActive: row.isActive,
      mustChangePassword: row.mustChangePassword,
      managedByConfig: row.managedByConfig,
      passwordResetRequestedAt: row.passwordResetRequestedAt
        ? row.passwordResetRequestedAt.toISOString()
        : null,
      lastLoginAt: row.lastLoginAt ? row.lastLoginAt.toISOString() : null,
      lockedUntil: row.lockedUntil ? row.lockedUntil.toISOString() : null,
      failedAttempts: row.failedAttempts,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
