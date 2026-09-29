<script setup lang="ts">
import { onMounted, ref } from 'vue'
import type { Device } from '@/api/types'
import { useMonitorStore } from '@/stores/monitor'
import DeviceCard from '@/components/DeviceCard.vue'
import DeviceDrawer from '@/components/DeviceDrawer.vue'

const monitor = useMonitorStore()
const selected = ref<Device | null>(null)
const drawerVisible = ref(false)

onMounted(() => {
  void monitor.init()
})

function open(device: Device): void {
  selected.value = device
  drawerVisible.value = true
}
</script>

<template>
  <div>
    <div class="grid grid-cols-2 gap-5">
      <DeviceCard
        v-for="device in monitor.state.devices"
        :key="device.id"
        :device="device"
        :reading="monitor.state.readings[device.id] ?? null"
        :status-info="monitor.state.statuses[device.id]"
        :forced-offline="monitor.state.forcedOffline.includes(device.id)"
        @open="open(device)"
        @toggle-offline="monitor.toggleOffline(device.id)"
      />
    </div>

    <DeviceDrawer v-model="drawerVisible" :device="selected" />
  </div>
</template>
