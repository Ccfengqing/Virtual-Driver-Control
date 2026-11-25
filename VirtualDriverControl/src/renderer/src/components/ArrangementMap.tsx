import { useEffect, useRef, useState } from 'react'
import { Loader2, Minus, MonitorCheck, Plus, RefreshCw, Star } from 'lucide-react'
import type { DisplayLayoutInfo } from '@shared/types'
import { Card } from '@renderer/components/ui'
import { useDriver } from '@renderer/stores/driver'
import { useSettings } from '@renderer/stores/settings'

const PADDING = 16
const MAX_MONITORS = 16

export function useDisplayLayout(): { displays: DisplayLayoutInfo[]; refresh: () => void } {
  const [displays, setDisplays] = useState<DisplayLayoutInfo[]>([])

  const refresh = (): void => {
    void window.vdd.system
      .displays()
      .then(setDisplays)
      .catch(() => undefined)
  }

  useEffect(() => {
    let cancelled = false
    let attempts = 0
    // A real system always has at least one display - empty means the call
    // raced app startup, so retry briefly.
    const fetchLayout = (): void => {
      window.vdd.system
        .displays()
        .then((layout) => {
          if (cancelled) return
          if (layout.length > 0) setDisplays(layout)
          else if (attempts++ < 5) window.setTimeout(fetchLayout, 1200)
        })
        .catch(() => {
          if (!cancelled && attempts++ < 5) window.setTimeout(fetchLayout, 1200)
        })
    }
    fetchLayout()
    const unsubscribe = window.vdd.events.onDisplays(setDisplays)
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [])

  return { displays, refresh }
}

/**
 * Unified desktop canvas: physical and virtual monitors rendered together,
 * to scale, in their real Windows arrangement. Virtual monitors only appear
 * when they actually exist in the layout. The footer integrates the virtual
 * display count control and live legend.
 */
export function DisplayCanvas(): React.JSX.Element {
  const { displays, refresh } = useDisplayLayout()
  const busy = useDriver((s) => s.busy)
  const online = useDriver((s) => s.status?.pipeConnected === true)
  const applyDisplayCount = useDriver((s) => s.applyDisplayCount)
  const count = useSettings((s) => s.draft.monitors.count)

  const wrapRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(880)

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const observer = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 880
      setWidth(Math.max(300, Math.floor(w)))
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const height = Math.round(Math.min(340, Math.max(220, width * 0.32)))
  const virtualCount = displays.filter((d) => d.isVirtual).length
  const physicalCount = displays.length - virtualCount

  let monitors: React.JSX.Element | React.JSX.Element[]
  if (displays.length === 0) {
    monitors = <div className="canvas-empty faint">正在读取显示器拓扑…</div>
  } else {
    const minX = Math.min(...displays.map((d) => d.bounds.x))
    const minY = Math.min(...displays.map((d) => d.bounds.y))
    const maxX = Math.max(...displays.map((d) => d.bounds.x + d.bounds.width))
    const maxY = Math.max(...displays.map((d) => d.bounds.y + d.bounds.height))
    const scale = Math.min((width - PADDING * 2) / (maxX - minX), (height - PADDING * 2) / (maxY - minY))
    const offsetX = (width - (maxX - minX) * scale) / 2
    const offsetY = (height - (maxY - minY) * scale) / 2

    monitors = displays.map((d) => {
      const pxW = Math.round(d.bounds.width * d.scaleFactor)
      const pxH = Math.round(d.bounds.height * d.scaleFactor)
      return (
        <div
          key={d.id}
          className={`arrange-display ${d.isVirtual ? 'virtual' : ''}`}
          style={{
            left: offsetX + (d.bounds.x - minX) * scale,
            top: offsetY + (d.bounds.y - minY) * scale,
            width: Math.max(36, d.bounds.width * scale),
            height: Math.max(26, d.bounds.height * scale)
          }}
          title={`${d.label}\n${pxW}×${pxH} @ ${d.frequency || '?'} Hz · 缩放 ${Math.round(d.scaleFactor * 100)}%\n位置 ${d.bounds.x}, ${d.bounds.y}${d.isVirtual ? '\n虚拟显示器驱动' : ''}`}
        >
          <span className="ad-name">
            {d.primary && <Star size={10} fill="currentColor" />}
            {d.label}
          </span>
          <span className="ad-res mono">
            {pxW}×{pxH}
          </span>
          <span className="ad-meta">
            {d.frequency ? `${d.frequency} Hz` : ''}
            {d.scaleFactor !== 1 ? ` · ${Math.round(d.scaleFactor * 100)}%` : ''}
          </span>
          {d.isVirtual && <span className="ad-badge">虚拟</span>}
        </div>
      )
    })
  }

  return (
    <div ref={wrapRef}>
      <div className="arrange-stage" style={{ width, height }}>
        {busy && (
          <div className="canvas-busy">
            <div className="row" style={{ color: 'var(--accent-text)', fontWeight: 600 }}>
              <Loader2 size={16} className="spin" />
              {busy}
            </div>
          </div>
        )}
        {monitors}
      </div>

      <div className="canvas-bar">
        <div className="canvas-legend">
          <span className="chip">{physicalCount} 个物理</span>
          <span className={`chip ${virtualCount > 0 ? 'on' : ''}`}>{virtualCount} 个虚拟</span>
          {count > 0 && virtualCount === 0 && (
            <span className="canvas-hint">
              {count} 个已配置 — {online ? '应用中…' : '驱动运行时将出现'}
            </span>
          )}
        </div>
        <div className="canvas-controls">
          <button type="button" className="btn ghost small" onClick={refresh} title="重新读取显示器布局">
            <RefreshCw size={13} />
          </button>
          <span className="canvas-ctl-label">虚拟显示器</span>
          <div className="count-stepper compact">
            <button
              type="button"
              aria-label="移除一个虚拟显示器"
              disabled={busy !== null || count <= 0}
              onClick={() => void applyDisplayCount(count - 1)}
            >
              <Minus size={14} />
            </button>
            <span className="count-value">{count}</span>
            <button
              type="button"
              aria-label="添加一个虚拟显示器"
              disabled={busy !== null || count >= MAX_MONITORS}
              onClick={() => void applyDisplayCount(count + 1)}
            >
              <Plus size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function ArrangementMap(): React.JSX.Element {
  return (
    <Card icon={MonitorCheck} title="桌面排列" subtitle="按比例显示物理与虚拟显示器 - 实时 Windows 布局">
      <DisplayCanvas />
    </Card>
  )
}
