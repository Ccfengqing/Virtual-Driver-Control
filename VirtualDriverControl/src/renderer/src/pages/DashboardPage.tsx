import {
  Activity,
  Bug,
  Cpu,
  FileText,
  HardDrive,
  Layers,
  MonitorPlay,
  MousePointer2,
  ScanEye,
  ShieldAlert,
  Sparkles,
  Sun
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { PipeToggleCommand } from '@shared/types'
import { Card, Toggle } from '@renderer/components/ui'
import { DisplayCanvas, useDisplayLayout } from '@renderer/components/ArrangementMap'
import { DriverLifecycle } from '@renderer/components/DriverLifecycle'
import { useDriver } from '@renderer/stores/driver'
import { useSettings } from '@renderer/stores/settings'
import { useUi } from '@renderer/stores/ui'

interface QuickToggleDef {
  command: PipeToggleCommand
  label: string
  sub: string
  icon: LucideIcon
  get: (s: ReturnType<typeof useSettings.getState>['draft']) => boolean
}

const QUICK_TOGGLES: QuickToggleDef[] = [
  { command: 'HDRPLUS', label: 'HDR+', sub: '高动态范围输出', icon: Sparkles, get: (s) => s.colour.hdrPlus },
  { command: 'SDR10', label: 'SDR 10-bit', sub: 'SDR 模式下的 10 位色深', icon: Sun, get: (s) => s.colour.sdr10bit },
  {
    command: 'HARDWARECURSOR',
    label: '硬件光标',
    sub: '由 GPU 合成的光标',
    icon: MousePointer2,
    get: (s) => s.cursor.hardwareCursor
  },
  { command: 'CUSTOMEDID', label: '自定义 EDID', sub: '使用 user_edid.bin 身份信息', icon: ScanEye, get: (s) => s.edid.customEdid },
  { command: 'LOGGING', label: '文件日志', sub: '写入驱动日志文件', icon: FileText, get: (s) => s.logging.logging },
  { command: 'LOG_DEBUG', label: '调试日志', sub: '详细的故障排查日志', icon: Bug, get: (s) => s.logging.debugLogging }
]

const LEVEL_LABEL: Record<string, string> = {
  online: '在线',
  'installed-offline': '无响应',
  'not-installed': '未安装',
  unknown: '检查中…'
}

export function DashboardPage(): React.JSX.Element {
  const status = useDriver((s) => s.status)
  const iddcx = useDriver((s) => s.iddcx)
  const busy = useDriver((s) => s.busy)
  const quickToggle = useDriver((s) => s.quickToggle)
  const sysInfo = useDriver((s) => s.sysInfo)
  const draft = useSettings((s) => s.draft)
  const isDefault = useSettings((s) => s.isDefault)
  const setPage = useUi((s) => s.setPage)
  const { displays } = useDisplayLayout()

  const online = status?.pipeConnected === true
  const attachedVirtual = displays.filter((d) => d.isVirtual).length
  const attachedPhysical = displays.length - attachedVirtual

  return (
    <div className="page-inner">
      <div className="page-header">
        <div>
          <h1 className="page-title">仪表盘</h1>
          <p className="page-subtitle">实时控制你的虚拟显示器</p>
        </div>
      </div>

      {status?.level === 'not-installed' && (
        <div className="banner warn">
          <ShieldAlert size={16} />
          <span>
            此系统尚未安装虚拟显示器驱动。你仍可编辑和暂存配置 - 使用下方的驱动生命周期卡片下载并安装最新官方版本。
          </span>
        </div>
      )}

      {isDefault && status?.level !== 'not-installed' && (
        <div className="banner info">
          <FileText size={16} />
          <span>未找到 vdd_settings.xml - 当前显示默认配置。保存后将创建配置文件。</span>
        </div>
      )}

      <Card
        icon={MonitorPlay}
        title="显示器"
        subtitle={
          online ? '实时桌面 - 虚拟显示器更改即时生效' : '实时桌面 - 驱动离线，虚拟显示器数量已暂存'
        }
      >
        <DisplayCanvas />
      </Card>

      <div className="stat-tiles">
        <div className="stat-tile">
          <span className="stat-label">
            <Activity size={11} /> 驱动
          </span>
          <span className="stat-value" style={{ color: online ? 'var(--success)' : status?.level === 'not-installed' ? 'var(--danger)' : 'var(--warning)' }}>
            {LEVEL_LABEL[status?.level ?? 'unknown']}
          </span>
          <span className="stat-sub">{status?.deviceName ?? 'Root\\MttVDD'}</span>
        </div>
        <div className="stat-tile">
          <span className="stat-label">
            <Layers size={11} /> 活动显示器
          </span>
          <span className="stat-value">{displays.length > 0 ? displays.length : '—'}</span>
          <span className="stat-sub">
            {displays.length > 0 ? `${attachedPhysical} physical · ${attachedVirtual} virtual · ` : ''}
            {draft.monitors.count} 已配置
          </span>
        </div>
        <div className="stat-tile">
          <span className="stat-label">
            <Cpu size={11} /> GPU
          </span>
          <span className="stat-value" title={draft.gpu.friendlyName}>
            {draft.gpu.friendlyName === 'default' ? '系统默认' : draft.gpu.friendlyName}
          </span>
          <span className="stat-sub">
            <button type="button" className="btn ghost small" style={{ padding: '1px 6px', marginLeft: -6 }} onClick={() => setPage('gpu')}>
              管理 →
            </button>
          </span>
        </div>
        <div className="stat-tile">
          <span className="stat-label">
            <HardDrive size={11} /> IddCx
          </span>
          <span className="stat-value">{iddcx ?? '—'}</span>
          <span className="stat-sub">{status?.dllPresent ? `MttVDD.dll · ${status.dllDate ?? ''}` : '未找到驱动 DLL'}</span>
        </div>
        {sysInfo && (
          <div className="stat-tile">
            <span className="stat-label">
              <ShieldAlert size={11} /> 会话
            </span>
            <span className="stat-value">{sysInfo.isAdmin ? '管理员' : '标准用户'}</span>
            <span className="stat-sub">{sysInfo.windowsVersion}</span>
          </div>
        )}
      </div>

      <DriverLifecycle driver="display" />

      <Card
        icon={Sparkles}
        title="快捷开关"
        subtitle={online ? '通过驱动管道实时应用 - 部分开关会触发短暂重载' : '驱动离线 - 开关将暂存到草稿配置'}
      >
        <div className="quick-toggles">
          {QUICK_TOGGLES.map((def) => {
            const Icon = def.icon
            const value = def.get(draft)
            return (
              <div key={def.command} className={`quick-toggle ${value ? 'on' : ''}`}>
                <span className="qt-icon">
                  <Icon size={16} />
                </span>
                <div className="qt-text">
                  <div className="qt-title">{def.label}</div>
                  <div className="qt-sub">{def.sub}</div>
                </div>
                <Toggle checked={value} disabled={busy !== null} onChange={(v) => void quickToggle(def.command, v, def.label)} />
              </div>
            )
          })}
        </div>
      </Card>
    </div>
  )
}
