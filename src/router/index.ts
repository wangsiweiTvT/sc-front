import { createRouter, createWebHashHistory } from 'vue-router'
import MonitorView from '@/views/MonitorView.vue'

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', redirect: '/monitor' },
    { path: '/monitor', name: 'monitor', component: MonitorView },
    { path: '/alarms', name: 'alarms', component: () => import('@/views/AlarmsView.vue') },
    { path: '/settings', name: 'settings', component: () => import('@/views/SettingsView.vue') },
  ],
})
