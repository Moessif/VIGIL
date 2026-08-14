import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import * as bcrypt from 'bcryptjs';
import { DbService } from '../../db/db.service';
import { env } from '../../config/env';
import type { Role, UserInfo } from '@police/shared';

export interface UserRow {
  id: string;
  username: string;
  password_hash: string;
  school: string;
  education: string;
  role: string;
  created_at: number;
}

@Injectable()
export class UsersService implements OnApplicationBootstrap {
  constructor(private readonly db: DbService) {}

  onApplicationBootstrap() {
    this.seedAdmin();
  }

  /** 首次启动且无 admin 角色时，按 env 创建初始管理员 */
  private seedAdmin() {
    if (!env.adminUsername) return;
    if (this.findByUsername(env.adminUsername)) return;
    const adminCount = this.db.get<{ c: number }>(
      "SELECT COUNT(*) AS c FROM users WHERE role = 'admin'",
    );
    if (Number(adminCount?.c ?? 0) > 0) return;
    this.create({
      username: env.adminUsername,
      passwordHash: bcrypt.hashSync(env.adminPassword, 10),
      school: '',
      education: '',
      role: 'admin',
    });
    // eslint-disable-next-line no-console
    console.log(`[警心护航] 已创建初始管理员账号: ${env.adminUsername}`);
  }

  create(dto: {
    username: string;
    passwordHash: string;
    school?: string;
    education?: string;
    role?: Role;
  }): UserInfo {
    const id = randomUUID();
    const now = Date.now();
    this.db.run(
      'INSERT INTO users (id, username, password_hash, school, education, role, created_at) VALUES (?,?,?,?,?,?,?)',
      id,
      dto.username,
      dto.passwordHash,
      dto.school || '',
      dto.education || '',
      dto.role || 'student',
      now,
    );
    return this.toInfo(this.findById(id)!);
  }

  findByUsername(username: string): UserRow | undefined {
    return this.db.get<UserRow>('SELECT * FROM users WHERE username = ?', username);
  }

  findById(id: string): UserRow | undefined {
    return this.db.get<UserRow>('SELECT * FROM users WHERE id = ?', id);
  }

  list(): UserInfo[] {
    const rows = this.db.all<UserRow>('SELECT * FROM users ORDER BY created_at ASC');
    return rows.map((r) => this.toInfo(r));
  }

  count(): number {
    const r = this.db.get<{ c: number }>('SELECT COUNT(*) AS c FROM users');
    return Number(r?.c ?? 0);
  }

  resetPassword(id: string, passwordHash: string) {
    this.db.run(
      'UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?',
      passwordHash,
      id,
    );
  }

  setRole(id: string, role: Role) {
    this.db.run('UPDATE users SET role = ? WHERE id = ?', role, id);
  }

  remove(id: string) {
    this.db.run('DELETE FROM users WHERE id = ?', id);
  }

  toInfo(r: UserRow): UserInfo {
    return {
      id: r.id,
      username: r.username,
      school: r.school,
      education: r.education,
      role: r.role as Role,
      createdAt: Number(r.created_at),
    };
  }
}
