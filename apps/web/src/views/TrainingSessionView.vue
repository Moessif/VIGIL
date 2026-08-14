<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api } from '../api';
import { errMsg } from '../api/client';
import { useRealtimeCall } from '../composables/useRealtimeCall';
import { ABILITY_DIMENSIONS, ABILITY_LABELS } from '@police/shared';
import type {
  AbilityScores,
  ChoiceOption,
  EndingResult,
  TrainingMessage,
} from '@police/shared';

interface DecisionTrigger {
  key: string;
  label: string;
  danger: boolean;
}

interface Turn {
  sessionId?: string;
  messages: TrainingMessage[];
  options: ChoiceOption[];
  triggers: DecisionTrigger[];
  scores: AbilityScores;
  ended: boolean;
  ending?: EndingResult;
}

const route = useRoute();
const router = useRouter();
const scenarioId = String(route.params.id);

const sessionId = ref('');
const scenarioTitle = ref('');
const fraudType = ref('');
const messages = ref<TrainingMessage[]>([]);
const options = ref<ChoiceOption[]>([]);
const triggers = ref<DecisionTrigger[]>([]);
const scores = ref<AbilityScores>({ identityCheck: 60, fundSafety: 60, privacyProtection: 60, emergencyResponse: 60 });
const ended = ref(false);
const ending = ref<EndingResult | null>(null);
const input = ref('');
const busy = ref(false);
const typing = ref(false);
const error = ref('');
const incomingCall = ref<TrainingMessage | null>(null);
const callerName = ref('');
const scrollEl = ref<HTMLDivElement>();

const {
  start: rtStart,
  stop: rtStop,
  isActive: rtActive,
  bubbles: rtBubbles,
  userTranscript: rtUserTranscript,
  aiTranscript: rtAiTranscript,
  getFullTranscript: rtGetFullTranscript,
  error: rtError,
} = useRealtimeCall();

const dims = ABILITY_DIMENSIONS;

function reset() {
  sessionId.value = '';
  messages.value = [];
  options.value = [];
  triggers.value = [];
  scores.value = { identityCheck: 60, fundSafety: 60, privacyProtection: 60, emergencyResponse: 60 };
  ended.value = false;
  ending.value = null;
  incomingCall.value = null;
  error.value = '';
}

async function startSession() {
  reset();
  typing.value = true;
  try {
    const [summary, start] = await Promise.all([
      api.scenarios.get(scenarioId),
      api.training.start(scenarioId),
    ]);
    scenarioTitle.value = summary.title;
    fraudType.value = summary.fraudType;
    applyTurn(start);
  } catch (e) {
    error.value = errMsg(e);
  } finally {
    typing.value = false;
  }
}

function applyTurn(turn: Turn) {
  if (turn.sessionId) sessionId.value = turn.sessionId;
  messages.value = [...messages.value, ...turn.messages];
  options.value = turn.options;
  triggers.value = turn.triggers;
  scores.value = turn.scores;
  ended.value = turn.ended;
  if (turn.ending) ending.value = turn.ending;
  const call = [...turn.messages].reverse().find((m) => m.channel === 'voice_call' && m.role === 'ai');
  if (call) incomingCall.value = call;
  scrollToBottom();
}

async function chooseOption(o: ChoiceOption) {
  if (busy.value || ended.value) return;
  await run(async () => applyTurn(await api.training.reply(sessionId.value, { optionId: o.id })));
}

async function doAction(key: string) {
  if (busy.value || ended.value) return;
  await run(async () => applyTurn(await api.training.action(sessionId.value, key)));
}

async function sendText() {
  const text = input.value.trim();
  if (!text || busy.value || ended.value) return;
  input.value = '';
  await run(async () => applyTurn(await api.training.reply(sessionId.value, { text })));
}

async function run(fn: () => Promise<void>) {
  busy.value = true;
  typing.value = true;
  try {
    await fn();
  } catch (e) {
    error.value = errMsg(e);
  } finally {
    busy.value = false;
    typing.value = false;
  }
}

