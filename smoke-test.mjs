// 临时冒烟测试：验证后端核心闭环
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
  for (let i = 0; i < 40; i++) {
    try {
      await fetch(BASE + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      up = true;
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  if (!up) throw new Error('server not up');

  const uname = 'test_' + Date.now();
  const reg = await j('/auth/register', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: uname, password: '123456', school: '测试警院', education: '本科' }),
  });
  console.log('register', reg.status, reg.data.user?.username ?? reg.data.message);

  const login = await j('/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: uname, password: '123456' }),
  });
  console.log('login', login.status, 'token?', !!login.data.token, 'role', login.data.user?.role);
  const auth = { 'Content-Type': 'application/json', Authorization: `Bearer ${login.data.token}` };

  const scenarios = await j('/scenarios', { headers: auth });
  console.log('scenarios', scenarios.status, scenarios.data.length, scenarios.data.map((s) => `${s.id}:${s.status}`).join(','));

  const start = await j('/training/start', { method: 'POST', headers: auth, body: JSON.stringify({ scenarioId: 'scn_car_crash' }) });
  console.log('start', start.status, 'session', start.data.sessionId, 'messages', start.data.messages?.length, 'triggers', start.data.triggers?.map((t) => t.key).join(','));

  const rep = await j(`/training/${start.data.sessionId}/reply`, { method: 'POST', headers: auth, body: JSON.stringify({ optionId: '0' }) });
  console.log('reply', rep.status, 'messages', rep.data.messages?.length, 'options', rep.data.options?.length, 'ended', rep.data.ended);

  const act = await j(`/training/${start.data.sessionId}/action`, { method: 'POST', headers: auth, body: JSON.stringify({ trigger: 'transfer' }) });
  console.log('action', act.status, 'ended', act.data.ended, 'ending', act.data.ending?.ending, 'scores', JSON.stringify(act.data.ending?.scores));

  const report = await j('/reports', { headers: auth });
  console.log('report', report.status, 'total', report.data.totalSessions, 'tier', report.data.tierName, 'success', report.data.successRate);

  const records = await j('/records', { headers: auth });
  console.log('records', records.status, records.data.length);

  const cases = await j('/cases/scn_car_crash', { headers: auth });
  console.log('case detail', cases.status, 'history', cases.data.history?.length, 'best', cases.data.bestScore);

  console.log('SMOKE OK');
}

main().catch((e) => {
  console.error('SMOKE FAIL', e);
  process.exit(1);
});
