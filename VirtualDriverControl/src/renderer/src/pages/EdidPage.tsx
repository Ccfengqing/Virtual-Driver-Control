import { useRef, useState } from 'react'
import {
  BadgeCheck,
  BadgeX,
  FileDown,
  FileUp,
  Fingerprint,
  FolderOpen,
  MonitorCheck,
  ScanEye,
  ShieldCheck,
  Workflow
} from 'lucide-react'
import { generateMonitorProfileXml, parseEdid } from '@shared/edid'
import type { ParsedEdid } from '@shared/types'
import { CieDiagram } from '@renderer/components/CieDiagram'
import { Card, Field, Toggle } from '@renderer/components/ui'
import { useDriver } from '@renderer/stores/driver'
import { useSettings } from '@renderer/stores/settings'
import { useUi } from '@renderer/stores/ui'

const SOURCE_LABEL: Record<string, string> = {
  detailed: '详细 (DTD)',
  'cea-vic': 'CEA-861 VIC',
  standard: '标准',
  established: '既有标准'
}

export function EdidPage(): React.JSX.Element {
  const [edid, setEdid] = useState<ParsedEdid | null>(null)
  const [fileName, setFileName] = useState('')
  const [bytes, setBytes] = useState<Uint8Array | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [exporting, setExporting] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  const draft = useSettings((s) => s.draft)
  const patch = useSettings((s) => s.patch)
  const busy = useDriver((s) => s.busy)
  const quickToggle = useDriver((s) => s.quickToggle)
  const toast = useUi((s) => s.toast)

  const loadFile = async (file: File): Promise<void> => {
    if (file.size > 4096) {
      toast('warning', '不是 EDID 文件', 'EDID 数据通常只有几百字节。')
      return
    }
    const buffer = new Uint8Array(await file.arrayBuffer())
    const parsed = parseEdid(buffer)
    setBytes(buffer)
    setEdid(parsed)
    setFileName(file.name)
    if (!parsed.valid && parsed.errors.length > 0) {
      toast('error', 'EDID 解析失败', parsed.errors[0])
    } else {
      toast('success', 'EDID 解码成功', `找到 ${parsed.timings.length} 个显示模式`)
    }
  }

  const exportProfile = async (): Promise<void> => {
    if (!edid || !bytes) return
    setExporting(true)
    try {
      const xml = generateMonitorProfileXml(edid)
      const result = await window.vdd.settings.saveMonitorProfile(xml, bytes)
      if (result.ok) {
        patch((d) => {
          d.edidIntegration.enabled = true
          d.edidIntegration.autoConfigureFromEdid = true
        })
        toast('success', '显示器配置已导出', '已写入 monitor_profile.xml + user_edid.bin。草稿中已启用 EDID 集成 - 请保存以持久化。')
      } else {
        toast('error', '导出失败', result.error)
      }
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="page-inner">
      <div className="page-header">
        <div>
          <h1 className="page-title">EDID 实验室</h1>
          <p className="page-subtitle">解码真实显示器的 EDID，让你的虚拟显示器模拟它们</p>
        </div>
      </div>

      <Card icon={ScanEye} title="EDID 解码器" subtitle="拖入从实体显示器抓取的 .bin / .edid / .dat 文件">
        <input
          ref={fileInput}
          type="file"
          accept=".bin,.edid,.dat,.raw"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) void loadFile(file)
            e.target.value = ''
          }}
        />
        <div
          className={`dropzone ${dragOver ? 'over' : ''}`}
          role="button"
          tabIndex={0}
          onClick={() => fileInput.current?.click()}
          onKeyDown={(e) => e.key === 'Enter' && fileInput.current?.click()}
          onDragOver={(e) => {
            e.preventDefault()
            setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragOver(false)
            const file = e.dataTransfer.files?.[0]
            if (file) void loadFile(file)
          }}
        >
          <FileUp size={28} strokeWidth={1.6} />
          <div style={{ fontWeight: 600 }}>{fileName || '将 EDID 二进制文件拖到此处'}</div>
          <div className="faint" style={{ fontSize: 12 }}>
            {fileName ? '拖入其他文件以替换' : '或点击浏览 - 支持 128/256/512 字节文件'}
          </div>
        </div>
      </Card>

      {edid && (
        <>
          <div className="card-grid two">
            <Card icon={Fingerprint} title="身份信息" subtitle={fileName}>
              <table className="data-table">
                <tbody>
                  <tr>
                    <td>显示器名称</td>
                    <td>{edid.displayName ?? '—'}</td>
                  </tr>
                  <tr>
                    <td>制造商</td>
                    <td className="mono">
                      {edid.manufacturerId} · product {edid.productCode.toString(16).toUpperCase().padStart(4, '0')}h
                    </td>
                  </tr>
                  <tr>
                    <td>序列号</td>
                    <td className="mono">{edid.serialString ?? edid.serialNumber}</td>
                  </tr>
                  <tr>
                    <td>生产日期</td>
                    <td>
                      {edid.manufactureYear}
                      {edid.manufactureWeek > 0 && edid.manufactureWeek <= 54 ? `，第 ${edid.manufactureWeek} 周` : ''}
                    </td>
                  </tr>
                  <tr>
                    <td>EDID 版本</td>
                    <td>
                      {edid.edidVersion} · {edid.extensionCount} 个扩展块
                    </td>
                  </tr>
                  <tr>
                    <td>接口</td>
                    <td>
                      {edid.digital ? `数字 (${edid.videoInterface ?? '未知'})` : '模拟'}
                      {edid.bitDepth ? ` · ${edid.bitDepth}-bit` : ''}
                    </td>
                  </tr>
                  {edid.screenWidthCm && edid.screenHeightCm && (
                    <tr>
                      <td>物理尺寸</td>
                      <td>
                        {edid.screenWidthCm}×{edid.screenHeightCm} cm (
                        {(Math.hypot(edid.screenWidthCm, edid.screenHeightCm) / 2.54).toFixed(1)}″)
                      </td>
                    </tr>
                  )}
                  <tr>
                    <td>伽马</td>
                    <td>{edid.gamma?.toFixed(2) ?? '—'}</td>
                  </tr>
                  <tr>
                    <td>校验和</td>
                    <td>
                      {edid.checksumOk ? (
                        <span className="badge ok">
                          <BadgeCheck size={11} /> 有效
                        </span>
                      ) : (
                        <span className="badge err">
                          <BadgeX size={11} /> 无效
                        </span>
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>
              <div className="row wrap" style={{ marginTop: 12, gap: 7 }}>
                {edid.hasCeaExtension && <span className="badge neutral">CEA-861</span>}
                {edid.ceaBasicAudio && <span className="badge neutral">音频</span>}
                {edid.ceaYcbcr444 && <span className="badge neutral">YCbCr 4:4:4</span>}
                {edid.ceaYcbcr422 && <span className="badge neutral">YCbCr 4:2:2</span>}
                {edid.hdr?.eotfPq && <span className="badge ok">HDR10 (PQ)</span>}
                {edid.hdr?.eotfHlg && <span className="badge ok">HLG</span>}
                {edid.hdr?.maxLuminance && <span className="badge neutral">{edid.hdr.maxLuminance} 尼特峰值</span>}
              </div>
            </Card>

            <Card icon={Workflow} title="实测色域" subtitle="EDID 中嵌入的色度坐标">
              {edid.chromaticity ? (
                <CieDiagram value={edid.chromaticity} onChange={() => undefined} disabled width={320} />
              ) : (
                <span className="faint">无色度数据</span>
              )}
            </Card>
          </div>

          <Card
            icon={MonitorCheck}
            title={`显示模式 (${edid.timings.length})`}
            subtitle={edid.preferred ? `首选：${edid.preferred.width}×${edid.preferred.height} @ ${edid.preferred.refreshHz.toFixed(2)} Hz` : undefined}
            actions={
              <button type="button" className="btn primary small" disabled={exporting} onClick={() => void exportProfile()}>
                <FileDown size={13} />
                导出配置 + EDID
              </button>
            }
          >
            <div style={{ maxHeight: 320, overflowY: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>分辨率</th>
                    <th>刷新率</th>
                    <th>来源</th>
                    <th>像素时钟</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {edid.timings.map((t, i) => (
                    <tr key={i}>
                      <td className="mono">
                        {t.width}×{t.height}
                        {t.interlaced ? 'i' : ''}
                      </td>
                      <td className="mono">{t.refreshHz.toFixed(t.refreshHz % 1 === 0 ? 0 : 3)} Hz</td>
                      <td>
                        {SOURCE_LABEL[t.source]}
                        {t.vic ? ` ${t.vic}` : ''}
                      </td>
                      <td className="mono">{t.pixelClockMHz ? `${t.pixelClockMHz.toFixed(2)} MHz` : '—'}</td>
                      <td>{t === edid.preferred && <span className="badge ok">首选</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      <div className="card-grid two">
        <Card
          icon={ShieldCheck}
          title="EDID 身份控制"
          subtitle="在线时通过驱动管道实时应用"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
            <Toggle
              checked={draft.edid.customEdid}
              disabled={busy !== null}
              onChange={(v) => void quickToggle('CUSTOMEDID', v, '自定义 EDID')}
              label="使用自定义 EDID"
              sublabel="向 Windows 提供 user_edid.bin，而非内置身份信息"
            />
            <Toggle
              checked={draft.edid.preventSpoof}
              disabled={busy !== null}
              onChange={(v) => void quickToggle('PREVENTSPOOF', v, '防伪造')}
              label="防止制造商信息伪造"
              sublabel="在提供的 EDID 中保留原始制造商 ID"
            />
            <Toggle
              checked={draft.edid.edidCeaOverride}
              disabled={busy !== null}
              onChange={(v) => void quickToggle('CEAOVERRIDE', v, 'CEA 覆盖')}
              label="CEA 扩展覆盖"
              sublabel="用驱动生成的数据替换 CEA-861 块"
            />
          </div>
        </Card>

        <Card
          icon={FolderOpen}
          title="EDID 集成"
          subtitle="根据 monitor_profile.xml 自动配置驱动"
          actions={
            <button type="button" className="btn ghost small" onClick={() => void window.vdd.system.openPath('edid')}>
              <FolderOpen size={13} /> Open folder
            </button>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
            <Toggle
              checked={draft.edidIntegration.enabled}
              onChange={(v) => patch((d) => (d.edidIntegration.enabled = v))}
              label="启用 EDID 集成"
            />
            <Toggle
              checked={draft.edidIntegration.autoConfigureFromEdid}
              onChange={(v) => patch((d) => (d.edidIntegration.autoConfigureFromEdid = v))}
              label="根据配置自动设置"
              sublabel="分辨率、色彩与 HDR 均来自配置文件"
            />
            <Toggle
              checked={draft.edidIntegration.overrideManualSettings}
              onChange={(v) => patch((d) => (d.edidIntegration.overrideManualSettings = v))}
              label="配置文件覆盖手动设置"
            />
            <Toggle
              checked={draft.edidIntegration.fallbackOnError}
              onChange={(v) => patch((d) => (d.edidIntegration.fallbackOnError = v))}
              label="出错时回退到手动设置"
            />
            <Field label="配置文件路径" hint="相对于驱动文件夹">
              <input
                type="text"
                value={draft.edidIntegration.edidProfilePath}
                onChange={(e) => patch((d) => (d.edidIntegration.edidProfilePath = e.target.value))}
              />
            </Field>
          </div>
        </Card>
      </div>
    </div>
  )
}
