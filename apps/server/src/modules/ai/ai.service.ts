import { Injectable } from '@nestjs/common';
import { AiConfigService } from './ai-config.service';
import { deepseekChat, qwenImage, qwenTts, svgPlaceholder, ChatMessage } from './providers';
import { env } from '../../config/env';

export interface ChatOpts {
  temperature?: number;
  json?: boolean;
}

@Injectable()
export class AiService {
  constructor(private readonly cfg: AiConfigService) {}

  get mode(): 'mock' | 'real' {
    return env.aiMode;
  }

  /** 主线 AI 对话（仅 real 模式；无 Key 或失败返回空串） */
  async chat(messages: ChatMessage[], opts: ChatOpts = {}): Promise<string> {
    if (env.aiMode !== 'real') return '';
    const p = this.cfg.provider('main_chat');
    const key = this.cfg.apiKey('main_chat');
    if (!key) return '';
    try {
      return await deepseekChat(messages, { baseUrl: p.base_url, apiKey: key, model: p.model }, opts);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('[AI chat]', (e as Error).message);
      return '';
    }
  }

  /** 快速意图识别：使用 DeepSeek v4 Flash（低延迟），用于实时通话中的"是否要挂断"等判定 */
  async classifyQuick(text: string, instruction: string): Promise<string> {
    if (env.aiMode !== 'real') return '';
    const p = this.cfg.provider('main_chat');
    const key = this.cfg.apiKey('main_chat');
    if (!key) return '';
    try {
      return await deepseekChat(
        [
          { role: 'system', content: instruction },
          { role: 'user', content: text },
        ],
        { baseUrl: p.base_url, apiKey: key, model: 'deepseek-v4-flash' },
        { temperature: 0, json: true },
      );
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('[AI classifyQuick]', (e as Error).message);
      return '';
    }
  }

  /** 图片生成：real 走 Qwen，mock 返回 SVG 占位图 */
  async generateImage(prompt: string): Promise<{ dataUrl?: string; url?: string }> {
    if (env.aiMode === 'real') {
      const p = this.cfg.provider('image');
      const key = this.cfg.apiKey('image');
      if (key) {
        try {
          return await qwenImage(prompt, { baseUrl: p.base_url, apiKey: key, model: p.model });
        } catch (e) {
          // eslint-disable-next-line no-console
          console.error('[AI image]', (e as Error).message);
        }
      }
    }
    return { dataUrl: svgPlaceholder('图片消息（示意）', prompt.slice(0, 60)) };
  }

  /** 语音合成：real 走 Qwen TTS，mock 返回空（前端用浏览器 speechSynthesis 朗读） */
  async synthesize(text: string, voice?: string): Promise<{ dataUrl?: string; url?: string }> {
    if (env.aiMode === 'real') {
      const p = this.cfg.provider('tts');
      const key = this.cfg.apiKey('tts');
      if (key) {
        try {
          return await qwenTts(text, voice, { baseUrl: p.base_url, apiKey: key, model: p.model });
        } catch (e) {
          // eslint-disable-next-line no-console
          console.error('[AI tts]', (e as Error).message);
        }
      }
    }
    return {};
  }

  /** 连通性测试（供后台） */
  async testConnection(type: 'main_chat' | 'image' | 'tts' | 'realtime'): Promise<{ ok: boolean; message: string }> {
    const key = this.cfg.apiKey(type);
    if (!key) return { ok: false, message: '未配置 API Key（可在环境变量或后台填写）' };
    if (env.aiMode !== 'real') return { ok: true, message: '已配置 Key（当前为 mock 模式）' };
    try {
      if (type === 'main_chat') {
        const p = this.cfg.provider('main_chat');
        const r = await deepseekChat(
          [{ role: 'user', content: 'ping' }],
          { baseUrl: p.base_url, apiKey: key, model: p.model },
          { temperature: 0, json: false },
        );
        return { ok: true, message: `连接成功，模型响应 ${r.length} 字符` };
      }
      return { ok: true, message: '已配置 Key（图片/语音为按需计费，未做实际调用）' };
    } catch (e) {
      return { ok: false, message: (e as Error).message };
    }
  }
}
