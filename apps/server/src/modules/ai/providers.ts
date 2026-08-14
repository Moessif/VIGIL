// AI 供应商适配器：DeepSeek 官方 API + 阿里云百炼原生 API（best-effort，失败时由编排层回退 Mock）

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// ---------------- 主线 AI：DeepSeek 官方（OpenAI 兼容） ----------------
export async function deepseekChat(
  messages: ChatMessage[],
  cfg: { baseUrl: string; apiKey: string; model: string },
  opts: { temperature?: number; json?: boolean } = {},
): Promise<string> {
  const res = await fetch(`${cfg.baseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.apiKey}` },
    body: JSON.stringify({
      model: cfg.model,
      messages,
      temperature: opts.temperature ?? 0.7,
      ...(opts.json ? { response_format: { type: 'json_object' } } : {}),
    }),
  });
  if (!res.ok) {
    throw new Error(`DeepSeek ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  const data: any = await res.json();
  return data?.choices?.[0]?.message?.content ?? '';
}

// ---------------- 图片生成：qwen-image-3.0-pro（百炼原生） ----------------
export async function qwenImage(
  prompt: string,
  cfg: { baseUrl: string; apiKey: string; model: string },
): Promise<{ dataUrl?: string; url?: string }> {
  const res = await fetch(
    `${cfg.baseUrl.replace(/\/$/, '')}/api/v1/services/aigc/multimodal-generation/generation`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.apiKey}` },
      body: JSON.stringify({
        model: cfg.model,
        input: { messages: [{ role: 'user', content: [{ text: prompt }] }] },
        parameters: { size: '1024*1024', prompt_extend: true },
      }),
    },
  );
  if (!res.ok) {
    throw new Error(`Qwen image ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  const data: any = await res.json();
  const url: string | undefined = data?.output?.choices?.[0]?.message?.content?.[0]?.image;
  if (url) return { url };
  throw new Error('Qwen image: 无返回图片');
}

// ---------------- 语音合成：qwen-audio-3.0-tts-plus（百炼原生 HTTP） ----------------
// 剧本 DSL 中的语义音色 key → 真实音色名（更多音色见 Qwen-Audio-TTS 音色列表）
const VOICE_MAP: Record<string, string> = {
  female_middle: 'longanhuan_v3.6',
  female_young: 'longanhuan_v3.6',
  male_young: 'longanhuan_v3.6',
  male_middle: 'longanhuan_v3.6',
};
const DEFAULT_VOICE = 'longanhuan_v3.6';

export function resolveVoice(key?: string): string {
  if (!key) return DEFAULT_VOICE;
  return VOICE_MAP[key] || (key.includes('_v3') ? key : DEFAULT_VOICE);
}

export async function qwenTts(
  text: string,
  voice: string | undefined,
  cfg: { baseUrl: string; apiKey: string; model: string },
): Promise<{ dataUrl?: string; url?: string }> {
  const res = await fetch(
    `${cfg.baseUrl.replace(/\/$/, '')}/api/v1/services/audio/tts/SpeechSynthesizer`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.apiKey}` },
      body: JSON.stringify({
        model: cfg.model,
        input: {
          text,
          voice: resolveVoice(voice),
          format: 'mp3',
          sample_rate: 24000,
        },
      }),
    },
  );
  if (!res.ok) {
    throw new Error(`Qwen TTS ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  const data: any = await res.json();
  const url: string | undefined = data?.output?.audio?.url;
  if (url) return { url };
  throw new Error('Qwen TTS: 无返回音频');
}

// ---------------- Mock 图片：内联 SVG 占位图（无 Key 也可演示） ----------------
export function svgPlaceholder(title: string, subtitle: string): string {
  const esc = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="300">
  <rect width="100%" height="100%" fill="#0f172a"/>
  <rect x="14" y="14" width="452" height="272" rx="12" fill="none" stroke="#334155" stroke-width="2"/>
  <circle cx="240" cy="104" r="28" fill="#1d4ed8"/>
  <text x="240" y="112" font-family="sans-serif" font-size="24" fill="#fff" text-anchor="middle">警</text>
  <text x="240" y="176" font-family="sans-serif" font-size="20" fill="#e2e8f0" text-anchor="middle">${esc(title)}</text>
  <text x="240" y="208" font-family="sans-serif" font-size="12" fill="#94a3b8" text-anchor="middle">${esc(subtitle)}</text>
</svg>`;
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}
