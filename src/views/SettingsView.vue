<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { DeviceId, Receiver } from '@/api/types'
import { useSettingsStore } from '@/stores/settings'
import { validatePhone, validateThresholdRules } from '@/core/validation'
import { DEVICES, PARAM_META_MAP } from '@/config/params'
import { getLatestFollower } from '@/api/wechatApi'
import { followedAgoText } from '@/core/followedAgo'

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
/** 正在编辑的接收人 id;null = 添加模式 */
const editingId = ref<string | null>(null)
const form = ref({ name: '', phone: '', subscribedDevices: [] as DeviceId[], wechatOpenid: '' })

/** 获取最新关注的确认提示(四期 §9.3):「x 分钟前关注」;null = 未获取 */
const followedHint = ref<string | null>(null)
const fetchingFollower = ref(false)

/**
 * 手动获取最新关注者 openid(四期 §9.3):扫码关注后由管理员点按钮拉取。
 * 仅输入框为空时填入,已有值(手动粘贴/编辑回填)不覆盖;
 * 暂无新关注/接口失败给出提示,不再后台轮询。
 */
async function fetchFollower(): Promise<void> {
  if (fetchingFollower.value) return
  fetchingFollower.value = true
  try {
    const r = await getLatestFollower()
    if (!r.openid) {
      ElMessage.info('暂无新关注——扫码关注测试号后再点获取')
      return
    }
    if (form.value.wechatOpenid.trim()) {
      ElMessage.info('输入框已有 openid,未覆盖;要换人请先清空再获取')
      return
    }
    form.value.wechatOpenid = r.openid
    followedHint.value = followedAgoText(r.subscribeTime, Date.now())
  } catch {
    ElMessage.error('获取失败:微信渠道未配置或接口异常,请稍后再试')
  } finally {
    fetchingFollower.value = false
  }
}

function openAdd(): void {
  editingId.value = null
  form.value = { name: '', phone: '', subscribedDevices: [], wechatOpenid: '' }
  followedHint.value = null
  dialogVisible.value = true
}

/** 编辑时回填全部字段;openid 清空即提交 null(四期 §9) */
function openEdit(row: Receiver): void {
  editingId.value = row.id
  form.value = {
    name: row.name,
    phone: row.phone,
    subscribedDevices: [...row.subscribedDevices],
    wechatOpenid: row.wechatOpenid ?? '',
  }
  followedHint.value = null
  dialogVisible.value = true
}

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
  const wechatOpenid = form.value.wechatOpenid.trim() || null
  if (editingId.value) {
    await settings.updateReceiver({
      id: editingId.value, name, phone: form.value.phone, subscribedDevices: form.value.subscribedDevices, wechatOpenid,
    })
    ElMessage.success('接收人已更新,新告警约 10 秒内按新名单与新渠道发送')
  } else {
    await settings.addReceiver(name, form.value.phone, form.value.subscribedDevices, wechatOpenid)
    ElMessage.success('接收人已添加,新告警短信约 10 秒内按订阅名单发送')
  }
  dialogVisible.value = false
}

/** 勾选即保存:订阅/取消订阅立即 PUT,约 10 秒被检测器采纳(三期 §8) */
async function toggleSubscribe(row: Receiver, id: DeviceId): Promise<void> {
  const set = new Set(row.subscribedDevices)
  if (set.has(id)) set.delete(id)
  else set.add(id)
  const subscribedDevices = [...set]
  await settings.updateReceiver({ ...row, subscribedDevices })
  ElMessage.success(
    subscribedDevices.length === 0
      ? '已更新:未订阅任何设备,该接收人将收不到短信'
      : '订阅已更新,新告警短信约 10 秒内按新名单发送',
  )
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
      <el-tab-pane v-for="device in DEVICES" :key="device.id" :label="device.clientId">
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
        <el-button size="small" type="primary" plain @click="openAdd">添加接收人</el-button>
      </div>
      <el-table :data="settings.state.receivers" border size="small" class="w-full" empty-text="暂无接收人,告警短信将标记为发送失败">
        <el-table-column prop="name" label="姓名" width="160" />
        <el-table-column prop="phone" label="手机号" width="200" />
        <el-table-column label="订阅设备" min-width="380">
          <template #default="{ row }">
            <el-checkbox
              v-for="d in DEVICES"
              :key="d.id"
              :model-value="row.subscribedDevices.includes(d.id)"
              @change="toggleSubscribe(row, d.id)"
            >{{ d.clientId }}</el-checkbox>
            <div v-if="row.subscribedDevices.length === 0" class="sc-dim text-xs">未订阅任何设备,将不会收到短信</div>
          </template>
        </el-table-column>
        <el-table-column label="微信 openid" min-width="150" show-overflow-tooltip>
          <template #default="{ row }">
            <span v-if="row.wechatOpenid">{{ row.wechatOpenid }}</span>
            <span v-else class="sc-dim">未配置</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="140">
          <template #default="{ row }">
            <el-button size="small" @click="openEdit(row)">编辑</el-button>
            <el-button size="small" type="danger" plain @click="removeReceiver(row.id)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <el-dialog v-model="dialogVisible" :title="editingId ? '编辑接收人' : '添加接收人'" width="480px">
      <el-form label-width="90px">
        <el-form-item label="姓名">
          <el-input v-model="form.name" placeholder="如:张工" />
        </el-form-item>
        <el-form-item label="手机号">
          <el-input v-model="form.phone" placeholder="1 开头的 11 位数字" maxlength="11" />
        </el-form-item>
        <el-form-item label="订阅设备">
          <el-checkbox-group v-model="form.subscribedDevices">
            <el-checkbox v-for="d in DEVICES" :key="d.id" :value="d.id">{{ d.clientId }}</el-checkbox>
          </el-checkbox-group>
          <div v-if="form.subscribedDevices.length === 0" class="sc-dim w-full text-xs">不订阅任何设备,将不会收到短信</div>
        </el-form-item>
        <el-form-item label="微信 openid">
          <el-input v-model="form.wechatOpenid" placeholder="可选;不填则微信渠道无法送达" maxlength="64" />
          <div class="sc-dim w-full text-xs">扫码关注测试号后点「获取最新关注」自动填入;也可在测试号用户列表复制 openid 手填;清空即取消该渠道</div>
          <div v-if="followedHint" class="w-full text-xs text-[var(--sc-online)]">已填入:{{ followedHint }},请确认时间对得上再提交</div>
          <div class="mt-3 flex w-full items-center gap-3">
            <img
              src="https://mp.weixin.qq.com/cgi-bin/showqrcode?ticket=gQEC8TwAAAAAAAAAAS5odHRwOi8vd2VpeGluLnFxLmNvbS9xLzAyWmVncFpnb1plSHIxMDAwME0wN0kAAgTD-85qAwQAAAAA"
              alt="微信测试号二维码"
              class="h-36 w-36 rounded-lg border border-[var(--sc-border)] bg-white"
            />
            <div class="flex flex-col items-start gap-2">
              <span class="sc-dim text-xs">扫码关注测试号，关注后点下方按钮获取 openid</span>
              <el-button size="small" type="primary" plain :loading="fetchingFollower" @click="fetchFollower">获取最新关注</el-button>
            </div>
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitReceiver">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>
