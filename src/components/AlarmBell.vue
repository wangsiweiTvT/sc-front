<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useAlarmsStore } from '@/stores/alarms'

const router = useRouter()
const alarms = useAlarmsStore()

function open(): void {
  alarms.markAllRead()
  void router.push({ name: 'alarms' })
}
</script>

<template>
  <el-badge :value="alarms.state.unread" :hidden="alarms.state.unread === 0" :max="99">
    <el-button circle text aria-label="告警记录" @click="open">🔔</el-button>
  </el-badge>
</template>
