/**
 * MacroPanel.tsx — 상용구 관리 패널 (📎 주머니)
 *
 * 역할:
 * - 상용구(자주 쓰는 말) 추가/삭제
 * - 단축키 설정 (트리거키, 단어삭제키, 간단등록키)
 * - 상용구 검색
 * - 파일로 내보내기/불러오기
 *
 * "상용구"란?
 * 속기사가 자주 쓰는 표현을 짧은 준말로 등록해두고,
 * 준말을 치고 트리거키(기본 F3)를 누르면 전체 표현으로 바뀌는 기능.
 * 예: "감사" → "감사합니다"
 */
import { useState, useEffect, useRef } from 'react'
import type { Macro } from '../types'

// 키 설정 타입: 어떤 키를 누르면 어떤 기능이 작동할지 정의
export interface MacroConfig {
  triggerKey: string      // 상용구 치환 키 (기본: F3)
  jasoDeleteKey: string   // 단어 단위 삭제 키 (기본: F4)
  quickAddKey: string     // 간단 등록 키 (기본: F5)
  segUpKey: string        // 위 세그먼트로 이동 키 (기본: ArrowUp)
  segDownKey: string      // 아래 세그먼트로 이동 키 (기본: ArrowDown)
}

interface Props {
  macros: Macro[]                                    // 등록된 상용구 목록
  macroConfig: MacroConfig                           // 현재 키 설정
  onAdd: (macro: Macro) => void                      // 상용구 추가 함수
  onDelete: (label: string, expand: string) => void  // 상용구 삭제 함수
  onConfigChange: (config: MacroConfig) => void      // 키 설정 변경 함수
  onClose: () => void                                // 패널 닫기 함수
}

// 키 녹음 대상: 어떤 키 설정을 바꾸고 있는지
type RecordTarget = 'trigger' | 'jasoDelete' | 'quickAdd' | 'segUp' | 'segDown' | null

