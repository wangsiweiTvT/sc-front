<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useSettingsStore } from '@/stores/settings'
import { validatePhone, validateThresholdRules } from '@/core/validation'
import { DEVICES, PARAM_META_MAP } from '@/config/params'

const settings = useSettingsStore()

onMounted(() => {
  void settings.init()
})

async function saveAll(): Promise<void> {
  const err = validateThresholdRules(settings.state.thresholds)
  if (err) {
    ElMessage.error(err)
    return
  }
  await settings.save()
  ElMessage.success('阈值配置已保存,后端检测器约 10 秒内采纳')
}

const dialogVisible = ref(false)
const form = ref({ name: '', phone: '' })

async function submitReceiver(): Promise<void> {
  const name = form.value.name.trim()
  if (!name) {
    ElMessage.error('请输入姓名')
    return
  }
  if (!validatePhone(form.value.phone)) {
    ElMessage.error('手机号须为 1 开头的 11 位数字')
    return
  }
  await settings.addReceiver(name, form.value.phone)
  ElMessage.success('接收人已添加,新告警短信约 10 秒内按新名单发送')
  dialogVisible.value = false
  form.value = { name: '', phone: '' }
}

async function removeReceiver(id: string): Promise<void> {
  await ElMessageBox.confirm('确定删除该接收人?', '提示', { type: 'warning' })
  await settings.removeReceiver(id)
}
</script>

<template>
  <div>
    <div class="mb-4 flex items-center justify-between">
      <span class="sc-dim text-sm">修改后点击"保存"生效;告警判定由后端检测器执行(约 10 秒采纳),设备状态角标按新阈值即时展示。</span>
      <el-button type="primary" @click="saveAll">保存</el-button>
    </div>

    <el-tabs type="border-card">
      <el-tab-pane v-for="device in DEVICES" :key="device.id" :label="device.name">
        <el-table :data="settings.rulesFor(device.id)" border size="small">
          <el-table-column label="参数" width="140">
            <template #default="{ row }">{{ PARAM_META_MAP[row.paramKey as keyof typeof PARAM_META_MAP].label }}</template>
          </el-table-column>
          <el-table-column label="下限" width="200">
            <template #default="{ row }">
              <el-input-number
                v-model="row.low"
                :precision="PARAM_META_MAP[row.paramKey as keyof typeof PARAM_META_MAP].decimals"
                :step="1"
                size="small"
              />
            </template>
          </el-table-column>
          <el-table-column label="上限" width="200">
            <template #default="{ row }">
              <el-input-number
                v-model="row.high"
                :precision="PARAM_META_MAP[row.paramKey as keyof typeof PARAM_META_MAP].decimals"
                :step="1"
                size="small"
              />
            </template>
          </el-table-column>
          <el-table-column label="参与监控">
            <template #default="{ row }">
              <el-switch v-model="row.enabled" />
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>
    </el-tabs>

    <div class="sc-panel mt-6 p-5">
      <div class="mb-3 flex items-center justify-between">
        <span class="font-semibold">短信接收人</span>
        <el-button size="small" type="primary" plain @click="dialogVisible = true">添加接收人</el-button>
      </div>
      <el-table :data="settings.state.receivers" border size="small" class="w-full" empty-text="暂无接收人,告警短信将标记为发送失败">
        <el-table-column prop="name" label="姓名" width="160" />
        <el-table-column prop="phone" label="手机号" width="200" />
        <el-table-column label="操作" width="100">
          <template #default="{ row }">
            <el-button size="small" type="danger" plain @click="removeReceiver(row.id)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <el-dialog v-model="dialogVisible" title="添加接收人" width="400px">
      <el-form label-width="70px">
        <el-form-item label="姓名">
          <el-input v-model="form.name" placeholder="如:张工" />
        </el-form-item>
        <el-form-item label="手机号">
          <el-input v-model="form.phone" placeholder="1 开头的 11 位数字" maxlength="11" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitReceiver">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>
