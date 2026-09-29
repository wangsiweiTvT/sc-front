<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { AlarmRecord, AlarmType, DeviceId } from '@/api/types'
import { useAlarmsStore } from '@/stores/alarms'
import { DEVICES, PARAM_META_MAP } from '@/config/params'
import { formatDateTime, formatParamValue } from '@/utils/format'

const alarms = useAlarmsStore()
const filterDevice = ref<DeviceId | ''>('')
const filterType = ref<AlarmType | ''>('')

onMounted(() => {
  void alarms.init()
})

const filtered = computed(() =>
  alarms.state.records
    .filter((r) => (filterDevice.value ? r.deviceId === filterDevice.value : true))
    .filter((r) => (filterType.value ? r.type === filterType.value : true))
    .slice()
    .reverse(),
)

const typeText: Record<AlarmType, string> = { high: '超上限', low: '超下限', offline: '离线' }
const smsText: Record<AlarmRecord['sms']['status'], string> = { sent: '已发送', pending: '发送中', failed: '失败' }

function paramLabel(key: AlarmRecord['paramKey']): string {
  return key ? PARAM_META_MAP[key].label : '整机'
}

function deviceName(id: DeviceId): string {
  return DEVICES.find((d) => d.id === id)?.name ?? id
}

async function clearAll(): Promise<void> {
  await ElMessageBox.confirm('确定清空全部告警记录?', '提示', { type: 'warning' })
  await alarms.clearAll()
  ElMessage.success('已清空')
}
</script>

<template>
  <div>
    <div class="mb-4 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <el-select v-model="filterDevice" placeholder="全部设备" clearable class="w-44">
          <el-option v-for="d in DEVICES" :key="d.id" :label="d.name" :value="d.id" />
        </el-select>
        <el-select v-model="filterType" placeholder="全部类型" clearable class="w-36">
          <el-option label="超上限" value="high" />
          <el-option label="超下限" value="low" />
          <el-option label="离线" value="offline" />
        </el-select>
      </div>
      <el-button type="danger" plain @click="clearAll">清空记录</el-button>
    </div>

    <el-table :data="filtered" border stripe size="small" class="w-full">
      <el-table-column label="时间" width="170">
        <template #default="{ row }">{{ formatDateTime(row.time) }}</template>
      </el-table-column>
      <el-table-column label="设备" width="130">
        <template #default="{ row }">{{ deviceName(row.deviceId) }}</template>
      </el-table-column>
      <el-table-column label="参数" width="100">
        <template #default="{ row }">{{ paramLabel(row.paramKey) }}</template>
      </el-table-column>
      <el-table-column label="类型" width="90">
        <template #default="{ row }">
          <el-tag :type="row.type === 'offline' ? 'danger' : 'warning'" size="small">{{ typeText[row.type as AlarmType] }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="当前值" width="110">
        <template #default="{ row }">
          {{ row.value === null ? '--' : formatParamValue(row.value, row.paramKey!) }}
        </template>
      </el-table-column>
      <el-table-column label="阈值" width="90">
        <template #default="{ row }">{{ row.threshold ?? '--' }}</template>
      </el-table-column>
      <el-table-column label="级别" width="90">
        <template #default="{ row }">
          <el-tag :type="row.level === 'critical' ? 'danger' : 'warning'" size="small" effect="plain">
            {{ row.level === 'critical' ? '严重' : '警告' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="短信">
        <template #default="{ row }">
          <el-tag :type="row.sms.status === 'sent' ? 'success' : row.sms.status === 'failed' ? 'danger' : 'info'" size="small">
            {{ smsText[row.sms.status as AlarmRecord['sms']['status']] }}
          </el-tag>
          <span class="sc-dim ml-2 text-xs">
            {{ row.sms.receivers.length > 0 ? `${row.sms.receivers.length} 位接收人` : '无接收人' }}
          </span>
        </template>
      </el-table-column>
    </el-table>

    <div v-if="filtered.length === 0" class="sc-dim mt-6 text-center">暂无告警记录</div>
  </div>
</template>
