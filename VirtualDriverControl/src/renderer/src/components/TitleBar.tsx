import { Loader2, Minus, Square, X, Copy, ShieldAlert } from 'lucide-react'
import { useDriver } from '@renderer/stores/driver'
import { useUi } from '@renderer/stores/ui'
import logoOk from '../assets/logo-ok.png'
import logoWarn from '../assets/logo-warn.png'
import logoErr from '../assets/logo-err.png'

const LEVEL_META: Record<string, { className: string; label: string; logo: string }> = {
  online: { className: 'online', label: '驱动在线', logo: logoOk },
  'installed-offline': { className: 'offline', label: '已安装，无响应', logo: logoWarn },
  'not-installed': { className: 'missing', label: '未安装驱动', logo: logoErr },
  unknown: { className: 'unknown', label: '正在检查驱动…', logo: logoErr }
}

export function TitleBar(): React.JSX.Element {
  const status = useDriver((s) => s.status)
  const busy = useDriver((s) => s.busy)
  const sysInfo = useDriver((s) => s.sysInfo)
  const maximized = useUi((s) => s.maximized)

  const meta = LEVEL_META[status?.level ?? 'unknown']

  return (
    <header className="titlebar">
      <div className="brand">
        <img className="brand-mark" src={meta.logo} alt="" title={meta.label} />
        虚拟显示器控制中心
      </div>

      <div className="titlebar-status" title={status?.deviceName ?? ''}>
        <span className={`status-orb ${meta.className}`} />
        {meta.label}
      </div>

      {busy && (
        <div className="titlebar-status" style={{ color: 'var(--accent-text)' }}>
          <Loader2 size={12} className="spin" />
          {busy}
        </div>
      )}

      {sysInfo && !sysInfo.isAdmin && (
        <div className="titlebar-status" style={{ color: 'var(--warning)' }} title="未提权时可能无法写入 C:\VirtualDisplayDriver">
          <ShieldAlert size={12} />
          未提权
        </div>
      )}

      <div className="titlebar-spacer" />

      <div className="window-controls">
        <button type="button" aria-label="最小化" onClick={() => window.vdd.window.minimize()}>
          <Minus size={15} />
        </button>
        <button type="button" aria-label="最大化" onClick={() => window.vdd.window.maximizeToggle()}>
          {maximized ? <Copy size={12} style={{ transform: 'scaleX(-1)' }} /> : <Square size={11} />}
        </button>
        <button type="button" aria-label="关闭" className="close" onClick={() => window.vdd.window.close()}>
          <X size={16} />
        </button>
      </div>
    </header>
  )
}
