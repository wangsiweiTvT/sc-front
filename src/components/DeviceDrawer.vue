<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { Device, ParamKey } from '@/api/types'
import { PARAM_METAS } from '@/config/params'
import { useMonitorStore } from '@/stores/monitor'
import StatusBadge from './StatusBadge.vue'
import TrendChart from './TrendChart.vue'
import { formatDateTime, formatParamValue } from '@/utils/format'

const props = defineProps<{ device: Device | null }>()
const visible = defineModel<boolean>({ required: true })

const monitor = useMonitorStore()
const activeParam = ref<ParamKey>('Vf')

watch(visible, (v) => {
  if (v) activeParam.value = 'Vf'
})

const reading = computed(() => (props.device ? monitor.state.readings[props.device.id] ?? null : null))
const statusInfo = computed(() => (props.device ? monitor.state.statuses[props.device.id] : undefined))
</script>

<template>
  <el-drawer v-model="visible" :title="device?.name" size="560px">
    <template v-if="device">
      <img :src="device.image" :alt="device.name" class="w-full rounded-lg border border-[var(--sc-border)]" />

      <el-descriptions :column="2" border size="small" class="mt-4">
        <el-descriptions-item label="设备编号">{{ device.clientId }}</el-descriptions-item>
        <el-descriptions-item label="状态">
          <StatusBadge :status="statusInfo?.status ?? 'offline'" />
        </el-descriptions-item>
        <el-descriptions-item label="型号">{{ device.model }}</el-descriptions-item>
        <el-descriptions-item label="安装位置">{{ device.location }}</el-descriptions-item>
        <el-descriptions-item label="投运日期">{{ device.commissionDate }}</el-descriptions-item>
        <el-descriptions-item label="负责人">{{ device.manager }}</el-descriptions-item>
        <el-descriptions-item label="通信方式" :span="2">{{ device.comm }}</el-descriptions-item>
        <el-descriptions-item label="最近上报" :span="2">
          {{ reading ? formatDateTime(reading.timestamp) : '暂无数据' }}
        </el-descriptions-item>
      </el-descriptions>

      <div class="mt-4 grid grid-cols-3 gap-2">
        <div
          v-for="meta in PARAM_METAS"
          :key="meta.key"
          class="sc-panel cursor-pointer p-2 text-center"
          :class="activeParam === meta.key ? 'ring-1 ring-[#38bdf8]' : ''"
          @click="activeParam = meta.key"
        >
          <div class="sc-dim text-xs">{{ meta.label }}</div>
          <div class="text-base tabular-nums">{{ formatParamValue(reading?.params[meta.key], meta.key) }}</div>
          <div class="sc-dim text-xs">{{ meta.unit }}</div>
        </div>
      </div>

      <div class="mt-4">
        <TrendChart :device-id="device.id" :param-key="activeParam" />
      </div>
    </template>
  </el-drawer>
</template>