function answerCall() {
  const call = incomingCall.value;
  if (!call) return;
  callerName.value = call.speaker || '对方';
  incomingCall.value = null;
  // 不再播放预生成的 TTS（避免被麦克风回采造成回声/不同步）。
  // 改由实时语音 AI 自己开口说开场白，并在完整情境上下文下继续对话。
  rtStart({
    instructions: buildCallInstructions(call),
    voice: (call.meta?.voice as string) || undefined,
  });
}

function buildCallInstructions(call: TrainingMessage): string {
  const speaker = call.speaker || '对方';
  const persona = (call.meta?.persona as string) || '';
  const tone = (call.meta?.voiceParams?.tone as string) || '自然';
  const opening = call.content || '';
  const parts = [
    '你正在一场沉浸式反诈情景训练中扮演一个角色，请全程入戏、不要跳出角色。',
    scenarioTitle.value
      ? `情景：${scenarioTitle.value}${fraudType.value ? `（${fraudType.value}）` : ''}`
      : '',
    `你的角色：${speaker}。`,
    persona ? `角色设定（务必遵守）：${persona}。` : '',
    `开场白：「${opening}」`,
    `请先用「${tone}」的语气说出开场白，然后继续以该角色身份与我进行实时语音对话，按角色设定如实、自然地回应。`,
  ];
  return parts.filter(Boolean).join('\n');
}

const callStartAt = ref(0);
const callElapsed = ref('00:00');
const callAnalyzing = ref(false);
let callTimer: ReturnType<typeof setInterval> | null = null;
let hangupCheckTimer: ReturnType<typeof setTimeout> | null = null;
let handingOff = false;

function startCallTimer() {
  callStartAt.value = Date.now();
  callElapsed.value = '00:00';
  if (callTimer) clearInterval(callTimer);
  callTimer = setInterval(() => {
    const s = Math.floor((Date.now() - callStartAt.value) / 1000);
    callElapsed.value = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  }, 1000);
}

function stopCallTimer() {
  if (callTimer) {
    clearInterval(callTimer);
    callTimer = null;
  }
}

async function hangUp() {
  if (handingOff) return;
  handingOff = true;
  callAnalyzing.value = true;
  stopCallTimer();
  const full = rtGetFullTranscript();
  rtStop();
  // 把实时通话转写交给主线 AI，让它决定后续剧情（期间锁定交互）
  if (full.trim() && sessionId.value) {
    try {
      const turn = await api.training.realtimeResult(sessionId.value, full);
      applyTurn(turn);
    } catch (e) {
      error.value = errMsg(e);
    }
  }
  callAnalyzing.value = false;
  handingOff = false;
}

// 语音识别"挂断"：正则即时命中 + DeepSeek v4 Flash 精确兜底
watch(rtUserTranscript, (t) => {
  if (!rtActive.value || !t.trim()) return;
  if (/(挂了|挂吧|挂断|再见|拜拜|先这样|不聊了|不说了|就这样)/.test(t)) {
    hangUp();
    return;
  }
  if (hangupCheckTimer) clearTimeout(hangupCheckTimer);
  hangupCheckTimer = setTimeout(async () => {
    if (!rtActive.value) return;
    try {
      const r = await api.training.realtimeIntent(t);
      if (r.intent === 'hangup') hangUp();
    } catch {
      /* ignore */
    }
  }, 1200);
});

// 通话接通/结束时启停计时器
watch(rtActive, (active) => {
  if (active) startCallTimer();
  else stopCallTimer();
});

// 退出训练页时清理实时语音（否则通话会残留）
onBeforeUnmount(() => {
  stopCallTimer();
  if (hangupCheckTimer) clearTimeout(hangupCheckTimer);
  rtStop();
});

function declineCall() {
  incomingCall.value = null;
}

function playMessage(m: TrainingMessage) {
  if (m.assetUrl) {
    const a = new Audio(m.assetUrl);
    a.play().catch(() => speak(m.content));
  } else {
    speak(m.content);
  }
}

function speak(text: string) {
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'zh-CN';
    u.rate = 1;
    const voices = window.speechSynthesis.getVoices();
    const zh = voices.find((v) => v.lang && v.lang.toLowerCase().startsWith('zh'));
    if (zh) u.voice = zh;
    window.speechSynthesis.speak(u);
  } catch {
    /* ignore */
  }
}

