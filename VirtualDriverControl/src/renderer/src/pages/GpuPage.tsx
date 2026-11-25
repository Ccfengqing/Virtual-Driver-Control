import { useEffect } from 'react'
import { Cpu, Gpu, Loader2, RefreshCw, Zap } from 'lucide-react'
import { Card } from '@renderer/components/ui'
import { useDriver } from '@renderer/stores/driver'
import { useSettings } from '@renderer/stores/settings'
import { useUi } from '@renderer/stores/ui'

export function GpuPage(): React.JSX.Element {
  const gpus = useDriver((s) => s.gpus)
  const gpusLoading = useDriver((s) => s.gpusLoading)
  const refreshGpus = useDriver((s) => s.refreshGpus)
  const assignGpu = useDriver((s) => s.assignGpu)
  const busy = useDriver((s) => s.busy)
  const online = useDriver((s) => s.status?.pipeConnected === true)
  const assignedName = useSettings((s) => s.draft.gpu.friendlyName)
  const setPage = useUi((s) => s.setPage)

  useEffect(() => {
    if (gpus.length === 0) void refreshGpus()
  }, [gpus.length, refreshGpus])

  const isDefault = assignedName.trim().toLowerCase() === 'default'

  return (
    <div className="page-inner">
      <div className="page-header">
        <div>
          <h1 className="page-title">GPU</h1>
          <p className="page-subtitle">选择由哪个适配器渲染你的虚拟显示器</p>
        </div>
        <button type="button" className="btn small" disabled={gpusLoading} onClick={() => void refreshGpus()}>
          {gpusLoading ? <Loader2 size={13} className="spin" /> : <RefreshCw size={13} />}
          重新扫描
        </button>
      </div>

      {!online && (
        <div className="banner info">
          <Cpu size={15} />
          驱动离线 - 适配器列表来自 Windows (WMI)。分配操作将暂存到草稿配置。
        </div>
      )}

      <Card
        icon={Gpu}
        title="可用适配器"
        subtitle={online ? '由驱动通过 GETALLGPUS 枚举' : '通过 WMI 枚举'}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className={`gpu-card ${isDefault ? 'assigned' : ''}`}>
            <span className="gpu-icon">
              <Zap size={18} />
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 620 }}>系统默认</div>
              <div className="faint" style={{ fontSize: 12 }}>
                由 Windows 选择适配器（单 GPU 系统推荐）
              </div>
            </div>
            {isDefault ? (
              <span className="badge ok">已分配</span>
            ) : (
              <button type="button" className="btn small" disabled={busy !== null} onClick={() => void assignGpu('default')}>
                分配
              </button>
            )}
          </div>

          {gpus.map((gpu) => {
            const assigned = !isDefault && (gpu.assigned || gpu.name.toLowerCase() === assignedName.toLowerCase())
            return (
              <div key={gpu.name} className={`gpu-card ${assigned ? 'assigned' : ''}`}>
                <span className="gpu-icon">
                  <Gpu size={18} />
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 620, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{gpu.name}</div>
                  <div className="faint" style={{ fontSize: 12 }}>
                    {gpu.source === 'pipe' ? '由驱动报告' : '由 Windows 报告'}
                    {gpu.driverVersion ? ` · 驱动 ${gpu.driverVersion}` : ''}
                    {gpu.vramMB ? ` · ${(gpu.vramMB / 1024).toFixed(1)} GB 显存` : ''}
                  </div>
                </div>
                {assigned ? (
                  <span className="badge ok">已分配</span>
                ) : (
                  <button type="button" className="btn small" disabled={busy !== null} onClick={() => void assignGpu(gpu.name)}>
                    Assign
                  </button>
                )}
              </div>
            )
          })}

          {gpus.length === 0 && !gpusLoading && <span className="faint">未找到适配器。</span>}
        </div>
      </Card>

      <Card icon={Cpu} title="诊断" subtitle="直接查询驱动 - 结果显示在控制台">
        <div className="row wrap">
          <button
            type="button"
            className="btn small"
            disabled={!online}
            onClick={() => {
              void window.vdd.pipe.query('D3DDEVICEGPU')
              setPage('console')
            }}
          >
            D3D 设备信息
          </button>
          <button
            type="button"
            className="btn small"
            disabled={!online}
            onClick={() => {
              void window.vdd.pipe.query('GETASSIGNEDGPU')
              setPage('console')
            }}
          >
            已分配 GPU
          </button>
          <button
            type="button"
            className="btn small"
            disabled={!online}
            onClick={() => {
              void window.vdd.pipe.query('IDDCXVERSION')
              setPage('console')
            }}
          >
            IddCx 版本
          </button>
          <button
            type="button"
            className="btn small"
            disabled={!online}
            onClick={() => {
              void window.vdd.pipe.query('GETALLGPUS')
              setPage('console')
            }}
          >
            所有 GPU
          </button>
        </div>
      </Card>
    </div>
  )
}