export default function MacroPanel({ macros, macroConfig, onAdd, onDelete, onConfigChange, onClose }: Props) {
  // ── 입력 상태 ──────────────────────────────────────────────────
  const [label, setLabel] = useState('')        // 준말 입력값
  const [expand, setExpand] = useState('')      // 치환 텍스트 입력값
  const [error, setError] = useState('')        // 에러 메시지
  const [recording, setRecording] = useState<RecordTarget>(null) // 키 녹음 중인 대상
  const [search, setSearch] = useState('')      // 검색어
  const expandRef = useRef<HTMLInputElement>(null) // 치환 텍스트 입력칸 참조

  // ── 키 녹음 기능 ──────────────────────────────────────────────
  // "키를 누르세요…" 상태일 때, 사용자가 누른 키를 감지해서 설정에 저장
  useEffect(() => {
    if (!recording) return // 녹음 중이 아니면 아무것도 안 함
    const handler = (e: KeyboardEvent) => {
      e.preventDefault()   // 브라우저 기본 동작 방지
      e.stopPropagation()  // 다른 이벤트 리스너로 전파 방지
      // Ctrl, Alt, Shift, Meta(윈도우키)만 누른 건 무시 (조합키의 일부이므로)
      if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) return
      // 눌린 키를 "Ctrl+F3" 같은 문자열로 조합
      const parts: string[] = []
      if (e.ctrlKey) parts.push('Ctrl')
      if (e.altKey) parts.push('Alt')
      if (e.shiftKey) parts.push('Shift')
      let k = e.key
      // 한글 IME가 켜져 있으면 key가 'Process'로 올 수 있음 → code에서 가져옴
      if (k === 'Process' || k === 'Unidentified') {
        k = e.code ?? ''
        if (k.startsWith('Key')) k = k.slice(3) // 'KeyA' → 'A'
      }
      if (!k) return
      parts.push(k.length === 1 ? k.toUpperCase() : k)
      const keyStr = parts.join('+')
      // 녹음 대상에 따라 해당 키 설정 업데이트
      if (recording === 'trigger') onConfigChange({ ...macroConfig, triggerKey: keyStr })
      else if (recording === 'jasoDelete') onConfigChange({ ...macroConfig, jasoDeleteKey: keyStr })
      else if (recording === 'quickAdd') onConfigChange({ ...macroConfig, quickAddKey: keyStr })
      else if (recording === 'segUp') onConfigChange({ ...macroConfig, segUpKey: keyStr })
      else if (recording === 'segDown') onConfigChange({ ...macroConfig, segDownKey: keyStr })
      setRecording(null) // 녹음 완료
    }
    // capture: true → 다른 이벤트 리스너보다 먼저 실행
    window.addEventListener('keydown', handler, true)
    return () => window.removeEventListener('keydown', handler, true)
  }, [recording, macroConfig, onConfigChange])

  // ── 상용구 추가 ───────────────────────────────────────────────
  const handleAdd = () => {
    const l = label.trim()
    const e = expand.trim()
    if (!l) { setError('준말을 입력하세요.'); return }
    if (!e) { setError('치환 텍스트를 입력하세요.'); return }
    onAdd({ label: l, expand: e })
    setLabel('')           // 입력칸 비우기
    setExpand('')
    setError('')
    expandRef.current?.focus() // 다음 입력을 위해 포커스 이동
  }

  // ── 상용구 내보내기 (파일 다운로드) ───────────────────────────
  // 등록된 상용구를 .txt 파일로 저장
  const handleExport = () => {
    // 파일 내용 구성: 주석 + 준말\t치환텍스트 형식
    const lines = [
      '# LiveTyping 상용구 파일',
      `# 트리거키: ${macroConfig.triggerKey}`,
      '# 형식: 준말<TAB>치환텍스트',
      ''
    ]
    macros.forEach(m => lines.push(`${m.label}\t${m.expand}`))

    // Blob: 메모리에 파일을 만드는 것. 이걸 다운로드 링크에 연결
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')       // 임시 다운로드 링크 생성
    a.href = url
    a.download = `상용구_${new Date().toISOString().slice(0, 10)}.txt`
    a.click()                                    // 자동 클릭 → 다운로드 시작
    URL.revokeObjectURL(url)                     // 임시 URL 해제 (메모리 정리)
  }

  // ── 상용구 불러오기 (파일 업로드) ─────────────────────────────
  // .txt 파일을 읽어서 상용구를 추가
  const handleImport = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.txt'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return
      const text = await file.text()            // 파일 내용을 텍스트로 읽기
      text.split('\n').forEach(line => {
        if (line.startsWith('#') || !line.trim()) return // 주석이나 빈 줄은 건너뛰기
        const [lbl, ...rest] = line.split('\t') // 탭으로 구분: 준말 / 치환텍스트
        const exp = rest.join('\t')
        if (lbl?.trim() && exp?.trim()) onAdd({ label: lbl.trim(), expand: exp.trim() })
      })
    }
    input.click() // 파일 선택 대화상자 열기
  }

  // ── 검색 필터 ─────────────────────────────────────────────────
  // 준말이나 치환텍스트에 검색어가 포함된 것만 표시
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
        {/* 세그먼트 이동 키 설정 */}
        <div className="key-row">
          <span className="key-row-label">위 세그먼트</span>
          <button
            className={`btn-key-capture ${recording === 'segUp' ? 'recording' : ''}`}
            onClick={() => setRecording('segUp')}
          >
            {recording === 'segUp' ? '키를 누르세요…' : macroConfig.segUpKey}
          </button>
        </div>
        <div className="key-row">
          <span className="key-row-label">아래 세그먼트</span>
          <button
            className={`btn-key-capture ${recording === 'segDown' ? 'recording' : ''}`}
            onClick={() => setRecording('segDown')}
          >
            {recording === 'segDown' ? '키를 누르세요…' : macroConfig.segDownKey}
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
