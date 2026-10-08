<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { detectorApi } from '@/api/detectorApi'
import { DETECTOR_POLL_INTERVAL_MS } from '@/config/params'

const useMock = (import.meta.env.VITE_USE_MOCK ?? 'true') !== 'false'

const running = ref<boolean | null>(null)
let timer: number | null = null

async function refresh(): Promise<void> {
  try {
    running.value = (await detectorApi.getStatus()).running
  } catch {
    running.value = null // 接口异常按未知处理,不误报"已停止"
  }
}

onMounted(() => {
  if (useMock) return // mock 模式没有真实检测器,不展示
  void refresh()
  timer = window.setInterval(() => {
    void refresh()
  }, DETECTOR_POLL_INTERVAL_MS)
})

onBeforeUnmount(() => {
  if (timer !== null) clearInterval(timer)
})
</script>

<template>
  <span v-if="!useMock && running !== null" class="flex items-center gap-1.5 text-sm whitespace-nowrap">
    <span
      class="inline-block h-2 w-2 rounded-full"
      :class="running ? 'bg-[var(--sc-online)]' : 'bg-[var(--sc-abnormal)]'"
    />
    <span :class="running ? 'text-[var(--sc-online)]' : 'text-[var(--sc-abnormal)]'">
      检测器{{ running ? '运行中' : '已停止' }}
    </span>
  </span>
</template>
