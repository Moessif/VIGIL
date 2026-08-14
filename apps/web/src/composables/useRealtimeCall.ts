import { computed, ref } from 'vue';

// 浏览器麦克风 → PCM16 采集处理器
const CAPTURE_PROCESSOR = `
class CaptureProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const input = inputs[0];
    if (input && input[0]) {
      const ch = input[0];
      const buf = new Int16Array(ch.length);
      for (let i = 0; i < ch.length; i++) {
        const s = Math.max(-1, Math.min(1, ch[i]));
        buf[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
      }
      this.port.postMessage(buf.buffer, [buf.buffer]);
    }
    return true;
  }
}
registerProcessor('capture-processor', CaptureProcessor);
`;

// PCM16 → 扬声器回放处理器
const PLAYBACK_PROCESSOR = `
class PlaybackProcessor extends AudioWorkletProcessor {
  constructor() { super(); this.bufs = []; this.port.onmessage = (e) => {
    if (e.data instanceof ArrayBuffer) this.bufs.push(new Int16Array(e.data));
  }; }
  process(_, outputs) {
    const out = outputs[0];
    if (!out || !out[0]) return true;
    const ch = out[0];
    let idx = 0;
    while (idx < ch.length && this.bufs.length) {
      let b = this.bufs[0];
      const n = Math.min(b.length, ch.length - idx);
      for (let i = 0; i < n; i++) ch[idx + i] = b[i] / 0x8000;
      idx += n;
      this.bufs[0] = n === b.length ? null : b.subarray(n);
      if (this.bufs[0] === null) this.bufs.shift();
    }
    for (let i = idx; i < ch.length; i++) ch[i] = 0;
    return true;
  }
}
registerProcessor('playback-processor', PlaybackProcessor);
`;

export interface CallBubble {
  role: 'ai' | 'user';
  text: string;
}

