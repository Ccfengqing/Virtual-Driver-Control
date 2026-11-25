import { create } from 'zustand'
import type { InstallProgress, LifecycleResult, ManagedDeviceState, ManagedDriverId, ReleaseInfo } from '@shared/types'
import { useDriver } from './driver'
import { useSettings } from './settings'
import { useUi } from './ui'

export type LifecycleOp = 'install' | 'uninstall' | 'restart' | 'instances' | 'testsigning'

interface DriverLifecycleState {
  latest: ReleaseInfo | null
  installedTag: string | null
  device: ManagedDeviceState | null
  checking: boolean
  checkError: string | null
}

interface InstallerState {
  drivers: Record<ManagedDriverId, DriverLifecycleState>
  /** Which driver+operation is in flight (lifecycle ops are globally exclusive). */
  working: { driver: ManagedDriverId; op: LifecycleOp } | null
  progress: InstallProgress | null
  /** Windows boot-config test signing state (audio driver is test-signed). */
  testSigning: boolean | null
  init: () => void
  checkLatest: (driver: ManagedDriverId) => Promise<void>
  refreshDevice: (driver: ManagedDriverId) => Promise<void>
  install: (driver: ManagedDriverId, instances?: number) => Promise<void>
  uninstallDriver: (driver: ManagedDriverId) => Promise<void>
  restartDevice: (driver: ManagedDriverId) => Promise<void>
  setInstances: (driver: ManagedDriverId, count: number) => Promise<void>
  refreshTestSigning: () => Promise<void>
  setTestSigning: (enabled: boolean) => Promise<void>
}

const emptyState = (): DriverLifecycleState => ({
  latest: null,
  installedTag: null,
  device: null,
  checking: false,
  checkError: null
})

let initialized = false

export const useInstaller = create<InstallerState>((set, get) => {
  const patchDriver = (driver: ManagedDriverId, patch: Partial<DriverLifecycleState>): void => {
    set((s) => ({ drivers: { ...s.drivers, [driver]: { ...s.drivers[driver], ...patch } } }))
  }

  const refreshAfter = async (driver: ManagedDriverId): Promise<void> => {
    await get().refreshDevice(driver)
    const installedTag = await window.vdd.installer.installedTag(driver).catch(() => null)
    patchDriver(driver, { installedTag })
    if (driver === 'display') {
      await useDriver.getState().refreshStatus(true)
      await useSettings.getState().load()
    } else {
      // Audio endpoints appear/disappear with the device nodes.
      const { useAudio } = await import('./audio')
      void useAudio.getState().refreshEndpoints()
      void useAudio.getState().refreshWebDevices()
    }
  }

  const runOp = async (
    driver: ManagedDriverId,
    op: LifecycleOp,
    action: () => Promise<LifecycleResult>,
    successTitle: string,
    successMessage: string | undefined,
    failTitle: string
  ): Promise<void> => {
    if (get().working) return
    const toast = useUi.getState().toast
    set({ working: { driver, op }, progress: null })
    try {
      const result = await action()
      if (result.ok) toast('success', successTitle, successMessage)
      else toast('error', failTitle, result.error ?? result.detail)
    } finally {
      set({ working: null, progress: null })
      await refreshAfter(driver)
    }
  }

  return {
    drivers: { display: emptyState(), audio: emptyState() },
    working: null,
    progress: null,
    testSigning: null,

    init: () => {
      if (initialized) return
      initialized = true
      window.vdd.events.onInstallProgress((progress) => set({ progress }))
      for (const driver of ['display', 'audio'] as ManagedDriverId[]) {
        void window.vdd.installer
          .installedTag(driver)
          .then((installedTag) => patchDriver(driver, { installedTag }))
          .catch(() => undefined)
        void get().refreshDevice(driver)
      }
      void get().refreshTestSigning()
    },

    checkLatest: async (driver) => {
      patchDriver(driver, { checking: true, checkError: null })
      try {
        const latest = await window.vdd.installer.latestRelease(driver)
        patchDriver(driver, { latest })
      } catch (error) {
        patchDriver(driver, { checkError: error instanceof Error ? error.message : String(error) })
      } finally {
        patchDriver(driver, { checking: false })
      }
    },

    refreshDevice: async (driver) => {
      try {
        const device = await window.vdd.installer.deviceState(driver)
        patchDriver(driver, { device })
      } catch {
        // main not ready
      }
    },

    install: (driver, instances) =>
      runOp(
        driver,
        'install',
        () => window.vdd.installer.install(driver, instances),
        '驱动已安装',
        driver === 'display'
          ? '虚拟显示器驱动已安装，正在启动。'
          : '虚拟音频驱动已安装 - 新的音频设备即将出现。',
        '安装失败'
      ),

    uninstallDriver: (driver) =>
      runOp(
        driver,
        'uninstall',
        () => window.vdd.installer.uninstall(driver),
        '驱动已卸载',
        driver === 'display' ? '配置文件已保留，供日后重新安装使用。' : undefined,
        '卸载失败'
      ),

    restartDevice: (driver) =>
      runOp(
        driver,
        'restart',
        () => window.vdd.installer.restartDevice(driver),
        '设备已重启',
        '设备已停用后重新启用。',
        '重启失败'
      ),

    setInstances: (driver, count) =>
      runOp(
        driver,
        'instances',
        () => window.vdd.installer.setInstances(driver, count),
        '设备数已更新',
        `现有 ${count} 个虚拟音频设备。`,
        '更改设备数失败'
      ),

    refreshTestSigning: async () => {
      try {
        set({ testSigning: await window.vdd.installer.testSigning() })
      } catch {
        // main not ready
      }
    },

    setTestSigning: async (enabled) => {
      if (get().working) return
      const toast = useUi.getState().toast
      set({ working: { driver: 'audio', op: 'testsigning' }, progress: null })
      try {
        const result = await window.vdd.installer.setTestSigning(enabled)
        if (result.ok) {
          toast('success', `测试签名已${enabled ? '启用' : '禁用'}`, '请重启 Windows 使更改生效。')
        } else {
          toast('error', '测试签名更改失败', result.error ?? result.detail)
        }
      } finally {
        set({ working: null, progress: null })
        await get().refreshTestSigning()
      }
    }
  }
})
