<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as echarts from 'echarts'
import dayjs from 'dayjs'
import type { DeviceId, ParamKey } from '@/api/types'
import { monitorApi } from '@/api/monitorApi'
import { PARAM_META_MAP } from '@/config/params'

const props = defineProps<{ deviceId: DeviceId; paramKey: ParamKey }>()

const el = ref<HTMLDivElement>()
let chart: echarts.ECharts | null = null

async function render(): Promise<void> {
  if (!el.value) return
  const meta = PARAM_META_MAP[props.paramKey]
  const history = await monitorApi.getHistory(props.deviceId, props.paramKey)
  const times = history.map((r) => dayjs(r.timestamp).format('HH:mm:ss'))
  const values = history.map((r) => r.params[props.paramKey] ?? null)
  chart ??= echarts.init(el.value)
  chart.setOption(
    {
      backgroundColor: 'transparent',
      grid: { left: 56, right: 16, top: 30, bottom: 28 },
      tooltip: { trigger: 'axis' },
      xAxis: {
        type: 'category',
        data: times,
        axisLabel: { color: '#8ea0bf' },
        axisLine: { lineStyle: { color: '#1e2a44' } },
      },
      yAxis: {
        type: 'value',
        scale: true,
        axisLabel: { color: '#8ea0bf' },
        splitLine: { lineStyle: { color: '#1e2a44' } },
      },
      series: [
        {
          name: meta.label,
          type: 'line',
          data: values,
          showSymbol: false,
          smooth: true,
          lineStyle: { color: '#38bdf8' },
          areaStyle: { color: 'rgba(56, 189, 248, 0.12)' },
          markLine: {
            silent: true,
            symbol: 'none',
            lineStyle: { color: '#f87171', type: 'dashed' },
            label: { color: '#f87171', formatter: '阈值上限 {b}' },
            data: [{ yAxis: meta.defaultThreshold[1] }],
          },
        },
      ],
    },
    true,
  )
}

function onResize(): void {
  chart?.resize()
}

onMounted(() => {
  void render()
  window.addEventListener('resize', onResize)
})

watch(
  () => [props.deviceId, props.paramKey] as const,
  () => void render(),
)

onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize)
  chart?.dispose()
  chart = null
})
</script>

<template>
  <div ref="el" class="h-64 w-full" />
</template>
