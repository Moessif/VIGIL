<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';

const auth = useAuthStore();
const route = useRoute();
const router = useRouter();

const navs = computed(() => {
  const items = [
    { to: '/training', label: '训练中心', icon: '🎯' },
    { to: '/cases', label: '案例库', icon: '📚' },
    { to: '/report', label: '能力报告', icon: '📈' },
    { to: '/records', label: '学习记录', icon: '🕘' },
  ];
  if (auth.isAdmin) items.push({ to: '/admin', label: '管理后台', icon: '⚙️' });
  return items;
});

function logout() {
  auth.logout();
  router.push({ name: 'login' });
}
</script>

<template>
  <div class="flex h-screen overflow-hidden">
    <!-- 侧边栏 -->
    <aside class="w-60 shrink-0 bg-slate-900 text-slate-300 flex flex-col">
      <div class="flex items-center gap-3 px-5 py-5 border-b border-slate-800">
        <div class="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-xl">🛡️</div>
        <div>
          <div class="text-white font-bold text-lg leading-tight">警心护航</div>
          <div class="text-xs text-slate-500">沉浸式反诈科普平台</div>
        </div>
      </div>

      <nav class="flex-1 py-4 space-y-1 px-3">
        <router-link
          v-for="n in navs"
          :key="n.to"
          :to="n.to"
          class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors"
          :class="
            route.path.startsWith(n.to)
              ? 'bg-blue-600 text-white'
              : 'hover:bg-slate-800 hover:text-white'
          "
        >
          <span class="text-base">{{ n.icon }}</span>
          <span>{{ n.label }}</span>
        </router-link>
      </nav>

      <div class="px-4 py-4 border-t border-slate-800 flex items-center gap-3">
        <div class="w-9 h-9 rounded-full bg-slate-700 flex items-center justify-center text-sm text-white font-semibold">
          {{ (auth.user?.username || '?').slice(0, 1).toUpperCase() }}
        </div>
        <div class="flex-1 min-w-0">
          <div class="text-sm text-white truncate">{{ auth.user?.username }}</div>
          <div class="text-xs text-slate-500 truncate">
            {{ auth.user?.school || '未填写学校' }} · {{ auth.user?.role === 'admin' ? '管理员' : '学员' }}
          </div>
        </div>
        <button
          class="text-slate-500 hover:text-white text-lg leading-none px-1"
          title="退出登录"
          @click="logout"
        >
          ⏻
        </button>
      </div>
    </aside>

    <!-- 主内容 -->
    <main class="flex-1 overflow-y-auto">
      <router-view />
    </main>
  </div>
</template>
