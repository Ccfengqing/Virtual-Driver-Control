import { useEffect, useState } from 'react'
import {
  ArrowUpCircle,
  Download,
  ExternalLink,
  Layers,
  Loader2,
  PackageCheck,
  PackageOpen,
  Power,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Trash2
} from 'lucide-react'
import type { ManagedDriverId } from '@shared/types'
import { Card, Segmented } from '@renderer/components/ui'
import { useDriver } from '@renderer/stores/driver'
import { useInstaller } from '@renderer/stores/installer'

const TITLES: Record<ManagedDriverId, string> = {
  display: '显示器驱动生命周期',
  audio: '音频驱动生命周期'
}

const REPOS: Record<ManagedDriverId, string> = {
  display: 'VirtualDrivers/Virtual-Display-Driver',
  audio: 'VirtualDrivers/Virtual-Audio-Driver'
}

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${Math.max(1, Math.round(bytes / 1024))} KB`
}

function formatDate(iso: string): string {
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleDateString()
}

export function DriverLifecycle(props: { driver: ManagedDriverId }): React.JSX.Element {
  const { driver } = props
  const multiInstance = driver === 'audio'

  const state = useInstaller((s) => s.drivers[driver])
  const working = useInstaller((s) => s.working)
  const progress = useInstaller((s) => s.progress)
  const init = useInstaller((s) => s.init)
  const checkLatest = useInstaller((s) => s.checkLatest)
  const install = useInstaller((s) => s.install)
  const uninstallDriver = useInstaller((s) => s.uninstallDriver)
  const restartDevice = useInstaller((s) => s.restartDevice)
  const setInstances = useInstaller((s) => s.setInstances)
  const testSigning = useInstaller((s) => s.testSigning)
  const setTestSigning = useInstaller((s) => s.setTestSigning)
  const displayStatus = useDriver((s) => s.status)

  const [instanceChoice, setInstanceChoice] = useState<number | null>(null)

  useEffect(() => {
    init()
    if (!useInstaller.getState().drivers[driver].latest && !useInstaller.getState().drivers[driver].checking) {
      void checkLatest(driver)
    }
  }, [init, checkLatest, driver])

  const { latest, installedTag, device, checking, checkError } = state
  const installed = (device?.count ?? 0) > 0
  const updateAvailable = installed && latest !== null && installedTag !== null && latest.tag !== installedTag
  const busy = working !== null
  const busyHere = working?.driver === driver
  const deviceCount = device?.count ?? 0
  const selectedInstances = instanceChoice ?? Math.max(deviceCount, 1)

  const installLabel = !installed
    ? latest
      ? `下载并安装 ${latest.tag}`
      : '下载并安装最新版本'
    : updateAvailable
      ? `更新到 ${latest?.tag}`
      : '重新安装最新版本'

  const installedDetail = (): string => {
    if (!installed) return '此系统上没有设备'
    const statuses = device?.statuses.join(', ') ?? ''
    if (driver === 'display') {
      return displayStatus?.dllDate ? `MttVDD.dll · ${displayStatus.dllDate}` : `设备状态 ${statuses}`
    }
    return `${deviceCount} 个设备 · 状态 ${statuses}`
  }

  return (
    <Card
      icon={PackageOpen}
      title={TITLES[driver]}
      subtitle={`来自 ${REPOS[driver]} 的官方安装包 - 下载经过校验和验证`}
      actions={
        <button type="button" className="btn ghost small" disabled={checking || busy} onClick={() => void checkLatest(driver)}>
          {checking ? <Loader2 size={13} className="spin" /> : <RefreshCw size={13} />} 检查更新
        </button>
      }
    >
      <div className="lifecycle-grid">
        <div className="lifecycle-block">
          <span className="stat-label">
            <PackageCheck size={11} /> 已安装
          </span>
          <span className="stat-value" style={{ color: installed ? 'var(--success)' : 'var(--danger)' }}>
            {installed ? installedTag ?? '已安装' : '未安装'}
          </span>
          <span className="stat-sub">{installedDetail()}</span>
        </div>

        <div className="lifecycle-block">
          <span className="stat-label">
            <Download size={11} /> 最新版本
          </span>
          <span className="stat-value">{checking ? '检查中…' : latest?.tag ?? '—'}</span>
          <span className="stat-sub">
            {checkError
              ? `检查失败：${checkError}`
              : latest
                ? `${formatDate(latest.publishedAt)}${latest.asset ? ` · ${latest.asset.name} (${formatSize(latest.asset.sizeBytes)})` : ' · 无驱动安装包'}`
                : '正在从 GitHub 获取…'}
          </span>
          {latest && (
            <button
              type="button"
              className="btn ghost small"
              style={{ padding: '1px 6px', marginLeft: -6, alignSelf: 'flex-start' }}
              onClick={() => void window.vdd.system.openExternal(latest.htmlUrl)}
            >
              版本说明 <ExternalLink size={11} />
            </button>
          )}
        </div>
      </div>

      {driver === 'audio' && (
        <div className={`banner ${testSigning === true ? 'info' : 'warn'}`} style={{ marginTop: 12 }}>
          {testSigning === true ? <ShieldCheck size={16} style={{ flexShrink: 0 }} /> : <ShieldAlert size={16} style={{ flexShrink: 0 }} />}
          <span style={{ flex: 1 }}>
            虚拟音频驱动当前为<strong>测试签名</strong>，因此 Windows 必须处于{' '}
            <strong>测试签名模式</strong>，设备才能启动。{' '}
            {testSigning === true && '此电脑的启动配置中已启用测试签名。'}
            {testSigning === false && '此电脑当前未启用测试签名。'}
            {testSigning === null && '无法确定当前的测试签名状态。'}
            {testSigning !== null && ' 更改将在 Windows 重启后生效。启用它需要先关闭安全启动。'}
          </span>
          {testSigning !== null && (
            <button
              type="button"
              className="btn small"
              style={{ flexShrink: 0 }}
              disabled={busy}
              onClick={() => void setTestSigning(!testSigning)}
            >
              {busyHere && working?.op === 'testsigning' ? (
                <Loader2 size={13} className="spin" />
              ) : testSigning ? (
                <ShieldAlert size={13} />
              ) : (
                <ShieldCheck size={13} />
              )}
              {busyHere && working?.op === 'testsigning'
                ? '应用中…'
                : testSigning
                  ? '禁用测试签名'
                  : '启用测试签名'}
            </button>
          )}
        </div>
      )}

      {busyHere && progress && (
        <div className="lifecycle-progress">
          <div className="progress-track">
            <div
              className={`progress-fill ${progress.percent < 0 ? 'indeterminate' : ''}`}
              style={progress.percent >= 0 ? { width: `${progress.percent}%` } : undefined}
            />
          </div>
          <span className="progress-message">{progress.message}</span>
        </div>
      )}

      <div className="lifecycle-actions">
        <button
          type="button"
          className={`btn small ${!installed || updateAvailable ? 'primary' : ''}`}
          disabled={busy || checking || (latest !== null && latest.asset === null)}
          onClick={() => void install(driver, multiInstance ? selectedInstances : undefined)}
        >
          {busyHere && working?.op === 'install' ? (
            <Loader2 size={13} className="spin" />
          ) : updateAvailable ? (
            <ArrowUpCircle size={13} />
          ) : (
            <Download size={13} />
          )}
          {busyHere && working?.op === 'install' ? '安装中…' : installLabel}
        </button>
        {installed && (
          <>
            <button type="button" className="btn ghost small" disabled={busy} onClick={() => void restartDevice(driver)}>
              {busyHere && working?.op === 'restart' ? <Loader2 size={13} className="spin" /> : <Power size={13} />}
              {busyHere && working?.op === 'restart' ? '重启中…' : '重启设备'}
            </button>
            <button type="button" className="btn ghost small danger" disabled={busy} onClick={() => void uninstallDriver(driver)}>
              {busyHere && working?.op === 'uninstall' ? <Loader2 size={13} className="spin" /> : <Trash2 size={13} />}
              {busyHere && working?.op === 'uninstall' ? '卸载中…' : '卸载'}
            </button>
          </>
        )}
        {updateAvailable && (
          <span className="lifecycle-hint">
            有可用更新：{installedTag} → {latest?.tag}
          </span>
        )}
      </div>

      {multiInstance && (
        <div className="lifecycle-actions" style={{ marginTop: 10 }}>
          <span className="stat-label" style={{ marginRight: 2 }}>
            <Layers size={11} /> 设备数
          </span>
          <Segmented
            value={String(selectedInstances)}
            options={[1, 2, 3, 4].map((n) => ({ value: String(n), label: String(n) }))}
            onChange={(v) => setInstanceChoice(Number(v))}
          />
          {installed && selectedInstances !== deviceCount && (
            <button
              type="button"
              className="btn small"
              disabled={busy}
              onClick={() => void setInstances(driver, selectedInstances)}
            >
              {busyHere && working?.op === 'instances' ? <Loader2 size={13} className="spin" /> : <Layers size={13} />}
              {busyHere && working?.op === 'instances' ? '应用中…' : `设为 ${selectedInstances} 个设备`}
            </button>
          )}
          <span className="faint" style={{ fontSize: 11.5 }}>
            每个设备会增加一组独立的虚拟扬声器 + 麦克风用于路由。
          </span>
        </div>
      )}
    </Card>
  )
}
