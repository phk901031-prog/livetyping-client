/**
 * DisplayBoard.tsx — 웹 전광판 (자막 송출용)
 *
 * URL: livesogki.vercel.app/#display?code=123456
 *
 * 사용 시나리오:
 * - OBS Studio "브라우저 소스"로 이 URL 추가 → 영상 위에 자막 오버레이
 * - 결혼식, 강연, 회의 등에서 별도 모니터에 자막 표시
 *
 * 특징:
 * - 투명 배경 지원 (OBS에서 투명하게 보임)
 * - 배경색, 글자색, 폰트 크기 등 커스터마이징
 * - 방 코드로 접속 → 읽기 전용 (입력 불가, 보기만 가능)
 * - 설정 패널 숨기기 가능 (송출 시 깔끔)
 */
import { useState, useEffect, useRef } from 'react'
import { io, Socket } from 'socket.io-client'
import type { Segment } from '../types'

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001'

interface DisplaySettings {
  bgColor: string        // 배경색
  textColor: string      // 완료된 세그먼트 글자색
  typingColor: string    // 타이핑 중인 글자색
  fontSize: number       // 글자 크기 (px)
  fontFamily: string     // 글꼴
  transparent: boolean   // 투명 배경 (OBS용)
  showCount: number      // 표시할 완료 세그먼트 수
  position: 'bottom' | 'top' | 'center'  // 자막 위치
}

const DEFAULT_SETTINGS: DisplaySettings = {
  bgColor: '#000000',
  textColor: '#ffffff',
  typingColor: '#f7c14c',
  fontSize: 44,
  fontFamily: 'Malgun Gothic',
  transparent: false,
  showCount: 3,
  position: 'bottom',
}

const FONTS = ['Malgun Gothic', '맑은 고딕', '나눔고딕', '돋움', '굴림', 'Arial', 'sans-serif']

function loadSettings(): DisplaySettings {
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem('lt_display_online') ?? '{}') }
  } catch {
    return DEFAULT_SETTINGS
  }
}

interface DisplayBoardProps {
  roomCode: string   // URL에서 파싱한 방 코드
}

