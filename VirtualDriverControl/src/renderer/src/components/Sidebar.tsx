import {
  Cpu,
  LayoutDashboard,
  MonitorCog,
  Palette,
  ScanEye,
  SettingsIcon,
  SquareTerminal,
  Volume2
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useDriver } from '@renderer/stores/driver'
import { useUi, type PageId } from '@renderer/stores/ui'

interface NavEntry {
  id: PageId
  label: string
  icon: LucideIcon
  section?: string
}

const NAV: NavEntry[] = [
  { id: 'dashboard', label: '仪表盘', icon: LayoutDashboard },
  { id: 'displays', label: '显示器', icon: MonitorCog, section: '配置' },
  { id: 'color', label: 'HDR 与色彩', icon: Palette },
  { id: 'edid', label: 'EDID 实验室', icon: ScanEye },
  { id: 'gpu', label: 'GPU', icon: Cpu },
  { id: 'audio', label: '音频', icon: Volume2 },
  { id: 'console', label: '控制台', icon: SquareTerminal, section: '诊断' },
  { id: 'settings', label: '设置', icon: SettingsIcon }
]

export function Sidebar(): React.JSX.Element {
  const page = useUi((s) => s.page)
  const setPage = useUi((s) => s.setPage)
  const sysInfo = useDriver((s) => s.sysInfo)
  const iddcx = useDriver((s) => s.iddcx)

  return (
    <nav className="sidebar">
      {NAV.map((entry) => {
        const Icon = entry.icon
        return (
          <div key={entry.id}>
            {entry.section && <div className="nav-section">{entry.section}</div>}
            <button
              type="button"
              className={`nav-item ${page === entry.id ? 'active' : ''}`}
              style={{ width: '100%' }}
              onClick={() => setPage(entry.id)}
            >
              <Icon size={16} strokeWidth={2.1} />
              {entry.label}
            </button>
          </div>
        )
      })}
      <div className="sidebar-footer">
        <span>v{sysInfo?.appVersion ?? '2.0.0'}</span>
        <span className="mono" style={{ fontSize: 10 }}>
          MttVDD · IddCx{iddcx ? ` ${iddcx}` : ''}
        </span>
      </div>
    </nav>
  )
}
