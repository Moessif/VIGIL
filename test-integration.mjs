// 真实 AI 集成测试：通过服务器验证 TTS 语音、图片生成、管理员种子
const BASE = 'http://localhost:3000/api';

async function j(url, opts = {}) {
  const res = await fetch(BASE + url, opts);
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data };
}

async function main() {
  let up = false;
  for (let i = 0; i < 60; i++) {
    try { await fetch(BASE + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }); up = true; break; }
    catch { await new Promise((r) => setTimeout(r, 500)); }
  }
  if (!up) throw new Error('server not up');

  // 1. 管理员种子验证
  const adminLogin = await j('/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'admin', password: 'admin123456' }) });
  console.log('1. 管理员登录:', adminLogin.status, adminLogin.data.user?.role ?? adminLogin.data.message);

  // 2. 学生注册 + 训练
  const uname = 'stu_' + Date.now();
  const reg = await j('/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: uname, password: '123456', school: '测试警院', education: '本科' }) });
  const auth = { 'Content-Type': 'application/json', Authorization: `Bearer ${reg.data.token}` };

  // 3. 语音消息（scn_car_crash 的 b2_verify 是 voice_call）
  const start = await j('/training/start', { method: 'POST', headers: auth, body: JSON.stringify({ scenarioId: 'scn_car_crash' }) });
  const rep = await j(`/training/${start.data.sessionId}/reply`, { method: 'POST', headers: auth, body: JSON.stringify({ optionId: '0' }) });
  const voiceMsg = rep.data.messages?.find((m) => m.channel === 'voice_call');
  console.log('2. voice_call 消息:', voiceMsg ? `channel=${voiceMsg.channel}, speaker=${voiceMsg.speaker}, assetUrl=${String(voiceMsg.assetUrl).slice(0, 60)}...` : '未找到');

  // 4. 图片消息（scn_refund 的 b1 是 image）
  const start2 = await j('/training/start', { method: 'POST', headers: auth, body: JSON.stringify({ scenarioId: 'scn_refund' }) });
  const imgMsg = start2.data.messages?.find((m) => m.channel === 'image');
  console.log('3. image 消息:', imgMsg ? `channel=${imgMsg.channel}, assetUrl=${String(imgMsg.assetUrl).slice(0, 60)}...` : '未找到');

  // 5. 供应商列表（管理员）
  const providers = await j('/admin/providers', { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminLogin.data.token}` } });
  console.log('4. 供应商:', providers.status, providers.data.map((p) => `${p.type}=${p.baseUrl.replace('https://', '')}/${p.model} key:${p.keyMask ? '已配置' : '未配置'}`).join(' | '));

  console.log('INTEGRATION DONE');
}

main().catch((e) => { console.error('INTEGRATION FAIL', e); process.exit(1); });
