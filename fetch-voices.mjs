// 抓取 Qwen-Audio-TTS 音色列表，提取音色名与性别
const urls = [
  ['voice-list', 'https://help.aliyun.com/zh/document_detail/3045630.md'],
  ['voice-list-html', 'https://help.aliyun.com/zh/document_detail/3045630.html'],
];

for (const [name, url] of urls) {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const text = await res.text();
    console.log(`\n===== ${name} (${res.status}) len=${text.length} =====`);
    // 找包含 long 的音色名（龙字系）和性别关键词
    const hits = text.match(/long[a-z_0-9]+/gi);
    const unique = [...new Set(hits || [])];
    console.log('音色名:', unique.join(', '));
    // 提取性别相关片段
    const g = text.replace(/<[^>]+>/g, ' ');
    const genderIdx = g.search(/男|女|性别|音色/);
    if (genderIdx >= 0) console.log('性别信息片段:', g.slice(genderIdx, genderIdx + 1500).replace(/\s+/g, ' '));
  } catch (e) {
    console.log(`${name} ERROR`, e.message);
  }
}
