import { Injectable, NotFoundException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findByUsername(username: string) {
    return this.prisma.user.findUnique({ where: { username } });
  }

  findById(id: number) {
    return this.prisma.user.findUnique({ where: { id } });
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

  list() {
    return this.prisma.user.findMany({
      orderBy: { username: 'asc' },
      select: {
        id: true,
        username: true,
        role: true,
        isActive: true,
        mustChangePassword: true,
        lastLoginAt: true,
        lockedUntil: true,
        failedAttempts: true,
        createdAt: true,
      },
    });
  }

  async setPassword(userId: number, newPassword: string, mustChange = false) {
    const passwordHash = await this.hash(newPassword);
    return this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash, mustChangePassword: mustChange, failedAttempts: 0, lockedUntil: null },
    });
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
      },
    });
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
}
