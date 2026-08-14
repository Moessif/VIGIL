// 验证男/女音色在 TTS 与实时语音中的可用性
const qwenKey = process.env.QWEN_API_KEY || '';

async function testTts(voice, label) {
  try {
    const res = await fetch('https://dashscope.aliyuncs.com/api/v1/services/audio/tts/SpeechSynthesizer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${qwenKey}` },
      body: JSON.stringify({
        model: 'qwen-audio-3.0-tts-plus',
        input: { text: '你好，我是爸爸。', voice, format: 'mp3', sample_rate: 24000 },
      }),
    });
    const t = await res.text();
    const ok = t.includes('output') && t.includes('url');
    console.log(`TTS[${label} ${voice}]: ${res.status} ${ok ? 'OK' : t.slice(0, 150)}`);
  } catch (e) {
    console.log(`TTS[${voice}] ERROR`, e.message);
  }
}

function testRealtime(voice, label) {
  return new Promise((resolve) => {
    const ws = new WebSocket('wss://dashscope.aliyuncs.com/api-ws/v1/realtime?model=qwen-audio-3.0-realtime-plus', {
      headers: { Authorization: 'Bearer ' + qwenKey },
    });
    let updated = false;
    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'session.update', session: { instructions: '你是爸爸', voice, turn_detection: { type: 'server_vad', silence_duration_ms: 1200 }, input_audio_format: 'pcm', output_audio_format: 'pcm' } }));
    };
    ws.onmessage = (ev) => {
      if (typeof ev.data === 'string') {
        try {
          const j = JSON.parse(ev.data);
          if (j.type === 'session.updated') { updated = true; console.log(`RT[${label} ${voice}]: session.updated OK`); ws.close(); resolve(); }
          else if (j.type === 'error') { console.log(`RT[${label} ${voice}] ERROR:`, JSON.stringify(j).slice(0, 200)); ws.close(); resolve(); }
        } catch {}
      }
    };
    ws.onerror = (e) => { console.log(`RT[${voice}] ws error`, e.message); resolve(); };
    setTimeout(() => { console.log(`RT[${voice}] TIMEOUT updated=${updated}`); try { ws.close(); } catch {} resolve(); }, 10000);
  });
}

await testTts('longanlingxin', '女');
await testTts('longanlufeng', '男');
await testRealtime('longanlingxin', '女');
await testRealtime('longanlufeng', '男');
console.log('DONE');
process.exit(0);
