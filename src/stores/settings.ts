import { reactive } from 'vue'
import type { DeviceId, ParamKey, Receiver, ThresholdRule } from '@/api/types'
import { configApi } from '@/api/configApi'

const state = reactive<{ thresholds: ThresholdRule[]; receivers: Receiver[]; loaded: boolean }>({
  thresholds: [],
  receivers: [],
  loaded: false,
})

let initPromise: Promise<void> | null = null

export function useSettingsStore() {
  function init(): Promise<void> {
    initPromise ??= (async () => {
      const [thresholds, receivers] = await Promise.all([configApi.getThresholds(), configApi.getReceivers()])
      state.thresholds = thresholds
      state.receivers = receivers
      state.loaded = true
    })()
    return initPromise
  }

  function rulesFor(deviceId: DeviceId): ThresholdRule[] {
    return state.thresholds.filter((r) => r.deviceId === deviceId)
  }

  function ruleFor(deviceId: DeviceId, paramKey: ParamKey): ThresholdRule | undefined {
    return state.thresholds.find((r) => r.deviceId === deviceId && r.paramKey === paramKey)
  }

  async function save(): Promise<void> {
    const plain = JSON.parse(JSON.stringify(state.thresholds)) as ThresholdRule[]
    await configApi.saveThresholds(plain)
  }

  async function addReceiver(name: string, phone: string): Promise<Receiver> {
    const r = await configApi.addReceiver({ name, phone })
    state.receivers.push(r)
    return r
  }

  async function removeReceiver(id: string): Promise<void> {
    await configApi.removeReceiver(id)
    state.receivers = state.receivers.filter((r) => r.id !== id)
  }

  return { state, init, rulesFor, ruleFor, save, addReceiver, removeReceiver }
}
