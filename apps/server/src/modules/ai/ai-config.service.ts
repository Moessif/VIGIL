import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DbService } from '../../db/db.service';
import { env } from '../../config/env';
import { decryptSecret, encryptSecret, maskSecret } from './crypto';
import type { AiProviderInfo, AiProviderType } from '@police/shared';

export interface ProviderRow {
  id: string;
  name: string;
  type: string;
  base_url: string;
  model: string;
  enabled: number;
  priority: number;
}

const PROVIDER_DEFAULTS: Array<Pick<ProviderRow, 'id' | 'name' | 'type' | 'base_url' | 'model'>> = [
  { id: 'prov_main', name: '主线 AI（DeepSeek 官方）', type: 'main_chat', base_url: env.deepseekBaseUrl, model: env.mainModel },
  { id: 'prov_image', name: '图片生成（Qwen-Image）', type: 'image', base_url: env.qwenBaseUrl, model: env.imageModel },
  { id: 'prov_tts', name: '语音消息（Qwen-TTS）', type: 'tts', base_url: env.qwenBaseUrl, model: env.ttsModel },
  { id: 'prov_realtime', name: '实时语音（Qwen-Realtime）', type: 'realtime', base_url: env.qwenBaseUrl, model: env.realtimeModel },
];

@Injectable()
export class AiConfigService implements OnApplicationBootstrap {
  constructor(private readonly db: DbService) {}

  onApplicationBootstrap() {
    this.seed();
  }

  seed() {
    for (const p of PROVIDER_DEFAULTS) {
      const exists = this.db.get('SELECT id FROM ai_providers WHERE id = ?', p.id);
      if (!exists) {
        this.db.run(
          `INSERT INTO ai_providers (id, name, type, base_url, model, enabled, priority, created_at)
           VALUES (?,?,?,?,?,?,?,?)`,
          p.id, p.name, p.type, p.base_url, p.model, 1, 0, Date.now(),
        );
      }
    }
  }

  provider(type: AiProviderType): ProviderRow {
    const p = this.db.get<ProviderRow>('SELECT * FROM ai_providers WHERE type = ? ORDER BY priority ASC LIMIT 1', type);
    if (p) return p;
    const d = PROVIDER_DEFAULTS.find((x) => x.type === type)!;
    return { ...d, enabled: 1, priority: 0 };
  }

  apiKey(type: AiProviderType): string {
    const cred = this.db.get<{ key_cipher: string }>(
      `SELECT c.key_cipher FROM ai_credentials c
       JOIN ai_providers p ON c.provider_id = p.id
       WHERE p.type = ? AND c.enabled = 1 ORDER BY c.created_at DESC LIMIT 1`,
      type,
    );
    if (cred?.key_cipher) {
      try {
        const k = decryptSecret(cred.key_cipher);
        if (k) return k;
      } catch {
        /* ignore */
      }
    }
    return type === 'main_chat' ? env.deepseekApiKey : env.qwenApiKey;
  }

  listProviders(): AiProviderInfo[] {
    const rows = this.db.all<ProviderRow>('SELECT * FROM ai_providers ORDER BY type ASC');
    return rows.map((p) => {
      const cred = this.db.get<{ key_cipher: string }>(
        'SELECT key_cipher FROM ai_credentials WHERE provider_id = ? ORDER BY created_at DESC LIMIT 1',
        p.id,
      );
      let keyMask = '';
      if (cred?.key_cipher) {
        try {
          keyMask = maskSecret(decryptSecret(cred.key_cipher));
        } catch {
          keyMask = '';
        }
      } else {
        const envKey = p.type === 'main_chat' ? env.deepseekApiKey : env.qwenApiKey;
        keyMask = maskSecret(envKey);
      }
      return {
        id: p.id,
        name: p.name,
        type: p.type as AiProviderType,
        baseUrl: p.base_url,
        model: p.model,
        enabled: !!p.enabled,
        priority: Number(p.priority),
        keyMask,
        connected: !!keyMask,
      };
    });
  }

  setProvider(
    id: string,
    dto: { name?: string; baseUrl?: string; model?: string; enabled?: boolean; priority?: number },
  ): ProviderRow {
    const existing = this.db.get<ProviderRow>('SELECT * FROM ai_providers WHERE id = ?', id);
    if (!existing) {
      this.db.run(
        `INSERT INTO ai_providers (id, name, type, base_url, model, enabled, priority, created_at)
         VALUES (?,?,?,?,?,?,?,?)`,
        id, dto.name || id, 'main_chat', dto.baseUrl || '', dto.model || '', dto.enabled ? 1 : 0, dto.priority ?? 0, Date.now(),
      );
    } else {
      this.db.run(
        'UPDATE ai_providers SET name=?, base_url=?, model=?, enabled=?, priority=? WHERE id=?',
        dto.name ?? existing.name,
        dto.baseUrl ?? existing.base_url,
        dto.model ?? existing.model,
        (dto.enabled ?? !!existing.enabled) ? 1 : 0,
        dto.priority ?? existing.priority,
        id,
      );
    }
    return this.db.get<ProviderRow>('SELECT * FROM ai_providers WHERE id = ?', id)!;
  }

  setCredential(providerId: string, apiKey: string) {
    const existing = this.db.get('SELECT id FROM ai_credentials WHERE provider_id = ?', providerId);
    const cipher = encryptSecret(apiKey);
    if (existing) {
      this.db.run('UPDATE ai_credentials SET key_cipher = ? WHERE provider_id = ?', cipher, providerId);
    } else {
      this.db.run(
        'INSERT INTO ai_credentials (id, provider_id, key_cipher, key_mask, enabled, created_at) VALUES (?,?,?,?,?,?)',
        randomUUID(), providerId, cipher, maskSecret(apiKey), 1, Date.now(),
      );
    }
    return { ok: true, keyMask: maskSecret(apiKey) };
  }
}
