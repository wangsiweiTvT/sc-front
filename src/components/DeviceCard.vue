<script setup lang="ts">
import { computed } from 'vue'
import type { Device, DeviceStatusInfo, ParamKey, Reading } from '@/api/types'
import { PARAM_METAS } from '@/config/params'
import StatusBadge from './StatusBadge.vue'
import { formatParamValue, formatTime } from '@/utils/format'

const props = defineProps<{
  device: Device
  reading: Reading | null
  statusInfo: DeviceStatusInfo | undefined
}>()

defineEmits<{ open: [] }>()

const agoText = computed(() => {
  if (!props.reading) return '暂无数据'
  const s = Math.max(0, Math.floor((Date.now() - props.reading.timestamp) / 1000))
  return `${formatTime(props.reading.timestamp)}(${s}s前)`
})

function violationFor(key: ParamKey) {
  return props.statusInfo?.violations.find((v) => v.paramKey === key)
}
</script>

<template>
  <div
    class="sc-panel flex cursor-pointer flex-col gap-4 p-5 transition-colors hover:border-[#38bdf8]/50"
    @click="$emit('open')"
  >
    <div class="flex items-center justify-between">
      <div>
        <div class="text-lg font-semibold">{{ device.name }}</div>
        <div class="sc-dim mt-0.5 text-xs">{{ device.clientId }}</div>
      </div>
      <StatusBadge :status="statusInfo?.status ?? 'offline'" />
    </div>

    <div class="grid grid-cols-3 gap-x-4 gap-y-2">
      <div v-for="meta in PARAM_METAS" :key="meta.key" class="text-sm">
        <span class="sc-dim">{{ meta.label }}</span>
        <span
          class="ml-1 tabular-nums"
          :class="violationFor(meta.key) ? 'font-semibold text-[var(--sc-abnormal)]' : ''"
        >
          {{ formatParamValue(reading?.params[meta.key], meta.key) }}{{ meta.unit }}
        </span>
      </div>
    </div>

    <div class="text-xs">
      <span class="sc-dim">最近上报:{{ agoText }}</span>
    </div>
  </div>
</template>
