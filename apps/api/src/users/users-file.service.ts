import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { dump, load } from 'js-yaml';
import type { Role } from '@ttah/shared';

export interface YamlUser {
  username: string;
  role: Role;
  initialPassword: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  active?: boolean;
}

interface UsersFile {
  users?: YamlUser[];
}

const HEADER = `# ============================================================================
# TTAH user accounts — kept in sync with Admin → Users.
# ----------------------------------------------------------------------------
# The API updates this file when you create, edit or delete users in the UI.
# On startup it is synced into the database:
#   * New usernames are created (must change password on first login).
#   * Existing users keep the password they chose; profile/role/active refresh.
#   * Removed usernames are deactivated (data is kept).
#   * active: false deactivates the account without deleting the YAML entry.
# ============================================================================
`;

@Injectable()
export class UsersFileService {
  private readonly logger = new Logger(UsersFileService.name);

  constructor(private readonly config: ConfigService) {}

  absolutePath(): string {
    const path = this.config.get<string>('usersConfigPath') ?? './config/users.yml';
    return resolve(path);
  }

  read(): YamlUser[] {
    const abs = this.absolutePath();
    if (!existsSync(abs)) return [];
    const doc = (load(readFileSync(abs, 'utf8')) as UsersFile) ?? {};
    return (doc.users ?? []).filter((u) => u?.username && u?.initialPassword);
  }

  upsert(entry: YamlUser): void {
    const users = this.read();
    const next: YamlUser = this.normalize(entry);
    const idx = users.findIndex((u) => u.username === next.username);
    if (idx >= 0) users[idx] = { ...users[idx], ...next };
    else users.push(next);
    this.write(users);
  }

  patch(username: string, fields: Partial<YamlUser>): void {
    const users = this.read();
    const idx = users.findIndex((u) => u.username === username);
    if (idx < 0) {
      if (!fields.initialPassword) {
        this.logger.warn(`users.yml has no entry for ${username}; skip patch`);
        return;
      }
      this.upsert({ username, role: fields.role ?? 'user', initialPassword: fields.initialPassword, ...fields });
      return;
    }
    users[idx] = this.normalize({ ...users[idx], ...fields, username });
    this.write(users);
  }

  remove(username: string): void {
    this.write(this.read().filter((u) => u.username !== username));
  }

  private normalize(entry: YamlUser): YamlUser {
    const out: YamlUser = {
      username: entry.username,
      role: entry.role === 'admin' ? 'admin' : 'user',
      initialPassword: entry.initialPassword,
    };
    if (entry.firstName) out.firstName = entry.firstName;
    if (entry.lastName) out.lastName = entry.lastName;
    if (entry.email) out.email = entry.email;
    if (entry.active === false) out.active = false;
    return out;
  }

  private write(users: YamlUser[]): void {
    const abs = this.absolutePath();
    try {
      mkdirSync(dirname(abs), { recursive: true });
      const body = dump(
        { users: users.map((u) => this.normalize(u)) },
        { noRefs: true, lineWidth: 120, quotingType: '"', forceQuotes: false },
      );
      writeFileSync(abs, `${HEADER}${body}`, 'utf8');
    } catch (err) {
      this.logger.error(`Failed to write ${abs}`, err as Error);
      throw new InternalServerErrorException(
        `Could not update users.yml (${abs}). Check that the config file is writable.`,
      );
    }
  }
}
