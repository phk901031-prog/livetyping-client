import { useState, useEffect, useRef } from 'react'
import type { Macro } from '../types'

export interface MacroConfig {
  triggerKey: string
  jasoDeleteKey: string
  quickAddKey: string
}

interface Props {
  macros: Macro[]
  macroConfig: MacroConfig
  onAdd: (macro: Macro) => void
  onDelete: (label: string, expand: string) => void
  onConfigChange: (config: MacroConfig) => void
  onClose: () => void
}

type RecordTarget = 'trigger' | 'jasoDelete' | 'quickAdd' | null

export default function MacroPanel({ macros, macroConfig, onAdd, onDelete, onConfigChange, onClose }: Props) {
  const [label, setLabel] = useState('')
  const [expand, setExpand] = useState('')
  const [error, setError] = useState('')
  const [recording, setRecording] = useState<RecordTarget>(null)
  const [search, setSearch] = useState('')
  const expandRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!recording) return
    const handler = (e: KeyboardEvent) => {
      e.preventDefault()
      e.stopPropagation()
      if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) return
      const parts: string[] = []
      if (e.ctrlKey) parts.push('Ctrl')
      if (e.altKey) parts.push('Alt')
      if (e.shiftKey) parts.push('Shift')
      let k = e.key
      if (k === 'Process' || k === 'Unidentified') {
        k = e.code ?? ''
        if (k.startsWith('Key')) k = k.slice(3)
      }
      if (!k) return
      parts.push(k.length === 1 ? k.toUpperCase() : k)
      const keyStr = parts.join('+')
      if (recording === 'trigger') onConfigChange({ ...macroConfig, triggerKey: keyStr })
      else if (recording === 'jasoDelete') onConfigChange({ ...macroConfig, jasoDeleteKey: keyStr })
      else if (recording === 'quickAdd') onConfigChange({ ...macroConfig, quickAddKey: keyStr })
      setRecording(null)
    }
    window.addEventListener('keydown', handler, true)
    return () => window.removeEventListener('keydown', handler, true)
  }, [recording, macroConfig, onConfigChange])

  const handleAdd = () => {
    const l = label.trim()
    const e = expand.trim()
    if (!l) { setError('준말을 입력하세요.'); return }
    if (!e) { setError('치환 텍스트를 입력하세요.'); return }
    onAdd({ label: l, expand: e })
    setLabel('')
    setExpand('')
    setError('')
    expandRef.current?.focus()
  }

  // 웹 버전: 파일 다운로드로 내보내기
  const handleExport = () => {
    const lines = [
      '# LiveTyping 상용구 파일',
      `# 트리거키: ${macroConfig.triggerKey}`,
      '# 형식: 준말<TAB>치환텍스트',
      ''
    ]
    macros.forEach(m => lines.push(`${m.label}\t${m.expand}`))
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `상용구_${new Date().toISOString().slice(0, 10)}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  // 웹 버전: 파일 선택으로 불러오기
  const handleImport = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.txt'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return
      const text = await file.text()
      text.split('\n').forEach(line => {
        if (line.startsWith('#') || !line.trim()) return
        const [lbl, ...rest] = line.split('\t')
        const exp = rest.join('\t')
        if (lbl?.trim() && exp?.trim()) onAdd({ label: lbl.trim(), expand: exp.trim() })
      })
    }
    input.click()
  }

  const filtered = macros.filter(m =>
    m.label.includes(search) || m.expand.includes(search)
  )

  return (
    <aside className="macro-panel">
      <div className="macro-header">
        <span className="macro-title">상용구</span>
        <button className="btn-close" onClick={onClose}>✕</button>
      </div>

      <div className="macro-keys-section">
        <div className="key-row">
          <span className="key-row-label">상용구 트리거</span>
          <button
            className={`btn-key-capture ${recording === 'trigger' ? 'recording' : ''}`}
            onClick={() => setRecording('trigger')}
          >
            {recording === 'trigger' ? '키를 누르세요…' : macroConfig.triggerKey}
          </button>
        </div>
        <div className="key-row">
          <span className="key-row-label">단어단위 삭제</span>
          <button
            className={`btn-key-capture ${recording === 'jasoDelete' ? 'recording' : ''}`}
            onClick={() => setRecording('jasoDelete')}
          >
            {recording === 'jasoDelete' ? '키를 누르세요…' : macroConfig.jasoDeleteKey}
          </button>
        </div>
        <div className="key-row">
          <span className="key-row-label">간단등록</span>
          <button
            className={`btn-key-capture ${recording === 'quickAdd' ? 'recording' : ''}`}
            onClick={() => setRecording('quickAdd')}
          >
            {recording === 'quickAdd' ? '키를 누르세요…' : macroConfig.quickAddKey}
          </button>
        </div>
      </div>

      <div className="macro-add">
        <div className="macro-add-row">
          <input
            className="macro-input macro-input-sm"
            placeholder="준말"
            value={label}
            onChange={e => setLabel(e.target.value)}
            onKeyDown={e => e.key === 'Tab' && (e.preventDefault(), expandRef.current?.focus())}
          />
          <span className="macro-arrow-label">→</span>
          <input
            ref={expandRef}
            className="macro-input macro-input-lg"
            placeholder="치환 텍스트"
            value={expand}
            onChange={e => setExpand(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
          />
        </div>
        {error && <p className="macro-error">{error}</p>}
        <button className="btn-macro-add" onClick={handleAdd}>+ 추가</button>
      </div>

      <div className="macro-toolbar">
        <input
          className="macro-input macro-search"
          placeholder="검색…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <button className="btn-macro-io" onClick={handleExport} title="txt로 내보내기">내보내기</button>
        <button className="btn-macro-io" onClick={handleImport} title="txt에서 불러오기">불러오기</button>
      </div>

      <div className="macro-list">
        {filtered.length === 0 && (
          <p className="macro-empty">{search ? '검색 결과 없음' : '등록된 상용구가 없습니다.'}</p>
        )}
        {filtered.map((m, i) => {
          const group = macros.filter(x => x.label === m.label)
          const groupIdx = macros.slice(0, macros.indexOf(m)).filter(x => x.label === m.label).length
          return (
            <div key={`${m.label}-${i}`} className="macro-item">
              <span className="macro-trigger-badge">
                {m.label}
                {group.length > 1 && <span className="macro-cycle-badge"> {groupIdx + 1}/{group.length}</span>}
              </span>
              <span className="macro-expand-text">{m.expand}</span>
              <button className="btn-macro-del" onClick={() => onDelete(m.label, m.expand)}>✕</button>
            </div>
          )
        })}
      </div>

      <p className="macro-count">{macros.length}개 등록됨</p>
    </aside>
  )
}
