<script setup lang="ts">
import { computed } from 'vue'
import type { DeviceStatus } from '@/api/types'

const props = defineProps<{ status: DeviceStatus }>()

const config = computed(() => {
  switch (props.status) {
    case 'online':
      return { text: '在线', type: 'success' as const, cls: '' }
    case 'offline':
      return { text: '离线', type: 'info' as const, cls: '' }
    case 'abnormal':
      return { text: '异常', type: 'danger' as const, cls: 'sc-badge-abnormal' }
  }
})
</script>

<template>
  <el-tag :type="config.type" :class="config.cls" effect="dark" round>{{ config.text }}</el-tag>
</template>
