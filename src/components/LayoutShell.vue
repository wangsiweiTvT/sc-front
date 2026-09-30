<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import dayjs from 'dayjs'
import { useMonitorStore } from '@/stores/monitor'
import AlarmBell from './AlarmBell.vue'

const route = useRoute()
const router = useRouter()
const monitor = useMonitorStore()

const nowText = ref(dayjs().format('YYYY-MM-DD HH:mm:ss'))
let clockTimer: number | null = null

onMounted(() => {
  void monitor.init()
  clockTimer = window.setInterval(() => {
    nowText.value = dayjs().format('YYYY-MM-DD HH:mm:ss')
  }, 1000)
})

onBeforeUnmount(() => {
  if (clockTimer !== null) clearInterval(clockTimer)
})

const activeMenu = computed(() => (route.name as string) ?? 'monitor')
const counts = monitor.statusCounts

function go(name: string): void {
  void router.push({ name })
}
</script>

<template>
  <el-container class="min-h-screen">
    <el-header height="64px" class="flex items-center justify-between border-b border-[var(--sc-border)]">
      <div class="flex items-center gap-6">
        <span class="text-xl font-semibold tracking-wide whitespace-nowrap">九厂一期工艺参数监控</span>
        <el-menu mode="horizontal" :ellipsis="false" :default-active="activeMenu" class="!border-b-0" @select="go">
          <el-menu-item index="monitor">实时监控</el-menu-item>
          <el-menu-item index="alarms">告警记录</el-menu-item>
          <el-menu-item index="settings">阈值配置</el-menu-item>
        </el-menu>
      </div>
      <div class="flex items-center gap-5">
        <div class="flex items-center gap-3 text-sm whitespace-nowrap">
          <span class="text-[var(--sc-online)]">在线 {{ counts.online }}</span>
          <span class="text-[var(--sc-offline)]">离线 {{ counts.offline }}</span>
          <span class="text-[var(--sc-abnormal)]">异常 {{ counts.abnormal }}</span>
        </div>
        <span class="sc-dim text-sm tabular-nums">{{ nowText }}</span>
        <AlarmBell />
      </div>
    </el-header>
    <el-main>
      <router-view />
    </el-main>
  </el-container>
</template>
