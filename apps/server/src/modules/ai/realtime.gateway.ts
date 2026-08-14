// 实时语音 S2S 网关：桥接浏览器 ⇄ 千问实时语音（OpenAI Realtime 风格事件协议）
import type { Server } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { resolveVoice } from './providers';

export interface RealtimeGatewayOptions {
  apiKey: string;
  model: string;
  baseUrl: string; // https://dashscope.aliyuncs.com
}

export function attachRealtimeGateway(server: Server, opts: RealtimeGatewayOptions): WebSocketServer {
  const wss = new WebSocketServer({ server, path: '/api/realtime-call' });

  wss.on('connection', (browserWs, req) => {
    const url = new URL(req.url || '/', 'http://localhost');
    const instructions = url.searchParams.get('instructions') || '你是反诈训练中的对话角色。';
    const voice = resolveVoice(url.searchParams.get('voice') ?? undefined);

    const qwenUrl = `${opts.baseUrl.replace(/^https/, 'wss')}/api-ws/v1/realtime?model=${encodeURIComponent(
      opts.model,
    )}`;

    let qwenWs: WebSocket;
    try {
      qwenWs = new WebSocket(qwenUrl, { headers: { Authorization: `Bearer ${opts.apiKey}` } });
    } catch (e) {
      browserWs.send(JSON.stringify({ type: 'error', message: String(e) }));
      browserWs.close();
      return;
    }

    let qwenOpen = false;
    let openingTriggered = false;
    const seenEventTypes = new Set<string>();
    let seenTranscriptPayload = false;
    const sendBrowser = (data: string | Buffer) => {
      if (browserWs.readyState === WebSocket.OPEN) browserWs.send(data);
    };

    qwenWs.on('open', () => {
      qwenOpen = true;
      sendBrowser(JSON.stringify({ type: 'gateway.ready', voice }));
      qwenWs.send(
        JSON.stringify({
          type: 'session.update',
          session: {
            instructions,
            voice,
            // server_vad + silence_duration_ms：停顿宽容度可调（1200ms 给足句间停顿），
            // 同时支持用户说话打断 AI 播报（barge-in）
            turn_detection: { type: 'server_vad', threshold: 0.5, silence_duration_ms: 1200 },
            // 千问实时语音：输入 pcm 16kHz 16bit 单声道；输出 pcm 24kHz 16bit 单声道
            input_audio_format: 'pcm',
            output_audio_format: 'pcm',
          },
        }),
      );
    });

    qwenWs.on('message', (data, isBinary) => {
      // 千问 → 浏览器：二进制为 PCM16 音频，文本为 JSON 事件（转写/结束等）
      if (isBinary) {
        sendBrowser(data as Buffer);
        return;
      }
      const text = data.toString();
      sendBrowser(text);
      // 会话配置生效后，注入触发消息让 AI 主动开口说开场白（否则模型在无输入时不会说话）
      try {
        const j = JSON.parse(text);
        // 调试：每个事件类型只打印一次，便于排查转写事件名
        if (!seenEventTypes.has(j.type)) {
          seenEventTypes.add(j.type);
          // eslint-disable-next-line no-console
          console.log(`[realtime] 事件类型: ${j.type}`);
        }
        // 调试：打印首个用户转写事件的完整内容，便于确认字段名
        if (
          !seenTranscriptPayload &&
          (j.type === 'conversation.item.input_audio_transcription.delta' ||
            j.type === 'conversation.item.input_audio_transcription.completed')
        ) {
          seenTranscriptPayload = true;
          // eslint-disable-next-line no-console
          console.log(`[realtime] 用户转写事件示例(${j.type}):`, JSON.stringify(j).slice(0, 400));
        }
        if (j.type === 'session.updated' && !openingTriggered) {
          openingTriggered = true;
          qwenWs.send(
            JSON.stringify({
              type: 'conversation.item.create',
              item: {
                type: 'message',
                role: 'user',
                content: [
                  {
                    type: 'input_text',
                    text: '（对方已接听电话，请现在开始，用设定语气说出你的开场白，然后继续扮演该角色对话）',
                  },
                ],
              },
            }),
          );
          qwenWs.send(JSON.stringify({ type: 'response.create' }));
        }
      } catch {
        /* ignore */
      }
    });

    qwenWs.on('error', (e) => {
      sendBrowser(JSON.stringify({ type: 'error', message: (e as Error).message || 'realtime error' }));
      browserWs.close();
    });
    qwenWs.on('close', () => browserWs.close());

    browserWs.on('message', (data, isBinary) => {
      if (!qwenOpen || qwenWs.readyState !== WebSocket.OPEN) return;
      if (isBinary) {
        // 浏览器麦克风 PCM16 → 追加到千问输入音频缓冲
        qwenWs.send(
          JSON.stringify({ type: 'input_audio_buffer.append', audio: (data as Buffer).toString('base64') }),
        );
      } else {
        // 浏览器 JSON 事件（input_audio_buffer.commit / response.create 等）透传
        qwenWs.send(data.toString());
      }
    });

    browserWs.on('close', () => {
      try {
        qwenWs.close();
      } catch {
        /* ignore */
      }
    });
  });

  return wss;
}
