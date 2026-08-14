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
            // smart_turn：融合声学与语义判断轮次边界，支持高质量打断（用户说话可中断 AI 播报）
            turn_detection: { type: 'smart_turn' },
            input_audio_format: 'pcm16',
            output_audio_format: 'pcm16',
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
