import { Injectable } from '@nestjs/common';
import { DatabaseSync } from 'node:sqlite';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { env } from '../config/env';

@Injectable()
export class DbService {
  readonly db: DatabaseSync;

  constructor() {
    const dir = path.dirname(env.dbPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    this.db = new DatabaseSync(env.dbPath);
    this.db.exec('PRAGMA journal_mode = WAL;');
    this.db.exec('PRAGMA foreign_keys = ON;');
    this.initSchema();
  }

  private initSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        school TEXT DEFAULT '',
        education TEXT DEFAULT '',
        role TEXT DEFAULT 'student',
        must_change_password INTEGER DEFAULT 0,
        created_at INTEGER
      );

      CREATE TABLE IF NOT EXISTS scenarios (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        fraud_type TEXT,
        difficulty INTEGER,
        est_minutes INTEGER,
        description TEXT,
        script_json TEXT NOT NULL,
        status TEXT DEFAULT 'published',
        version INTEGER DEFAULT 1,
        created_at INTEGER
      );

      CREATE TABLE IF NOT EXISTS training_sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        scenario_id TEXT NOT NULL,
        status TEXT NOT NULL,
        state_json TEXT,
        ending TEXT,
        scores_json TEXT,
        started_at INTEGER,
        ended_at INTEGER,
        duration_sec INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS training_messages (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        seq INTEGER,
        channel TEXT,
        role TEXT,
        speaker TEXT,
        content TEXT,
        asset_url TEXT,
        meta_json TEXT,
        created_at INTEGER
      );

      CREATE TABLE IF NOT EXISTS training_events (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        type TEXT,
        payload_json TEXT,
        created_at INTEGER
      );

      CREATE TABLE IF NOT EXISTS ability_scores (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        identity_check INTEGER,
        fund_safety INTEGER,
        privacy_protection INTEGER,
        emergency_response INTEGER,
        created_at INTEGER
      );

      CREATE TABLE IF NOT EXISTS user_scenario_status (
        user_id TEXT NOT NULL,
        scenario_id TEXT NOT NULL,
        attempts INTEGER DEFAULT 0,
        best_score INTEGER,
        best_ending TEXT,
        unlocked_endings TEXT DEFAULT '[]',
        last_played_at INTEGER,
        PRIMARY KEY (user_id, scenario_id)
      );

      CREATE TABLE IF NOT EXISTS ai_providers (
        id TEXT PRIMARY KEY,
        name TEXT,
        type TEXT,
        base_url TEXT,
        model TEXT,
        enabled INTEGER DEFAULT 1,
        priority INTEGER DEFAULT 0,
        created_at INTEGER
      );

      CREATE TABLE IF NOT EXISTS ai_credentials (
        id TEXT PRIMARY KEY,
        provider_id TEXT,
        key_cipher TEXT,
        key_mask TEXT,
        enabled INTEGER DEFAULT 1,
        created_at INTEGER
      );

      CREATE TABLE IF NOT EXISTS audit_logs (
        id TEXT PRIMARY KEY,
        operator_id TEXT,
        action TEXT,
        target TEXT,
        detail_json TEXT,
        created_at INTEGER
      );
    `);
  }

  all<T = Record<string, unknown>>(sql: string, ...params: unknown[]): T[] {
    return this.db.prepare(sql).all(...(params as never[])) as unknown as T[];
  }

  get<T = Record<string, unknown>>(sql: string, ...params: unknown[]): T | undefined {
    return this.db.prepare(sql).get(...(params as never[])) as unknown as T | undefined;
  }

  run(sql: string, ...params: unknown[]): { changes: number; lastInsertRowid: number } {
    const r = this.db.prepare(sql).run(...(params as never[]));
    return { changes: Number(r.changes), lastInsertRowid: Number(r.lastInsertRowid) };
  }
}