export function useRealtimeCall() {
  const isActive = ref(false);
  const connected = ref(false);
  const bubbles = ref<CallBubble[]>([]);
  const error = ref('');

  let currentRole: 'ai' | 'user' | null = null;

  let ws: WebSocket | null = null;
  let captureCtx: AudioContext | null = null;
  let playbackCtx: AudioContext | null = null;
  let micStream: MediaStream | null = null;
  let captureSource: MediaStreamAudioSourceNode | null = null;
  let captureNode: AudioWorkletNode | null = null;
  let playbackNode: AudioWorkletNode | null = null;

  // 由气泡推导转写（保证气泡与转写永远一致）
  const userTranscript = computed(() =>
    bubbles.value.filter((b) => b.role === 'user').map((b) => b.text).join(''),
  );
  const aiTranscript = computed(() =>
    bubbles.value.filter((b) => b.role === 'ai').map((b) => b.text).join(''),
  );

  function addDelta(role: 'ai' | 'user', delta: string) {
    if (!delta) return;
    // 离散气泡：同一角色连续增量追加到最后一个气泡，角色切换则新建气泡
    const last = bubbles.value[bubbles.value.length - 1];
    if (currentRole === role && last && last.role === role) {
      last.text += delta;
    } else {
      bubbles.value.push({ role, text: delta });
      currentRole = role;
    }
  }

  /** 用完整转写补齐当前用户气泡（只增不减，绝不覆盖丢失文字） */
  function fixLastUserBubble(full: string) {
    if (!full) return;
    const last = bubbles.value[bubbles.value.length - 1];
    if (currentRole === 'user' && last && last.role === 'user') {
      if (full.length > last.text.length) last.text = full;
    } else {
      bubbles.value.push({ role: 'user', text: full });
    }
  }

  function endTurn() {
    currentRole = null;
  }

  async function start(opts: { instructions: string; voice?: string }) {
    stop();
    error.value = '';
    bubbles.value = [];
    currentRole = null;
    try {
      // 1) 先建立音频管线（获取麦克风授权可能较慢）
      // 千问实时语音要求：输入 pcm 16kHz、输出 pcm 24kHz —— 用两个独立 AudioContext 保证采样率正确
      captureCtx = new AudioContext({ sampleRate: 16000 });
      await captureCtx.audioWorklet.addModule(
        URL.createObjectURL(new Blob([CAPTURE_PROCESSOR], { type: 'application/javascript' })),
      );
      playbackCtx = new AudioContext({ sampleRate: 24000 });
      await playbackCtx.audioWorklet.addModule(
        URL.createObjectURL(new Blob([PLAYBACK_PROCESSOR], { type: 'application/javascript' })),
      );
      micStream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
      });
      captureSource = captureCtx.createMediaStreamSource(micStream);
      captureNode = new AudioWorkletNode(captureCtx, 'capture-processor');
      captureSource.connect(captureNode);
      playbackNode = new AudioWorkletNode(playbackCtx, 'playback-processor');
      playbackNode.connect(playbackCtx.destination);

      // 2) 音频就绪后再建 WebSocket，并立即挂回调
      const proto = location.protocol === 'https:' ? 'wss' : 'ws';
      const qs = new URLSearchParams({
        instructions: opts.instructions,
        voice: opts.voice || 'longanhuan_v3.6',
      });
      ws = new WebSocket(`${proto}://${location.host}/api/realtime-call?${qs.toString()}`);
      ws.binaryType = 'arraybuffer';

      ws.onopen = () => {
        connected.value = true;
        isActive.value = true;
      };
      ws.onmessage = (e) => {
        if (typeof e.data === 'string') {
          try {
            const j = JSON.parse(e.data);
            const t = j.type || '';
            if (t === 'error') {
              error.value = j.message || j.error?.message || '实时语音错误';
              return;
            }
            // 对方（AI）的转写
            if (t === 'response.audio_transcript.delta') addDelta('ai', j.delta || '');
            else if (t === 'response.audio_transcript.done') endTurn();
            else if (t === 'response.done') endTurn();
            // 用户（我）的转写（ASR）——增量与完整事件都兼容，只增不减
            else if (t === 'conversation.item.input_audio_transcription.delta') addDelta('user', j.delta || j.text || '');
            else if (t === 'conversation.item.input_audio_transcription.completed') {
              // 当前气泡仍在本轮用户 turn 内则补齐，否则新建（避免与 AI 回复错位时重复建气泡）
              fixLastUserBubble(String(j.transcript || j.text || j.delta || ''));
              endTurn();
            }
            // 注意：
            // - input_audio_buffer.committed 不再结束轮次（保持本轮，等 completed 来补齐，避免气泡错位）
            // - conversation.item.created 不再处理（网关注入的"开场触发语"也会触发该事件，误伤用户气泡）

            // 千问实时语音的音频以 base64 内嵌在 JSON 事件中，解码为 PCM16 回放
            if (t === 'response.audio.delta' && j.delta) {
              const bin = atob(j.delta);
              const bytes = new Uint8Array(bin.length);
              for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
              const pcm = new Int16Array(bytes.buffer);
              playbackNode?.port.postMessage(pcm.buffer, [pcm.buffer]);
            }
          } catch {
            /* ignore */
          }
        } else {
          playbackNode?.port.postMessage(e.data);
        }
      };
      ws.onerror = () => {
        error.value = '实时语音连接失败';
      };
      ws.onclose = () => {
        connected.value = false;
        isActive.value = false;
      };

      // 3) 麦克风采集 → 发送到网关
      captureNode.port.onmessage = (e) => {
        if (ws && ws.readyState === WebSocket.OPEN) ws.send(e.data);
      };
    } catch (e) {
      error.value = (e as Error).message || '无法启动实时语音（需麦克风权限）';
      stop();
    }
  }

  function stop() {
    try { captureNode?.port.close(); } catch { /* */ }
    try { captureSource?.disconnect(); } catch { /* */ }
    try { captureNode?.disconnect(); } catch { /* */ }
    try { playbackNode?.disconnect(); } catch { /* */ }
    try { micStream?.getTracks().forEach((t) => t.stop()); } catch { /* */ }
    try { ws?.close(); } catch { /* */ }
    try { captureCtx?.close(); } catch { /* */ }
    try { playbackCtx?.close(); } catch { /* */ }
    ws = null;
    captureCtx = null;
    playbackCtx = null;
    micStream = null;
    captureSource = null;
    captureNode = null;
    playbackNode = null;
    currentRole = null;
    isActive.value = false;
    connected.value = false;
  }

  function getFullTranscript(): string {
    return bubbles.value.map((b) => `${b.role === 'ai' ? '对方' : '用户'}：${b.text.trim()}`).join('\n');
  }

  return { start, stop, isActive, connected, bubbles, userTranscript, aiTranscript, getFullTranscript, error };
}