export default function DisplayBoard({ roomCode }: DisplayBoardProps) {
  const [segments, setSegments] = useState<Segment[]>([])
  const [displayOrder, setDisplayOrder] = useState<number[]>([])
  const [settings, setSettings] = useState<DisplaySettings>(loadSettings)
  const [showSettings, setShowSettings] = useState(false)
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const socketRef = useRef<Socket | null>(null)

  // 설정 저장
  useEffect(() => {
    localStorage.setItem('lt_display_online', JSON.stringify(settings))
  }, [settings])

  // 소켓 연결 + 방 참여
  useEffect(() => {
    if (!roomCode) return

    const s = io(SERVER_URL, { autoConnect: true })
    socketRef.current = s

    s.on('connect', () => {
      // 전광판 전용 접속 (읽기 전용)
      s.emit('display:join', roomCode, (res: { ok: boolean; error?: string }) => {
        if (res.ok) {
          setConnected(true)
          setError('')
        } else {
          setError(res.error || '접속 실패')
        }
      })
    })

    s.on('disconnect', () => setConnected(false))

    // 세그먼트 업데이트 수신
    s.on('state:sync', (state: { segments: Segment[]; displayOrder?: number[] }) => {
      setSegments([...state.segments])
      if (state.displayOrder && state.displayOrder.length > 0) {
        setDisplayOrder([...state.displayOrder])
      }
    })

    return () => { s.disconnect() }
  }, [roomCode])

  // 자동 스크롤
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [segments])

  // 설정 변경 헬퍼
  const set = <K extends keyof DisplaySettings>(key: K, val: DisplaySettings[K]) =>
    setSettings(prev => ({ ...prev, [key]: val }))

  // 표시 순서 적용
  const orderedSegments = displayOrder.length > 0
    ? displayOrder.map(idx => segments.find(s => s.index === idx)).filter(Boolean) as Segment[]
    : segments

  // 완료된 것 최근 N개 + 타이핑 중인 것
  const completed = orderedSegments.filter(s => s.status === 'completed').slice(-settings.showCount)
  const typing = orderedSegments.filter(s => s.status === 'typing')
  const visible = [...completed, ...typing]

  // 배경 스타일
  const bgStyle = settings.transparent
    ? { background: 'transparent' }
    : { background: settings.bgColor }

  // 위치 스타일
  const positionStyle: React.CSSProperties = {
    justifyContent: settings.position === 'top' ? 'flex-start'
      : settings.position === 'center' ? 'center'
      : 'flex-end',
  }

  // 방 코드 없음
  if (!roomCode) {
    return (
      <div className="display-board display-board-error">
        <h2>전광판 모드</h2>
        <p>URL에 방 코드가 필요합니다.</p>
        <p>예: <code>#display?code=123456</code></p>
      </div>
    )
  }

  return (
    <div
      className="display-board"
      style={{ ...bgStyle, fontFamily: settings.fontFamily }}
    >
      {/* 설정 토글 버튼 (마우스 올리면 보임) */}
      <button
        className="display-settings-btn"
        onClick={() => setShowSettings(v => !v)}
        title="설정"
      >
        ⚙
      </button>

      {/* 연결 상태 */}
      {!connected && !error && (
        <div className="display-status">연결 중... (방 코드: {roomCode})</div>
      )}
      {error && (
        <div className="display-status display-error">{error}</div>
      )}

      {/* 설정 패널 */}
      {showSettings && (
        <div className="display-settings-panel">
          <h3>전광판 설정</h3>
          <div className="ds-row">
            <label>투명 배경 (OBS용)</label>
            <input type="checkbox" checked={settings.transparent}
              onChange={e => set('transparent', e.target.checked)} />
          </div>
          {!settings.transparent && (
            <div className="ds-row">
              <label>배경색</label>
              <input type="color" value={settings.bgColor}
                onChange={e => set('bgColor', e.target.value)} />
            </div>
          )}
          <div className="ds-row">
            <label>글자색</label>
            <input type="color" value={settings.textColor}
              onChange={e => set('textColor', e.target.value)} />
          </div>
          <div className="ds-row">
            <label>입력중 색상</label>
            <input type="color" value={settings.typingColor}
              onChange={e => set('typingColor', e.target.value)} />
          </div>
          <div className="ds-row">
            <label>글자 크기: {settings.fontSize}px</label>
            <input type="range" min={18} max={120} value={settings.fontSize}
              onChange={e => set('fontSize', Number(e.target.value))} />
          </div>
          <div className="ds-row">
            <label>글꼴</label>
            <select value={settings.fontFamily}
              onChange={e => set('fontFamily', e.target.value)}>
              {FONTS.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          <div className="ds-row">
            <label>표시 줄 수: {settings.showCount}</label>
            <input type="range" min={1} max={10} value={settings.showCount}
              onChange={e => set('showCount', Number(e.target.value))} />
          </div>
          <div className="ds-row">
            <label>자막 위치</label>
            <select value={settings.position}
              onChange={e => set('position', e.target.value as 'top' | 'center' | 'bottom')}>
              <option value="top">상단</option>
              <option value="center">중앙</option>
              <option value="bottom">하단</option>
            </select>
          </div>
          <div className="ds-row ds-url-info">
            <label>OBS 브라우저 소스 URL:</label>
            <code className="ds-url">{window.location.href}</code>
          </div>
          <button className="btn-ds-close" onClick={() => setShowSettings(false)}>닫기</button>
        </div>
      )}

      {/* 자막 표시 영역 */}
      <div className="display-content" style={positionStyle}>
        {visible.length === 0 && connected && (
          <p className="display-empty" style={{ color: settings.textColor, opacity: 0.3 }}>
            입력 대기 중…
          </p>
        )}
        {visible.map((seg, i) => {
          const isLast = i === visible.length - 1
          const isTyping = seg.status === 'typing'
          return (
            <div
              key={seg.index}
              className={`display-seg ${isTyping ? 'display-typing' : ''}`}
              style={{
                color: isTyping ? settings.typingColor : settings.textColor,
                fontSize: isLast ? settings.fontSize : settings.fontSize * 0.75,
                opacity: isLast ? 1 : 0.45,
                fontWeight: isLast ? 700 : 400,
              }}
            >
              {seg.content}
              {isTyping && (
                <span className="display-cursor" style={{ color: settings.typingColor }}>▊</span>
              )}
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
