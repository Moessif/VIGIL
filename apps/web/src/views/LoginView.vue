<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { errMsg } from '../api/client';

const auth = useAuthStore();
const router = useRouter();

const mode = ref<'login' | 'register'>('login');
const form = ref({ username: '', password: '', school: '', education: '本科' });
const error = ref('');
const loading = ref(false);

const educations = ['高中', '专科', '本科', '硕士', '博士'];

async function submit() {
  error.value = '';
  loading.value = true;
  try {
    if (mode.value === 'login') {
      await auth.login(form.value.username, form.value.password);
    } else {
      await auth.register(form.value);
    }
    router.push('/training');
  } catch (e) {
    error.value = errMsg(e);
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="min-h-screen flex">
    <!-- 品牌区 -->
    <div
      class="hidden lg:flex flex-1 flex-col justify-between p-12 text-white bg-gradient-to-br from-slate-900 via-blue-900 to-blue-700"
    >
      <div class="flex items-center gap-3">
        <div class="w-11 h-11 rounded-xl bg-white/15 flex items-center justify-center text-2xl">🛡️</div>
        <span class="text-xl font-bold">警心护航</span>
      </div>
      <div>
        <h1 class="text-4xl font-bold leading-tight">
          在拟真诈骗情境中<br />练就反诈「肌肉记忆」
        </h1>
        <p class="mt-4 text-blue-100/80 max-w-md">
          AI 动态导演 · 多模态拟真 · 四维能力画像。面向警校生与公安实战的沉浸式反诈科普训练平台。
        </p>
        <div class="mt-8 flex gap-3 text-sm">
          <span class="px-3 py-1.5 rounded-full bg-white/10">🎯 沉浸式情景训练</span>
          <span class="px-3 py-1.5 rounded-full bg-white/10">📞 实时虚拟电话</span>
          <span class="px-3 py-1.5 rounded-full bg-white/10">📊 维度能力报告</span>
        </div>
      </div>
      <p class="text-sm text-blue-200/60">人工智能 + 公安教育赋能 · 仅供反诈科普用途</p>
    </div>

    <!-- 表单区 -->
    <div class="flex-1 flex items-center justify-center p-6 bg-slate-50">
      <div class="w-full max-w-md">
        <div class="bg-white rounded-2xl shadow-xl shadow-slate-200/60 p-8">
          <h2 class="text-2xl font-bold text-slate-900">
            {{ mode === 'login' ? '登录账号' : '注册账号' }}
          </h2>
          <p class="mt-1 text-sm text-slate-500">
            {{ mode === 'login' ? '欢迎回来，继续你的反诈训练' : '填写信息，开启反诈能力成长之旅' }}
          </p>

          <form class="mt-6 space-y-4" @submit.prevent="submit">
            <div>
              <label class="block text-sm font-medium text-slate-700 mb-1">用户名</label>
              <input
                v-model="form.username"
                required
                minlength="3"
                placeholder="请输入用户名"
                class="w-full px-3 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label class="block text-sm font-medium text-slate-700 mb-1">密码</label>
              <input
                v-model="form.password"
                type="password"
                required
                minlength="6"
                placeholder="至少 6 位"
                class="w-full px-3 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <template v-if="mode === 'register'">
              <div>
                <label class="block text-sm font-medium text-slate-700 mb-1">学校</label>
                <input
                  v-model="form.school"
                  placeholder="例如：河南警察学院"
                  class="w-full px-3 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-slate-700 mb-1">学历水平</label>
                <select
                  v-model="form.education"
                  class="w-full px-3 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option v-for="e in educations" :key="e" :value="e">{{ e }}</option>
                </select>
              </div>
            </template>

            <p v-if="error" class="text-sm text-red-600">{{ error }}</p>

            <button
              type="submit"
              :disabled="loading"
              class="w-full py-2.5 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-60 transition-colors"
            >
              {{ loading ? '请稍候…' : mode === 'login' ? '登录' : '注册并登录' }}
            </button>
          </form>

          <p class="mt-4 text-center text-sm text-slate-500">
            {{ mode === 'login' ? '还没有账号？' : '已有账号？' }}
            <button
              class="text-blue-600 font-medium hover:underline"
              @click="mode = mode === 'login' ? 'register' : 'login'"
            >
              {{ mode === 'login' ? '立即注册' : '去登录' }}
            </button>
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