async function scrollToBottom() {
  await nextTick();
  if (scrollEl.value) scrollEl.value.scrollTop = scrollEl.value.scrollHeight;
}

watch(
  () => messages.value.length,
  () => scrollToBottom(),
);

function scoreColor(v: number): string {
  if (v >= 80) return 'text-emerald-600';
  if (v >= 60) return 'text-blue-600';
  if (v >= 40) return 'text-amber-600';
  return 'text-red-600';
}

function retry() {
  startSession();
}

onMounted(startSession);
</script>

<template>
  <div class="flex flex-col h-screen bg-slate-100">
    <!-- 顶栏 -->
    <header class="bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-3">
      <button
        class="w-9 h-9 rounded-lg hover:bg-slate-100 text-slate-500 flex items-center justify-center"
        @click="router.push('/training')"
      >
        ‹
      </button>
      <div class="flex-1 min-w-0">
        <div class="font-semibold text-slate-900 truncate">{{ scenarioTitle || '训练中…' }}</div>
        <div class="text-xs text-slate-400">沉浸式反诈情景训练</div>
      </div>
      <div class="hidden sm:flex items-center gap-2">
        <span
          v-for="d in dims"
          :key="d"
          class="text-xs px-2 py-1 rounded-lg bg-slate-50 border border-slate-200"
          :class="scoreColor(scores[d])"
        >
          {{ ABILITY_LABELS[d] }} {{ scores[d] }}
        </span>
      </div>
    </header>

    <!-- 聊天区 -->
    <div ref="scrollEl" class="flex-1 overflow-y-auto px-4 py-5">
      <div class="max-w-2xl mx-auto space-y-4">
        <p v-if="error" class="text-sm text-red-600 text-center">{{ error }}</p>

        <div
          v-for="m in messages"
          :key="m.id"
          class="fade-up"
          :class="m.role === 'user' ? 'flex justify-end' : m.role === 'system' ? 'flex justify-center' : 'flex justify-start'"
        >
          <!-- 系统提示 -->
          <div
            v-if="m.channel === 'system' || m.role === 'system'"
            class="max-w-[85%] text-sm text-slate-500 bg-slate-200/60 rounded-xl px-4 py-2.5 whitespace-pre-wrap"
          >
            {{ m.content }}
          </div>

          <!-- 用户消息 -->
          <div
            v-else-if="m.role === 'user'"
            class="max-w-[75%] bg-blue-600 text-white rounded-2xl rounded-br-sm px-4 py-2.5 shadow-sm"
          >
            <div v-if="m.channel === 'choice'" class="text-[11px] text-blue-200 mb-0.5">你选择了</div>
            <div class="text-sm whitespace-pre-wrap">{{ m.content }}</div>
          </div>

          <!-- AI 消息 -->
          <div v-else class="flex items-end gap-2 max-w-[80%]">
            <div
              class="w-8 h-8 rounded-full bg-slate-700 text-white flex items-center justify-center text-sm shrink-0"
            >
              {{ (m.speaker || '骗')[0] }}
            </div>
            <div class="bg-white rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
              <div v-if="m.speaker" class="text-[11px] text-slate-400 mb-1">{{ m.speaker }}</div>

              <!-- 文本 -->
              <div v-if="m.channel === 'text'" class="text-sm whitespace-pre-wrap">{{ m.content }}</div>

              <!-- 图片 -->
              <div v-else-if="m.channel === 'image'" class="text-sm">
                <img
                  v-if="m.assetUrl"
                  :src="m.assetUrl"
                  class="rounded-lg max-w-xs border border-slate-200"
                  alt="图片消息"
                />
                <div class="mt-1.5 text-xs text-slate-400">{{ m.content }}</div>
              </div>

              <!-- 语音消息 -->
              <div v-else-if="m.channel === 'voice'" class="flex items-center gap-2">
                <button
                  class="w-9 h-9 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center hover:bg-blue-100"
                  @click="playMessage(m)"
                >
                  🔊
                </button>
                <span class="text-sm text-slate-600">语音消息（点击播放）</span>
              </div>

              <!-- 虚拟来电 -->
              <div v-else-if="m.channel === 'voice_call'" class="text-sm">
                <div class="text-xs text-red-500 font-medium mb-1">📞 对方来电</div>
                <div class="whitespace-pre-wrap">{{ m.content }}</div>
              </div>

              <div v-else class="text-sm whitespace-pre-wrap">{{ m.content }}</div>
            </div>
          </div>
        </div>

        <!-- 打字指示 -->
        <div v-if="typing" class="flex items-end gap-2">
          <div class="w-8 h-8 rounded-full bg-slate-700 text-white flex items-center justify-center text-sm">…</div>
          <div class="bg-white rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm text-slate-400 text-sm">
            对方正在输入<span class="blink">…</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 底部操作区 -->
    <footer class="bg-white border-t border-slate-200 px-4 py-3">
      <div class="max-w-2xl mx-auto space-y-3">
        <!-- 通话分析中：锁定交互 -->
        <div v-if="callAnalyzing" class="flex items-center justify-center gap-2 py-3 text-sm text-blue-600">
          <span class="inline-block w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></span>
          通话已结束，主线 AI 正在分析对话并推进剧情…
        </div>

        <template v-else>
          <!-- 决策栏 -->
          <div v-if="!ended && triggers.length" class="flex flex-wrap gap-2">
            <button
              v-for="t in triggers"
              :key="t.key"
              class="px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors"
              :class="
                t.danger
                  ? 'border-red-200 text-red-600 hover:bg-red-50'
                  : 'border-emerald-200 text-emerald-600 hover:bg-emerald-50'
              "
              @click="doAction(t.key)"
            >
              {{ t.danger ? '⚠️ ' : '✅ ' }}{{ t.label }}
            </button>
          </div>

          <!-- 选项 -->
          <div v-if="!ended && options.length" class="space-y-2">
            <button
              v-for="o in options"
              :key="o.id"
              class="w-full text-left px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-blue-50 hover:border-blue-300 text-sm text-slate-700 transition-colors"
              @click="chooseOption(o)"
            >
              {{ o.label }}
            </button>
          </div>

          <!-- 输入框 -->
          <div v-if="!ended" class="flex items-center gap-2">
            <input
              v-model="input"
              placeholder="输入你的回复…（例如：我先核实一下）"
              class="flex-1 px-3 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              @keyup.enter="sendText"
            />
            <button
              class="px-4 py-2.5 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50"
              :disabled="busy"
              @click="sendText"
            >
              发送
            </button>
          </div>
        </template>
      </div>
    </footer>

    <!-- 来电弹窗 -->
    <div
      v-if="incomingCall"
      class="fixed inset-0 bg-slate-900/80 flex items-center justify-center z-40 p-6"
    >
      <div class="bg-white rounded-2xl p-8 text-center max-w-sm w-full fade-up">
        <div class="text-5xl ring-pulse rounded-full inline-flex items-center justify-center w-24 h-24 bg-red-50">
          📞
        </div>
        <div class="mt-4 text-xl font-bold text-slate-900">{{ incomingCall.speaker || '未知来电' }}</div>
        <div class="mt-1 text-sm text-slate-500">正在呼叫你…</div>
        <div class="mt-6 flex justify-center gap-4">
          <button
            class="w-16 h-16 rounded-full bg-red-500 text-white text-2xl hover:bg-red-600"
            @click="declineCall"
          >
            ✕
          </button>
          <button
            class="w-16 h-16 rounded-full bg-emerald-500 text-white text-2xl hover:bg-emerald-600"
            @click="answerCall"
          >
            ✓
          </button>
        </div>
        <div class="mt-3 text-xs text-slate-400">接听后进入实时语音对话，AI 会开口说话</div>
      </div>
    </div>

    <!-- 实时语音通话中（手机通话式界面） -->
    <div v-if="rtActive" class="fixed inset-0 z-40 flex flex-col bg-slate-900 text-white">
      <!-- 顶部：来电人 + 计时 -->
      <div class="pt-14 pb-6 text-center shrink-0">
        <div class="w-20 h-20 mx-auto rounded-full bg-slate-700/60 flex items-center justify-center text-4xl">📞</div>
        <div class="mt-4 text-2xl font-bold">{{ callerName || '对方' }}</div>
        <div class="mt-1 text-sm text-slate-400">{{ callElapsed }}</div>
      </div>

      <!-- 中部：双方发言（离散气泡） -->
      <div class="flex-1 overflow-y-auto px-5 pb-4 space-y-3 max-w-lg w-full mx-auto">
        <div v-for="(b, i) in rtBubbles" :key="i" class="fade-up" :class="b.role === 'ai' ? 'text-left' : 'text-right'">
          <div class="text-xs mb-1" :class="b.role === 'ai' ? 'text-slate-400' : 'text-blue-400'">
            {{ b.role === 'ai' ? '对方' : '你' }}
          </div>
          <div
            class="inline-block text-left px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap rounded-2xl"
            :class="b.role === 'ai' ? 'bg-slate-800 rounded-tl-sm' : 'bg-blue-600 rounded-tr-sm'"
          >
            {{ b.text }}
          </div>
        </div>
        <div v-if="rtBubbles.length === 0" class="pt-10 text-center text-sm text-slate-500">
          正在通话中，请直接说话（可随时打断对方）…
        </div>
        <div v-if="rtError" class="text-center text-xs text-red-400">{{ rtError }}</div>
      </div>

      <!-- 底部：挂断按钮 -->
      <div class="pb-12 pt-4 flex flex-col items-center shrink-0">
        <button
          class="w-16 h-16 rounded-full bg-red-600 hover:bg-red-700 text-2xl flex items-center justify-center shadow-lg"
          @click="hangUp"
        >
          📵
        </button>
        <div class="mt-2 text-xs text-slate-400">挂断（或直接说「挂了」）</div>
      </div>
    </div>

    <!-- 结局弹窗 -->
    <div v-if="ended && ending" class="fixed inset-0 bg-slate-900/70 flex items-center justify-center z-50 p-6">
      <div class="bg-white rounded-2xl p-8 max-w-lg w-full fade-up max-h-[90vh] overflow-y-auto">
        <div
          class="text-3xl font-bold"
          :class="ending.ending === 'defended' ? 'text-emerald-600' : 'text-red-600'"
        >
          {{ ending.ending === 'defended' ? '🛡️ 成功识破' : '⚠️ 本次被骗' }}
        </div>
        <div class="mt-1 text-sm text-slate-500">结局：{{ ending.endingTitle }}</div>

        <div class="mt-4 bg-slate-50 rounded-xl p-4 text-sm text-slate-700 whitespace-pre-wrap">
          {{ ending.review }}
        </div>

        <div class="mt-4">
          <div class="text-sm font-semibold text-slate-700 mb-2">四维能力评分</div>
          <div class="space-y-2">
            <div v-for="d in dims" :key="d" class="flex items-center gap-3 text-sm">
              <span class="w-20 text-slate-600">{{ ABILITY_LABELS[d] }}</span>
              <div class="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                <div
                  class="h-full bg-blue-600 rounded-full transition-all"
                  :style="{ width: ending.scores[d] + '%' }"
                />
              </div>
              <span class="w-24 text-right" :class="scoreColor(ending.scores[d])">
                {{ ending.scores[d] }}
                <span class="text-xs" :class="ending.delta[d] >= 0 ? 'text-emerald-600' : 'text-red-600'">
                  ({{ ending.delta[d] >= 0 ? '+' : '' }}{{ ending.delta[d] }})
                </span>
              </span>
            </div>
          </div>
        </div>

        <div class="mt-6 flex gap-3">
          <button
            class="flex-1 py-2.5 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700"
            @click="retry"
          >
            再来一次
          </button>
          <button
            class="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50"
            @click="router.push('/training')"
          >
            返回训练中心
          </button>
          <button
            class="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50"
            @click="router.push(`/cases/${scenarioId}`)"
          >
            查看案例
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
