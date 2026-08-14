import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '../stores/auth';

const routes = [
  {
    path: '/login',
    name: 'login',
    component: () => import('../views/LoginView.vue'),
    meta: { public: true },
  },
  {
    path: '/',
    component: () => import('../layouts/AppLayout.vue'),
    children: [
      { path: '', redirect: '/training' },
      { path: 'training', name: 'training', component: () => import('../views/TrainingCenterView.vue') },
      { path: 'training/:id', name: 'training-session', component: () => import('../views/TrainingSessionView.vue') },
      { path: 'cases', name: 'cases', component: () => import('../views/CasesView.vue') },
      { path: 'cases/:id', name: 'case-detail', component: () => import('../views/CaseDetailView.vue') },
      { path: 'report', name: 'report', component: () => import('../views/ReportView.vue') },
      { path: 'records', name: 'records', component: () => import('../views/RecordsView.vue') },
      { path: 'admin', name: 'admin', component: () => import('../views/AdminView.vue'), meta: { admin: true } },
    ],
  },
  { path: '/:pathMatch(.*)*', redirect: '/training' },
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach((to) => {
  const auth = useAuthStore();
  if (!to.meta.public && !auth.isAuthenticated) return { name: 'login' };
  if (to.meta.admin && !auth.isAdmin) return { name: 'training' };
  return true;
});
