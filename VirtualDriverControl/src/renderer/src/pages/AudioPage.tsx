import { useEffect, useRef, useState } from 'react'
import {
  ArrowRight,
  AudioLines,
  Check,
  Info,
  Loader2,
  Mic,
  MonitorSpeaker,
  Plus,
  RefreshCw,
  Trash2,
  Volume2,
  VolumeX,
  Waves
} from 'lucide-react'
import type { AudioEndpoint } from '@shared/types'
import { Card, Toggle } from '@renderer/components/ui'
import { DriverLifecycle } from '@renderer/components/DriverLifecycle'
import { SYSTEM_AUDIO_SOURCE, useAudio } from '@renderer/stores/audio'
import { audioRouter } from '@renderer/utils/audio-router'

export function AudioPage(): React.JSX.Element {
  const init = useAudio((s) => s.init)

  useEffect(() => {
    void init()
  }, [init])

  return (
    <div className="page-inner">
      <div className="page-header">
        <div>
          <h1 className="page-title">音频</h1>
          <p className="page-subtitle">虚拟音频设备、Windows 终结点控制与实时路由</p>
        </div>
      </div>

      <DriverLifecycle driver="audio" />
      <EndpointsCard />
      <RoutingCard />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Windows endpoints
// ---------------------------------------------------------------------------

function EndpointsCard(): React.JSX.Element {
  const endpoints = useAudio((s) => s.endpoints)
  const loading = useAudio((s) => s.endpointsLoading)
  const error = useAudio((s) => s.endpointsError)
  const refresh = useAudio((s) => s.refreshEndpoints)

  const outputs = endpoints.filter((e) => e.flow === 'render')
  const inputs = endpoints.filter((e) => e.flow === 'capture')

  return (
    <Card
      icon={MonitorSpeaker}
      title="Windows 音频设备"
      subtitle="活动的播放与录制终结点 - 音量、静音与默认设备"
      actions={
        <button type="button" className="btn ghost small" disabled={loading} onClick={() => void refresh()}>
          {loading ? <Loader2 size={13} className="spin" /> : <RefreshCw size={13} />} 刷新
        </button>
      }
    >
      {error && <div className="banner warn" style={{ marginBottom: 10 }}>{error}</div>}
      {endpoints.length === 0 && !error && (
        <div className="faint">{loading ? '正在枚举音频终结点…' : '未找到活动的音频终结点。'}</div>
      )}
      <div className="card-grid two">
        <div>
          <div className="nav-section" style={{ margin: '0 0 8px' }}>
            输出 · {outputs.length}
          </div>
          <div className="endpoint-list">
            {outputs.map((e) => (
              <EndpointRow key={e.id} endpoint={e} />
            ))}
          </div>
        </div>
        <div>
          <div className="nav-section" style={{ margin: '0 0 8px' }}>
            输入 · {inputs.length}
          </div>
          <div className="endpoint-list">
            {inputs.map((e) => (
              <EndpointRow key={e.id} endpoint={e} />
            ))}
          </div>
        </div>
      </div>
    </Card>
  )
}

function EndpointRow(props: { endpoint: AudioEndpoint }): React.JSX.Element {
  const { endpoint } = props
  const setVolume = useAudio((s) => s.setEndpointVolume)
  const setMute = useAudio((s) => s.setEndpointMute)
  const setDefault = useAudio((s) => s.setDefaultEndpoint)

  return (
    <div className={`endpoint-row ${endpoint.isVirtual ? 'virtual' : ''}`}>
      <span className="ep-icon">{endpoint.flow === 'render' ? <Volume2 size={15} /> : <Mic size={15} />}</span>
      <div className="ep-main">
        <div className="ep-name" title={endpoint.name}>
          {endpoint.name}
          {endpoint.isVirtual && <span className="ep-badge accent">虚拟</span>}
          {endpoint.isDefault && <span className="ep-badge">默认</span>}
          {endpoint.isDefaultComm && <span className="ep-badge dim">通讯</span>}
        </div>
        <div className="ep-controls">
          <button
            type="button"
            className={`btn ghost small icon-only ${endpoint.muted ? 'danger' : ''}`}
            aria-label={endpoint.muted ? '取消静音' : '静音'}
            onClick={() => void setMute(endpoint.id, !endpoint.muted)}
          >
            {endpoint.muted ? <VolumeX size={13} /> : <Volume2 size={13} />}
          </button>
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(endpoint.volume * 100)}
            onChange={(e) => setVolume(endpoint.id, Number(e.target.value) / 100)}
          />
          <span className="ep-vol mono">{Math.round(endpoint.volume * 100)}%</span>
          {!endpoint.isDefault && (
            <button type="button" className="btn ghost small" onClick={() => void setDefault(endpoint.id)}>
              <Check size={12} /> 设为默认
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Routing
// ---------------------------------------------------------------------------

function RoutingCard(): React.JSX.Element {
  const routes = useAudio((s) => s.routes)
  const webInputs = useAudio((s) => s.webInputs)
  const webOutputs = useAudio((s) => s.webOutputs)
  const activeRoutes = useAudio((s) => s.activeRoutes)
  const routeErrors = useAudio((s) => s.routeErrors)
  const addRoute = useAudio((s) => s.addRoute)
  const removeRoute = useAudio((s) => s.removeRoute)
  const toggleRoute = useAudio((s) => s.toggleRoute)
  const setRouteGain = useAudio((s) => s.setRouteGain)
  const refreshWebDevices = useAudio((s) => s.refreshWebDevices)

  const [sourceId, setSourceId] = useState('')
  const [sinkId, setSinkId] = useState('')

  const sourceOptions = [{ deviceId: SYSTEM_AUDIO_SOURCE, label: '系统音频（默认输出回环）' }, ...webInputs]

  const add = (): void => {
    const source = sourceOptions.find((d) => d.deviceId === sourceId)
    const sink = webOutputs.find((d) => d.deviceId === sinkId)
    if (!source || !sink) return
    void addRoute(source.deviceId, source.label, sink.deviceId, sink.label)
  }

  return (
    <Card
      icon={Waves}
      title="音频路由"
      subtitle="将任意输入或系统混音送到任意输出 - 路由在应用打开期间生效"
      actions={
        <button type="button" className="btn ghost small" onClick={() => void refreshWebDevices()}>
          <RefreshCw size={13} /> 重新扫描设备
        </button>
      }
    >
      <div className="route-add">
        <select value={sourceId} onChange={(e) => setSourceId(e.target.value)}>
          <option value="">选择来源…</option>
          {sourceOptions.map((d) => (
            <option key={d.deviceId} value={d.deviceId}>
              {d.label}
            </option>
          ))}
        </select>
        <ArrowRight size={15} style={{ color: 'var(--text-faint)', flexShrink: 0 }} />
        <select value={sinkId} onChange={(e) => setSinkId(e.target.value)}>
          <option value="">选择输出…</option>
          {webOutputs.map((d) => (
            <option key={d.deviceId} value={d.deviceId}>
              {d.label}
            </option>
          ))}
        </select>
        <button type="button" className="btn primary small" disabled={!sourceId || !sinkId} onClick={add}>
          <Plus size={13} /> 添加路由
        </button>
      </div>

      <div className="route-list">
        {routes.map((route) => (
          <div key={route.id} className={`route-row ${activeRoutes.has(route.id) ? 'active' : ''}`}>
            <Toggle checked={route.enabled} onChange={(v) => void toggleRoute(route.id, v)} />
            <div className="route-main">
              <div className="route-path">
                <span className="route-ep" title={route.sourceLabel}>
                  {route.sourceId === SYSTEM_AUDIO_SOURCE ? <AudioLines size={12} /> : <Mic size={12} />}
                  {route.sourceLabel}
                </span>
                <ArrowRight size={13} style={{ color: 'var(--text-faint)', flexShrink: 0 }} />
                <span className="route-ep" title={route.sinkLabel}>
                  <Volume2 size={12} />
                  {route.sinkLabel}
                </span>
              </div>
              <div className="route-controls">
                <span className="faint" style={{ fontSize: 11 }}>
                  增益
                </span>
                <input
                  type="range"
                  min={0}
                  max={200}
                  value={Math.round(route.gain * 100)}
                  onChange={(e) => setRouteGain(route.id, Number(e.target.value) / 100)}
                />
                <span className="ep-vol mono">{Math.round(route.gain * 100)}%</span>
                <RouteMeter routeId={route.id} active={activeRoutes.has(route.id)} />
              </div>
              {routeErrors[route.id] && <div className="route-error">{routeErrors[route.id]}</div>}
            </div>
            <button
              type="button"
              className="btn ghost small icon-only"
              aria-label="移除路由"
              onClick={() => void removeRoute(route.id)}
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
        {routes.length === 0 && <div className="faint">暂无路由 - 请在上方添加。</div>}
      </div>

      <div className="banner info" style={{ marginTop: 12 }}>
        <Info size={15} />
        <span>
          <strong>麦克风 → 扬声器：</strong>选择麦克风和输出设备。<strong>扬声器 → 扬声器：</strong>使用{' '}
          <em>系统音频</em>作为来源。<strong>扬声器 → 麦克风：</strong>路由到{' '}
          <em>Speakers (Virtual Audio Driver)</em> - 应用随后会在对应的虚拟麦克风上听到声音。
        </span>
      </div>
    </Card>
  )
}

function RouteMeter(props: { routeId: string; active: boolean }): React.JSX.Element {
  const barRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!props.active) return
    let raf = 0
    const tick = (): void => {
      if (barRef.current) {
        barRef.current.style.width = `${Math.round(audioRouter.level(props.routeId) * 100)}%`
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [props.routeId, props.active])

  return (
    <div className={`route-meter ${props.active ? '' : 'idle'}`}>
      <div ref={barRef} className="route-meter-fill" />
    </div>
  )
}
