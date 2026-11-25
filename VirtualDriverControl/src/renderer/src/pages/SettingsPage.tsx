import { useCallback, useEffect, useState } from 'react'
import {
  Archive,
  FileCode2,
  FileText,
  FolderOpen,
  History,
  MousePointer2,
  Paintbrush,
  RotateCcw,
  Wand2
} from 'lucide-react'
import { DEFAULT_BASE_DIR, type BackupInfo } from '@shared/types'
import { Card, Field, Modal, NumberField, Segmented, Toggle } from '@renderer/components/ui'
import { useSettings } from '@renderer/stores/settings'
import { useUi } from '@renderer/stores/ui'
import { compactDiff, diffLines } from '@renderer/utils/diff'

const ACCENT_PRESETS = ['#4cc2ff', '#36c98e', '#9b7bff', '#f0a04c', '#e96bb0', '#f0566a', '#4dd4d4']

export function SettingsPage(): React.JSX.Element {
  const draft = useSettings((s) => s.draft)
  const dirty = useSettings((s) => s.dirty)
  const patch = useSettings((s) => s.patch)
  const load = useSettings((s) => s.load)
  const prefs = useUi((s) => s.prefs)
  const updatePrefs = useUi((s) => s.updatePrefs)
  const toast = useUi((s) => s.toast)

  const [xmlOpen, setXmlOpen] = useState(false)
  const [diff, setDiff] = useState<ReturnType<typeof compactDiff> | null>(null)
  const [rawXml, setRawXml] = useState('')
  const [backups, setBackups] = useState<BackupInfo[]>([])

  const refreshBackups = useCallback(async () => {
    setBackups(await window.vdd.settings.backups())
  }, [])

  useEffect(() => {
    void refreshBackups()
  }, [refreshBackups])

  const openXmlPreview = async (): Promise<void> => {
    const [current, preview] = await Promise.all([window.vdd.settings.raw(), window.vdd.settings.preview(draft)])
    setRawXml(preview)
    setDiff(dirty || current === null ? compactDiff(diffLines(current ?? '', preview)) : null)
    setXmlOpen(true)
  }

  const restoreBackup = async (backup: BackupInfo): Promise<void> => {
    const result = await window.vdd.settings.restore(backup.fileName)
    if (result.ok) {
      await load()
      await refreshBackups()
      toast('success', '备份已恢复', `${backup.fileName} 现已成为当前配置。请点击应用以重新加载驱动。`)
    } else {
      toast('error', '恢复失败', result.error)
    }
  }

  return (
    <div className="page-inner">
      <div className="page-header">
        <div>
          <h1 className="page-title">设置</h1>
          <p className="page-subtitle">驱动行为、配置文件管理与应用偏好</p>
        </div>
      </div>

      <div className="card-grid two">
        <Card icon={MousePointer2} title="光标">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
            <Toggle
              checked={draft.cursor.hardwareCursor}
              onChange={(v) => patch((d) => (d.cursor.hardwareCursor = v))}
              label="硬件光标"
              sublabel="由 GPU 合成光标（推荐）"
            />
            <Toggle
              checked={draft.cursor.alphaCursorSupport}
              onChange={(v) => patch((d) => (d.cursor.alphaCursorSupport = v))}
              label="Alpha 混合光标"
            />
            <div className="grid-2">
              <NumberField
                label="光标最大宽度"
                value={draft.cursor.cursorMaxX}
                min={16}
                max={512}
                onChange={(v) => patch((d) => (d.cursor.cursorMaxX = v))}
              />
              <NumberField
                label="光标最大高度"
                value={draft.cursor.cursorMaxY}
                min={16}
                max={512}
                onChange={(v) => patch((d) => (d.cursor.cursorMaxY = v))}
              />
            </div>
            <Field label="XOR 光标支持级别" hint="已知上游问题：会被驱动加载但不生效">
              <Segmented
                value={String(draft.cursor.xorCursorSupportLevel) as '0' | '1' | '2'}
                options={[
                  { value: '0', label: '无' },
                  { value: '1', label: '模拟' },
                  { value: '2', label: '完整' }
                ]}
                onChange={(v) => patch((d) => (d.cursor.xorCursorSupportLevel = Number(v)))}
              />
            </Field>
          </div>
        </Card>

        <Card icon={FileText} title="日志">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
            <Toggle
              checked={draft.logging.sendLogsThroughPipe}
              onChange={(v) => patch((d) => (d.logging.sendLogsThroughPipe = v))}
              label="通过管道传输日志"
              sublabel="让本应用捕获驱动的实时响应"
            />
            <Toggle
              checked={draft.logging.logging}
              onChange={(v) => patch((d) => (d.logging.logging = v))}
              label="文件日志"
              sublabel="在 Logs 文件夹中每天生成日志文件"
            />
            <Toggle
              checked={draft.logging.debugLogging}
              onChange={(v) => patch((d) => (d.logging.debugLogging = v))}
              label="调试日志"
              sublabel="警告：内容详细 - 会快速生成大文件"
            />
          </div>
        </Card>
      </div>

      <Card
        icon={Wand2}
        title="自动分辨率"
        subtitle="从 EDID 配置而非手动列表生成显示模式"
        actions={<Toggle checked={draft.autoResolutions.enabled} onChange={(v) => patch((d) => (d.autoResolutions.enabled = v))} />}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 15,
            opacity: draft.autoResolutions.enabled ? 1 : 0.45,
            pointerEvents: draft.autoResolutions.enabled ? 'auto' : 'none'
          }}
        >
          <Field label="来源优先级">
            <Segmented
              value={draft.autoResolutions.sourcePriority as 'manual' | 'edid' | 'combined'}
              options={[
                { value: 'manual', label: '手动列表' },
                { value: 'edid', label: 'EDID 模式' },
                { value: 'combined', label: '合并' }
              ]}
              onChange={(v) => patch((d) => (d.autoResolutions.sourcePriority = v))}
            />
          </Field>
          <div className="grid-4">
            <NumberField
              label="最小刷新率 (Hz)"
              value={draft.autoResolutions.edidModeFiltering.minRefreshRate}
              min={1}
              max={1000}
              onChange={(v) => patch((d) => (d.autoResolutions.edidModeFiltering.minRefreshRate = v))}
            />
            <NumberField
              label="最大刷新率 (Hz)"
              value={draft.autoResolutions.edidModeFiltering.maxRefreshRate}
              min={1}
              max={1000}
              onChange={(v) => patch((d) => (d.autoResolutions.edidModeFiltering.maxRefreshRate = v))}
            />
            <NumberField
              label="最小宽度"
              value={draft.autoResolutions.edidModeFiltering.minResolutionWidth}
              min={160}
              max={10240}
              onChange={(v) => patch((d) => (d.autoResolutions.edidModeFiltering.minResolutionWidth = v))}
            />
            <NumberField
              label="最大宽度"
              value={draft.autoResolutions.edidModeFiltering.maxResolutionWidth}
              min={160}
              max={10240}
              onChange={(v) => patch((d) => (d.autoResolutions.edidModeFiltering.maxResolutionWidth = v))}
            />
            <NumberField
              label="最小高度"
              value={draft.autoResolutions.edidModeFiltering.minResolutionHeight}
              min={120}
              max={4320}
              onChange={(v) => patch((d) => (d.autoResolutions.edidModeFiltering.minResolutionHeight = v))}
            />
            <NumberField
              label="最大高度"
              value={draft.autoResolutions.edidModeFiltering.maxResolutionHeight}
              min={120}
              max={4320}
              onChange={(v) => patch((d) => (d.autoResolutions.edidModeFiltering.maxResolutionHeight = v))}
            />
          </div>
          <Toggle
            checked={draft.autoResolutions.edidModeFiltering.excludeFractionalRates}
            onChange={(v) => patch((d) => (d.autoResolutions.edidModeFiltering.excludeFractionalRates = v))}
            label="排除小数刷新率"
            sublabel="从生成的模式中剔除 59.94 这类 NTSC 刷新率"
          />
        </div>
      </Card>

      <Card
        icon={FileCode2}
        title="配置文件"
        subtitle={`${prefs.baseDir}\\vdd_settings.xml`}
        actions={
          <>
            <button type="button" className="btn ghost small" onClick={() => void window.vdd.system.openPath('base')}>
              <FolderOpen size={13} /> 打开文件夹
            </button>
            <button type="button" className="btn small" onClick={() => void openXmlPreview()}>
              <FileCode2 size={13} /> {dirty ? '预览更改' : '查看 XML'}
            </button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="row" style={{ gap: 8 }}>
            <History size={14} style={{ color: 'var(--text-faint)' }} />
            <span className="muted" style={{ fontWeight: 580 }}>
              备份 ({backups.length})
            </span>
            <span className="faint" style={{ fontSize: 12 }}>
              每次保存前自动创建
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7, maxHeight: 220, overflowY: 'auto' }}>
            {backups.map((backup) => (
              <div key={backup.fileName} className="backup-row">
                <Archive size={14} style={{ color: 'var(--text-faint)', flexShrink: 0 }} />
                <span className="mono" style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {backup.fileName}
                </span>
                <span className="faint">{new Date(backup.createdAt).toLocaleString()}</span>
                <button type="button" className="btn ghost small" onClick={() => void restoreBackup(backup)}>
                  <RotateCcw size={12} /> 恢复
                </button>
              </div>
            ))}
            {backups.length === 0 && <span className="faint">暂无备份。</span>}
          </div>
        </div>
      </Card>

      <Card icon={Paintbrush} title="应用偏好">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Field label="主题">
            <Segmented
              value={prefs.theme}
              options={[
                { value: 'dark', label: '深色' },
                { value: 'light', label: '浅色' },
                { value: 'system', label: '跟随系统' }
              ]}
              onChange={(v) => void updatePrefs({ theme: v })}
            />
          </Field>
          <Field label="强调色">
            <div className="row wrap" style={{ gap: 8 }}>
              {ACCENT_PRESETS.map((color) => (
                <button
                  key={color}
                  type="button"
                  aria-label={`强调色 ${color}`}
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: '50%',
                    background: color,
                    border: prefs.accent === color ? '2px solid var(--text)' : '2px solid transparent',
                    boxShadow: prefs.accent === color ? `0 0 12px ${color}` : 'none'
                  }}
                  onClick={() => void updatePrefs({ accent: color })}
                />
              ))}
              <input type="color" value={prefs.accent} onChange={(e) => void updatePrefs({ accent: e.target.value })} />
            </div>
          </Field>
          <DriverFolderField />
        </div>
      </Card>

      <Modal
        open={xmlOpen}
        title={diff ? 'vdd_settings.xml 待保存的更改' : 'vdd_settings.xml'}
        icon={FileCode2}
        onClose={() => setXmlOpen(false)}
        wide
        footer={
          <button type="button" className="btn ghost" onClick={() => setXmlOpen(false)}>
            关闭
          </button>
        }
      >
        {diff ? (
          <div className="diff-view" style={{ maxHeight: '56vh' }}>
            {diff.map((line, idx) =>
              'count' in line ? (
                <div key={idx} className="diff-line ctx" style={{ opacity: 0.5, fontStyle: 'italic' }}>
                  <span className="gutter">⋯</span>
                  <span> {line.count} 行未更改</span>
                </div>
              ) : (
                <div key={idx} className={`diff-line ${line.type}`}>
                  <span className="gutter">{line.type === 'add' ? '+' : line.type === 'del' ? '−' : ''}</span>
                  <span>{line.text || ' '}</span>
                </div>
              )
            )}
          </div>
        ) : (
          <pre
            className="diff-view selectable-text"
            style={{ maxHeight: '56vh', padding: 14, whiteSpace: 'pre-wrap' }}
          >
            {rawXml}
          </pre>
        )}
      </Modal>
    </div>
  )
}

/**
 * Driver folder control. The app keeps the VDDPATH registry value (which the
 * driver reads its settings path from) and this preference in lockstep:
 * changes are written to the registry first and only applied once verified.
 */
function DriverFolderField(): React.JSX.Element {
  const prefs = useUi((s) => s.prefs)
  const setBaseDir = useUi((s) => s.setBaseDir)
  const toast = useUi((s) => s.toast)
  const load = useSettings((s) => s.load)

  const [value, setValue] = useState(prefs.baseDir)
  const [applying, setApplying] = useState(false)

  // Follow external changes (registry sync at startup, reset, etc.).
  useEffect(() => setValue(prefs.baseDir), [prefs.baseDir])

  const isDefault = prefs.baseDir.toLowerCase() === DEFAULT_BASE_DIR.toLowerCase()
  const edited = value.trim().length > 0 && value.trim().toLowerCase() !== prefs.baseDir.toLowerCase()

  const apply = async (target: string): Promise<void> => {
    setApplying(true)
    try {
      const result = await setBaseDir(target)
      if (result.ok) {
        await load()
        toast('success', '驱动文件夹已更新', `注册表和应用现在都指向 ${result.prefs.baseDir}。请重启驱动设备以生效。`)
      } else {
        toast('error', '文件夹未更改', result.error)
      }
    } finally {
      setApplying(false)
    }
  }

  return (
    <Field
      label="驱动文件夹"
      hint={`驱动从此文件夹读取 vdd_settings.xml（注册表 VDDPATH，默认 ${DEFAULT_BASE_DIR}）。应用会自动保持两者同步 - 更改时可能提示提权。现有文件不会被移动。`}
    >
      <div className="row" style={{ gap: 8 }}>
        <input
          type="text"
          value={value}
          className="mono"
          style={{ flex: 1 }}
          disabled={applying}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && edited && void apply(value.trim())}
        />
        <button type="button" className="btn small primary" disabled={!edited || applying} onClick={() => void apply(value.trim())}>
          {applying ? '应用中…' : '应用'}
        </button>
        {!isDefault && (
          <button type="button" className="btn ghost small" disabled={applying} onClick={() => void apply(DEFAULT_BASE_DIR)}>
            恢复默认
          </button>
        )}
      </div>
    </Field>
  )
}
